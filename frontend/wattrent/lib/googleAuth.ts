// Google sign-in hook — wraps Firebase Auth + the native Google Sign-In SDK
// (@react-native-google-signin/google-signin) on Android, and Firebase's
// signInWithPopup on Web.
//
// Why the native SDK (not expo-auth-session):
//   expo-auth-session drives Google via a browser redirect using the app's
//   custom scheme, which Google rejects for "Web" OAuth clients:
//   "custom scheme URIs are not allowed for 'WEB' client type". Expo's own
//   docs now recommend a native SDK for Google. The native SDK authenticates
//   through Google Play Services (no browser redirect) and, given a
//   `webClientId`, returns an id_token whose audience is our Web client —
//   exactly what Firebase's signInWithCredential expects.
//
// Android requirement:
//   An OAuth client of type "Android" (package app.wattrent + the build's
//   SHA-1 fingerprint) must exist in the same Google Cloud project so Play
//   Services can validate the app. Register the SHA-1 in the Firebase console.
//
// iOS is intentionally HIDDEN until we also implement Apple sign-in:
//   App Store Guideline 4.8 requires that any 3rd-party SSO (Google / LINE /
//   Facebook) be accompanied by Apple sign-in. We ship Android-first; when iOS
//   ships we'll add an iOS OAuth client + the plugin's `iosUrlScheme`.

import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';

function readWebClientId(): string | undefined {
  const env = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  const extra = (Constants.expoConfig?.extra as { google?: { webClientId?: string | null } })
    ?.google;
  if (extra?.webClientId && typeof extra.webClientId === 'string' && extra.webClientId.length > 0) {
    return extra.webClientId;
  }
  return undefined;
}

export interface UseGoogleSignInResult {
  /** True once the platform-specific OAuth machinery is ready to be called. */
  ready: boolean;
  /**
   * True when Google sign-in is configured AND supported on this platform.
   * Use this to decide whether to render the "Continue with Google" button.
   * Returns false on iOS (we hide it until Apple sign-in ships) and when
   * EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is missing.
   */
  available: boolean;
  /** Triggers the Google sign-in flow and resolves once Firebase auth succeeds. */
  signIn: () => Promise<void>;
}

/**
 * Hook that returns a stable `signIn` function plus availability flags.
 */
export function useGoogleSignIn(): UseGoogleSignInResult {
  const auth = getFirebaseAuth();
  const webClientId = readWebClientId();

  const signInOnWeb = useCallback(async () => {
    if (!auth) throw new Error('auth.not_configured');
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }, [auth]);

  const signInOnNative = useCallback(async () => {
    if (!auth) throw new Error('auth.not_configured');
    if (!webClientId) throw new Error('auth.google.misconfigured');
    // configure() is idempotent and cheap; calling it here guarantees the
    // native SDK knows our Web client id before signIn(), regardless of the
    // order in which screens mount.
    GoogleSignin.configure({ webClientId });
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        // User dismissed the account picker.
        throw new Error('auth.signInCancelled');
      }
      const idToken = response.data.idToken;
      if (!idToken) throw new Error('auth.errors.generic');
      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (err) {
      // Our own typed i18n-key errors bubble up unchanged.
      if (err instanceof Error && err.message.startsWith('auth.')) throw err;
      // Native failures (e.g. DEVELOPER_ERROR when the SHA-1 isn't registered,
      // or PLAY_SERVICES_NOT_AVAILABLE) carry a `code`; surface it for debugging.
      if (isErrorWithCode(err)) {
        console.warn('[googleAuth] native Google sign-in failed:', err.code);
      }
      throw new Error('auth.errors.generic');
    }
  }, [auth, webClientId]);

  return useMemo<UseGoogleSignInResult>(() => {
    if (Platform.OS === 'ios') {
      // Hide on iOS until Apple sign-in is also implemented (Guideline 4.8).
      return {
        ready: false,
        available: false,
        signIn: async () => {
          throw new Error('auth.google.iosDisabled');
        },
      };
    }
    if (Platform.OS === 'web') {
      return { ready: !!auth, available: !!auth, signIn: signInOnWeb };
    }
    // Android (and any other native target).
    return {
      ready: !!auth && !!webClientId,
      available: !!auth && !!webClientId,
      signIn: signInOnNative,
    };
  }, [auth, webClientId, signInOnWeb, signInOnNative]);
}
