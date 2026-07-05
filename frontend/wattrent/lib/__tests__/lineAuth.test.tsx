// Tests for the useLineSignIn hook.
//
// Verifies:
//   1. iOS  -> hidden (Apple sign-in not shipped yet, Guideline 4.8)
//   2. No channelId -> available=false
//   3. Android + channelId + auth -> available + ready
//   4. signIn() cancelled  -> rejects "auth.signInCancelled"
//   5. signIn() success    -> POSTs to backend then signInWithCustomToken
//   6. signIn() with no channelId -> rejects "auth.line.misconfigured"

import { Platform } from 'react-native';

const mockState: {
  authInstance: object | null;
  signInWithCustomToken: jest.Mock;
  exchangeLine: jest.Mock;
  promptResult: { type: string; params?: Record<string, string> } | null;
  request: { codeVerifier?: string } | null;
} = {
  authInstance: null,
  signInWithCustomToken: jest.fn(async () => undefined),
  exchangeLine: jest.fn(async () => 'fake-custom-token'),
  promptResult: { type: 'cancel' },
  request: { codeVerifier: 'verifier-from-pkce' },
};

jest.mock('@/lib/firebase', () => ({
  __esModule: true,
  getFirebaseAuth: () => mockState.authInstance,
}));

jest.mock('firebase/auth', () => ({
  __esModule: true,
  signInWithCustomToken: (...args: unknown[]) => mockState.signInWithCustomToken(...args),
}));

jest.mock('@/services/api', () => ({
  __esModule: true,
  default: {
    exchangeLine: (...args: unknown[]) => mockState.exchangeLine(...args),
  },
}));

jest.mock('expo-auth-session', () => ({
  __esModule: true,
  ResponseType: { Code: 'code' },
  CodeChallengeMethod: { S256: 'S256' },
  makeRedirectUri: jest.fn(() => 'wattrent://redirect'),
  useAuthRequest: () => [
    mockState.request,
    null,
    jest.fn(async () => mockState.promptResult),
  ],
}));

jest.mock('expo-web-browser', () => ({
  __esModule: true,
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { line: { channelId: null } } } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderHook, act } = require('@testing-library/react-native');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useLineSignIn } = require('../lineAuth');

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('useLineSignIn', () => {
  beforeEach(() => {
    mockState.authInstance = null;
    mockState.promptResult = { type: 'cancel' };
    mockState.request = { codeVerifier: 'verifier-from-pkce' };
    mockState.signInWithCustomToken.mockClear();
    mockState.exchangeLine.mockClear();
    mockState.exchangeLine.mockResolvedValue('fake-custom-token');
    delete process.env.EXPO_PUBLIC_LINE_CHANNEL_ID;
  });

  it('is hidden on iOS even when fully configured', () => {
    setPlatform('ios');
    mockState.authInstance = {};
    process.env.EXPO_PUBLIC_LINE_CHANNEL_ID = '1234567890';
    const { result } = renderHook(() => useLineSignIn());
    expect(result.current.available).toBe(false);
    expect(result.current.ready).toBe(false);
  });

  it('is not available on Android without a channel ID', () => {
    setPlatform('android');
    mockState.authInstance = {};
    const { result } = renderHook(() => useLineSignIn());
    expect(result.current.available).toBe(false);
  });

  it('is available on Android with auth + channel ID', () => {
    setPlatform('android');
    mockState.authInstance = {};
    process.env.EXPO_PUBLIC_LINE_CHANNEL_ID = '1234567890';
    const { result } = renderHook(() => useLineSignIn());
    expect(result.current.available).toBe(true);
    expect(result.current.ready).toBe(true);
  });

  it('signIn() with cancelled prompt throws "auth.signInCancelled"', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    process.env.EXPO_PUBLIC_LINE_CHANNEL_ID = '1234567890';
    mockState.promptResult = { type: 'cancel' };
    const { result } = renderHook(() => useLineSignIn());
    await expect(result.current.signIn()).rejects.toThrow('auth.signInCancelled');
    expect(mockState.exchangeLine).not.toHaveBeenCalled();
  });

  it('signIn() success calls backend exchangeLine then Firebase signInWithCustomToken', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    process.env.EXPO_PUBLIC_LINE_CHANNEL_ID = '1234567890';
    mockState.promptResult = { type: 'success', params: { code: 'auth-code-from-line' } };
    const { result } = renderHook(() => useLineSignIn());
    await act(async () => {
      await result.current.signIn();
    });
    expect(mockState.exchangeLine).toHaveBeenCalledWith(
      'auth-code-from-line',
      'verifier-from-pkce',
      'wattrent://redirect',
    );
    expect(mockState.signInWithCustomToken).toHaveBeenCalledTimes(1);
    expect(mockState.signInWithCustomToken).toHaveBeenCalledWith({ fake: 'auth' }, 'fake-custom-token');
  });

  it('signIn() without channelId throws "auth.line.misconfigured"', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    const { result } = renderHook(() => useLineSignIn());
    await expect(result.current.signIn()).rejects.toThrow('auth.line.misconfigured');
  });
});
