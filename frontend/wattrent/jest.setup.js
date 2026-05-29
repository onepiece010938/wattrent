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

// Silence the noisy "Animated: useNativeDriver" warning during tests.
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}), {
  virtual: true,
});

// Provide a stable `__DEV__` global. Jest sets it to true via jest-expo preset,
// but we set it explicitly so test assertions don't depend on env detection.
// eslint-disable-next-line no-undef
global.__DEV__ = true;
