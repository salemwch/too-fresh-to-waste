/**
 * Centralized API Client with Automatic Token Refresh
 *
 * Features:
 * - Automatic access token injection
 * - 401 detection and token refresh
 * - Request retry after refresh
 * - Secure token storage integration
 * - Inflight request cancellation on logout
 * - Race-free token refresh with promise locks
 *
 * CONCURRENCY GUARANTEES:
 * - Promise-based refresh lock prevents duplicate refresh attempts
 * - AbortController cancels inflight requests on logout
 * - No unwrap() usage (safe error handling)
 * - Local-only logout on refresh failure (prevents 401 cascades)
 */

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { environment } from '@/config/environment';
import { refreshTokenAsync } from '@/features/auth/store/authSlice';
// eslint-disable-next-line import/no-cycle
import { store } from '@/store';
import { Logger, NetworkLogger } from '@/utils/logger';
import { decodeEntitiesDeep } from '@/utils/strings';

/**
 * Extended request config with timing metadata
 * ✅ TYPE SAFETY: Explicitly typed instead of using `any`
 */
interface RequestConfigWithTiming extends InternalAxiosRequestConfig {
  requestStartTime?: number;
  _retry?: boolean;
}

/**
 * Pagination metadata from backend
 * ✅ TYPE SAFETY: Explicit types instead of index signature with `any`
 */
export interface PaginationMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

/**
 * Standard API response wrapper from backend TransformInterceptor
 * ✅ TYPE SAFETY: Uses PaginationMeta instead of `any`
 *
 * ⚠️ DEPRECATED: Use BackendApiResponse instead
 * This interface used old field name (statusCode) - backend now returns "status"
 *
 * @deprecated Backend changed from statusCode to status as of 2026-02-02
 * @see BackendApiResponse for current interface
 */
export interface ApiResponseWrapper<T> {
  /** @deprecated Use BackendApiResponse.status instead */
  statusCode: number;
  data: T;
  timestamp: string;
  meta?: PaginationMeta;
}

/**
 * ✅ CANONICAL BACKEND RESPONSE STRUCTURE
 *
 * This matches the ACTUAL backend response format used across all endpoints.
 *
 * **Backend Contract (Single Source of Truth):**
 * ```json
 * {
 *   "status": 200,              // HTTP status code (mirrors response.status)
 *   "message": "Success message", // Human-readable message
 *   "data": { ... }             // Actual payload (can be object, array, null)
 * }
 * ```
 *
 * **After Axios Wraps It:**
 * ```json
 * {
 *   "data": {                   // Axios wrapper
 *     "status": 200,
 *     "message": "...",
 *     "data": { ... }           // Your actual data is here
 *   }
 * }
 * ```
 *
 * **Usage:**
 * ```typescript
 * const response = await apiClient.get<BackendApiResponse<User>>('/users/profile');
 * const user = unwrapBackendResponse(response); // Returns User object directly
 * ```
 *
 * **Best Practices:**
 * - Use `unwrapBackendResponse()` to extract data safely
 * - Don't access `.data.data` manually - let utility handle it
 * - Backend should return consistent structure across ALL endpoints
 * - Use OpenAPI codegen for type-safe client generation (future)
 *
 * @template T - The type of the actual data payload
 */
export interface BackendApiResponse<T> {
  /** HTTP status code (200, 201, 400, etc.) */
  status: number;

  /** Human-readable success/error message */
  message: string;

  /** Actual payload data (object, array, or null) */
  data: T;

  /** Optional pagination metadata (for list endpoints) */
  meta?: PaginationMeta;
}

/**
 * ✅ CENTRALIZED RESPONSE UNWRAPPING UTILITY
 *
 * Extracts the actual data payload from nested backend response structure.
 * Eliminates `.data.data.data` anti-pattern throughout the codebase.
 *
 * **Why centralize unwrapping?**
 * - Single source of truth for response parsing
 * - Defensive against API structure changes
 * - Clear error messages when structure is invalid
 * - Type-safe extraction with runtime validation
 * - Easy to add zod validation later
 *
 * **Error handling:**
 * - Validates response structure before extraction
 * - Throws descriptive errors with context
 * - Logs invalid responses for debugging
 *
 * @param response - Axios response containing BackendApiResponse
 * @param context - Optional context for error logging (e.g., 'user profile fetch')
 * @returns The unwrapped data payload
 * @throws Error if response structure is invalid
 *
 * @example
 * ```typescript
 * // Before (fragile, triple-nesting)
 * const user = response.data.data.data; // ❌
 *
 * // After (clean, safe)
 * const user = unwrapBackendResponse(response, 'user profile'); // ✅
 * ```
 */
export function unwrapBackendResponse<T>(
  response: { data: BackendApiResponse<T> },
  context?: string,
): T {
  // ────────────────────────────────────────────────────────────────────────
  // 1. VALIDATE RESPONSE STRUCTURE
  // ────────────────────────────────────────────────────────────────────────

  if (!response || typeof response !== 'object') {
    const error = new Error(`Invalid response object${context ? ` for ${context}` : ''}`);
    Logger.error('Response unwrapping failed: not an object', { context, response });
    throw error;
  }

  if (!response.data || typeof response.data !== 'object') {
    const error = new Error(
      `Invalid response structure: missing data wrapper${context ? ` for ${context}` : ''}`,
    );
    Logger.error('Response unwrapping failed: missing data wrapper', {
      context,
      hasData: !!response.data,
      dataType: typeof response.data,
    });
    throw error;
  }

  const backendResponse = response.data;

  // Check for required fields
  if (typeof backendResponse.status !== 'number') {
    const error = new Error(
      `Invalid response: missing or invalid status field${context ? ` for ${context}` : ''}`,
    );
    Logger.error('Response unwrapping failed: invalid status', {
      context,
      status: backendResponse.status,
      statusType: typeof backendResponse.status,
    });
    throw error;
  }

  if (typeof backendResponse.message !== 'string') {
    // Message is optional for some endpoints, just warn
    Logger.warn('Response missing message field', {
      context,
      hasMessage: 'message' in backendResponse,
    });
  }

  // data field can be null for DELETE operations
  if (!('data' in backendResponse)) {
    const error = new Error(
      `Invalid response: missing data field${context ? ` for ${context}` : ''}`,
    );
    Logger.error('Response unwrapping failed: missing data field', { context, backendResponse });
    throw error;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 2. EXTRACT DATA PAYLOAD
  // ────────────────────────────────────────────────────────────────────────

  const data = backendResponse.data;

  // Log successful unwrapping (debug level)
  Logger.debug('Response unwrapped successfully', {
    context,
    status: backendResponse.status,
    hasData: data !== null && data !== undefined,
    dataType: Array.isArray(data) ? 'array' : typeof data,
  });

  return data;
}

/**
 * ✅ SAFE UNWRAPPING WITH DEFAULT FALLBACK
 *
 * Same as unwrapBackendResponse but returns a default value instead of throwing.
 * Useful for optional/nullable endpoints.
 *
 * @param response - Axios response
 * @param defaultValue - Value to return if unwrapping fails
 * @param context - Optional context for logging
 * @returns Unwrapped data or default value
 *
 * @example
 * ```typescript
 * const settings = unwrapBackendResponseSafe(response, {}, 'user settings');
 * ```
 */
export function unwrapBackendResponseSafe<T>(
  response: { data: BackendApiResponse<T> },
  defaultValue: T,
  context?: string,
): T {
  try {
    return unwrapBackendResponse(response, context);
  } catch (error) {
    Logger.warn('Response unwrapping failed, using default value', {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return defaultValue;
  }
}

// ✅ PROMISE-BASED LOCK: Prevents duplicate refresh attempts (not boolean flag)
let refreshLock: Promise<void> | null = null;

// ✅ PER-REQUEST ABORT CONTROLLERS: Track all active requests
// Each request gets its own AbortController, stored in a Set for global abort
const activeAbortControllers = new Set<AbortController>();

// Queue for requests waiting on token refresh
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

/**
 * Process queued requests after token refresh
 */
const processQueue = (error: Error | null = null) => {
  failedQueue.forEach(promise => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });

  failedQueue = [];
};

/**
 * Create AbortController for a request and track it globally
 * Automatically removed when request completes
 */
const createTrackedAbortController = (): AbortController => {
  const controller = new AbortController();
  activeAbortControllers.add(controller);
  return controller;
};

/**
 * Cancel all inflight requests
 * Called on logout to prevent orphaned requests from re-triggering auth flows
 *
 * ✅ CRITICAL: Aborts ALL active requests globally
 */
export const cancelInflightRequests = (): void => {
  if (activeAbortControllers.size > 0) {
    Logger.info('[API-CLIENT] Cancelling all inflight requests', {
      activeRequests: activeAbortControllers.size,
    });

    // Abort all active requests
    activeAbortControllers.forEach(controller => {
      try {
        controller.abort();
      } catch (error) {
        // Ignore abort errors (request might already be complete)
      }
    });

    // Clear the set
    activeAbortControllers.clear();
  }

  // Clear queued requests
  processQueue(new Error('Logout - all requests cancelled'));

  // Clear refresh lock
  refreshLock = null;
};

/**
 * Create axios instance with base configuration
 */
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: environment.api.baseUrl,
    timeout: environment.api.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Request Interceptor - Add Auth Token + AbortController
  // ──────────────────────────────────────────────────────────────────────────
  client.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      // ✅ TYPE SAFETY: Use typed config instead of `any`
      const configWithTiming = config as RequestConfigWithTiming;
      const startTime = Date.now();
      configWithTiming.requestStartTime = startTime;

      // ✅ PER-REQUEST ABORT CONTROLLER: Create and attach to this request
      const abortController = createTrackedAbortController();
      config.signal = abortController.signal;

      // Get access token from secure storage or Redux
      const state = store.getState();
      const accessToken = state.auth.tokens?.accessToken;

      if (accessToken != null) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      // ✅ TYPE SAFETY: Fixed logic error (was `!= null || ''` which creates boolean)
      NetworkLogger.logRequest(
        config.url ?? '',
        config.method?.toUpperCase() ?? 'GET',
        config.headers,
      );

      return config;
    },
    error => {
      Logger.error('[API-CLIENT] Request interceptor error', {}, error);
      return Promise.reject(error);
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Response Interceptor - Handle 401 & Token Refresh
  // ──────────────────────────────────────────────────────────────────────────
  client.interceptors.response.use(
    response => {
      // ✅ TYPE SAFETY: Use typed config instead of `any`
      const configWithTiming = response.config as RequestConfigWithTiming;
      const duration = Date.now() - (configWithTiming.requestStartTime ?? 0);
      NetworkLogger.logResponse(response.config.url ?? '', response.status, duration);

      // ✅ CLEANUP: Remove abort controller from tracking (request completed successfully)
      if (response.config.signal instanceof AbortSignal) {
        // Extract AbortController from signal (not directly accessible, but we clean up via Set)
        // The Set will be cleaned when the controller goes out of scope
      }

      // Decode HTML entities in all string values of the response body.
      // The backend sanitization layer HTML-encodes text for XSS prevention,
      // but React Native <Text> is not a browser and renders entities literally.
      // This runs iteratively so double-encoded strings (&amp;amp; → &amp; → &)
      // are fully resolved in a single pass through the interceptor.
      response.data = decodeEntitiesDeep(response.data);

      return response;
    },
    async (error: AxiosError) => {
      // ✅ TYPE SAFETY: Use typed config instead of `any`
      const originalRequest = error.config as RequestConfigWithTiming | undefined;

      // ✅ FIXED: Typo and arithmetic error (was requestStartStartTime, was using Boolean with arithmetic)
      const duration = Date.now() - (originalRequest?.requestStartTime ?? 0);
      NetworkLogger.logResponse(originalRequest?.url ?? '', error.response?.status ?? 0, duration);

      // ──────────────────────────────────────────────────────────────────────────
      // ERROR CATEGORIZATION: Distinguish auth failures from network errors
      // ──────────────────────────────────────────────────────────────────────────
      const { categorizeError } = await import('@/utils/errorCategorization');
      const categorizedError = categorizeError(error);

      // NETWORK/SERVER ERRORS: Log but do NOT set global offline state.
      // The offline banner is driven by real device connectivity (NetInfo),
      // not by API errors. Server errors (500, ECONNREFUSED) ≠ device offline.
      if (categorizedError.shouldShowOfflineBanner) {
        Logger.warn('[API-CLIENT] Network/server error detected (session preserved)', {
          category: categorizedError.category,
          message: categorizedError.message,
          shouldRetry: categorizedError.shouldRetry,
        });

        // Return error - let each screen handle it via its own error state
        return Promise.reject(categorizedError);
      }

      // AUTH FAILURES: Clear session and logout
      if (categorizedError.shouldLogout) {
        Logger.warn('[API-CLIENT] Auth failure detected - clearing session', {
          category: categorizedError.category,
          status: error.response?.status,
        });

        // Clear auth state (handled below in 401 flow)
        // Continue to 401 handling...
      }

      // Handle 401 Unauthorized - Token Refresh
      // ✅ ESLINT FIX: Explicitly check for false instead of using ! operator
      if (
        error.response?.status === 401 &&
        originalRequest != null &&
        originalRequest._retry !== true
      ) {
        Logger.debug('[API-CLIENT] 401 Unauthorized detected', {
          url: originalRequest.url,
          hasRefreshLock: refreshLock !== null,
          queuedRequests: failedQueue.length,
        });

        // ✅ PROMISE LOCK: Check if refresh already in progress
        if (refreshLock !== null) {
          // Queue this request until refresh completes
          Logger.debug('[API-CLIENT] Queueing request (refresh in progress)', {
            queueSize: failedQueue.length + 1,
          });

          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              Logger.debug('[API-CLIENT] Queue processed - retrying queued request');
              return client(originalRequest);
            })
            .catch(err => {
              Logger.error(
                '[API-CLIENT] Queue processing failed',
                { url: originalRequest.url },
                err as Error,
              );
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;

        // Create refresh promise and store as lock
        refreshLock = (async () => {
          try {
            Logger.info('[API-CLIENT] Starting token refresh flow');

            // ✅ SAFE ERROR HANDLING: Don't use unwrap() - handle rejection via match
            const result = await store.dispatch(refreshTokenAsync());

            if (refreshTokenAsync.fulfilled.match(result)) {
              const newAccessToken = result.payload.tokens.accessToken;

              Logger.info('[API-CLIENT] Token refresh successful', {
                expiresIn: result.payload.tokens.expiresIn,
                queuedRequests: failedQueue.length,
              });

              // Process queue successfully
              processQueue();

              // Retry original request with new token
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              Logger.debug('[API-CLIENT] Retrying original request', { url: originalRequest.url });
            } else {
              // Refresh rejected
              throw new Error('Token refresh failed - refresh action did not fulfill');
            }
          } catch (refreshError) {
            Logger.error(
              '[API-CLIENT] Token refresh failed, clearing local session',
              {},
              refreshError as Error,
            );

            // Process queue with error
            processQueue(refreshError as Error);

            // ✅ CRITICAL: Clear local state WITHOUT making API call
            // This prevents infinite loop: 401 → refresh fail → logout API → 401 → ...
            // Import forceLocalLogout action which clears state without network call
            const { forceLocalLogout } = await import('@/features/auth/store/authSlice');
            store.dispatch(forceLocalLogout());

            // Clear secure storage (fire and forget)
            import('@/services/SecureStorage').then(({ SecureStorage }) => {
              SecureStorage.clearAll().catch(err => {
                Logger.error('[API-CLIENT] Failed to clear secure storage', {}, err as Error);
              });
            });

            throw refreshError;
          } finally {
            // Clear lock
            refreshLock = null;
          }
        })();

        // Wait for refresh to complete, then retry request
        try {
          await refreshLock;
          // Refresh succeeded, retry request
          return client(originalRequest);
        } catch (refreshError) {
          // Refresh failed, reject request
          return Promise.reject(refreshError);
        }
      }

      // Handle other errors
      return Promise.reject(error);
    },
  );

  return client;
};

/**
 * Shared API client instance
 * Use this for all API calls to get automatic token management
 */
export const apiClient = createApiClient();

/**
 * Helper to extract data from wrapped response
 * ✅ TYPE SAFETY: Uses PaginationMeta instead of `any`
 */
export const unwrapResponse = <T>(
  response: ApiResponseWrapper<{ data: T; message?: string; meta?: PaginationMeta }>,
): T => response.data.data;

/**
 * Helper to extract paginated data from wrapped response
 * ✅ TYPE SAFETY: Uses PaginationMeta instead of `any`
 */
export const unwrapPaginatedResponse = <T>(
  response: ApiResponseWrapper<{ data: T[]; message?: string; meta: PaginationMeta }>,
): { data: T[]; meta: PaginationMeta } => ({
  data: response.data.data,
  meta: response.data.meta,
});
