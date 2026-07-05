// LINE Login hook — implements the PKCE-protected OAuth 2.0 flow against
// LINE Login channels.
//
// Why a backend round-trip:
//   LINE issues an authorisation `code` rather than an id_token to mobile
//   clients, and exchanging the code requires the channel secret which we
//   absolutely do not ship in the app bundle. The flow is therefore:
//
//     1. expo-auth-session opens LINE's authorize URL with PKCE
//     2. LINE redirects back with `?code=...&state=...`
//     3. We POST {code, codeVerifier, redirectUri} to /api/v1/auth/line/exchange
//     4. Backend exchanges with LINE, verifies id_token, mints a Firebase
//        custom token, returns it
//     5. signInWithCustomToken(auth, token) flips us into the signed-in state
//
// iOS is intentionally HIDDEN: App Store Guideline 4.8 requires Apple sign-in
// alongside any 3rd-party SSO. We ship Android-first; iOS gets re-enabled
// once Phase 4 (Apple sign-in) lands.

import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { signInWithCustomToken } from 'firebase/auth';

import { getFirebaseAuth } from '@/lib/firebase';
import apiService from '@/services/api';

WebBrowser.maybeCompleteAuthSession();

// LINE Login's OAuth 2.0 endpoints (OIDC-compliant).
const LINE_DISCOVERY = {
  authorizationEndpoint: 'https://access.line.me/oauth2/v2.1/authorize',
  tokenEndpoint: 'https://api.line.me/oauth2/v2.1/token',
} as const;

function readChannelId(): string | undefined {
  const env = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  const extra = (Constants.expoConfig?.extra as { line?: { channelId?: string | null } })?.line;
  if (extra?.channelId && typeof extra.channelId === 'string' && extra.channelId.length > 0) {
    return extra.channelId;
  }
  return undefined;
}

export interface UseLineSignInResult {
  /** True once the PKCE request has been built and is ready to prompt. */
  ready: boolean;
  /**
   * True when LINE login is configured AND supported on this platform.
   * Hidden on iOS (until Apple sign-in ships) and when EXPO_PUBLIC_LINE_CHANNEL_ID
   * is missing.
   */
  available: boolean;
  /** Triggers the LINE flow and resolves once Firebase auth succeeds. */
  signIn: () => Promise<void>;
}

/**
 * Hook returning a `signIn` function plus platform-aware availability flags.
 *
 * Rules of hooks: `useAuthRequest` is always invoked (with a placeholder
 * clientId when none is configured) so the hook order stays stable; the
 * returned `signIn` then refuses to run when prerequisites are missing.
 */
export function useLineSignIn(): UseLineSignInResult {
  const auth = getFirebaseAuth();
  const channelId = readChannelId();

  // makeRedirectUri auto-selects the right URI per platform:
  //   - native: wattrent://redirect (our app.config.js `scheme`)
  //   - web: window.location.origin
  // The user MUST register every actually-used URI in the LINE Login channel
  // "Callback URL" allow-list, otherwise LINE rejects with invalid_request.
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'wattrent',
    path: 'redirect',
  });

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: channelId ?? 'placeholder',
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
      // S256 is the only method LINE supports; expo-auth-session picks this
      // by default when usePKCE is true.
      codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    },
    LINE_DISCOVERY,
  );

  const signInImpl = useCallback(async () => {
    if (!auth) throw new Error('auth.not_configured');
    if (!channelId) throw new Error('auth.line.misconfigured');
    if (!request) throw new Error('auth.line.misconfigured');
    const verifier = request.codeVerifier;
    if (!verifier) throw new Error('auth.line.misconfigured');

    const result = await promptAsync();
    if (result?.type === 'cancel' || result?.type === 'dismiss') {
      throw new Error('auth.signInCancelled');
    }
    if (result?.type !== 'success' || !result.params?.code) {
      throw new Error('auth.errors.generic');
    }

    const customToken = await apiService.exchangeLine(result.params.code, verifier, redirectUri);
    await signInWithCustomToken(auth, customToken);
  }, [auth, channelId, promptAsync, redirectUri, request]);

  return useMemo<UseLineSignInResult>(() => {
    if (Platform.OS === 'ios') {
      return {
        ready: false,
        available: false,
        signIn: async () => {
          throw new Error('auth.line.iosDisabled');
        },
      };
    }
    return {
      ready: !!auth && !!channelId && !!request,
      available: !!auth && !!channelId,
      signIn: signInImpl,
    };
  }, [auth, channelId, request, signInImpl]);
}
