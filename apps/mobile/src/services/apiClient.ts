/**
 * Centralized API Client with Automatic Token Refresh
 *
 * Features:
 * - Automatic access token injection
 * - 401 detection and token refresh
 * - Request retry after refresh
 * - Secure token storage integration
 */

import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { environment } from '@/config/environment';
import { refreshTokenAsync, logoutAsync } from '@/features/auth/store/authSlice';
import { store } from '@/store';
import { Logger, NetworkLogger } from '@/utils/logger';

/**
 * Standard API response wrapper from backend TransformInterceptor
 */
export interface ApiResponseWrapper<T> {
  statusCode: number;
  data: T;
  timestamp: string;
}

// Track if we're currently refreshing to prevent multiple refresh attempts
let isRefreshing = false;
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
  // Request Interceptor - Add Auth Token
  // ──────────────────────────────────────────────────────────────────────────
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      const startTime = Date.now();
      (config as any).requestStartTime = startTime;

      // Get access token from secure storage or Redux
      const state = store.getState();
      const accessToken = state.auth.tokens?.accessToken;

      if (accessToken != null) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      NetworkLogger.logRequest(
        config.url || '',
        config.method?.toUpperCase() || 'GET',
        config.headers as any,
      );

      return config;
    },
    error => {
      Logger.error('Request interceptor error', {}, error);
      return Promise.reject(error);
    },
  );

  // ──────────────────────────────────────────────────────────────────────────
  // Response Interceptor - Handle 401 & Token Refresh
  // ──────────────────────────────────────────────────────────────────────────
  client.interceptors.response.use(
    response => {
      const duration = Date.now() - ((response.config as any).requestStartTime || 0);
      NetworkLogger.logResponse(response.config.url || '', response.status, duration);
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      const duration = Date.now() - ((originalRequest as any).requestStartStartTime || 0);
      NetworkLogger.logResponse(originalRequest?.url || '', error.response?.status || 0, duration);

      // Handle 401 Unauthorized - Token Refresh
      if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
        console.log('\n🚨 401 UNAUTHORIZED DETECTED');
        console.log('─'.repeat(50));
        console.log('📍 URL:', originalRequest.url);
        console.log('🔄 Is Refreshing?:', isRefreshing);
        console.log('🔁 Retry Flag:', originalRequest._retry);
        console.log('📋 Queued Requests:', failedQueue.length);

        if (isRefreshing) {
          // Queue this request until refresh completes
          console.log('⏳ QUEUEING REQUEST (refresh in progress)');
          console.log('   Queue size:', failedQueue.length + 1);

          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then(() => {
              console.log('✅ QUEUE PROCESSED - Retrying queued request');
              return client(originalRequest);
            })
            .catch(err => {
              console.error('❌ QUEUE PROCESSING FAILED:', err);
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          console.log('🔄 STARTING REFRESH TOKEN FLOW...');
          Logger.info('Access token expired, attempting refresh...');

          const state = store.getState();
          const oldToken = state.auth.tokens?.accessToken;
          console.log('   Old Access Token:', oldToken?.substring(0, 30) + '...');

          // Dispatch refresh token action
          const result = await store.dispatch(refreshTokenAsync());

          if (refreshTokenAsync.fulfilled.match(result)) {
            const newAccessToken = result.payload.tokens.accessToken;

            console.log('✅ REFRESH SUCCESSFUL');
            console.log('   New Access Token:', newAccessToken.substring(0, 30) + '...');
            console.log('   Expires In:', result.payload.tokens.expiresIn, 'seconds');
            console.log('   Processing', failedQueue.length, 'queued requests...');

            Logger.info('Token refresh successful, retrying original request');
            processQueue();
            isRefreshing = false;

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            console.log('🔁 RETRYING ORIGINAL REQUEST:', originalRequest.url);
            return client(originalRequest);
          }

          throw new Error('Token refresh failed - refresh action did not fulfill');
        } catch (refreshError) {
          console.error('❌ REFRESH FAILED');
          console.error('   Error:', (refreshError as Error).message);
          console.error('   Logging out user...');

          Logger.error('Token refresh failed, logging out', {}, refreshError as Error);
          processQueue(refreshError as Error);
          isRefreshing = false;

          // Logout user - refresh token is invalid
          await store.dispatch(logoutAsync());

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
 */
export const unwrapResponse = <T>(
  response: ApiResponseWrapper<{ data: T; message?: string; meta?: any }>,
): T => response.data.data;

/**
 * Helper to extract paginated data from wrapped response
 */
export const unwrapPaginatedResponse = <T>(
  response: ApiResponseWrapper<{ data: T[]; message?: string; meta: any }>,
): { data: T[]; meta: any } => ({
  data: response.data.data,
  meta: response.data.meta,
});
