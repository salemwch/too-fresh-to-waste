import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@foodwaste/shared';
import { useAuthStore } from './auth';

/**
 * Resolve the API base URL.
 *
 * During Next.js static prerendering (`next build`), NEXT_PUBLIC_*
 * variables may not be injected yet because the build worker is not
 * the production runtime.  We fall back to localhost so the module
 * can load without throwing — the real URL is used at request time
 * once the env var is available (set it in Vercel project settings).
 */
const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  withCredentials: true, // Browser auto-sends HttpOnly cookies set by backend
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Refresh mutex + request queue ───────────────────────────────────────────
// Single boolean flag + queue shared by BOTH the reactive interceptor and the
// proactive AuthProvider interval.  Only one refresh is ever in-flight.
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (result: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, result: string | null) {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (result) {
      promise.resolve(result);
    }
  });
  failedQueue = [];
}

/**
 * Shared token-refresh entry point used by BOTH the reactive 401 interceptor
 * and the proactive AuthProvider interval.
 *
 * Guarantees:
 * - Only ONE refresh request is ever in-flight (mutex + queue).
 * - The refresh token is sent automatically via the HttpOnly cookie
 *   (browser attaches it because withCredentials=true and path matches).
 * - On success: backend sets new HttpOnly cookies via Set-Cookie header.
 * - On hard failure (401/403): calls logout() to clear the session.
 * - On network/server errors: throws without touching the session.
 */
export async function performRefreshOnce(): Promise<string> {
  // If a refresh is already in-flight, queue and wait for its result.
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  isRefreshing = true;

  try {
    if (process.env.NODE_ENV === 'development') {
      console.info('[API] performRefreshOnce — starting token refresh');
    }

    // Empty body — the backend reads the refresh token from the HttpOnly cookie.
    // See auth.controller.ts: req.cookies?.['refresh_token'] fallback.
    await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });

    // Backend already set new HttpOnly cookies via Set-Cookie header.
    // No tokens are captured in JavaScript memory.
    // Broadcast to other tabs so they know tokens were refreshed.
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('wfa_tokens_ts', String(Date.now()));
      }
    } catch {
      /* ignore — private browsing may restrict localStorage writes */
    }

    if (process.env.NODE_ENV === 'development') {
      console.info('[API] performRefreshOnce — token refresh succeeded');
    }

    processQueue(null, 'refreshed');
    return 'refreshed';
  } catch (err) {
    processQueue(err, null);

    // Only log out on hard auth rejections (401/403).
    // Network errors, timeouts, and 5xx keep the session alive so the next
    // request or interval tick can retry.
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 401 || status === 403) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] performRefreshOnce — refresh token rejected, logging out', { status });
      }
      useAuthStore.getState().logout();
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[API] performRefreshOnce — network/server error, keeping session', {
          status,
        });
      }
    }

    throw err;
  } finally {
    isRefreshing = false;
  }
}

// No request interceptor needed — browser auto-sends HttpOnly cookies.
// The backend JWT strategy extracts the access_token cookie as fallback
// after checking the Authorization header (mobile path).

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
      originalRequest._retry = true;

      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `[API] 401 on ${originalRequest.method?.toUpperCase()} ${originalRequest.url} — attempting token refresh`,
        );
      }

      try {
        await performRefreshOnce();
        // Retry — browser auto-sends the fresh HttpOnly cookie
        return apiClient(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
