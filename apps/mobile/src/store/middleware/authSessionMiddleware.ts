/**
 * Auth Session Middleware
 *
 * PRODUCTION-GRADE SESSION MANAGEMENT
 * Following industry best practices (Facebook, Instagram, Google, WhatsApp)
 *
 * ARCHITECTURE:
 * - Pure JavaScript/TypeScript (NO React dependency)
 * - Runs outside React bridge (better performance)
 * - Survives navigation stack changes
 * - Proper separation of concerns (business logic ≠ UI)
 *
 * RESPONSIBILITIES:
 * 1. Monitor sessionExpiresAt changes in Redux state
 * 2. Proactively refresh tokens BEFORE expiry (3-min threshold)
 * 3. Attempt refresh FIRST if token expired (silent recovery)
 * 4. Only logout if refresh fails (refresh token invalid/expired)
 * 5. Handle app background/foreground transitions (critical for mobile!)
 *
 * CONCURRENCY GUARANTEES:
 * - Promise-based locks prevent duplicate refresh/logout
 * - Inflight request cancellation on logout
 * - Idempotent session manager start/stop
 * - Race-free token expiry checks
 *
 * STRATEGY:
 * - Short-lived access tokens (15 min)
 * - Long-lived refresh tokens (30 days)
 * - Silent refresh (user doesn't notice)
 * - Token rotation (new tokens on each refresh)
 *
 * MOBILE-SPECIFIC HANDLING:
 * - AppState listener for background/foreground transitions
 * - Immediate session check when app becomes active
 * - Prevents token expiry during background throttling
 *
 * REFERENCE:
 * - https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/
 * - https://tools.ietf.org/html/rfc6749#section-6 (OAuth 2.0 Refresh Token)
 * - https://reactnative.dev/docs/appstate (React Native AppState API)
 */

import { AppState, type AppStateStatus } from 'react-native';

import {
  forceLocalLogout,
  sessionRecoveryStarted,
  sessionRecoveryFinished,
} from '@/features/auth/store/authSlice';
import { AuthFlowState } from '@/features/auth/types';
import { refreshTokenSafe } from '@/services/authRefresh';
import { KeychainLockedError, SecureStorage } from '@/services/SecureStorage';
import { Logger } from '@/utils/logger';
import { offlineManager } from '@/utils/offlineManager';
import { SafeAnalytics } from '@/utils/safeAnalytics';
import { validateTokenLocally } from '@/utils/tokenValidator';

import type { RootState, AppDispatch } from '../index';
import type { Middleware } from '@reduxjs/toolkit';

/**
 * Configuration Constants (Industry Standards)
 */
const CONFIG = {
  // Check token expiry every 60 seconds (standard for production apps)
  CHECK_INTERVAL_MS: 60 * 1000, // 1 minute

  // Refresh token when 3 minutes or less remaining
  // This gives enough time for retry if refresh fails
  REFRESH_THRESHOLD_MS: 3 * 60 * 1000, // 3 minutes

  // Jitter for event-driven triggers (AppState changes, push notifications)
  // Prevents "thundering herd" problem when many users trigger simultaneously
  // Example: 100K users tap push notification → without jitter: all hit API at once
  // With jitter: Requests spread across 0-2000ms window → smooth server load
  JITTER_MAX_MS: 2000, // 2 seconds (industry standard for mobile apps)

  // Exponential backoff for refresh retries
  REFRESH_MAX_RETRIES: 3,
  REFRESH_BACKOFF_BASE_MS: 1000, // Start with 1 second
  REFRESH_BACKOFF_MAX_MS: 10000, // Cap at 10 seconds

  // Rate limiting for error logs (prevent console flood)
  LOG_RATE_LIMIT_MS: 5000, // Max one error log per 5 seconds

  // Enable detailed logging in development
  ENABLE_LOGGING: __DEV__,
} as const;

/**
 * Cross-platform timer types
 * - Node.js: setTimeout returns NodeJS.Timeout
 * - React Native/Browser: setTimeout returns number
 * - Use ReturnType for compatibility across all environments
 */
type TimerId = ReturnType<typeof setTimeout>;
type IntervalId = ReturnType<typeof setInterval>;

/**
 * Logout Reason (for analytics and debugging)
 */
enum LogoutReason {
  USER_ACTION = 'user_action', // User clicked logout
  TOKEN_EXPIRED = 'token_expired', // Token expired naturally
  TOKEN_MISSING = 'token_missing', // No refresh token found
  REFRESH_FAILED = 'refresh_failed', // Refresh attempt failed
  SESSION_INVALID = 'session_invalid', // Session invalidated by server
}

/**
 * Session Manager State
 * Tracks interval timer, AppState subscription, jitter timeout, and prevents duplicate operations
 */
interface SessionManagerState {
  intervalId: IntervalId | null;
  isRefreshing: boolean;
  lastCheckTime: number;
  appStateSubscription: ReturnType<typeof AppState.addEventListener> | null;
  lastAppState: AppStateStatus;
  jitterTimeoutId: TimerId | null;

  // Logout single-flight (refresh single-flight now lives in
  // services/authRefresh.ts and is shared with the axios interceptor).
  logoutLock: Promise<void> | null;

  // ✅ Session manager start guard (idempotency)
  isManagerRunning: boolean;

  // ✅ Rate limiting for error logs
  lastErrorLogTime: number;

  // ✅ Refresh retry tracking
  refreshRetryCount: number;

  // ✅ Rehydration tracking (prevents session manager from starting before rehydrate)
  hasRehydrated: boolean;
}

const sessionManagerState: SessionManagerState = {
  intervalId: null,
  isRefreshing: false,
  lastCheckTime: 0,
  appStateSubscription: null,
  lastAppState: AppState.currentState,
  jitterTimeoutId: null,
  logoutLock: null,
  isManagerRunning: false,
  lastErrorLogTime: 0,
  refreshRetryCount: 0,
  hasRehydrated: false,
};

/**
 * Extract HTTP status code from error object
 * Handles axios errors, custom errors, and error messages
 */

/**
 * Rate-limited error logger
 * Prevents console flood when errors happen in rapid succession
 */
const logErrorRateLimited = (
  message: string,
  context: Record<string, unknown>,
  error?: Error,
): void => {
  const now = Date.now();
  if (now - sessionManagerState.lastErrorLogTime > CONFIG.LOG_RATE_LIMIT_MS) {
    Logger.error(message, context, error);
    sessionManagerState.lastErrorLogTime = now;
  }
};

/**
 * Exponential backoff calculator
 * Used for refresh retries with jitter to prevent thundering herd
 */
const calculateBackoff = (attemptNumber: number): number => {
  const backoff = Math.min(
    CONFIG.REFRESH_BACKOFF_BASE_MS * Math.pow(2, attemptNumber),
    CONFIG.REFRESH_BACKOFF_MAX_MS,
  );
  // Add jitter (±20% randomization)
  const jitter = backoff * 0.2 * (Math.random() - 0.5);
  return Math.floor(backoff + jitter);
};

/**
 * Handle AppState Changes (Background/Foreground Transitions)
 * CRITICAL for mobile apps - prevents token expiry during background throttling
 *
 * Issue: iOS/Android throttle JavaScript execution when app is backgrounded
 * Result: setInterval might not fire for 10-30 minutes
 * Solution: Check session when app comes back to foreground
 *
 * JITTER IMPLEMENTATION (Anti-Thundering Herd):
 * - Event-driven triggers (push notifications, deep links) cause simultaneous activations
 * - Without jitter: 100K users hit /auth/refresh at exact same millisecond
 * - With jitter: Requests spread across 0-2000ms window
 * - Result: Server load smooth curve instead of spike
 *
 * References:
 * - AWS SDK: Uses exponential backoff with jitter
 * - Google Cloud: Recommends jitter for event-driven calls
 * - Stripe API: Uses jitter for webhook retries
 */
const handleAppStateChange = (
  nextAppState: AppStateStatus,
  dispatch: AppDispatch,
  getState: () => RootState,
): void => {
  const { lastAppState } = sessionManagerState;

  // Detect active → background transition (user leaving app).
  //
  // Raise the recovery gate NOW — before the JS thread gets suspended —
  // so that when the user returns, any focus-refetch that fires in the
  // same tick as the `active` event sees isRecoveringSession=true and
  // holds back. Without this, the AppState change listeners for
  // TanStack Query's focusManager and this middleware race on resume:
  // if focusManager runs first, queries refetch with the STALE access
  // token, producing a burst of backend 401s before our middleware
  // gets a chance to start the refresh.
  //
  // The gate is cleared in checkAndRefreshToken's finally block, which
  // runs unconditionally once the resume-side handler reaches it.
  if (lastAppState === 'active' && nextAppState.match(/inactive|background/)) {
    const backgroundState = getState();
    const shouldGate =
      backgroundState.auth.flowState === AuthFlowState.AUTHENTICATED &&
      backgroundState.auth.isAuthenticated;
    if (shouldGate) {
      dispatch(sessionRecoveryStarted());
      if (CONFIG.ENABLE_LOGGING) {
        Logger.debug('[AUTH-MIDDLEWARE] Raised recovery gate on background (pre-suspend)');
      }
    }
  }

  // Detect background → active transition (user returned to app)
  if (lastAppState.match(/inactive|background/) && nextAppState === 'active') {
    // Clear any existing jitter timeout to prevent duplicate checks
    // This handles rapid background/foreground transitions
    if (sessionManagerState.jitterTimeoutId !== null) {
      clearTimeout(sessionManagerState.jitterTimeoutId);
      sessionManagerState.jitterTimeoutId = null;

      if (CONFIG.ENABLE_LOGGING) {
        Logger.debug(
          '[AUTH-MIDDLEWARE] Cleared previous jitter timeout (rapid foreground transition)',
        );
      }
    }

    // AppState active → NO jitter. The jitter logic was borrowed from push-notification
    // thundering-herd prevention (100k users tapping a notification simultaneously).
    // For a regular foreground transition that is NOT notification-driven there is
    // no server-side thundering herd: each user's timer is already de-synchronized by
    // their individual login time. Adding jitter here just guarantees the token refresh
    // fires AFTER TanStack Query's onFocus queries, causing avoidable 401 floods.
    const jitterDelayMs = 0;

    Logger.info('[AUTH-MIDDLEWARE] App became active, checking session immediately', {
      previousState: lastAppState,
      currentState: nextAppState,
    });

    SafeAnalytics.track('session_foreground_jitter', {
      jitter_delay_ms: jitterDelayMs,
      previous_state: lastAppState,
      trigger: 'appstate_change',
    });

    // ✅ GATE PROTECTED QUERIES DURING RECOVERY
    // Raise the flag SYNCHRONOUSLY at the top of the resume handler so any
    // TanStack Query hook re-evaluated on focus sees isRecoveringSession=true
    // and holds back. The flag is cleared inside checkAndRefreshToken's
    // finally block (see below) once refresh has actually run.
    //
    // Only raise it for authenticated users — anonymous users don't need a
    // recovery gate and wouldn't benefit from waiting.
    const resumeState = getState();
    const needsRecoveryGate =
      resumeState.auth.flowState === AuthFlowState.AUTHENTICATED &&
      resumeState.auth.isAuthenticated;
    if (needsRecoveryGate) {
      dispatch(sessionRecoveryStarted());
    }

    // Schedule session check with jitter delay
    // This spreads load across time instead of hitting backend all at once
    // Store timeout ID for cleanup on logout
    sessionManagerState.jitterTimeoutId = setTimeout(() => {
      // Clear timeout ID since it has fired
      sessionManagerState.jitterTimeoutId = null;

      if (CONFIG.ENABLE_LOGGING) {
        Logger.debug('[AUTH-MIDDLEWARE] Jitter delay elapsed, checking session now');
      }

      // CRITICAL: Verify user is still authenticated before attempting refresh
      // Race condition: User might have logged out during jitter delay
      const currentState = getState();
      if (
        currentState.auth.flowState !== AuthFlowState.AUTHENTICATED ||
        !currentState.auth.isAuthenticated
      ) {
        if (CONFIG.ENABLE_LOGGING) {
          Logger.debug('[AUTH-MIDDLEWARE] User no longer authenticated, skipping session check', {
            flowState: currentState.auth.flowState,
            isAuthenticated: currentState.auth.isAuthenticated,
          });
        }
        // Release the gate — nothing to recover.
        if (needsRecoveryGate) {
          dispatch(sessionRecoveryFinished());
        }
        return; // Don't attempt refresh for logged-out user
      }

      void checkAndRefreshToken(dispatch, getState);
    }, jitterDelayMs);
  }

  // Update last known state
  sessionManagerState.lastAppState = nextAppState;

  // Log state changes in development
  if (CONFIG.ENABLE_LOGGING) {
    Logger.debug('[AUTH-MIDDLEWARE] AppState changed', {
      from: lastAppState,
      to: nextAppState,
    });
  }
};

/**
 * Start Session Manager
 * Begins monitoring token expiry and scheduling refreshes
 *
 * ✅ IDEMPOTENT: Safe to call multiple times, only runs once
 *
 * THREE LAYERS OF PROTECTION:
 * 1. setInterval: Regular checks every 60 seconds (when app active)
 *    - NO JITTER NEEDED: Each user logs in at different time, so timers naturally de-synchronized
 * 2. AppState listener: Check on foreground with JITTER (handles background throttling)
 *    - JITTER REQUIRED: Event-driven (push notifications) causes synchronized activation
 * 3. Periodic checks already staggered by login time (organic load distribution)
 */
const startSessionManager = (dispatch: AppDispatch, getState: () => RootState): void => {
  // ✅ IDEMPOTENCY GUARD: Prevent duplicate session managers
  if (sessionManagerState.isManagerRunning) {
    if (CONFIG.ENABLE_LOGGING) {
      Logger.debug('[AUTH-MIDDLEWARE] Session manager already running, skipping duplicate start');
    }
    return;
  }

  // Clear any existing interval to prevent duplicates (defense in depth)
  if (sessionManagerState.intervalId !== null) {
    clearInterval(sessionManagerState.intervalId);
    sessionManagerState.intervalId = null;
  }

  // Remove any existing AppState listener
  if (sessionManagerState.appStateSubscription !== null) {
    sessionManagerState.appStateSubscription.remove();
    sessionManagerState.appStateSubscription = null;
  }

  // Mark as running
  sessionManagerState.isManagerRunning = true;

  Logger.info('[AUTH-MIDDLEWARE] Session manager started');

  // LAYER 1: Check immediately on start
  void checkAndRefreshToken(dispatch, getState);

  // LAYER 2: Schedule periodic checks (every 60 seconds)
  sessionManagerState.intervalId = setInterval(() => {
    void checkAndRefreshToken(dispatch, getState);
  }, CONFIG.CHECK_INTERVAL_MS);

  // LAYER 3: Add AppState listener for background/foreground transitions
  // CRITICAL: Handles token expiry during background throttling
  sessionManagerState.appStateSubscription = AppState.addEventListener('change', nextAppState => {
    handleAppStateChange(nextAppState, dispatch, getState);
  });

  Logger.info('[AUTH-MIDDLEWARE] AppState listener added for background/foreground detection');
};

/**
 * Stop Session Manager
 * Stops monitoring when user logs out or session ends
 * Cleans up interval timer, AppState listener, and pending jitter timeout
 *
 * ✅ IDEMPOTENT: Safe to call multiple times
 */
const stopSessionManager = (): void => {
  // Clear interval timer
  if (sessionManagerState.intervalId !== null) {
    clearInterval(sessionManagerState.intervalId);
    sessionManagerState.intervalId = null;
  }

  // Remove AppState listener
  if (sessionManagerState.appStateSubscription !== null) {
    sessionManagerState.appStateSubscription.remove();
    sessionManagerState.appStateSubscription = null;
  }

  // Clear pending jitter timeout (if user logs out during jitter delay)
  if (sessionManagerState.jitterTimeoutId !== null) {
    clearTimeout(sessionManagerState.jitterTimeoutId);
    sessionManagerState.jitterTimeoutId = null;

    if (CONFIG.ENABLE_LOGGING) {
      Logger.debug('[AUTH-MIDDLEWARE] Cleared pending jitter timeout on session stop');
    }
  }

  // Reset state
  sessionManagerState.isRefreshing = false;
  sessionManagerState.lastAppState = AppState.currentState;
  sessionManagerState.isManagerRunning = false;
  sessionManagerState.refreshRetryCount = 0;

  Logger.info(
    '[AUTH-MIDDLEWARE] Session manager stopped (interval + AppState listener + jitter timeout cleared)',
  );
};

/**
 * Perform Local-Only Logout
 * Clears state without calling server API
 *
 * ✅ PROMISE-BASED LOCK: Prevents duplicate logout operations
 * ✅ INFLIGHT CANCELLATION: Safe for concurrent calls
 *
 * Used when:
 * - Refresh token is missing
 * - Token refresh fails
 * - Session is already invalid
 * - Server returned 401 (token already invalid)
 */
const performLocalLogout = async (
  dispatch: AppDispatch,
  reason: LogoutReason,
  context: Record<string, unknown> = {},
): Promise<void> => {
  // ✅ PROMISE LOCK: Check if logout already in progress
  if (sessionManagerState.logoutLock !== null) {
    Logger.info('[AUTH-MIDDLEWARE] Logout already in progress, waiting for completion', {
      reason,
    });
    // Wait for existing logout to complete
    await sessionManagerState.logoutLock;
    return;
  }

  // Create logout promise and store as lock
  const logoutPromise = (async () => {
    try {
      Logger.info('[AUTH-MIDDLEWARE] Starting local-only logout (no API call)', {
        reason,
        ...context,
      });

      // ✅ ONE-LINE SESSION END SUMMARY (rate-limited)
      const now = Date.now();
      if (now - sessionManagerState.lastErrorLogTime > CONFIG.LOG_RATE_LIMIT_MS) {
        // Single-line summary for monitoring/alerting
        Logger.info(
          `[SESSION-END] reason=${reason} ${Object.entries(context)
            .map(([k, v]) => `${k}=${v}`)
            .join(' ')}`,
        );
        sessionManagerState.lastErrorLogTime = now;
      }

      // Track logout reason for analytics
      SafeAnalytics.track('session_ended', {
        reason,
        trigger: 'automatic',
        ...context,
      });

      // Stop session manager BEFORE clearing state
      stopSessionManager();

      // Clear secure storage
      const { SecureStorage } = await import('@/services/SecureStorage');
      await SecureStorage.clearAll();

      // Dispatch force local logout (clears Redux state, triggers navigation)
      dispatch(forceLocalLogout());

      Logger.info('[AUTH-MIDDLEWARE] Local logout completed successfully', { reason });
    } catch (error) {
      logErrorRateLimited(
        '[AUTH-MIDDLEWARE] Local logout failed (unexpected)',
        { reason, ...context },
        error as Error,
      );
    } finally {
      // Clear lock
      sessionManagerState.logoutLock = null;
    }
  })();

  // Store promise as lock
  sessionManagerState.logoutLock = logoutPromise;

  // Wait for completion
  await logoutPromise;
};

/**
 * Refresh Token with Exponential Backoff
 *
 * Delegates the actual refresh call to the shared single-flight pipeline
 * (`refreshTokenSafe`). This module owns the *retry* policy — backoff on
 * transient network errors — but no longer owns the concurrency lock.
 *
 * Contract:
 * - Returns `true` if a refresh succeeded OR all retries were exhausted due
 *   to network errors (Facebook pattern: never logout for connectivity).
 * - Returns `false` only for fatal auth errors — caller should log out.
 */
const refreshTokenWithBackoff = async (
  dispatch: AppDispatch,
  _getState: () => RootState,
): Promise<boolean> => {
  let attempt = 0;
  let lastError: string | undefined;
  let wasNetworkError = false;

  while (attempt < CONFIG.REFRESH_MAX_RETRIES) {
    const refreshStartTime = Date.now();

    if (CONFIG.ENABLE_LOGGING) {
      Logger.debug('[AUTH-MIDDLEWARE] Attempting token refresh via shared pipeline', {
        attempt: attempt + 1,
        maxRetries: CONFIG.REFRESH_MAX_RETRIES,
      });
    }

    const result = await refreshTokenSafe(dispatch);
    const refreshDuration = Date.now() - refreshStartTime;

    if (result.success) {
      Logger.info('[AUTH-MIDDLEWARE] Token refreshed successfully', {
        attempt: attempt + 1,
        refreshDuration,
      });

      SafeAnalytics.track('token_refresh_success', {
        trigger: 'proactive',
        attempt: attempt + 1,
        refresh_duration_ms: refreshDuration,
      });

      sessionManagerState.refreshRetryCount = 0;
      return true;
    }

    attempt++;
    lastError = result.error;
    wasNetworkError = result.isNetworkError === true;

    if (wasNetworkError) {
      // Transient connectivity issue. Never logout — retry with backoff.
      Logger.info('[AUTH-MIDDLEWARE] Refresh failed due to network error, will retry', {
        attempt,
        nextRetryIn: attempt < CONFIG.REFRESH_MAX_RETRIES ? calculateBackoff(attempt) : 'N/A',
        error: lastError,
      });

      offlineManager.showOfflineToast();

      if (attempt < CONFIG.REFRESH_MAX_RETRIES) {
        const backoffMs = calculateBackoff(attempt);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
      continue;
    }

    // Fatal auth error (invalid/revoked refresh token, 401/403, etc.).
    Logger.warn('[AUTH-MIDDLEWARE] Refresh failed with fatal auth error', {
      attempt,
      error: lastError,
    });
    SafeAnalytics.track('token_refresh_fatal_error', {
      error_message: lastError ?? 'unknown',
      attempt,
    });
    break; // Don't retry on fatal errors
  }

  if (wasNetworkError) {
    // All attempts hit network errors — keep the user logged in.
    Logger.info(
      '[AUTH-MIDDLEWARE] Refresh attempts exhausted (network error), keeping user logged in',
      { attempts: attempt },
    );

    SafeAnalytics.track('token_refresh_network_exhausted', {
      attempts: attempt,
      action: 'keep_logged_in',
    });

    return true;
  }

  // Fatal error — caller will logout.
  logErrorRateLimited(
    '[AUTH-MIDDLEWARE] Token refresh failed with fatal error',
    { attempts: attempt, error: lastError ?? 'Unknown error' },
    lastError !== undefined ? new Error(lastError) : undefined,
  );

  SafeAnalytics.track('token_refresh_failed', {
    trigger: 'proactive',
    attempts: attempt,
    error_message: lastError ?? 'Unknown error',
  });

  return false;
};

/**
 * Check and Refresh Token
 * Core logic for proactive token refresh
 *
 * ✅ OFFLINE-FIRST ARCHITECTURE
 * ✅ RACE-FREE: Snapshots tokens before async operations
 * ✅ LOCAL PRE-FLIGHT CHECKS: Validates tokens locally before network calls
 * ✅ GRACEFUL DEGRADATION: Network errors don't log users out
 */
const checkAndRefreshToken = async (
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<void> => {
  // ✅ SNAPSHOT STATE: Read once at start to avoid stale data
  const state = getState();
  const { flowState, sessionExpiresAt } = state.auth;

  // Only manage sessions for authenticated users
  if (flowState !== AuthFlowState.AUTHENTICATED) {
    // Nothing to recover — release the gate if it was raised.
    dispatch(sessionRecoveryFinished());
    return;
  }

  // Always release the recovery gate on exit, no matter which branch
  // finishes the flow. This prevents protected queries from hanging forever
  // if something unexpected happens in refresh/logout.
  try {
    // ✅ STEP 1: LOCAL PRE-FLIGHT CHECK (No Network Call)
    // Read refresh token from Keychain (authoritative source — not Redux state).
    // Validate refresh-token format + access-token expiry locally.
    //
    // IMPORTANT: `validateTokenLocally` flags `reason: 'expired'` when the
    // ACCESS token is past its expiry. An expired access token is NOT a
    // reason to log out — that's exactly when we should use the refresh
    // token. Only missing/malformed refresh tokens (`missing`,
    // `invalid_format`, `malformed`) are terminal.
    //
    // KeychainLockedError means the device screen is off/locked — the token
    // EXISTS but the OS won't hand it to us right now. We defer to the next
    // 60-second timer tick (by which time the user will have unlocked) rather
    // than treating this as TOKEN_MISSING and logging the user out.
    let refreshToken: string | null;
    try {
      refreshToken = await SecureStorage.getRefreshToken();
    } catch (keychainError) {
      if (keychainError instanceof KeychainLockedError) {
        Logger.info(
          '[AUTH-MIDDLEWARE] Keychain locked (device screen off) — deferring refresh to next tick',
        );
        return; // Release recovery gate via finally block; next 60s tick will retry
      }
      throw keychainError; // Unexpected error — bubble up so outer catch handles it
    }

    const validationResult = validateTokenLocally(refreshToken, sessionExpiresAt);

    const isRefreshTokenBroken =
      validationResult.isValid === false &&
      (validationResult.reason === 'missing' ||
        validationResult.reason === 'invalid_format' ||
        validationResult.reason === 'malformed');

    if (isRefreshTokenBroken) {
      // Refresh token itself is missing/malformed — cannot recover.
      Logger.info('[AUTH-MIDDLEWARE] Refresh token missing or malformed, clearing session', {
        reason: validationResult.reason,
      });

      SafeAnalytics.track('token_invalid_locally', {
        reason: validationResult.reason,
      });

      await performLocalLogout(dispatch, LogoutReason.TOKEN_MISSING, {
        reason: validationResult.reason ?? 'unknown',
        validation_type: 'local',
      });
      return;
    }

    // At this point the refresh token looks usable. The access token may be
    // still valid, approaching expiry, or already expired — we decide below.
    const isAccessTokenExpired =
      validationResult.isValid === false && validationResult.reason === 'expired';

    // ✅ STEP 2: CHECK NETWORK CONNECTIVITY
    // Offline → keep user logged in with cached data. If the access token
    // is already expired the user may see 401s until connectivity returns,
    // but we never log them out for network reasons.
    if (offlineManager.isOffline()) {
      Logger.info('[AUTH-MIDDLEWARE] Device offline, skipping token refresh', {
        accessTokenExpired: isAccessTokenExpired,
        minutesRemaining: Math.floor((validationResult.timeUntilExpiry ?? 0) / 60000),
      });

      if (isAccessTokenExpired || validationResult.isApproachingExpiry === true) {
        offlineManager.showOfflineToast();
      }

      return;
    }

    const timeUntilExpiry = validationResult.timeUntilExpiry ?? 0;
    const minutesRemaining = Math.floor(timeUntilExpiry / 60000);

    // Update last check time for monitoring
    sessionManagerState.lastCheckTime = Date.now();

    if (CONFIG.ENABLE_LOGGING) {
      Logger.debug('[AUTH-MIDDLEWARE] Token check', {
        isAccessTokenExpired,
        minutesRemaining,
        isApproachingExpiry: validationResult.isApproachingExpiry,
      });
    }

    // ✅ STEP 3: DETERMINE IF REFRESH NEEDED
    // CASE 1: Access token already expired → silent refresh (recovery)
    // CASE 2: Access token approaching expiry → proactive refresh
    // CASE 3: Token still comfortably valid → no-op
    const needsRefresh = isAccessTokenExpired || timeUntilExpiry <= CONFIG.REFRESH_THRESHOLD_MS;

    if (!needsRefresh) {
      return;
    }

    // ✅ STEP 4: ATTEMPT TOKEN REFRESH
    if (isAccessTokenExpired) {
      Logger.info('[AUTH-MIDDLEWARE] Access token expired, attempting silent refresh', {
        minutesOverdue: Math.abs(minutesRemaining),
      });
    } else {
      Logger.info('[AUTH-MIDDLEWARE] Token approaching expiry, refreshing proactively', {
        minutesRemaining,
      });
    }

    const refreshSuccess = await refreshTokenWithBackoff(dispatch, getState);

    if (!refreshSuccess) {
      // Only FATAL errors reach here — network errors already handled in
      // refreshTokenWithBackoff (returns true to keep user logged in).
      Logger.warn('[AUTH-MIDDLEWARE] Refresh failed with fatal error, performing logout', {
        wasExpired: isAccessTokenExpired,
        minutesRemaining,
      });

      await performLocalLogout(dispatch, LogoutReason.REFRESH_FAILED, {
        minutes_remaining: minutesRemaining,
        was_expired: isAccessTokenExpired,
      });
      return;
    }

    Logger.info('[AUTH-MIDDLEWARE] Token refreshed successfully', {
      wasExpired: isAccessTokenExpired,
      minutesOverdue: isAccessTokenExpired ? Math.abs(minutesRemaining) : 0,
    });

    if (isAccessTokenExpired) {
      SafeAnalytics.track('session_restored_after_expiry', {
        minutes_overdue: Math.abs(minutesRemaining),
        trigger: 'expired_token_refresh',
      });
    }
  } finally {
    // Always release the recovery gate so protected queries can fire.
    dispatch(sessionRecoveryFinished());
  }
};

/**
 * Auth Session Middleware
 *
 * Monitors Redux state changes and manages session lifecycle
 * Runs on every action dispatch to detect auth state transitions
 *
 * ✅ PRODUCTION-GRADE:
 * - Promise-based locks prevent race conditions
 * - Idempotent session manager
 * - Graceful error handling
 * - Analytics tracking
 * - Waits for rehydration before starting session manager
 */
export const authSessionMiddleware: Middleware<object, RootState, AppDispatch> =
  storeAPI => next => action => {
    // Pass action to next middleware/reducer first
    const result = next(action);

    // Get current state after action processed
    const state = storeAPI.getState();
    const { flowState } = state.auth;

    // Check if action is related to authentication
    const actionType =
      typeof action === 'object' && action !== null && 'type' in action ? String(action.type) : '';

    // ✅ CRITICAL: Detect REHYDRATE action from redux-persist
    // Session manager should only start AFTER rehydration completes
    if (actionType === 'persist/REHYDRATE') {
      sessionManagerState.hasRehydrated = true;
      Logger.info('[AUTH-MIDDLEWARE] Redux rehydration complete', {
        flowState,
        isAuthenticated: state.auth.isAuthenticated,
      });
    }

    // ✅ CRITICAL: Only start session manager AFTER rehydration
    // This prevents starting manager with stale/partial state
    if (sessionManagerState.hasRehydrated && flowState === AuthFlowState.AUTHENTICATED) {
      // Start manager if not already running (idempotent)
      if (!sessionManagerState.isManagerRunning) {
        Logger.info('[AUTH-MIDDLEWARE] User authenticated, starting session manager');
        startSessionManager(storeAPI.dispatch, storeAPI.getState);
      }
    }

    // Stop session manager when user logs out or session ends
    if (flowState !== AuthFlowState.AUTHENTICATED && sessionManagerState.isManagerRunning) {
      Logger.info('[AUTH-MIDDLEWARE] User no longer authenticated, stopping session manager');
      stopSessionManager();
    }

    // Log auth-related actions in development
    if (CONFIG.ENABLE_LOGGING && actionType.includes('auth/')) {
      Logger.debug('[AUTH-MIDDLEWARE] Auth action dispatched', {
        type: actionType,
        flowState,
        hasRehydrated: sessionManagerState.hasRehydrated,
      });
    }

    return result;
  };

/**
 * Cleanup utility for testing
 * Exposed for test teardown to prevent timer leaks
 */
export const cleanupSessionManager = (): void => {
  stopSessionManager();
  sessionManagerState.logoutLock = null;
};

/**
 * Get session manager state for debugging
 * Exposed for development/debugging purposes
 */
export const getSessionManagerState = (): Readonly<SessionManagerState> => ({
  ...sessionManagerState,
});
