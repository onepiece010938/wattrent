// Tests for lib/ads — the AdMob helper layer.
//
// We rely on jest.setup.js mocking 'react-native-google-mobile-ads' with stub
// values for TestIds / AdsConsent so these tests don't touch a native module.

describe('lib/ads (default ios runtime)', () => {
  beforeEach(() => {
    jest.resetModules();
    // eslint-disable-next-line no-undef
    (global as unknown as { __DEV__: boolean }).__DEV__ = true;
  });

  it('areAdsAvailable returns true on iOS (jest-expo defaults Platform.OS=ios)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { areAdsAvailable } = require('../ads');
    expect(areAdsAvailable()).toBe(true);
  });

  it('getBannerAdUnitId returns Google TestIds.BANNER in __DEV__', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBannerAdUnitId } = require('../ads');
    expect(getBannerAdUnitId()).toBe('ca-app-pub-3940256099942544/6300978111');
  });

  it('getBannerAdUnitId still returns TestIds.BANNER in prod when env unset', () => {
    // eslint-disable-next-line no-undef
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    delete process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS;
    delete process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBannerAdUnitId } = require('../ads');
    expect(getBannerAdUnitId()).toBe('ca-app-pub-3940256099942544/6300978111');
  });

  it('getBannerAdUnitId prefers EXPO_PUBLIC_ADMOB_BANNER_IOS in prod on iOS', () => {
    // eslint-disable-next-line no-undef
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS = 'ca-app-pub-9999/ios-banner';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBannerAdUnitId } = require('../ads');
    expect(getBannerAdUnitId()).toBe('ca-app-pub-9999/ios-banner');
    delete process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS;
  });

  it('initAds resolves and is idempotent', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { initAds } = require('../ads');
    await expect(initAds()).resolves.toBeUndefined();
    // 2nd call should hit the cached promise (no throw, same return).
    await expect(initAds()).resolves.toBeUndefined();
  });

  it('getInterstitialAdUnitId returns Google TestIds.INTERSTITIAL in __DEV__', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInterstitialAdUnitId } = require('../ads');
    expect(getInterstitialAdUnitId()).toBe('ca-app-pub-3940256099942544/1033173712');
  });

  it('getInterstitialAdUnitId prefers EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS in prod on iOS', () => {
    // eslint-disable-next-line no-undef
    (global as unknown as { __DEV__: boolean }).__DEV__ = false;
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS = 'ca-app-pub-9999/ios-interstitial';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getInterstitialAdUnitId } = require('../ads');
    expect(getInterstitialAdUnitId()).toBe('ca-app-pub-9999/ios-interstitial');
    delete process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS;
  });

  it('prefetchInterstitial + maybeShowInterstitialAd are safe no-ops when no ad is loaded', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { prefetchInterstitial, maybeShowInterstitialAd } = require('../ads');
    // jest mock's load() never fires a LOADED event, so the ad never becomes
    // ready — maybeShow must short-circuit and resolve immediately.
    await expect(prefetchInterstitial()).resolves.toBeUndefined();
    await expect(maybeShowInterstitialAd()).resolves.toBeUndefined();
  });
});

describe('lib/ads on web', () => {
  // Web test is isolated so the Platform.OS override doesn't leak into the
  // describe block above.
  it('areAdsAvailable / getBannerAdUnitId return false/null on web', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native', () => ({
        __esModule: true,
        Platform: {
          OS: 'web',
          select: (m: Record<string, unknown>) => m.web ?? m.default,
        },
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { areAdsAvailable, getBannerAdUnitId } = require('../ads');
      expect(areAdsAvailable()).toBe(false);
      expect(getBannerAdUnitId()).toBeNull();
    });
  });
});
