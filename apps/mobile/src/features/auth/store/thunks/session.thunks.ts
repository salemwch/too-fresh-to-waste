/**
 * Session lifecycle thunks: token refresh, logout, and cold-start restore.
 *
 * Extracted verbatim from authSlice.ts — no logic changes. The slice imports
 * these for its extraReducers; nothing here imports the slice, so there is no
 * cycle.
 */

import { createAsyncThunk } from '@reduxjs/toolkit';

import { KeychainLockedError, SecureStorage } from '@/services/SecureStorage';
import { backgroundStorage } from '@/utils/backgroundStorage';
import { ErrorHandler } from '@/utils/errorHandler';
import { Logger } from '@/utils/logger';

import { authService } from '../../services/authService';
import { logoutLock } from '../logoutLock';

import { classifyRefreshFailure, NO_REFRESH_TOKEN } from './refreshFailure';

import type { User, AuthState } from '../../types';

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      // Read refresh token from Keychain — never from Redux state
      const refreshToken = await SecureStorage.getRefreshToken();

      if (refreshToken == null || refreshToken === '') {
        // Shared with the classifier, which must recognise this as "never
        // attempted" rather than "rejected". A literal on both sides would
        // drift, and the drift would silently make cold-start races
        // destructive again.
        throw new Error(NO_REFRESH_TOKEN);
      }

      Logger.debug('Token refresh attempt started');
      const response = await authService.refreshToken({ refreshToken });

      // ✅ CRITICAL FIX: Token persistence MUST be awaited, NOT fire-and-forget!
      //
      // WHY THIS MATTERS:
      // Backend uses TOKEN ROTATION - when refresh succeeds:
      // 1. Old token is IMMEDIATELY REVOKED (cannot be used again!)
      // 2. New token is issued
      //
      // If we fire-and-forget the storage and the app crashes/closes before
      // persistence completes, we lose the new tokens and the old ones are
      // already revoked → user gets logged out on next app launch.
      //
      // ATOMIC: Await token storage - if this fails, the refresh should fail
      await SecureStorage.setTokens(response.tokens.accessToken, response.tokens.refreshToken);

      // Non-critical metadata can be fire-and-forget
      backgroundStorage.execute('refresh-metadata', async () => {
        const expiresAt = new Date(Date.now() + response.tokens.expiresIn * 1000);
        const { lastLoginTime } = await SecureStorage.getSessionMetadata();
        await SecureStorage.setSessionMetadata(
          expiresAt.toISOString(),
          typeof lastLoginTime === 'string' && lastLoginTime !== ''
            ? lastLoginTime
            : new Date().toISOString(),
        );
      });

      Logger.info('[AUTH] Token refresh completed successfully');
      return response;
    } catch (error) {
      // ✅ OFFLINE-FIRST: Use WARN instead of ERROR for token refresh failures
      // Network errors are expected and shouldn't spam error logs
      Logger.warn('Token refresh failed (will be handled by middleware)', {
        error: error instanceof Error ? error.message : String(error),
      });
      void ErrorHandler.handle(error as Error, { operation: 'refreshToken' });

      // Classification lives in refreshFailure.ts so every branch can be tested
      // directly. One of its outputs clears the Keychain — see the note there on
      // why fatality must be a positive finding rather than a default.
      const failure = classifyRefreshFailure(error);

      return rejectWithValue(failure);
    }
  },
);

/**
 * Logout Async Thunk
 *
 * ✅ PRODUCTION-GRADE:
 * - Cancels inflight requests before logout
 * - Only calls API for explicit user logout with valid token
 * - Always clears local state (even if API fails)
 * - Idempotent with promise-based lock
 *
 * @param params.reason - Why logout is happening (user_action | session_expired | token_missing)
 */
export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (
    params: { reason?: 'user_action' | 'session_expired' | 'token_missing' } = {},
    { getState },
  ) => {
    // ✅ PROMISE LOCK: Prevent concurrent logout calls
    if (logoutLock.current !== null) {
      Logger.info('[AUTH] Logout already in progress, waiting for completion');
      await logoutLock.current;
      return; // Logout already completed by another call
    }

    // Snapshot state before async operations
    const state = getState() as { auth: AuthState };
    const { isAuthenticated, user } = state.auth;
    const userId = user?.userId;
    // Read access token from Keychain — never from Redux state
    const accessToken = await SecureStorage.getAccessToken();
    const reason = params.reason ?? 'user_action';

    // Create logout promise and store as lock
    logoutLock.current = (async () => {
      try {
        Logger.info('[AUTH] Logout started', { userId, reason });

        // ✅ CRITICAL: Cancel all inflight requests FIRST
        // Prevents orphaned requests from re-triggering auth flows
        const { cancelInflightRequests } = await import('@/services/requestCancellation');
        cancelInflightRequests();

        // ✅ CRITICAL: Clear TanStack Query cache to prevent stale data on account switch
        const { queryClient } = await import('@/lib/react-query/queryClient');
        queryClient.clear();

        // ✅ BEST PRACTICE: Only call logout API for explicit user action with valid token
        // Don't call API if:
        // - Session expired (token already invalid → would get 401)
        // - Token missing (no session to invalidate)
        // - Not authenticated (no active session)
        const logoutToken =
          accessToken !== null && accessToken !== undefined && accessToken !== ''
            ? accessToken
            : null;
        const shouldCallApi = reason === 'user_action' && isAuthenticated && logoutToken !== null;

        if (shouldCallApi) {
          try {
            Logger.info('[AUTH] Calling logout API (user-initiated)', { userId });
            await authService.logout(logoutToken);
            Logger.info('[AUTH] Logout API successful', { userId });
          } catch (error) {
            // ✅ GRACEFUL DEGRADATION: API failure doesn't stop local logout
            Logger.warn(
              '[AUTH] Logout API failed, clearing local state anyway',
              { userId, reason },
              error as Error,
            );
          }
        } else {
          Logger.info('[AUTH] Skipping logout API call (local-only)', {
            userId,
            reason,
            shouldCallApi: false,
          });
        }

        // ✅ ALWAYS clear local state (even if API fails)
        await SecureStorage.clearAll();

        Logger.info('[AUTH] Logout completed', { userId, reason, calledApi: shouldCallApi });
      } catch (error) {
        Logger.error('[AUTH] Logout failed (unexpected)', { userId, reason }, error as Error);

        // Still try to clear storage
        await SecureStorage.clearAll().catch(storageError => {
          Logger.error('[AUTH] Failed to clear secure storage', {}, storageError as Error);
        });
      } finally {
        // Clear lock
        logoutLock.current = null;
      }
    })();

    // Wait for logout to complete
    await logoutLock.current;
  },
);

/**
 * Delete Account Async Thunk
 *
 * Self-service account deletion:
 * - Calls DELETE /auth/me API
 * - Cancels inflight requests
 * - Clears all local storage (Keychain)
 * - Resets auth state → state-driven nav redirects to login
 *
 * On failure: keeps user logged in, surfaces error message.
 */
export const loadStoredAuthAsync = createAsyncThunk('auth/loadStoredAuth', async () => {
  try {
    Logger.debug('Loading stored authentication data');

    // Migrate from AsyncStorage to Keychain if needed (one-time migration)
    await SecureStorage.migrateFromAsyncStorage();

    // Parallel reads: tokens, user data, and session metadata are independent
    const [{ accessToken, refreshToken }, userJson, { expiresAt, lastLoginTime }] =
      await Promise.all([
        SecureStorage.getTokensWithRetry(3),
        SecureStorage.getUserData(),
        SecureStorage.getSessionMetadata(),
      ]);

    Logger.info('[Auth] Loaded from Keychain', { hasTokens: !!(accessToken && refreshToken) });

    // Explicitly check for null/undefined or empty strings to avoid nullable conditional usage
    const isAccessTokenMissing = accessToken == null || accessToken === '';
    const isRefreshTokenMissing = refreshToken == null || refreshToken === '';
    const isUserJsonMissing = userJson == null || userJson === '';

    if (isAccessTokenMissing || isRefreshTokenMissing || isUserJsonMissing) {
      Logger.debug('No stored authentication data found');
      return null;
    }

    const parsedUser = JSON.parse(userJson) as unknown;
    const user = parsedUser as User;

    // Check if the access token has expired on disk.
    // NOTE: We intentionally do NOT clear storage or return null here.
    // The refresh token may still be valid (it has a much longer TTL).
    // flowState=AUTHENTICATED is set in the reducer; the reactive 401 handler in
    // apiClient silently exchanges the stale access token for a new one on
    // the first API call — completely transparent to the user.
    // If the refresh token is also expired, apiClient dispatches forceLocalLogout
    // which clears storage and sets flowState=SESSION_EXPIRED.
    if (typeof expiresAt === 'string' && expiresAt !== '') {
      const expiresAtDate = new Date(expiresAt);
      if (expiresAtDate <= new Date()) {
        Logger.info('[Auth] Access token expired on cold start — will refresh transparently', {
          expiresAt,
        });
        // Fall through: tokens stay in Keychain; reactive refresh handles renewal.
      }
    }

    Logger.info('Stored authentication data loaded successfully', { userId: user.userId });
    return {
      user,
      lastLoginTime,
      sessionExpiresAt: expiresAt,
    };
  } catch (error) {
    // KeychainLockedError means the device is locked (screen off) — tokens
    // exist but the OS won't hand them over right now. Do NOT wipe storage.
    // Return null so flowState stays UNAUTHENTICATED; the session middleware
    // will retry once the device is unlocked and the user taps the app.
    if (error instanceof KeychainLockedError) {
      Logger.warn('[Auth] Keychain locked during rehydration — tokens preserved, will retry', {
        error: (error as Error).message,
      });
      return null;
    }

    Logger.error('Failed to load stored authentication data', {}, error as Error);

    // Do NOT clear Keychain here. The error could be a transient OS issue
    // (biometric prompt cancelled, Keychain busy, permission reset after
    // iOS update). Clearing destroys a potentially valid session. Return
    // null so flowState → UNAUTHENTICATED; the session middleware will
    // retry on the next app foreground, and if Keychain genuinely has
    // corrupt data the next read will fail identically and the user can
    // log in fresh.
    return null;
  }
});
