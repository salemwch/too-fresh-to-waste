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

    async function rehydrate() {
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
        if (!cancelled) {
          if (isHardAuthError(err)) {
            // Backend explicitly rejected the session — clear everything.
            useAuthStore.getState().logout();
          } else {
            // Network error — not authenticated (no offline fallback)
            setUser(null);
          }
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
      // Another tab refreshed — HttpOnly cookies already updated by backend.
      // Re-verify our session to update user state if needed.
      authService
        .getProfile()
        .then(res => {
          useAuthStore.getState().setUser(res.data.data);
        })
        .catch(err => {
          // Hard auth error (401/403) means the session is no longer valid — log out.
          // Network errors are ignored; the next proactive refresh will handle them.
          if (isHardAuthError(err)) {
            useAuthStore.getState().logout();
          }
        });
    };

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return <>{children}</>;
}
