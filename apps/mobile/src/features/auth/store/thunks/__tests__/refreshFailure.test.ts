/**
 * classifyRefreshFailure — which failures may cost the user their session.
 *
 * `isTokenRejected` is the most consequential boolean in the mobile app: the
 * axios interceptor reads it and, when true, runs `forceLocalLogout()` and
 * `SecureStorage.clearAll()`. Every other field is diagnostic.
 *
 * The rule under test is that fatality must be a *positive finding*. The
 * previous code inferred it — "not a network error, therefore the token is
 * dead" — and that inference shipped: `No refresh token available` is thrown
 * when the Keychain is not readable yet during cold-start recovery, it is
 * neither a network error nor a rejection, so it fell through to the
 * destructive branch and signed out users whose sessions were valid. In
 * production that was REACT-NATIVE-13/12/14, 95 events across 6 users.
 *
 * So the cases below are organised by the only question that matters: may this
 * failure clear the session? Everything that is not a server rejection must
 * answer no, however it is shaped.
 */

import { classifyRefreshFailure, NO_REFRESH_TOKEN } from '../refreshFailure';

/** The AppError shape the auth service throws. */
const appError = (fields: Record<string, unknown>) => ({ ...fields });

describe('classifyRefreshFailure', () => {
  describe('the session may be cleared', () => {
    it('treats a 401 from the refresh endpoint as a rejected token', () => {
      // The one true case: the server saw the token and refused it.
      const result = classifyRefreshFailure(appError({ message: 'Unauthorized', code: 401 }));

      expect(result.isTokenRejected).toBe(true);
      expect(result.isNetworkError).toBe(false);
    });

    it.each([
      ['a 403 status', appError({ message: 'Forbidden', code: 403 })],
      ['an ACCOUNT_SUSPENDED code', appError({ message: 'nope', errorCode: 'ACCOUNT_SUSPENDED' })],
      ['a "no longer active" message', appError({ message: 'Account is no longer active' })],
    ])('treats %s as a rejected token', (_label, error) => {
      const result = classifyRefreshFailure(error);

      expect(result.isAccountSuspended).toBe(true);
      expect(result.isTokenRejected).toBe(true);
    });
  });

  describe('the session must be preserved — never attempted', () => {
    it('does not reject the token when there was none to send', () => {
      // The cold-start race, and the whole reason this function exists.
      const result = classifyRefreshFailure(new Error(NO_REFRESH_TOKEN));

      expect(result.isTokenRejected).toBe(false);
      expect(result.isNetworkError).toBe(false);
      expect(result.message).toBe(NO_REFRESH_TOKEN);
    });

    it('still refuses to reject even if that error also carries a 401', () => {
      // Defence in depth: a request that never left cannot have been answered.
      const result = classifyRefreshFailure(appError({ message: NO_REFRESH_TOKEN, code: 401 }));

      expect(result.isTokenRejected).toBe(false);
    });
  });

  describe('the session must be preserved — the server never answered', () => {
    it.each([
      ['the canonical RN network failure', appError({ message: 'Network request failed' })],
      ['a message mentioning network', appError({ message: 'A network problem occurred' })],
      ['a timeout', appError({ message: 'Request timeout of 10000ms exceeded' })],
      ['ECONNREFUSED', appError({ message: 'connect ECONNREFUSED 10.0.2.2:3000' })],
      ['ECONNABORTED', appError({ message: 'ECONNABORTED' })],
      ['a NETWORK type tag', appError({ message: 'offline', type: 'NETWORK' })],
      ['a SERVER_ERROR type tag', appError({ message: 'boom', type: 'SERVER_ERROR' })],
      ['a 500', appError({ message: 'Internal Server Error', code: 500 })],
      ['a 502', appError({ message: 'Bad Gateway', code: 502 })],
      ['a 503', appError({ message: 'Service Unavailable', code: 503 })],
      ['a 599', appError({ message: 'edge failure', code: 599 })],
    ])('never rejects the token on %s', (_label, error) => {
      const result = classifyRefreshFailure(error);

      expect(result.isNetworkError).toBe(true);
      expect(result.isTokenRejected).toBe(false);
    });

    it('does not reject on a 5xx that also looks suspended', () => {
      // A 500 while the account happens to be flagged is still a server
      // problem. Network wins, because the server passed no judgement.
      const result = classifyRefreshFailure(appError({ message: 'no longer active', code: 500 }));

      expect(result.isNetworkError).toBe(true);
      expect(result.isTokenRejected).toBe(false);
    });
  });

  describe('the session must be preserved — unclassifiable', () => {
    it.each([
      ['a bare Error', new Error('something odd')],
      ['an empty object', {}],
      ['null', null],
      ['undefined', undefined],
      ['a plain string', 'kaboom'],
      ['a number', 42],
      ['a 400', appError({ message: 'Bad Request', code: 400 })],
      ['a 404', appError({ message: 'Not Found', code: 404 })],
      ['a 418', appError({ message: "I'm a teapot", code: 418 })],
    ])('never rejects the token on %s', (_label, error) => {
      // Absence of evidence is not evidence of a dead session.
      expect(classifyRefreshFailure(error).isTokenRejected).toBe(false);
    });

    it('does not treat a 4xx below 500 as a network error either', () => {
      const result = classifyRefreshFailure(appError({ message: 'Bad Request', code: 400 }));

      expect(result.isNetworkError).toBe(false);
      expect(result.isTokenRejected).toBe(false);
    });
  });

  describe('message extraction', () => {
    it('takes the message from an AppError shape', () => {
      expect(classifyRefreshFailure(appError({ message: 'specific' })).message).toBe('specific');
    });

    it('takes the message from a plain Error', () => {
      expect(classifyRefreshFailure(new Error('from error')).message).toBe('from error');
    });

    it.each([
      ['an empty AppError message', appError({ message: '' })],
      ['an empty Error message', new Error('')],
      ['a non-string message', appError({ message: { nested: true } })],
      ['no message at all', appError({ code: 400 })],
      ['null', null],
      ['a string throw', 'kaboom'],
    ])('falls back to the default for %s', (_label, error) => {
      expect(classifyRefreshFailure(error).message).toBe('Token refresh failed');
    });
  });

  describe('field extraction is defensive', () => {
    it.each([
      ['a non-number code', appError({ message: 'x', code: '401' })],
      ['a non-string errorCode', appError({ message: 'x', errorCode: 401 })],
      ['a non-string type', appError({ message: 'x', type: 7 })],
    ])('ignores %s rather than trusting it', (_label, error) => {
      // A string "401" is not a status. Coercing it would clear a session on
      // a malformed error object.
      const result = classifyRefreshFailure(error);

      expect(result.isTokenRejected).toBe(false);
      expect(result.isNetworkError).toBe(false);
    });
  });

  describe('invariants that must hold for every input', () => {
    const everyShape: unknown[] = [
      null,
      undefined,
      '',
      'kaboom',
      0,
      42,
      {},
      [],
      new Error(''),
      new Error(NO_REFRESH_TOKEN),
      appError({ message: 'Network request failed' }),
      appError({ message: 'Unauthorized', code: 401 }),
      appError({ message: 'Forbidden', code: 403 }),
      appError({ message: 'Internal', code: 500 }),
      appError({ message: 'Bad Request', code: 400 }),
      appError({ message: 'x', errorCode: 'ACCOUNT_SUSPENDED' }),
    ];

    it('never reports a network failure and a rejected token together', () => {
      // They are mutually exclusive by construction: a request that never
      // reached the server cannot have been rejected by it.
      for (const error of everyShape) {
        const result = classifyRefreshFailure(error);
        expect(result.isNetworkError && result.isTokenRejected).toBe(false);
      }
    });

    it('always returns a non-empty message', () => {
      for (const error of everyShape) {
        expect(classifyRefreshFailure(error).message.length).toBeGreaterThan(0);
      }
    });

    it('always returns booleans, never undefined', () => {
      // The interceptor checks `!== true`, so an undefined would preserve the
      // session — safe — but the middleware reads these too. Keep them total.
      for (const error of everyShape) {
        const result = classifyRefreshFailure(error);
        expect(typeof result.isNetworkError).toBe('boolean');
        expect(typeof result.isAccountSuspended).toBe('boolean');
        expect(typeof result.isTokenRejected).toBe('boolean');
      }
    });

    it('is pure — the same input classifies identically every time', () => {
      for (const error of everyShape) {
        expect(classifyRefreshFailure(error)).toEqual(classifyRefreshFailure(error));
      }
    });
  });
});
