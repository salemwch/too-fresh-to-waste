'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth';
import { performRefreshOnce } from '@/lib/api-client';
import { authService } from '@/services/auth.service';

const REFRESH_INTERVAL_MS = 13 * 60 * 1000; // 13 minutes — access token TTL is 15 min

// Pages that handle their own auth flow — skip rehydration to avoid
// spurious 401s before HttpOnly cookies are set by the backend.
const AUTH_FLOW_PAGES = ['/verify-email'];

// Returns true only when the backend explicitly rejected the token (not a network issue).
function isHardAuthError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

function isRateLimited(err: unknown): boolean {
  const status = (err as { response?: { status?: number } })?.response?.status;
  return status === 429;
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pathname = usePathname();

  // ── Rehydrate session on mount ─────────────────────────────────────────────
  // No tokens are read from JS — the browser auto-sends HttpOnly cookies.
  // We verify the session by calling GET /auth/me (cookie-authenticated).
  // Skip on auth-flow pages (e.g. verify-email) which set cookies themselves.
  useEffect(() => {
    const isAuthFlowPage = AUTH_FLOW_PAGES.some(p => pathname.includes(p));
    if (isAuthFlowPage) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function rehydrate(retries = 2) {
      // Verify session validity with the backend (browser sends HttpOnly cookie).
      // No localStorage cache — TanStack Query + Zustand store are the only
      // in-memory sources for user data. The loading skeleton stays visible
      // until this call resolves.
      try {
        const response = await authService.getProfile();
        if (!cancelled) {
          const user = response.data.data;
          setUser(user);
          useAuthStore.getState().setAuthenticated(true);
        }
      } catch (err) {
        if (cancelled) return;

        // Rate limited (429) — wait and retry instead of logging the user out.
        // This prevents transient rate-limit hits from killing valid sessions.
        if (isRateLimited(err) && retries > 0) {
          await wait(3000);
          if (!cancelled) return rehydrate(retries - 1);
          return;
        }

        if (isHardAuthError(err)) {
          // Backend explicitly rejected the session — clear everything.
          useAuthStore.getState().logout();
        } else {
          // Network/server error — backend unreachable but cookies may still be
          // valid. Do NOT clear auth state. Leave isAuthenticated as-is so the
          // user keeps seeing their current page. The proactive 13-min refresh
          // interval and the reactive 401 interceptor will recover the session
          // once the backend is reachable again.
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    rehydrate();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Proactive token refresh every 13 minutes ───────────────────────────────
  // Uses the same performRefreshOnce() mutex as the reactive 401 interceptor,
  // guaranteeing only ONE refresh is ever in-flight regardless of which code
  // path triggers it.
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    async function refreshTokens() {
      try {
        await performRefreshOnce();
      } catch {
        // Hard auth errors (401/403) are handled inside performRefreshOnce (calls logout()).
        // Network/server errors are swallowed — the next interval tick will retry.
      }
    }

    intervalRef.current = setInterval(refreshTokens, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isAuthenticated]);

  // ── Cross-tab synchronisation ────────────────────────────────────────────────
  // When another tab successfully rotates the tokens, it writes a timestamp to
  // localStorage. The storage event fires in every OTHER open tab.
  // Since tokens are HttpOnly, we just re-verify the session to sync user state.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'wfa_tokens_ts') return;
      // Another tab just refreshed tokens. The backend has already set new
      // HttpOnly cookies via Set-Cookie. We re-verify user state, but with
      // a small delay — the new cookies need time to propagate and the
      // backend may still be finishing the rotation.
      //
      // CRITICAL: Do NOT logout on errors here. The other tab's refresh
      // already succeeded (that's why we got the storage event). A 401
      // here is almost always a timing issue — the old access token cookie
      // hasn't been replaced yet. The next proactive refresh (13-min
      // interval) or the 401 interceptor will handle it properly.
      setTimeout(() => {
        authService
          .getProfile()
          .then(res => {
            useAuthStore.getState().setUser(res.data.data);
          })
          .catch(() => {
            // Swallow all errors — the proactive refresh interval and
            // the 401 interceptor are the proper recovery paths.
          });
      }, 1000);
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <>{children}</>;
}
