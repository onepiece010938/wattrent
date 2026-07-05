// Tests for lib/authErrors.mapAuthError.

import { mapAuthError } from '../authErrors';

describe('mapAuthError', () => {
  it.each([
    ['auth/invalid-email', 'auth.errors.invalidEmail'],
    ['auth/user-disabled', 'auth.errors.userDisabled'],
    ['auth/user-not-found', 'auth.errors.invalidCredentials'],
    ['auth/wrong-password', 'auth.errors.invalidCredentials'],
    ['auth/invalid-credential', 'auth.errors.invalidCredentials'],
    ['auth/email-already-in-use', 'auth.errors.emailInUse'],
    ['auth/weak-password', 'auth.errors.weakPassword'],
    ['auth/too-many-requests', 'auth.errors.tooManyRequests'],
    ['auth/network-request-failed', 'auth.errors.network'],
    ['auth/operation-not-allowed', 'auth.errors.operationNotAllowed'],
    ['auth/requires-recent-login', 'auth.errors.requiresRecentLogin'],
  ])('maps FirebaseError code %s -> %s', (code, expected) => {
    expect(mapAuthError({ code, message: 'whatever' })).toBe(expected);
  });

  it('maps thrown string sentinels', () => {
    expect(mapAuthError('auth.not_configured')).toBe('auth.notConfigured');
    expect(mapAuthError('auth.not_signed_in')).toBe('auth.errors.notSignedIn');
  });

  it('maps Error.message sentinel when code is missing', () => {
    expect(mapAuthError(new Error('auth.not_configured'))).toBe('auth.notConfigured');
  });

  it('falls back to generic for unknown FirebaseError codes', () => {
    expect(mapAuthError({ code: 'auth/something-new' })).toBe('auth.errors.generic');
  });

  it('falls back to generic for non-Error values', () => {
    expect(mapAuthError(undefined)).toBe('auth.errors.generic');
    expect(mapAuthError(null)).toBe('auth.errors.generic');
    expect(mapAuthError(42)).toBe('auth.errors.generic');
    expect(mapAuthError({ noCode: 'here' })).toBe('auth.errors.generic');
  });

  // LINE-specific error mapping (Phase 3). The client surfaces three kinds
  // of failures:
  //   - client-side guards thrown from useLineSignIn (auth.line.misconfigured,
  //     auth.line.iosDisabled, auth.line.exchangeFailed)
  //   - backend AppError keys returned in the API envelope
  //     (errors.auth.line_disabled / _invalid_code / _upstream)
  it.each([
    ['auth.line.misconfigured', 'auth.errors.lineMisconfigured'],
    ['auth.line.iosDisabled', 'auth.errors.lineIosDisabled'],
    ['auth.line.exchangeFailed', 'auth.errors.lineUpstream'],
    ['errors.auth.line_disabled', 'auth.errors.lineDisabled'],
    ['errors.auth.line_invalid_code', 'auth.errors.lineInvalidCode'],
    ['errors.auth.line_upstream', 'auth.errors.lineUpstream'],
  ])('maps LINE sentinel string %s -> %s', (sentinel, expected) => {
    expect(mapAuthError(sentinel)).toBe(expected);
  });

  it.each([
    ['auth.line.misconfigured', 'auth.errors.lineMisconfigured'],
    ['errors.auth.line_disabled', 'auth.errors.lineDisabled'],
    ['errors.auth.line_invalid_code', 'auth.errors.lineInvalidCode'],
  ])('maps LINE sentinel wrapped in Error(%s) -> %s', (sentinel, expected) => {
    expect(mapAuthError(new Error(sentinel))).toBe(expected);
  });
});
