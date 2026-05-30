// Jest setup — runs before every test file.
//
// Mocks here cover modules that don't work under jsdom (native bridges) or
// that we never want to actually invoke from tests (Sentry, Constants).

// AsyncStorage — official in-memory mock shipped with the package.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// expo-constants — return a minimal shape so resolveApiUrl etc. don't crash.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {},
    },
  },
}));

// expo-image-manipulator — return a deterministic fake so compressForOcr
// can run without a real native module.
jest.mock('expo-image-manipulator', () => ({
  __esModule: true,
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  manipulateAsync: jest.fn(async () => ({
    uri: 'file:///tmp/fake-compressed.jpg',
    width: 1024,
    height: 768,
    base64: 'SGVsbG8=', // "Hello"
  })),
}));

// @sentry/react-native — no-op so SentryTelemetry tests don't need the native module.
jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn((cb) => cb({ setContext: jest.fn() })),
  wrap: (c) => c,
}));

// react-native-google-mobile-ads — no-op so AdBanner / ads.ts tests don't
// touch the native module. Components rendered in tests just return null
// because Platform.OS defaults to 'ios' but the require() inside returns
// these stubs; ads.ts guards on the absence of TestIds.
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({
    initialize: jest.fn(async () => undefined),
    setRequestConfiguration: jest.fn(async () => undefined),
  }),
  BannerAd: () => null,
  BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER' },
  TestIds: { BANNER: 'ca-app-pub-3940256099942544/6300978111' },
  MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
  AdsConsent: {
    requestInfoUpdate: jest.fn(async () => ({ isConsentFormAvailable: false, status: 0 })),
    showForm: jest.fn(async () => undefined),
  },
  AdsConsentStatus: { UNKNOWN: 0, REQUIRED: 1, NOT_REQUIRED: 2, OBTAINED: 3 },
}));

// Silence the noisy "Animated: useNativeDriver" warning during tests.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), {
  virtual: true,
});

// Provide a stable `__DEV__` global. Jest sets it to true via jest-expo preset,
// but we set it explicitly so test assertions don't depend on env detection.
// eslint-disable-next-line no-undef
global.__DEV__ = true;
