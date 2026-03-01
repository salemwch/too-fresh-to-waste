import { create } from 'zustand';
import type { UserResponse } from '@foodwaste/shared';

// ─── Cookie helpers ──────────────────────────────────────────────────────────
// NOTE: document.cookie cannot set HttpOnly — these cookies are readable by JS.
// True HttpOnly security requires the backend to issue tokens via Set-Cookie headers.
// The benefit here is SameSite=Lax (CSRF protection) + cross-tab / cross-restart persistence.

function setCookie(name: string, value: string, days: number) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const row = document.cookie.split('; ').find((r) => r.startsWith(`${name}=`));
  if (!row) return null;
  try {
    // Use slice(name.length + 1) to handle values that contain '='
    return decodeURIComponent(row.slice(name.length + 1));
  } catch {
    return null;
  }
}

// ─── Access token cookie (7 days — read by Next.js middleware for route guards) ─
export function readPersistedAccessToken(): string | null {
  return readCookie('access_token');
}

// ─── Refresh token cookie (30 days — persists across tabs and browser restarts) ─
// Moved from sessionStorage which was wiped on every tab close / new tab.
const RT_COOKIE = 'wfa_rt';
const RT_MAX_DAYS = 30;

function saveRefreshToken(token: string) {
  setCookie(RT_COOKIE, token, RT_MAX_DAYS);
}

function clearRefreshToken() {
  deleteCookie(RT_COOKIE);
}

export function readPersistedRefreshToken(): string | null {
  return readCookie(RT_COOKIE);
}

// ─── User profile cache (localStorage) ──────────────────────────────────────
// Stores the last-known user object so the merchant sees their dashboard
// immediately on load and stays authenticated during transient network errors.
const USER_CACHE_KEY = 'wfa_user';

function saveUserCache(user: UserResponse) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    // localStorage can throw in private browsing when storage is full
  }
}

function clearUserCache() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(USER_CACHE_KEY);
}

export function readCachedUser(): UserResponse | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_CACHE_KEY);
    return raw ? (JSON.parse(raw) as UserResponse) : null;
  } catch {
    return null;
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isLoggingOut: boolean;
}

interface AuthActions {
  setUser: (user: UserResponse | null) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setLoading: (isLoading: boolean) => void;
  logout: () => void;
}

type AuthStore = AuthState & AuthActions;

// ─── Store ───────────────────────────────────────────────────────────────────
export const useAuthStore = create<AuthStore>((set) => ({
  // State
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  isLoggingOut: false,

  // Actions
  setUser: (user) => {
    // Keep the local user cache in sync so rehydration can restore it
    if (user) saveUserCache(user);
    set({ user, isAuthenticated: !!user });
  },

  setTokens: (accessToken, refreshToken) => {
    setCookie('access_token', accessToken, 7);
    saveRefreshToken(refreshToken);
    set({ accessToken, refreshToken });
  },

  setLoading: (isLoading) => set({ isLoading }),

  logout: () => {
    deleteCookie('access_token');
    clearRefreshToken();
    clearUserCache();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      isLoggingOut: true,
    });
  },
}));
