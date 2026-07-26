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
import { refreshTokenSafe } from '../authRefresh';

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
        error: 'Network request failed',
      });
    });

    it('treats a missing isNetworkError as fatal, not transient', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(
          rejectedWith({ message: 'Invalid refresh token' }),
        ) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        error: 'Invalid refresh token',
      });
    });

    it('falls back to a default message when the payload has none', async () => {
      const dispatch = jest
        .fn()
        .mockResolvedValue(rejectedWith(undefined)) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
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
        error: 'Token refresh rejected',
      });
    });

    // An unexpected throw is classified as fatal on purpose: we have no
    // evidence the session is still good, so callers get to decide.
    it('classifies an unexpected throw as a fatal failure', async () => {
      const dispatch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        error: 'boom',
      });
    });

    it('stringifies a non-Error throw rather than losing it', async () => {
      const dispatch = jest.fn().mockRejectedValue('plain string') as unknown as AppDispatch;

      await expect(refreshTokenSafe(dispatch)).resolves.toEqual({
        success: false,
        isNetworkError: false,
        error: 'plain string',
      });
    });

    it('never rejects, so callers can await it without a try/catch', async () => {
      const dispatch = jest.fn().mockRejectedValue(new Error('boom')) as unknown as AppDispatch;
      await expect(refreshTokenSafe(dispatch)).resolves.toBeDefined();
    });
  });
});
