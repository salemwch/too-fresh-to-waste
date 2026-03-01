'use client';

import { useEffect, useRef } from 'react';
import {
  useAuthStore,
  readPersistedAccessToken,
  readPersistedRefreshToken,
  readCachedUser,
} from '@/lib/auth';
import { authService } from '@/services/auth.service';

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes

// Returns true only when the backend explicitly rejected the token (not a network issue).
function isHardAuthError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setTokens, setLoading, logout, refreshToken } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Rehydrate session on mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function rehydrate() {
      const cookieAccessToken  = readPersistedAccessToken();
      const storedRefreshToken = readPersistedRefreshToken();
      const cachedUser         = readCachedUser();

      // Step 1: restore persisted tokens into the Zustand store BEFORE any
      //         authenticated API call — the request interceptor reads from here.
      if (cookieAccessToken || storedRefreshToken) {
        useAuthStore.setState({
          ...(cookieAccessToken  ? { accessToken:  cookieAccessToken  } : {}),
          ...(storedRefreshToken ? { refreshToken: storedRefreshToken } : {}),
        });
      }

      // Step 2: optimistically restore the cached user so the dashboard renders
      //         immediately and the merchant is never flashed to the login page
      //         during a slow network call.
      if (cachedUser && (cookieAccessToken || storedRefreshToken)) {
        useAuthStore.setState({ user: cachedUser, isAuthenticated: true });
        setLoading(false); // unblock the UI now; background verify below
      }

      // Step 3: verify token validity and refresh user profile in the background.
      try {
        const response = await authService.getProfile();
        if (!cancelled) {
          setUser(response.data.data); // also updates localStorage cache
        }
      } catch (err) {
        if (!cancelled) {
          if (isHardAuthError(err)) {
            // Backend explicitly rejected the token (401/403) — it is truly invalid.
            // Only then clear the session so the merchant is asked to re-login.
            if (cookieAccessToken || storedRefreshToken) {
              useAuthStore.getState().logout();
            } else {
              setUser(null);
            }
          }
          // For network errors, timeouts, 5xx — do NOT logout.
          // If we have a cached user they stay on the dashboard (stale but usable).
          // If there is no cache and no tokens, setUser(null) keeps isAuthenticated=false.
          else if (!cachedUser && !(cookieAccessToken || storedRefreshToken)) {
            setUser(null);
          }
          // else: network error + valid tokens + cached user → stay logged in silently.
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    rehydrate();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proactive token refresh every 13 minutes ───────────────────────────────
  useEffect(() => {
    if (!refreshToken) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    async function refreshTokens() {
      const currentRefreshToken = useAuthStore.getState().refreshToken;
      if (!currentRefreshToken) return;

      try {
        const response = await authService.refresh({ refreshToken: currentRefreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data.tokens;
        setTokens(accessToken, newRefreshToken);
      } catch (err) {
        // Only end the session when the server explicitly rejects the refresh token.
        // A network blip, timeout, or 5xx must NOT log the merchant out — the next
        // interval will retry automatically.
        if (isHardAuthError(err)) {
          logout();
        }
      }
    }

    intervalRef.current = setInterval(refreshTokens, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
