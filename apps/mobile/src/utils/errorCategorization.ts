/**
 * ERROR CATEGORIZATION FOR RESILIENT AUTH
 *
 * Distinguishes between auth failures (logout required) and network errors (keep session).
 * Implements production-grade error handling similar to Facebook/WhatsApp.
 *
 * @security Never logout users for network issues - only for explicit auth failures
 */

import type { AxiosError } from 'axios';

/**
 * Error categories determine app behavior
 */
enum ErrorCategory {
  /** Auth failure - logout required (401, 403, 404 on auth endpoints) */
  AUTH_FAILURE = 'AUTH_FAILURE',

  /** Network error - show offline banner, keep session (500, timeout, DNS) */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Business logic error - show to user, no logout (400, 422) */
  BUSINESS_ERROR = 'BUSINESS_ERROR',

  /** Unknown error - log and show generic message */
  UNKNOWN = 'UNKNOWN',
}

/**
 * Categorized error with metadata
 */
interface CategorizedError {
  category: ErrorCategory;
  originalError: AxiosError | Error;
  message: string;
  shouldLogout: boolean;
  shouldShowOfflineBanner: boolean;
  shouldRetry: boolean;
  retryAfterMs?: number;
}

/**
 * Categorize error to determine correct handling strategy
 *
 * @param error - Axios error or generic Error
 * @returns Categorized error with handling instructions
 */
export function categorizeError(error: AxiosError | Error): CategorizedError {
  // ────────────────────────────────────────────────────────────────────────
  // 1. NETWORK ERRORS (keep session, show offline banner)
  // ────────────────────────────────────────────────────────────────────────

  if ('code' in error) {
    const axiosError = error;

    // Network timeout
    if (axiosError.code === 'ECONNABORTED') {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: 'Network timeout. Trying to reconnect…',
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 3000,
      };
    }

    // DNS failure / No internet
    if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'EAI_AGAIN') {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: "You're offline. Trying to reconnect…",
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 5000,
      };
    }

    // Connection refused (backend down)
    if (axiosError.code === 'ECONNREFUSED') {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: 'Cannot reach server. Trying to reconnect…',
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 5000,
      };
    }

    // Network error (generic)
    if (axiosError.code === 'ERR_NETWORK') {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: "You're offline. Trying to reconnect…",
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 3000,
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. HTTP STATUS CODE ERRORS
  // ────────────────────────────────────────────────────────────────────────

  if ('response' in error && error.response !== undefined && error.response !== null) {
    const axiosError = error;
    const status = axiosError.response?.status;

    // 500 Internal Server Error - Backend issue (keep session)
    if (status === 500) {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: 'Server error. Trying again…',
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 5000,
      };
    }

    // 502/503/504 - Service unavailable (keep session)
    if (status === 502 || status === 503 || status === 504) {
      return {
        category: ErrorCategory.NETWORK_ERROR,
        originalError: error,
        message: 'Service temporarily unavailable. Trying to reconnect…',
        shouldLogout: false,
        shouldShowOfflineBanner: true,
        shouldRetry: true,
        retryAfterMs: 10000,
      };
    }

    // 401 Unauthorized - Session expired (logout)
    if (status === 401) {
      return {
        category: ErrorCategory.AUTH_FAILURE,
        originalError: error,
        message: 'Session expired',
        shouldLogout: true,
        shouldShowOfflineBanner: false,
        shouldRetry: false,
      };
    }

    // 403 Forbidden - Account suspended/deleted (logout)
    if (status === 403) {
      return {
        category: ErrorCategory.AUTH_FAILURE,
        originalError: error,
        message: 'Access denied',
        shouldLogout: true,
        shouldShowOfflineBanner: false,
        shouldRetry: false,
      };
    }

    // 404 on auth endpoints - User not found (logout)
    // SECURITY: Treat as auth failure to prevent user enumeration
    if (status === 404 && isAuthEndpoint(axiosError.config?.url)) {
      return {
        category: ErrorCategory.AUTH_FAILURE,
        originalError: error,
        message: 'Session expired',
        shouldLogout: true,
        shouldShowOfflineBanner: false,
        shouldRetry: false,
      };
    }

    // 400/422 - Business logic error (show to user, no logout)
    if (status === 400 || status === 422) {
      return {
        category: ErrorCategory.BUSINESS_ERROR,
        originalError: error,
        message: extractErrorMessage(axiosError),
        shouldLogout: false,
        shouldShowOfflineBanner: false,
        shouldRetry: false,
      };
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // 3. UNKNOWN ERROR (log and show generic message)
  // ────────────────────────────────────────────────────────────────────────

  return {
    category: ErrorCategory.UNKNOWN,
    originalError: error,
    message: 'Something went wrong. Please try again.',
    shouldLogout: false,
    shouldShowOfflineBanner: false,
    shouldRetry: false,
  };
}

/**
 * Check if URL is an auth endpoint
 * Auth endpoints: /auth/*, /users/me, etc.
 */
function isAuthEndpoint(url?: string): boolean {
  if (!url) return false;

  const authPatterns = [
    '/auth/refresh',
    '/auth/login',
    '/auth/logout',
    '/auth/verify-email',
    '/auth/me',
    '/users/me',
  ];

  return authPatterns.some(pattern => url.includes(pattern));
}

/**
 * Extract user-friendly error message from axios error
 */
function extractErrorMessage(error: AxiosError): string {
  const data = error.response?.data;

  // Try different message formats
  if (typeof data === 'string') return data;
  if (data !== null && typeof data === 'object') {
    if ('message' in data && typeof data.message === 'string') return data.message;
    if ('error' in data && typeof data.error === 'string') return data.error;
  }

  return 'Request failed. Please try again.';
}

/**
 * Check if error should trigger offline mode
 *
 * @param error - Categorized error
 * @returns True if app should enter offline mode
 */
export function shouldEnterOfflineMode(error: CategorizedError): boolean {
  return error.category === ErrorCategory.NETWORK_ERROR && error.shouldRetry;
}

/**
 * Check if error should clear auth state
 *
 * @param error - Categorized error
 * @returns True if app should logout user
 */
export function shouldClearAuth(error: CategorizedError): boolean {
  return error.category === ErrorCategory.AUTH_FAILURE && error.shouldLogout;
}
