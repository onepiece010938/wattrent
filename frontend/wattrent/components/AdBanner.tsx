// AdBanner — a single self-contained banner ad component.
//
// Drop <AdBanner /> at the bottom of any screen. It:
//   - Renders nothing on Web / Jest (no native module there).
//   - Renders nothing if no ad unit ID can be resolved (defensive).
//   - Reserves layout space for the banner so the screen doesn't jump when
//     the ad finishes loading.
//   - Logs load failures via telemetry (non-fatal — banner just stays empty).
//
// Uses adaptive anchored banner sizing (Google's recommended modern format)
// so the height adjusts to screen width and device class.

import React from 'react';
import { View, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { areAdsAvailable, getBannerAdUnitId } from '@/lib/ads';
import telemetry from '@/lib/telemetry';

interface AdBannerProps {
  /**
   * When true, applies the device's bottom safe-area inset as bottom padding.
   * Pass true when the banner sits below a ScrollView with no tab bar; pass
   * false (default) when it sits inside the (tabs) group whose tab bar
   * already handles the inset.
   */
  withSafeArea?: boolean;
}

export default function AdBanner({ withSafeArea = false }: AdBannerProps) {
  const insets = useSafeAreaInsets();

  if (!areAdsAvailable()) return null;
  const unitId = getBannerAdUnitId();
  if (!unitId) return null;

  // Lazy-require inside the component so Web bundles never try to resolve
  // the native module. Wrapped in try/catch in case the SDK was uninstalled
  // / unavailable at runtime (e.g. Expo Go).
  let BannerAd: React.ComponentType<{
    unitId: string;
    size: string;
    onAdFailedToLoad?: (err: unknown) => void;
  }> | null = null;
  let BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: string } | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-google-mobile-ads');
    BannerAd = mod.BannerAd;
    BannerAdSize = mod.BannerAdSize;
  } catch {
    return null;
  }
  if (!BannerAd || !BannerAdSize) return null;

  // Reserve ~ 50-90 px of layout. The exact height comes from the native
  // ad once it loads; this is a sensible upper bound so screens don't jump.
  const reservedHeight = Platform.OS === 'ios' ? 60 : 60;

  return (
    <View
      className="w-full items-center justify-center bg-transparent"
      style={{
        minHeight: reservedHeight,
        paddingBottom: withSafeArea ? insets.bottom : 0,
      }}
    >
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdFailedToLoad={(err) => {
          telemetry.captureException(err, { scope: 'ads.banner' });
        }}
      />
    </View>
  );
}
