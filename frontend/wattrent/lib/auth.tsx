// Auth context: single source of truth for "who is signed in".
//
// Wiring done here:
//   1. Subscribe to onAuthStateChanged from Firebase.
//   2. Inject a token provider into the API services so every request carries
//      Authorization: Bearer <id token>. Tokens auto-refresh roughly every
//      hour; getIdToken() handles that for us.
//   3. Tag Sentry with the verified uid (so issues are grouped per user).
//   4. POST /api/v1/users/me to bootstrap the Firestore user doc on first
//      successful sign-in (idempotent).
//
// AUTH_BYPASS local-dev mode:
//   When isFirebaseConfigured() returns false (i.e. EXPO_PUBLIC_FIREBASE_*
//   env vars are unset, typically when developing against a backend running
//   AUTH_BYPASS=true), we expose a synthetic "bypass user" so the UI flows
//   work without forcing every developer to wire up Firebase. The token
//   provider returns null and the backend's AUTH_BYPASS=true accepts the
//   call anyway. Never ship a build with AUTH_BYPASS to production.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  type User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile as fbUpdateProfile,
} from 'firebase/auth';

import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import apiService from '@/services/api';
import { setAuthTokenProvider as setSettingsAuthTokenProvider } from '@/services/settings';
import { setUserAdFree } from '@/lib/ads';
import telemetry from '@/lib/telemetry';

export type AuthMode = 'firebase' | 'bypass' | 'disabled';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextValue {
  user: AuthUser | null;
  /**
   * - 'initializing' = first onAuthStateChanged hasn't fired yet
   * - 'signedOut'    = no current user
   * - 'signedIn'     = user is signed in (or in bypass mode)
   */
  status: 'initializing' | 'signedOut' | 'signedIn';
  mode: AuthMode;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName?: string): Promise<void>;
  sendReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
}

const Context = createContext<AuthContextValue | null>(null);

function fromFirebaseUser(u: FirebaseUser): AuthUser {
  return {
    uid: u.uid,
    email: u.email,
    displayName: u.displayName,
    photoURL: u.photoURL,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = getFirebaseAuth();
  const configured = isFirebaseConfigured();

  // bypass mode: no Firebase config + we are in dev — backend will accept
  // any request with AUTH_BYPASS=true.
  const bypassMode = !configured && __DEV__;
  const mode: AuthMode = configured ? 'firebase' : bypassMode ? 'bypass' : 'disabled';

  const [user, setUser] = useState<AuthUser | null>(
    bypassMode
      ? { uid: 'dev-user', email: 'dev@example.com', displayName: 'Dev User', photoURL: null }
      : null,
  );
  const [status, setStatus] = useState<AuthContextValue['status']>(
    bypassMode ? 'signedIn' : 'initializing',
  );

  // 1. Token provider — invoked by api.ts on every request. Returns null in
  //    bypass mode so the backend short-circuits via AUTH_BYPASS.
  useEffect(() => {
    const provider = async (): Promise<string | null> => {
      if (!auth?.currentUser) return null;
      try {
        // false = do not force refresh; SDK refreshes ~ every hour automatically.
        return await auth.currentUser.getIdToken(false);
      } catch (err) {
        telemetry.captureException(err, { scope: 'auth.getIdToken' });
        return null;
      }
    };
    apiService.setAuthTokenProvider(provider);
    setSettingsAuthTokenProvider(provider);
  }, [auth]);

  // 2. Subscribe to auth state changes.
  useEffect(() => {
    if (!auth) {
      // bypass / disabled — nothing to subscribe to.
      return;
    }
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const u = fromFirebaseUser(fbUser);
        setUser(u);
        setStatus('signedIn');
        telemetry.setUser(u.uid);
        // Bootstrap user doc (idempotent — backend upserts). Failure is
        // non-fatal; we let the user keep using the app and surface in Sentry.
        try {
          await apiService.bootstrapUser({
            displayName: u.displayName ?? '',
            photoURL: u.photoURL ?? '',
          });
          // Fetch the ad-free entitlement (paying customers / owner accounts)
          // and suppress ads accordingly. Non-fatal; defaults to showing ads.
          try {
            const me = await apiService.getMe();
            setUserAdFree(!!me?.adFree);
          } catch {
            setUserAdFree(false);
          }
        } catch (err) {
          telemetry.captureException(err, { scope: 'auth.bootstrapUser' });
        }
      } else {
        setUser(null);
        setStatus('signedOut');
        setUserAdFree(false);
        telemetry.setUser(null);
      }
    });
    return unsub;
  }, [auth]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('auth.not_configured');
    await signInWithEmailAndPassword(auth, email, password);
  }, [auth]);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    if (!auth) throw new Error('auth.not_configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && cred.user) {
      try {
        await fbUpdateProfile(cred.user, { displayName });
      } catch (err) {
        telemetry.captureException(err, { scope: 'auth.updateProfile' });
      }
    }
  }, [auth]);

  const sendReset = useCallback(async (email: string) => {
    if (!auth) throw new Error('auth.not_configured');
    await sendPasswordResetEmail(auth, email);
  }, [auth]);

  const signOut = useCallback(async () => {
    if (!auth) {
      // bypass mode — nothing to sign out of.
      return;
    }
    await fbSignOut(auth);
  }, [auth]);

  const deleteAccount = useCallback(async () => {
    // The backend owns the cascade delete: it removes the user's Firestore
    // data, meter photos, and the Firebase Auth login itself (via the Admin
    // SDK, which — unlike client-side deleteUser — needs no recent re-auth).
    // Run it while we still hold a valid ID token, then clear the local
    // session so onAuthStateChanged routes back to the sign-in screen.
    await apiService.deleteAccount();
    if (auth) {
      await fbSignOut(auth);
    }
  }, [auth]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, mode, signIn, signUp, sendReset, signOut, deleteAccount }),
    [user, status, mode, signIn, signUp, sendReset, signOut, deleteAccount],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
