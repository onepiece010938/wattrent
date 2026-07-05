// Tests for the useGoogleSignIn hook.
//
// Verifies:
//   1. Default (no firebase auth, no clientId) -> available=false, ready=false
//   2. iOS -> available=false (guideline 4.8)
//   3. Web with auth -> available=true (uses signInWithPopup)
//   4. Native with auth + clientId -> available=true
//   5. signIn() rejects with our typed errors on cancel/misconfig

import { Platform } from 'react-native';

// Hoisted holders so the firebase/auth mock can be mutated per test.
const mockState: {
  authInstance: object | null;
  signInWithPopup: jest.Mock;
  signInWithCredential: jest.Mock;
  signInResponse: { type: string; data: { idToken: string | null } | null };
} = {
  authInstance: null,
  signInWithPopup: jest.fn(async () => undefined),
  signInWithCredential: jest.fn(async () => undefined),
  signInResponse: { type: 'cancelled', data: null },
};

jest.mock('@/lib/firebase', () => ({
  __esModule: true,
  getFirebaseAuth: () => mockState.authInstance,
}));

jest.mock('firebase/auth', () => ({
  __esModule: true,
  GoogleAuthProvider: Object.assign(
    function () {
      return { providerId: 'google.com' };
    },
    {
      credential: (idToken: string) => ({ providerId: 'google.com', idToken }),
    },
  ),
  signInWithPopup: (...args: unknown[]) => mockState.signInWithPopup(...args),
  signInWithCredential: (...args: unknown[]) => mockState.signInWithCredential(...args),
}));

jest.mock('@react-native-google-signin/google-signin', () => ({
  __esModule: true,
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signIn: jest.fn(async () => mockState.signInResponse),
  },
  isSuccessResponse: (r: { type?: string } | null) => r?.type === 'success',
  isErrorWithCode: (e: unknown): e is { code: string } =>
    typeof e === 'object' && e !== null && 'code' in e,
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { google: { webClientId: null } } } },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderHook, act } = require('@testing-library/react-native');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useGoogleSignIn } = require('../googleAuth');

function setPlatform(os: 'ios' | 'android' | 'web') {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

describe('useGoogleSignIn', () => {
  beforeEach(() => {
    mockState.authInstance = null;
    mockState.signInResponse = { type: 'cancelled', data: null };
    mockState.signInWithPopup.mockClear();
    mockState.signInWithCredential.mockClear();
    delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  });

  it('reports not-available on iOS even with full config', () => {
    setPlatform('ios');
    mockState.authInstance = {};
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '123.apps.googleusercontent.com';
    const { result } = renderHook(() => useGoogleSignIn());
    expect(result.current.available).toBe(false);
    expect(result.current.ready).toBe(false);
  });

  it('reports not-available on Android without a client ID', () => {
    setPlatform('android');
    mockState.authInstance = {};
    const { result } = renderHook(() => useGoogleSignIn());
    expect(result.current.available).toBe(false);
  });

  it('is available on Android with auth + client ID', () => {
    setPlatform('android');
    mockState.authInstance = {};
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '123.apps.googleusercontent.com';
    const { result } = renderHook(() => useGoogleSignIn());
    expect(result.current.available).toBe(true);
    expect(result.current.ready).toBe(true);
  });

  it('is available on Web with auth (signInWithPopup, no clientId needed)', () => {
    setPlatform('web');
    mockState.authInstance = {};
    const { result } = renderHook(() => useGoogleSignIn());
    expect(result.current.available).toBe(true);
    expect(result.current.ready).toBe(true);
  });

  it('signIn() on Web calls Firebase signInWithPopup', async () => {
    setPlatform('web');
    mockState.authInstance = { fake: 'auth' };
    const { result } = renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signIn();
    });
    expect(mockState.signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it('signIn() on Android with cancelled prompt throws "auth.signInCancelled"', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '123.apps.googleusercontent.com';
    mockState.signInResponse = { type: 'cancelled', data: null };
    const { result } = renderHook(() => useGoogleSignIn());
    await expect(result.current.signIn()).rejects.toThrow('auth.signInCancelled');
  });

  it('signIn() on Android success exchanges id_token via signInWithCredential', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '123.apps.googleusercontent.com';
    mockState.signInResponse = { type: 'success', data: { idToken: 'fake-id-token' } };
    const { result } = renderHook(() => useGoogleSignIn());
    await act(async () => {
      await result.current.signIn();
    });
    expect(mockState.signInWithCredential).toHaveBeenCalledTimes(1);
  });

  it('signIn() on Android without clientId throws "auth.google.misconfigured"', async () => {
    setPlatform('android');
    mockState.authInstance = { fake: 'auth' };
    // No EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID
    const { result } = renderHook(() => useGoogleSignIn());
    await expect(result.current.signIn()).rejects.toThrow('auth.google.misconfigured');
  });
});
