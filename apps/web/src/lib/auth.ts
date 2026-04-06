import { create } from 'zustand';
import type { UserResponse } from '@foodwaste/shared';

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
  setAuthenticated: (isAuthenticated: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

// ─── Store ───────────────────────────────────────────────────────────────────
//
// Auth tokens are NEVER stored in JavaScript memory.
// The backend sets HttpOnly cookies (access_token, refresh_token) that are
// completely inaccessible to client-side code (XSS-proof).
//
// Route protection is handled by Next.js middleware, which verifies the JWT
// server-side using jose — no client-side flag cookies needed.
//
// This store only holds the user profile (for UI rendering) and a boolean
// flag for client-side conditional rendering (e.g. show/hide nav items).
// The isAuthenticated flag is set by AuthProvider after GET /auth/me succeeds.
export const useAuthStore = create<AuthStore>(set => ({
  // State — isLoading starts TRUE so AuthGuard shows a skeleton until the
  // AuthProvider's rehydration effect completes. Without this, the guard sees
  // isLoading=false + isAuthenticated=false on the first render and immediately
  // redirects to /login before the session is verified.
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isLoggingOut: false,

  // Actions
  setUser: user => {
    set({ user, isAuthenticated: !!user });
  },

  setAuthenticated: isAuthenticated => {
    set({ isAuthenticated });
  },

  setLoading: isLoading => set({ isLoading }),

  logout: () => {
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
