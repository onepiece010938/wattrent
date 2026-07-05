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
  TestIds: {
    BANNER: 'ca-app-pub-3940256099942544/6300978111',
    INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  },
  MaxAdContentRating: { G: 'G', PG: 'PG', T: 'T', MA: 'MA' },
  AdsConsent: {
    requestInfoUpdate: jest.fn(async () => ({ isConsentFormAvailable: false, status: 0 })),
    showForm: jest.fn(async () => undefined),
  },
  AdsConsentStatus: { UNKNOWN: 0, REQUIRED: 1, NOT_REQUIRED: 2, OBTAINED: 3 },
  AdEventType: { LOADED: 'loaded', ERROR: 'error', OPENED: 'opened', CLOSED: 'closed' },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => ({
      load: jest.fn(),
      show: jest.fn(),
      addAdEventListener: jest.fn(() => jest.fn()),
    })),
  },
}));

// Silence the noisy "Animated: useNativeDriver" warning during tests.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), {
  virtual: true,
});

// expo-web-browser — used by expo-auth-session under the hood. Tests never
// actually open a browser, so a no-op stub is fine.
jest.mock('expo-web-browser', () => ({
  __esModule: true,
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
  dismissAuthSession: jest.fn(),
  WebBrowserResultType: { CANCEL: 'cancel', SUCCESS: 'success', DISMISS: 'dismiss' },
}));

// expo-auth-session/providers/google — by default returns a hook that says
// "not ready" and a promptAsync that resolves to a cancel. Individual tests
// can override the mock to simulate success.
jest.mock('expo-auth-session/providers/google', () => ({
  __esModule: true,
  useIdTokenAuthRequest: jest.fn(() => [
    null, // request
    null, // response
    jest.fn(async () => ({ type: 'cancel' })), // promptAsync
  ]),
  useAuthRequest: jest.fn(() => [
    null,
    null,
    jest.fn(async () => ({ type: 'cancel' })),
  ]),
}));

// expo-auth-session (top-level) — used by lib/lineAuth.ts. Default mock
// returns a not-ready request and a cancel-resolving promptAsync; tests can
// override per-suite by re-mocking useAuthRequest before importing lineAuth.
jest.mock('expo-auth-session', () => ({
  __esModule: true,
  ResponseType: { Code: 'code', Token: 'token', IdToken: 'id_token' },
  CodeChallengeMethod: { S256: 'S256', Plain: 'plain' },
  makeRedirectUri: jest.fn(() => 'wattrent://redirect'),
  useAuthRequest: jest.fn(() => [
    null, // request
    null, // response
    jest.fn(async () => ({ type: 'cancel' })), // promptAsync
  ]),
}));

// NativeWind's runtime (react-native-css-interop) destructures Appearance
// from react-native at module load. In Jest's jsdom environment Appearance
// can be undefined, so importing any file with className="" crashes with
// "Cannot read properties of undefined (reading 'getColorScheme')". We
// short-circuit the runtime to a no-op JSX runtime: className becomes a
// dead prop but the component tree still renders correctly for assertions.
jest.mock('react-native-css-interop/jsx-runtime', () => require('react/jsx-runtime'));
jest.mock('react-native-css-interop/jsx-dev-runtime', () =>
  require('react/jsx-dev-runtime'),
);

// Provide a stable `__DEV__` global. Jest sets it to true via jest-expo preset,
// but we set it explicitly so test assertions don't depend on env detection.
// eslint-disable-next-line no-undef
global.__DEV__ = true;
