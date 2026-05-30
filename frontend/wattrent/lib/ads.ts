// AdMob initialisation + ad unit resolver.
//
// We use react-native-google-mobile-ads (Invertase). This file centralises:
//   1. Whether ads are available at all on this platform / runtime.
//   2. Which ad unit IDs to use (real vs Google test IDs vs hidden).
//   3. The one-shot init that wires consent (UMP) + ATT.
//
// Test IDs (Google-provided, always safe to call, never count as invalid
// traffic) live in the SDK constants. We use them automatically in __DEV__
// and any time the env vars are unset, so a misconfigured production build
// won't accidentally violate AdMob policy by serving on uninitialised IDs.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import telemetry from '@/lib/telemetry';

// react-native-google-mobile-ads only runs on iOS / Android native. On Web
// (and inside Jest where the native module isn't wired up) we bail out early
// and let the rest of the app degrade gracefully.
const SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

interface AdsConfig {
  androidBanner: string | null;
  iosBanner: string | null;
}

function readConfig(): AdsConfig {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const ads = (extra?.ads as Record<string, string | null> | undefined) ?? {};
  return {
    androidBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || ads.androidBanner || null,
    iosBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || ads.iosBanner || null,
  };
}

/**
 * Resolve the banner ad unit ID for the current platform.
 *
 * - Returns Google's official test ID in __DEV__ (always safe).
 * - Returns the configured real ID in production.
 * - Returns null when the SDK isn't supported (Web, Jest) so callers can
 *   render nothing.
 */
export function getBannerAdUnitId(): string | null {
  if (!SUPPORTED) return null;
  // Lazy-require so Web / Jest never touch the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TestIds } = require('react-native-google-mobile-ads');
  if (__DEV__) return TestIds.BANNER as string;
  const cfg = readConfig();
  const real = Platform.OS === 'ios' ? cfg.iosBanner : cfg.androidBanner;
  return real || (TestIds.BANNER as string);
}

/**
 * True when banner ads should actually render. False on Web / Jest.
 */
export function areAdsAvailable(): boolean {
  return SUPPORTED;
}

let initPromise: Promise<void> | null = null;

/**
 * One-shot init: requests ATT on iOS 14+, requests UMP (GDPR) consent, then
 * initialises the Mobile Ads SDK. Idempotent — call as early in app startup
 * as you can.
 */
export async function initAds(): Promise<void> {
  if (!SUPPORTED) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('react-native-google-mobile-ads');
      const mobileAds = mod.default ?? mod;
      const { AdsConsent, AdsConsentStatus, MaxAdContentRating } = mod;

      // 1. Request UMP (GDPR) consent. AdsConsent silently no-ops in regions
      //    where consent isn't required (e.g. Taiwan default).
      try {
        const info = await AdsConsent.requestInfoUpdate();
        if (
          info?.isConsentFormAvailable &&
          (info.status === AdsConsentStatus.REQUIRED || info.status === AdsConsentStatus.UNKNOWN)
        ) {
          await AdsConsent.showForm();
        }
      } catch (err) {
        // Consent failures shouldn't kill ads entirely; SDK will fall back
        // to non-personalised ads automatically.
        telemetry.captureException(err, { scope: 'ads.consent' });
      }

      // 2. Configure default request settings before init. We mark TFUA / TFCD
      //    false (general audience, no kids). maxAdContentRating="T" keeps
      //    things broadly appropriate.
      await mobileAds().setRequestConfiguration({
        maxAdContentRating: MaxAdContentRating.T,
        tagForChildDirectedTreatment: false,
        tagForUnderAgeOfConsent: false,
      });

      // 3. Initialise the SDK. Returns once adapters are ready.
      await mobileAds().initialize();
    } catch (err) {
      telemetry.captureException(err, { scope: 'ads.init' });
    }
  })();
  return initPromise;
}
