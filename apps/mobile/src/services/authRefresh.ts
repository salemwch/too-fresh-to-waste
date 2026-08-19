/**
 * Shared Token Refresh Pipeline
 *
 * Single source of truth for "refresh the access token" across the mobile app.
 *
 * Why centralized?
 * -----------------
 * Previously the session middleware (authSessionMiddleware.ts) and the axios
 * interceptor (apiClient.ts) each owned an independent promise-based lock.
 * When the middleware fired a refresh at the same instant a stale request
 * returned 401, both locks saw `null` and dispatched two parallel
 * `POST /auth/refresh` calls. The backend rotates refresh tokens on every
 * call, so the second request carried an already-invalidated token and
 * returned a fatal error → forced logout.
 *
 * This module collapses those two locks into one shared promise. Every
 * caller — session timer, AppState resume handler, 401 interceptor,
 * background tasks — routes refresh through `refreshTokenSafe()`. If a
 * refresh is already in flight, subsequent callers await the same promise
 * and see the same result. Only one `/auth/refresh` hits the backend,
 * regardless of how many code paths wanted one.
 *
 * Scope on purpose kept narrow:
 * - No retry / backoff here. Retry policy belongs to the caller (the
 *   middleware wraps this in exponential backoff for network errors; the
 *   interceptor does a single shot). Putting retries inside would couple
 *   unrelated callers to the same retry semantics.
 * - No logout side-effects. Callers decide what to do with a failure.
 */

import { refreshTokenAsync } from '@/features/auth/store/authSlice';
import { Logger } from '@/utils/logger';

import type { AppDispatch } from '@/store';

export interface RefreshResult {
  /** True if /auth/refresh returned new tokens and Redux state is updated. */
  success: boolean;
  /**
   * True when the failure was a transient network error (device offline,
   * DNS failure, timeout, 5xx). Callers should NOT log the user out on
   * network errors — the session is still valid, we just couldn't reach
   * the server.
   */
  isNetworkError?: boolean;
  /**
   * True only when the server positively rejected the refresh token — a 401
   * from `/auth/refresh`, or a suspended account.
   *
   * This is the ONLY signal that may clear a session. Everything else that can
   * make a refresh fail — a 5xx, a timeout, an unexpected throw, or the
   * Keychain not being readable yet during cold-start recovery — leaves the
   * refresh token untested, and an untested token is not a dead one.
   *
   * Callers must check this positively rather than inferring fatality from the
   * absence of `isNetworkError`. That inference is what turned the cold-start
   * race into `SecureStorage.clearAll()`: `No refresh token available` is
   * neither a network error nor a rejection, so it fell through to the
   * destructive branch and signed out users whose sessions were valid.
   */
  isTokenRejected?: boolean;
  /** Non-empty error message when success is false. */
  error?: string;
}

/**
 * Module-scoped single-flight lock.
 *
 * Set synchronously when a refresh begins, cleared in the IIFE's finally
 * block. Because JavaScript is single-threaded, the `if (sharedLock)`
 * check and the subsequent assignment happen in the same synchronous
 * tick — no await in between — so two callers cannot both observe null
 * and start parallel refreshes.
 */
let sharedLock: Promise<RefreshResult> | null = null;

/**
 * Request a token refresh. If one is already in flight, the caller
 * receives the same promise and the same result.
 *
 * Safe to call from anywhere that has access to the Redux dispatch:
 * axios interceptors, middleware, background handlers, imperative code.
 */
export function refreshTokenSafe(dispatch: AppDispatch): Promise<RefreshResult> {
  if (sharedLock !== null) {
    return sharedLock;
  }

  sharedLock = (async (): Promise<RefreshResult> => {
    try {
      const action = await dispatch(refreshTokenAsync());

      if (refreshTokenAsync.fulfilled.match(action)) {
        Logger.info('[AUTH-REFRESH] Shared refresh completed successfully');
        return { success: true };
      }

      // Rejected path. The thunk classifies the failure on the payload.
      const payload = action.payload as
        | { message?: string; isNetworkError?: boolean; isTokenRejected?: boolean }
        | undefined;

      const isNetworkError = payload?.isNetworkError === true;
      const isTokenRejected = payload?.isTokenRejected === true;
      const message =
        typeof payload?.message === 'string' && payload.message !== ''
          ? payload.message
          : 'Token refresh rejected';

      Logger.warn('[AUTH-REFRESH] Shared refresh failed', {
        isNetworkError,
        isTokenRejected,
        message,
      });

      return {
        success: false,
        isNetworkError,
        isTokenRejected,
        error: message,
      };
    } catch (error) {
      // Unexpected throw outside the thunk's rejection path. "Safe" here means
      // preserving the session, not clearing it: nothing about this outcome
      // says the refresh token is dead, and destroying credentials should
      // require positive evidence rather than the absence of a flag.
      const message = error instanceof Error ? error.message : String(error);
      Logger.error(
        '[AUTH-REFRESH] Shared refresh threw unexpectedly',
        { message },
        error instanceof Error ? error : new Error(message),
      );
      return {
        success: false,
        isNetworkError: false,
        // An unexpected throw never reached a verdict on the token. Preserve.
        isTokenRejected: false,
        error: message,
      };
    } finally {
      // Release the lock so the next refresh request starts fresh.
      sharedLock = null;
    }
  })();

  return sharedLock;
}

/**
 * The refresh currently in flight, or `null` when none is.
 *
 * Lets a caller that needs a token *wait* for one rather than proceeding
 * without it. The request interceptor uses this: finding no access token in
 * the Keychain while a refresh is running means the token is seconds away, not
 * absent, and sending the request regardless guarantees a 401 that the
 * response interceptor then has to unpick.
 *
 * Deliberately does not start a refresh. A caller that merely wants to observe
 * one must not cause one — `refreshTokenSafe` is for that.
 */
export function getInFlightRefresh(): Promise<RefreshResult> | null {
  return sharedLock;
}
