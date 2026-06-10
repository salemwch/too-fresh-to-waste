import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@foodwaste/shared';
import { useAuthStore } from './auth';

/**
 * Resolve the API base URL.
 *
 * Two modes:
 * - Direct:  NEXT_PUBLIC_API_URL=https://api.toofreshtowaste.com/api/v1
 *            Axios calls the backend directly (cross-origin, CORS required).
 * - Proxy:   NEXT_PUBLIC_API_URL=/api/v1
 *            Axios uses relative paths; Vercel edge rewrites /api/* → backend.
 *            Same-origin to the browser — no CORS needed, cookies sent naturally.
 *
 * NEXT_PUBLIC_WS_URL is always the actual backend origin (Socket.IO, media, health).
 */
const API_BASE_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1';

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
  failedQueue.forEach(promise => {
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
 * - On 429 (rate limited): retries once after Retry-After delay.
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

    await doRefreshRequest();

    processQueue(null, 'refreshed');
    return 'refreshed';
  } catch (err) {
    processQueue(err, null);

    // Only log out on hard auth rejections (401).
    // 403 from refresh = account suspended — clear session but let the UI
    // show a specific "account suspended" message (not the generic login page).
    // Network errors, timeouts, and 5xx keep the session alive.
    const status = (err as { response?: { status?: number } })?.response?.status;
    const errorBody = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
    const isAccountSuspended = status === 403 && errorBody?.['error'] === 'ACCOUNT_SUSPENDED';

    if (status === 401) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] performRefreshOnce — refresh token rejected, logging out', { status });
      }
      useAuthStore.getState().logout();
      // Hard navigation clears all JS state and lets middleware handle the
      // redirect properly. Without this, stale HttpOnly cookies persist and
      // the next AuthProvider rehydration retries with dead tokens.
      if (typeof window !== 'undefined') {
        window.location.replace('/login');
      }
    } else if (isAccountSuspended) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[API] performRefreshOnce — account suspended', { status, errorBody });
      }
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') {
        window.location.replace('/login?reason=suspended');
      }
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

async function doRefreshRequest(retryCount = 1): Promise<void> {
  try {
    // Empty body — the backend reads the refresh token from the HttpOnly cookie.
    await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });

    // Backend already set new HttpOnly cookies via Set-Cookie header.
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
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;

    // 429 — rate limited. Wait and retry once so a transient spike doesn't kill the session.
    if (status === 429 && retryCount > 0) {
      const retryAfter =
        Number(
          (err as { response?: { headers?: Record<string, string> } })?.response?.headers?.[
            'retry-after'
          ],
        ) || 5;
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return doRefreshRequest(retryCount - 1);
    }

    throw err;
  }
}

// No request interceptor needed — browser auto-sends HttpOnly cookies.
// The backend JWT strategy extracts the access_token cookie as fallback
// after checking the Authorization header (mobile path).

// Response interceptor — handle 401 with token refresh
apiClient.interceptors.response.use(
  response => response,
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
