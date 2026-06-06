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
import { refreshTokenSafe } from '@/services/authRefresh';
import {
  cancelInflightRequests as cancelTrackedRequests,
  createTrackedAbortController,
  releaseTrackedAbortController,
} from '@/services/requestCancellation';
import { SecureStorage } from '@/services/SecureStorage';
import { getAppDispatch } from '@/store/storeAccessor';
import { Logger, NetworkLogger } from '@/utils/logger';
import { decodeEntitiesDeep } from '@/utils/strings';

import type { AppDispatch } from '@/store';
import type { ApiResponse, PaginationMeta } from '@foodwaste/shared';

// Re-export shared types for backward compatibility
export type { PaginationMeta };

/**
 * Extended request config with timing metadata
 */
interface RequestConfigWithTiming extends InternalAxiosRequestConfig {
  requestStartTime?: number;
  _retry?: boolean;
}

/**
 * Backend response envelope — alias for the canonical type in @foodwaste/shared.
 *
 * All services should use this (or the shared `ApiResponse` directly).
 *
 * **Usage:**
 * ```typescript
 * const response = await apiClient.get<BackendApiResponse<User>>('/users/profile');
 * const user = unwrapBackendResponse(response);
 * ```
 */
export type BackendApiResponse<T> = ApiResponse<T>;

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

  const responseData = (response as { data?: unknown }).data;

  if (responseData === undefined || responseData === null || typeof responseData !== 'object') {
    const error = new Error(
      `Invalid response structure: missing data wrapper${context ? ` for ${context}` : ''}`,
    );
    Logger.error('Response unwrapping failed: missing data wrapper', {
      context,
      hasData: responseData !== undefined && responseData !== null,
      dataType: typeof responseData,
    });
    throw error;
  }

  const backendResponse = responseData as BackendApiResponse<T>;

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

/**
 * Cancel all inflight requests
 * Called on logout to prevent orphaned requests from re-triggering auth flows
 *
 * Refresh single-flight now lives in services/authRefresh.ts and is shared
 * with the session middleware — no local refreshLock / failedQueue here.
 */
export const cancelInflightRequests = (): void => {
  cancelTrackedRequests();
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
    async (config: InternalAxiosRequestConfig) => {
      // ✅ TYPE SAFETY: Use typed config instead of `any`
      const configWithTiming = config as RequestConfigWithTiming;
      configWithTiming.requestStartTime = Date.now();

      // ✅ PER-REQUEST ABORT CONTROLLER: Create and attach to this request
      const abortController = createTrackedAbortController();
      config.signal = abortController.signal;

      // Read access token from Keychain — authoritative source.
      // Never read tokens from Redux state (tokens must not live in Redux).
      const accessToken = await SecureStorage.getAccessToken();

      if (accessToken != null) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

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
      releaseTrackedAbortController(response.config.signal);

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
      releaseTrackedAbortController(originalRequest?.signal);

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

      // Handle 401 Unauthorized - delegate to shared refresh pipeline
      //
      // Concurrency is guaranteed by services/authRefresh.ts — all callers
      // (this interceptor, the session middleware, background tasks) share
      // one promise-based lock. No local refreshLock / failedQueue needed:
      // if multiple 401s arrive in parallel they all await the same
      // refreshTokenSafe() promise, and their request-interceptor retries
      // pick up the freshly-written access token from Redux state.
      if (
        error.response?.status === 401 &&
        originalRequest != null &&
        originalRequest._retry !== true
      ) {
        Logger.debug('[API-CLIENT] 401 Unauthorized detected', {
          url: originalRequest.url,
        });

        originalRequest._retry = true;

        const dispatch = getAppDispatch<AppDispatch>();
        Logger.info('[API-CLIENT] Requesting shared token refresh');
        const refreshResult = await refreshTokenSafe(dispatch);

        if (refreshResult.success) {
          Logger.info('[API-CLIENT] Shared refresh succeeded, retrying request', {
            url: originalRequest.url,
          });
          // Strip the stale Authorization header so the request interceptor
          // injects the fresh one on retry.
          if (originalRequest.headers !== undefined) {
            delete originalRequest.headers.Authorization;
          }
          return client(originalRequest);
        }

        if (refreshResult.isNetworkError === true) {
          // Connectivity issue — keep the session, surface the error to the
          // caller. Middleware's AppState / retry loop will try again when
          // the network comes back.
          Logger.warn('[API-CLIENT] Shared refresh failed (network), preserving session', {
            error: refreshResult.error,
          });
          return Promise.reject(error);
        }

        // Fatal auth failure — refresh token is genuinely invalid/revoked.
        Logger.error(
          '[API-CLIENT] Shared refresh failed (fatal), clearing local session',
          { error: refreshResult.error },
          new Error(refreshResult.error ?? 'Token refresh failed'),
        );

        const { forceLocalLogout } = await import('@/features/auth/store/authSlice');
        const { queryClient } = await import('@/lib/react-query/queryClient');
        queryClient.clear();
        dispatch(forceLocalLogout());

        void import('@/services/SecureStorage').then(({ SecureStorage }) => {
          SecureStorage.clearAll().catch(err => {
            Logger.error('[API-CLIENT] Failed to clear secure storage', {}, err as Error);
          });
        });

        return Promise.reject(error);
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
