/**
 * isAuthReadyForApiCalls — the gate every authenticated query waits on.
 *
 * It had no tests, which is a poor place to have none: returning true too
 * eagerly produces 401 floods, and returning false too readily leaves the app
 * showing nothing. Both failures are silent in the sense that neither throws.
 */

import { isAuthReadyForApiCalls } from '../tokenValidator';

const MINUTE = 60_000;

/** Authenticated, valid session, not recovering — the ready case. */
const ready = (over: Partial<Parameters<typeof isAuthReadyForApiCalls>[0]> = {}) => ({
  isAuthenticated: true,
  sessionExpiresAt: new Date(Date.now() + 60 * MINUTE).toISOString(),
  isRecoveringSession: false,
  ...over,
});

describe('isAuthReadyForApiCalls', () => {
  it('is ready for an authenticated user with a valid session', () => {
    expect(isAuthReadyForApiCalls(ready())).toEqual({ isReady: true });
  });

  describe('not authenticated', () => {
    it('blocks and says why', () => {
      expect(isAuthReadyForApiCalls(ready({ isAuthenticated: false }))).toEqual({
        isReady: false,
        reason: 'not_authenticated',
      });
    });

    // Nothing else matters if there is no session at all.
    it('blocks even while recovering', () => {
      const result = isAuthReadyForApiCalls(
        ready({ isAuthenticated: false, isRecoveringSession: true }),
      );

      expect(result.reason).toBe('not_authenticated');
    });
  });

  describe('session recovery', () => {
    /*
     * The reason this gate exists: on resume, TanStack Query's focusManager
     * races the auth middleware. Without the wait, queries refetch with the
     * stale access token and the backend answers with a burst of 401s.
     */
    it('blocks while recovery is in flight', () => {
      expect(isAuthReadyForApiCalls(ready({ isRecoveringSession: true }))).toEqual({
        isReady: false,
        reason: 'session_recovering',
      });
    });

    it('opens again once recovery finishes', () => {
      expect(isAuthReadyForApiCalls(ready({ isRecoveringSession: false })).isReady).toBe(true);
    });

    // Mid-recovery the local timestamp is usually stale — that is why recovery
    // is running. Reporting "expired" there would send the caller down the
    // wrong path.
    it('reports recovery rather than expiry when both are true', () => {
      const result = isAuthReadyForApiCalls(
        ready({
          isRecoveringSession: true,
          sessionExpiresAt: new Date(Date.now() - 60 * MINUTE).toISOString(),
        }),
      );

      expect(result.reason).toBe('session_recovering');
    });
  });

  describe('local expiry', () => {
    it('blocks a session that has clearly expired', () => {
      const result = isAuthReadyForApiCalls(
        ready({ sessionExpiresAt: new Date(Date.now() - 60 * MINUTE).toISOString() }),
      );

      expect(result).toEqual({ isReady: false, reason: 'session_expired_locally' });
    });

    // A device clock a few seconds fast must not lock a valid session out.
    it('tolerates a small clock skew', () => {
      const result = isAuthReadyForApiCalls(
        ready({ sessionExpiresAt: new Date(Date.now() - 1_000).toISOString() }),
      );

      expect(result.isReady).toBe(true);
    });

    it.each([null, ''])(
      'treats %p as no local expiry information rather than as expired',
      sessionExpiresAt => {
        expect(isAuthReadyForApiCalls(ready({ sessionExpiresAt })).isReady).toBe(true);
      },
    );

    // An unparseable timestamp yields NaN, and every comparison against NaN is
    // false — so it falls through as "not expired". Failing open is right here:
    // the interceptor still validates the real token, and failing closed would
    // lock the user out over a malformed string.
    it('does not treat an unparseable timestamp as expired', () => {
      expect(isAuthReadyForApiCalls(ready({ sessionExpiresAt: 'not-a-date' })).isReady).toBe(true);
    });
  });

  describe('precedence', () => {
    // Stated as a table so the order cannot drift unnoticed.
    it.each([
      [{ isAuthenticated: false, isRecoveringSession: true }, 'not_authenticated'],
      [{ isRecoveringSession: true }, 'session_recovering'],
      [
        { sessionExpiresAt: new Date(Date.now() - 60 * MINUTE).toISOString() },
        'session_expired_locally',
      ],
    ])('reports %o as %s', (over, reason) => {
      expect(isAuthReadyForApiCalls(ready(over)).reason).toBe(reason);
    });
  });
});
