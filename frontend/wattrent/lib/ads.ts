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
  androidInterstitial: string | null;
  iosInterstitial: string | null;
}

function readConfig(): AdsConfig {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const ads = (extra?.ads as Record<string, string | null> | undefined) ?? {};
  return {
    androidBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID || ads.androidBanner || null,
    iosBanner: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS || ads.iosBanner || null,
    androidInterstitial:
      process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || ads.androidInterstitial || null,
    iosInterstitial:
      process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS || ads.iosInterstitial || null,
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

// ---------------------------------------------------------------------------
// Interstitial — full-screen ad shown at natural transition points
// (currently: after a bill is successfully created in capture.tsx).
// ---------------------------------------------------------------------------

/**
 * Resolve the interstitial ad unit ID for the current platform.
 * Same policy as the banner: Google TestIds in __DEV__, configured real ID
 * in production, falls back to test ID when nothing is configured, returns
 * null when the SDK isn't supported (Web / Jest).
 */
export function getInterstitialAdUnitId(): string | null {
  if (!SUPPORTED) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TestIds } = require('react-native-google-mobile-ads');
  if (__DEV__) return TestIds.INTERSTITIAL as string;
  const cfg = readConfig();
  const real = Platform.OS === 'ios' ? cfg.iosInterstitial : cfg.androidInterstitial;
  return real || (TestIds.INTERSTITIAL as string);
}

// Singleton state for the currently-loaded interstitial. Interstitials are
// one-shot: each instance can only be shown once. We keep the latest preloaded
// instance ready in memory so show() returns instantly.
type InterstitialAdInstance = {
  load: () => void;
  show: () => void;
  addAdEventListener: (event: string, listener: (...args: unknown[]) => void) => () => void;
};
let interstitialInstance: InterstitialAdInstance | null = null;
let interstitialLoaded = false;
let interstitialLoading = false;
let lastInterstitialShownAt = 0;
// Minimum time between two interstitial showings. Defensive against rapid
// retries / double-tap. WattRent is a once-a-month app so this almost never
// kicks in in real usage; it's purely a safety net.
const INTERSTITIAL_COOLDOWN_MS = 60_000;

/**
 * Preload an interstitial so the next call to maybeShowInterstitialAd() can
 * show instantly. Idempotent. Call this on a screen that will soon trigger
 * an ad (interstitial download takes 3-5s — preloading hides the latency).
 * Fire-and-forget; safe on Web / Jest where it no-ops.
 */
export async function prefetchInterstitial(): Promise<void> {
  if (!SUPPORTED) return;
  if (interstitialLoaded || interstitialLoading) return;
  // Ensure the SDK is initialised before requesting an ad.
  await initAds();
  const unitId = getInterstitialAdUnitId();
  if (!unitId) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { InterstitialAd, AdEventType } = require('react-native-google-mobile-ads');
    interstitialLoading = true;
    const ad: InterstitialAdInstance = InterstitialAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });
    interstitialInstance = ad;
    const unsubLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      interstitialLoaded = true;
      interstitialLoading = false;
      unsubLoaded();
    });
    const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
      interstitialLoaded = false;
      interstitialLoading = false;
      interstitialInstance = null;
      telemetry.captureException(err, { scope: 'ads.interstitial.load' });
      unsubError();
    });
    ad.load();
  } catch (err) {
    interstitialLoading = false;
    interstitialInstance = null;
    telemetry.captureException(err, { scope: 'ads.interstitial.prefetch' });
  }
}

/**
 * Show the preloaded interstitial if one is ready and the cooldown has
 * elapsed. Resolves once the ad is closed (or immediately on no-op).
 * After showing, automatically pre-fetches the next interstitial so it's
 * ready for the user's next workflow.
 *
 * Caller pattern: await right before navigation so the ad bridges the
 * "task complete" → "next screen" transition naturally.
 */
export async function maybeShowInterstitialAd(): Promise<void> {
  if (!SUPPORTED) return;
  if (!interstitialLoaded || !interstitialInstance) return;
  const now = Date.now();
  if (now - lastInterstitialShownAt < INTERSTITIAL_COOLDOWN_MS) return;
  const ad = interstitialInstance;
  // Mark consumed up-front so re-entrant calls (rapid double-tap) are no-ops.
  interstitialLoaded = false;
  interstitialInstance = null;
  lastInterstitialShownAt = now;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AdEventType } = require('react-native-google-mobile-ads');
    await new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        resolve();
      };
      const unsubClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
        unsubClosed();
        finish();
      });
      const unsubError = ad.addAdEventListener(AdEventType.ERROR, (err: unknown) => {
        unsubError();
        telemetry.captureException(err, { scope: 'ads.interstitial.show' });
        finish();
      });
      // Safety timeout — never block UX more than 8s waiting for an event.
      // Real ad close events fire within milliseconds of the user dismissing.
      setTimeout(finish, 8_000);
      try {
        ad.show();
      } catch (err) {
        telemetry.captureException(err, { scope: 'ads.interstitial.show.sync' });
        finish();
      }
    });
  } finally {
    // Fire-and-forget reload so the next workflow has an ad waiting.
    void prefetchInterstitial();
  }
}
