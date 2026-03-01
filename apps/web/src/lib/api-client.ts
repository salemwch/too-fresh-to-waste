import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@foodwaste/shared';
import { useAuthStore } from './auth';

const API_BASE_URL =
  (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ??
  'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track whether a token refresh is in progress
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
}

// Request interceptor — attach access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiError>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh on 401, not on login/refresh endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/refresh')
    ) {
      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[API] 401 on ${originalRequest.method?.toUpperCase()} ${originalRequest.url} — attempting token refresh`,
          { hasAccessToken: !!useAuthStore.getState().accessToken, hasRefreshToken: !!useAuthStore.getState().refreshToken },
        );
      }

      try {
        const { refreshToken } = useAuthStore.getState();
        if (!refreshToken) {
          throw new Error('[API] No refresh token available');
        }

        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
          response.data.data.tokens;

        useAuthStore.getState().setTokens(newAccessToken, newRefreshToken);

        if (process.env.NODE_ENV === 'development') {
          console.info('[API] Token refresh succeeded — retrying original request');
        }

        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        // Only destroy the session when the refresh endpoint itself explicitly
        // rejects the token (401/403). For network errors, timeouts, or 5xx
        // do NOT logout — the merchant stays in and the next request will retry.
        const status = (refreshError as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403) {
          if (process.env.NODE_ENV === 'development') {
            console.error('[API] Refresh token rejected by server — logging out', { status });
          }
          useAuthStore.getState().logout();
        } else {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[API] Token refresh failed due to network/server error — keeping session', { status });
          }
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
