import { create } from 'zustand';
import type { UserResponse } from '@foodwaste/shared';

// ─── Authenticated presence flag ───────────────────────────────────────────────
// Non-sensitive cookie (value = user role, e.g. "merchant") that tells Next.js
// middleware whether the user likely has a valid session and their role for
// routing decisions. The actual auth tokens are HttpOnly cookies set by the
// backend — completely inaccessible to JavaScript (XSS-proof).
const AUTH_FLAG_COOKIE = 'wfa_authenticated';

function setAuthFlag(role?: string) {
  if (typeof document === 'undefined') return;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const value = role || '1';
  // 7 days matches the refresh token cookie lifetime set by the backend
  document.cookie = `${AUTH_FLAG_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${secure}`;
}

function clearAuthFlag() {
  if (typeof document === 'undefined') return;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  document.cookie = `${AUTH_FLAG_COOKIE}=; path=/; max-age=0; SameSite=Lax${secure}`;
}

// ─── Legacy localStorage cleanup ────────────────────────────────────────────
// Previous versions cached the user profile in localStorage under 'wfa_user'.
// Remove it once on load so no PII lingers in client-side storage.
function clearLegacyUserCache() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('wfa_user');
  } catch {
    // Ignore — private browsing or quota errors
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface AuthState {
  user: UserResponse | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
}

interface AuthActions {
  setUser: (user: UserResponse | null) => void;
  /** Mark session as authenticated. Optionally pass the user role for middleware routing. */
  setAuthenticated: (isAuthenticated: boolean, role?: string) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

// ─── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthStore>((set) => ({
  // State — isLoading starts TRUE so AuthGuard shows a skeleton until the
  // AuthProvider's rehydration effect completes. Without this, the guard sees
  // isLoading=false + isAuthenticated=false on the first render and immediately
  // redirects to /login before the session is verified.
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isLoggingOut: false,

  // Actions
  setUser: (user) => {
    set({ user, isAuthenticated: !!user });
  },

  setAuthenticated: (isAuthenticated, role?) => {
    if (isAuthenticated) {
      setAuthFlag(role);
    } else {
      clearAuthFlag();
    }
    set({ isAuthenticated });
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    clearAuthFlag();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: true,
    });
  },
}));

// Run legacy cleanup once when this module loads (client-side only).
clearLegacyUserCache();
