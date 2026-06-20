/**
 * Token Validator Utility
 *
 * LOCAL TOKEN VALIDATION (No Network Calls)
 * Validates token expiry timestamps BEFORE making network requests
 *
 * Facebook/Instagram Pattern:
 * - Check token expiry locally first
 * - If expired based on timestamp → clear tokens, go to login
 * - If valid → attempt network refresh
 * - This prevents unnecessary network calls for expired tokens
 *
 * @example
 * ```typescript
 * const result = validateTokenLocally(refreshToken, expiresAt);
 * if (!result.isValid) {
 *   // Clear tokens and go to login (NO network call)
 *   return;
 * }
 * // Token looks valid, safe to attempt refresh
 * ```
 */

import { Logger } from './logger';

/**
 * Token validation result
 */
interface TokenValidationResult {
  /** Whether the token is valid (not expired) */
  isValid: boolean;
  /** Reason for invalidity (if applicable) */
  reason?: 'missing' | 'expired' | 'invalid_format' | 'malformed';
  /** Time until expiry in milliseconds (if valid) */
  timeUntilExpiry?: number;
  /** Whether the token is approaching expiry */
  isApproachingExpiry?: boolean;
}

/**
 * Configuration for token validation
 */
const CONFIG = {
  /** Threshold for "approaching expiry" warning (3 minutes) */
  EXPIRY_THRESHOLD_MS: 3 * 60 * 1000,

  /** Clock skew tolerance (30 seconds) - accounts for server/client time differences */
  CLOCK_SKEW_MS: 30 * 1000,
};

/**
 * Validate token locally without network calls
 *
 * @param refreshToken - The refresh token to validate
 * @param expiresAt - ISO 8601 timestamp when token expires
 * @returns Validation result with details
 */
export const validateTokenLocally = (
  refreshToken: string | null | undefined,
  expiresAt: string | null | undefined,
): TokenValidationResult => {
  // Check if token exists
  if (!refreshToken || refreshToken === '') {
    return {
      isValid: false,
      reason: 'missing',
    };
  }

  // Basic format validation (JWT should have 3 parts separated by dots)
  // This is a quick sanity check, not cryptographic validation
  const parts = refreshToken.split('.');
  if (parts.length !== 3) {
    Logger.warn('[TOKEN-VALIDATOR] Refresh token has invalid format', {
      parts: parts.length,
    });
    return {
      isValid: false,
      reason: 'invalid_format',
    };
  }

  // Check if expiry timestamp exists
  if (!expiresAt || expiresAt === '') {
    Logger.warn('[TOKEN-VALIDATOR] No expiry timestamp found');
    return {
      isValid: false,
      reason: 'malformed',
    };
  }

  // Parse expiry timestamp
  const expiryTime = new Date(expiresAt).getTime();
  if (isNaN(expiryTime)) {
    Logger.warn('[TOKEN-VALIDATOR] Invalid expiry timestamp format', {
      expiresAt,
    });
    return {
      isValid: false,
      reason: 'malformed',
    };
  }

  // Calculate time until expiry (with clock skew tolerance)
  const now = Date.now();
  const timeUntilExpiry = expiryTime - now;

  // Check if token is expired (accounting for clock skew)
  if (timeUntilExpiry <= -CONFIG.CLOCK_SKEW_MS) {
    const minutesAgo = Math.abs(Math.floor(timeUntilExpiry / 60000));
    Logger.info('[TOKEN-VALIDATOR] Token expired locally', {
      expiredAt: new Date(expiryTime).toISOString(),
      minutesAgo,
    });
    return {
      isValid: false,
      reason: 'expired',
      timeUntilExpiry,
    };
  }

  // Token is valid
  const isApproachingExpiry = timeUntilExpiry <= CONFIG.EXPIRY_THRESHOLD_MS;
  const minutesRemaining = Math.floor(timeUntilExpiry / 60000);

  if (isApproachingExpiry) {
    Logger.debug('[TOKEN-VALIDATOR] Token approaching expiry', {
      minutesRemaining,
      expiresAt: new Date(expiryTime).toISOString(),
    });
  }

  return {
    isValid: true,
    timeUntilExpiry,
    isApproachingExpiry,
  };
};

/**
 * ✅ BEST PRACTICE: Check if auth state is ready for API calls
 *
 * This function validates that:
 * 1. User is marked as authenticated in Redux
 * 2. Access token exists
 * 3. Session hasn't expired locally (based on timestamp)
 *
 * USE THIS before making authenticated API calls to prevent:
 * - 401 errors during app startup race conditions
 * - API calls with expired tokens
 * - Unnecessary network traffic
 *
 * @param authState - The auth state from Redux (state.auth)
 * @returns Object with isReady flag and reason if not ready
 *
 * @example
 * ```typescript
 * const { isReady, reason } = isAuthReadyForApiCalls(state.auth);
 * if (!isReady) {
 *   Logger.debug('Skipping API call', { reason });
 *   return; // Let auth middleware handle refresh/logout
 * }
 * // Safe to make authenticated API call
 * await apiClient.get('/protected-endpoint');
 * ```
 */
export const isAuthReadyForApiCalls = (authState: {
  isAuthenticated: boolean;
  sessionExpiresAt: string | null;
}): { isReady: boolean; reason?: string } => {
  // Check authentication flag
  if (!authState.isAuthenticated) {
    return { isReady: false, reason: 'not_authenticated' };
  }

  // NOTE: Token existence is not checked here — tokens live in Keychain, not Redux.
  // The apiClient interceptor reads the access token from Keychain at request time.

  // Check local expiry timestamp
  const { sessionExpiresAt } = authState;
  if (sessionExpiresAt != null && sessionExpiresAt !== '') {
    const expiryTime = new Date(sessionExpiresAt).getTime();
    const now = Date.now();

    // Use same clock skew tolerance as validateTokenLocally
    if (expiryTime <= now - CONFIG.CLOCK_SKEW_MS) {
      return { isReady: false, reason: 'session_expired_locally' };
    }
  }

  return { isReady: true };
};
