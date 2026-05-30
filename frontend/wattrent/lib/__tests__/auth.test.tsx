// Tests for the AuthProvider in bypass mode (no Firebase config).
//
// In Jest there are no EXPO_PUBLIC_FIREBASE_* env vars so isFirebaseConfigured
// returns false. __DEV__ is true (set in jest.setup.js), so AuthProvider falls
// into "bypass" mode and exposes a synthetic dev user without ever touching
// the firebase/auth module.

import React from 'react';
import { Text } from 'react-native';
import { renderHook, render, act } from '@testing-library/react-native';

// Mock firebase/auth so importing AuthProvider doesn't load the real SDK.
jest.mock('firebase/auth', () => ({
  __esModule: true,
  onAuthStateChanged: jest.fn(() => () => undefined),
  signInWithEmailAndPassword: jest.fn(async () => ({ user: null })),
  createUserWithEmailAndPassword: jest.fn(async () => ({ user: null })),
  sendPasswordResetEmail: jest.fn(async () => undefined),
  signOut: jest.fn(async () => undefined),
  updateProfile: jest.fn(async () => undefined),
  deleteUser: jest.fn(async () => undefined),
  getAuth: jest.fn(() => null),
  initializeAuth: jest.fn(() => null),
}));

// Mock api / settings token-provider setters so AuthProvider's useEffect runs
// without crashing on missing methods.
jest.mock('@/services/api', () => ({
  __esModule: true,
  default: {
    setAuthTokenProvider: jest.fn(),
    bootstrapUser: jest.fn(async () => undefined),
  },
}));
jest.mock('@/services/settings', () => ({
  __esModule: true,
  setAuthTokenProvider: jest.fn(),
}));

// Mock firebase config helper so isFirebaseConfigured returns false in tests.
jest.mock('@/lib/firebase', () => ({
  __esModule: true,
  getFirebaseAuth: () => null,
  isFirebaseConfigured: () => false,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AuthProvider, useAuth } = require('../auth');

describe('AuthProvider (bypass mode)', () => {
  it('exposes a synthetic dev user immediately', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.mode).toBe('bypass');
    expect(result.current.status).toBe('signedIn');
    expect(result.current.user?.uid).toBe('dev-user');
    expect(result.current.user?.email).toBe('dev@example.com');
  });

  it('signOut is a no-op in bypass mode and resolves', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => {
      await result.current.signOut();
    });
    // Still signed-in (no auth to sign out of).
    expect(result.current.status).toBe('signedIn');
  });

  it('signIn throws "auth.not_configured" in bypass mode (no firebase)', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(result.current.signIn('a@b.com', 'pw')).rejects.toThrow('auth.not_configured');
  });

  it('useAuth throws when called outside <AuthProvider>', () => {
    function Consumer() {
      useAuth();
      return <Text>x</Text>;
    }
    // React 19 logs a console error around the throw; silence the noise.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Consumer />)).toThrow(/useAuth must be used inside/);
    spy.mockRestore();
  });
});
