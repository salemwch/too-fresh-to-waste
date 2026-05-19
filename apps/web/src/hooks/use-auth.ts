'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { authService } from '@/services/auth.service';
import type { LoginRequest, RegisterRequest } from '@foodwaste/shared';

export function useAuth() {
  const store = useAuthStore();
  const router = useRouter();
  const locale = useLocale();
  const queryClient = useQueryClient();

  const login = useCallback(
    async (data: LoginRequest) => {
      store.setLoading(true);
      try {
        const response = await authService.login(data);
        const { user } = response.data.data;
        // Backend sets HttpOnly cookies (access_token, refresh_token) via
        // Set-Cookie header. No tokens are stored in JavaScript memory.
        store.setAuthenticated(true);
        store.setUser(user);
        return response.data.data;
      } finally {
        store.setLoading(false);
      }
    },
    [store],
  );

  const register = useCallback(
    async (data: RegisterRequest) => {
      store.setLoading(true);
      try {
        // Registration does NOT return tokens — user must verify email first.
        // Tokens are issued at POST /auth/verify-email (auto-login after verification).
        const response = await authService.register(data);
        return response.data.data;
      } finally {
        store.setLoading(false);
      }
    },
    [store],
  );

  const googleSignIn = useCallback(
    async (idToken: string) => {
      store.setLoading(true);
      try {
        const response = await authService.googleSignIn(idToken);
        const { user } = response.data.data;
        // Backend sets HttpOnly cookies (access_token, refresh_token) via
        // Set-Cookie header. No tokens are stored in JavaScript memory.
        store.setAuthenticated(true);
        store.setUser(user);
        return response.data.data;
      } finally {
        store.setLoading(false);
      }
    },
    [store],
  );

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Logout should always clear local state even if API fails
    } finally {
      // Clear all TanStack Query caches (user profile, orders, etc.)
      queryClient.clear();
      store.logout();
      router.replace(`/${locale}/login`);
    }
  }, [store, router, locale, queryClient]);

  return {
    user: store.user,
    isAuthenticated: store.isAuthenticated,
    isLoading: store.isLoading,
    login,
    register,
    googleSignIn,
    logout,
  };
}
