/**
 * refreshTokenSafe — single-flight refresh
 *
 * The bug this module exists to prevent: the session timer and the 401
 * interceptor each held their own lock, both saw `null` in the same tick, and
 * fired two POST /auth/refresh calls. The backend rotates the refresh token on
 * every call, so the second one carried an already-invalidated token and forced
 * a logout on a perfectly healthy session.
 *
 * So the property under test is not "refresh works" — it is "N concurrent
 * callers produce exactly ONE dispatch, and the lock is released afterwards no
 * matter how the refresh ended".
 */

import { refreshTokenAsync } from '@/features/auth/store/authSlice';
import { getInFlightRefresh, refreshTokenSafe } from '../authRefresh';

import type { AppDispatch } from '@/store';

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('@/features/auth/store/authSlice', () => {
  const thunk = jest.fn(() => ({ type: 'auth/refreshToken' }));
  return {
    refreshTokenAsync: Object.assign(thunk, {
      fulfilled: { match: (a: { type?: string }) => a?.type === 'auth/refreshToken/fulfilled' },
      rejected: { match: (a: { type?: string }) => a?.type === 'auth/refreshToken/rejected' },
    }),
  };
});

const fulfilled = { type: 'auth/refreshToken/fulfilled' };
const rejectedWith = (payload: unknown) => ({ type: 'auth/refreshToken/rejected', payload });

/** A dispatch whose promise we resolve by hand, to hold the lock open. */
function deferredDispatch() {
  let release!: (action: unknown) => void;
  const pending = new Promise(resolve => {
    release = resolve;
  });
  const dispatch = jest.fn(() => pending) as unknown as AppDispatch;
  return { dispatch, release };
}

describe('refreshTokenSafe', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (refreshTokenAsync as unknown as jest.Mock).mockReturnValue({ type: 'auth/refreshToken' });
  });

  describe('single-flight', () => {
    it('dispatches once when several callers race in the same tick', async () => {
      const { dispatch, release } = deferredDispatch();

      const a = refreshTokenSafe(dispatch);
      const b = refreshTokenSafe(dispatch);
      const c = refreshTokenSafe(dispatch);

      release(fulfilled);
      const results = await Promise.all([a, b, c]);

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(results).toEqual([{ success: true }, { success: true }, { success: true }]);
    });

    it('hands every racing caller the identical promise', () => {
      const { dispatch, release } = deferredDispatch();

      const a = refreshTokenSafe(dispatch);
      const b = refreshTokenSafe(dispatch);
      expect(a).toBe(b);

      release(fulfilled);
      return a;
    });

    it('starts a fresh refresh once the previous one settled', async () => {
      const dispatch = jest.fn().mockResolvedValue(fulfilled) as unknown as AppDispatch;

      await refreshTokenSafe(dispatch);
      await refreshTokenSafe(dispatch);

      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    // The lock lives in module scope. If `finally` ever stopped running, a
    // single failed refresh would wedge the app into "always refreshing" and
    // no later 401 could ever recover.
    it('releases the lock after a rejected refresh', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(rejectedWith({ message: 'nope' })) as unknown as AppDispatch;

      await refreshTokenSafe(dispatch);
      await refreshTokenSafe(dispatch);

      expect(dispatch).toHaveBeenCalledTimes(2);
    });

    it('releases the lock after the thunk throws', async () => {
      const dispatch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as AppDispatch;

      await refreshTokenSafe(dispatch);
      await refreshTokenSafe(dispatch);

      expect(dispatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('result mapping', () => {
    it('reports success on the fulfilled action', async () => {
      const dispatch = jest.fn().mockResolvedValue(fulfilled) as unknown as AppDispatch;
      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({ success: true });
    });

    // This flag is the difference between "you are offline" and "you are logged
    // out". Callers must never log the user out on a network error.
    it('propagates isNetworkError so callers do not log the user out', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(
          rejectedWith({ message: 'Network request failed', isNetworkError: true }),
        ) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: true,
        isTokenRejected: false,
        error: 'Network request failed',
      });
    });

    // Replaces an earlier test that asserted the opposite — "treats a missing
    // isNetworkError as fatal". That inference is what made the cold-start race
    // destructive: `No refresh token available` is neither a network error nor
    // a rejection, so it was read as proof the session was dead and the
    // interceptor cleared the Keychain. Fatality is now a positive finding.
    it('does not infer a rejected token from the absence of isNetworkError', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(
          rejectedWith({ message: 'No refresh token available' }),
        ) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: false,
        error: 'No refresh token available',
      });
    });

    // The one failure that may cost the user their session.
    it('propagates isTokenRejected when the server rejected the token', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(
          rejectedWith({ message: 'Invalid refresh token', isTokenRejected: true }),
        ) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: true,
        error: 'Invalid refresh token',
      });
    });

    it('never reports both a network failure and a rejected token', async () => {
      // A request that never reached the server cannot have been rejected by
      // it. If both ever arrive the caller must not clear the session.
      const dispatch = jest.fn().mockResolvedValue(
        rejectedWith({
          message: 'Network request failed',
          isNetworkError: true,
        }),
      ) as unknown as AppDispatch;

      const result = await refreshTokenSafe(dispatch);

      expect(result.isNetworkError).toBe(true);
      expect(result.isTokenRejected).toBe(false);
    });

    it('falls back to a default message when the payload has none', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(rejectedWith(undefined)) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: false,
        error: 'Token refresh rejected',
      });
    });

    it('falls back to a default message when the payload message is empty', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(rejectedWith({ message: '' })) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: false,
        error: 'Token refresh rejected',
      });
    });

    // Inverted from an earlier test that called this "a fatal failure". Having
    // no evidence the session is good is not evidence that it is dead, and the
    // two outcomes are not symmetric: preserving a dead session costs one more
    // 401, clearing a live one costs the user their login.
    it('preserves the session when the thunk throws unexpectedly', async () => {
      const dispatch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: false,
        error: 'boom',
      });
    });

    it('stringifies a non-Error throw rather than losing it', async () => {
      const dispatch = jest.fn().mockRejectedValue('plain string') as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        isTokenRejected: false,
        error: 'plain string',
      });
    });

    it('never rejects, so callers can await it without a try/catch', async () => {
      const dispatch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as AppDispatch;
      await expect(refreshTokenSafe(dispatch)).resolves.toBeDefined();
    });
  });
  /**
   * The request interceptor uses this to decide whether an absent access token
   * means "none exists" or "one is seconds away". Getting it wrong sends an
   * unauthenticated request to a guarded endpoint, which is the 401 storm this
   * whole area exists to stop.
   */
  describe('getInFlightRefresh', () => {
    it('reports nothing in flight when idle', () => {
      expect(getInFlightRefresh()).toBeNull();
    });

    it('exposes the running refresh, identical to the promise the caller got', async () => {
      const { dispatch, release } = deferredDispatch();

      const started = refreshTokenSafe(dispatch);
      expect(getInFlightRefresh()).toBe(started);

      release(fulfilled);
      await started;
    });

    it('observing does not start a refresh', () => {
      const dispatch = jest.fn().mockResolvedValue(fulfilled) as unknown as AppDispatch;

      getInFlightRefresh();
      getInFlightRefresh();

      expect(dispatch).not.toHaveBeenCalled();
      expect(getInFlightRefresh()).toBeNull();
    });

    it.each([
      ['success', () => jest.fn().mockResolvedValue(fulfilled)],
      ['rejection', () => jest.fn().mockResolvedValue(rejectedWith({ message: 'nope' }))],
      ['an unexpected throw', () => jest.fn().mockRejectedValue(new Error('boom'))],
    ])('clears once the refresh settles — %s', async (_label, makeDispatch) => {
      // A lock left set would make every later caller await a promise that has
      // already settled, and the interceptor would wait on nothing forever.
      const dispatch = makeDispatch() as unknown as AppDispatch;

      await refreshTokenSafe(dispatch);

      expect(getInFlightRefresh()).toBeNull();
    });

    it('hands a waiter the same result the refresh produced', async () => {
      const { dispatch, release } = deferredDispatch();

      const started = refreshTokenSafe(dispatch);
      const observed = getInFlightRefresh();

      release(rejectedWith({ message: 'Invalid refresh token', isTokenRejected: true }));

      await expect(observed).resolves.toEqual(await started);
    });
  });
});
