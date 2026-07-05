// Map a thrown error (typically a FirebaseError) into an i18n key.
//
// Centralised so screens stay declarative ("setError(t(mapAuthError(err)))").
// Unknown errors fall back to a generic key so the user always sees something
// translated rather than raw English from the SDK.

interface FirebaseLikeError {
  code?: unknown;
  message?: unknown;
}

const CODE_TO_KEY: Record<string, string> = {
  'auth/invalid-email': 'auth.errors.invalidEmail',
  'auth/user-disabled': 'auth.errors.userDisabled',
  'auth/user-not-found': 'auth.errors.invalidCredentials',
  'auth/wrong-password': 'auth.errors.invalidCredentials',
  'auth/invalid-credential': 'auth.errors.invalidCredentials',
  'auth/email-already-in-use': 'auth.errors.emailInUse',
  'auth/weak-password': 'auth.errors.weakPassword',
  'auth/too-many-requests': 'auth.errors.tooManyRequests',
  'auth/network-request-failed': 'auth.errors.network',
  'auth/operation-not-allowed': 'auth.errors.operationNotAllowed',
  'auth/requires-recent-login': 'auth.errors.requiresRecentLogin',
  'auth/popup-closed-by-user': 'auth.errors.signInCancelled',
  'auth/cancelled-popup-request': 'auth.errors.signInCancelled',
  'auth/account-exists-with-different-credential':
    'auth.errors.accountExistsDifferentCredential',
  'auth.not_configured': 'auth.notConfigured',
  'auth.not_signed_in': 'auth.errors.notSignedIn',
  'auth.signInCancelled': 'auth.errors.signInCancelled',
  'auth.google.misconfigured': 'auth.errors.googleMisconfigured',
  'auth.google.iosDisabled': 'auth.errors.googleIosDisabled',
  // LINE-specific error codes — backend-mapped (line_disabled / line_invalid_code
  // / line_upstream) plus client-side guards (misconfigured / iosDisabled /
  // exchangeFailed).
  'auth.line.misconfigured': 'auth.errors.lineMisconfigured',
  'auth.line.iosDisabled': 'auth.errors.lineIosDisabled',
  'auth.line.exchangeFailed': 'auth.errors.lineUpstream',
  'errors.auth.line_disabled': 'auth.errors.lineDisabled',
  'errors.auth.line_invalid_code': 'auth.errors.lineInvalidCode',
  'errors.auth.line_upstream': 'auth.errors.lineUpstream',
};

export function mapAuthError(err: unknown): string {
  if (typeof err === 'string') {
    return CODE_TO_KEY[err] ?? 'auth.errors.generic';
  }
  if (err && typeof err === 'object') {
    const fe = err as FirebaseLikeError;
    if (typeof fe.code === 'string' && fe.code in CODE_TO_KEY) {
      return CODE_TO_KEY[fe.code];
    }
    if (typeof fe.message === 'string' && CODE_TO_KEY[fe.message]) {
      return CODE_TO_KEY[fe.message];
    }
  }
  return 'auth.errors.generic';
}
