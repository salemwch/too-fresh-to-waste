/**
 * Protected Route Component
 * Wrapper for screens that require authentication and specific roles
 * Handles token expiration and role-based access control
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { logoutAsync } from '@/features/auth/store/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { refreshTokenSafe } from '@/services/authRefresh';
import { Logger } from '@/utils/logger';

import type { UserRole } from '@/features/auth/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
}

const hasRenderableNode = (
  value: React.ReactNode | undefined,
): value is Exclude<React.ReactNode, null | undefined | false> =>
  value !== null && value !== undefined && value !== false;

/**
 * Protected Route Component
 *
 * Features:
 * - Automatic token refresh when token is about to expire
 * - Role-based access control
 * - Session expiration handling
 * - Loading states during auth checks
 *
 * @param children - The protected content to render
 * @param requiredRoles - Array of roles allowed to access this route (optional)
 * @param fallback - Custom fallback component for unauthorized access (optional)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  fallback,
}) => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const [isSessionLogoutPending, setIsSessionLogoutPending] = useState(false);

  const { isAuthenticated, isLoading, user, sessionExpiresAt } = useAppSelector(
    state => state.auth,
  );

  const hasRequiredRole = (): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  // useEffectEvent polyfill: stable identity, always reads latest closure values.
  //
  // IMPORTANT: Route refresh through `refreshTokenSafe`, NOT a direct
  // `dispatch(refreshTokenAsync())`. The session middleware and axios 401
  // interceptor share a single-flight lock in `services/authRefresh.ts`;
  // dispatching the thunk directly here would run in parallel to them and
  // send a STALE refresh token right after the middleware has already
  // rotated it on the backend — producing the "Token has been revoked"
  // loop seen on app resume after long background periods.
  const checkAndRefreshTokenLatest = useRef(() => {});
  checkAndRefreshTokenLatest.current = () => {
    if (!isAuthenticated || !sessionExpiresAt) return;

    const expiresAt = new Date(sessionExpiresAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    if (!Number.isFinite(expiresAt) || expiresAt - Date.now() >= fiveMinutes) return;

    void refreshTokenSafe(dispatch).then(result => {
      if (result.success) {
        Logger.info('[ProtectedRoute] Token refreshed successfully');
        return;
      }

      if (result.isNetworkError === true) {
        Logger.warn('[ProtectedRoute] Token refresh failed due to network error', {
          message: result.error,
        });
        return;
      }

      Logger.error(
        '[ProtectedRoute] Token refresh failed and session will expire',
        { message: result.error },
        new Error(result.error ?? 'Unknown error'),
      );
    });
  };
  const checkAndRefreshToken = useCallback(() => checkAndRefreshTokenLatest.current(), []);

  const triggerSessionLogoutLatest = useRef(() => {});
  triggerSessionLogoutLatest.current = () => {
    setIsSessionLogoutPending(true);
    void dispatch(logoutAsync({})).finally(() => {
      setIsSessionLogoutPending(false);
    });
  };
  const triggerSessionLogout = useCallback(() => triggerSessionLogoutLatest.current(), []);

  useEffect(() => {
    checkAndRefreshToken();
  }, [isAuthenticated, sessionExpiresAt]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      checkAndRefreshToken();
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !sessionExpiresAt) {
      return;
    }

    const expiresAt = new Date(sessionExpiresAt).getTime();
    if (!Number.isFinite(expiresAt)) {
      return;
    }

    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      triggerSessionLogout();
      return;
    }

    const timeoutId = setTimeout(() => {
      triggerSessionLogout();
    }, remainingMs);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, sessionExpiresAt]);

  const renderUnauthorized = () => {
    if (hasRenderableNode(fallback)) return fallback;

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <Text variant='headline' size='lg' color='error' align='center' style={styles.title}>
            Access Denied
          </Text>
          <Text variant='body' size='md' color='secondary' align='center' style={styles.message}>
            You don&apos;t have permission to access this content.
            {requiredRoles && `\n\nRequired role: ${requiredRoles.join(', ')}`}
          </Text>
        </View>
      </View>
    );
  };

  const renderLoading = () => (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size='large' color={theme.colors.primary} />
    </View>
  );

  if (isLoading || (isSessionLogoutPending && isAuthenticated)) {
    return renderLoading();
  }

  if (!isAuthenticated) {
    return renderUnauthorized();
  }

  if (user?.isEmailVerified !== true) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <Text variant='headline' size='lg' color='warning' align='center' style={styles.title}>
            Email Verification Required
          </Text>
          <Text variant='body' size='md' color='secondary' align='center' style={styles.message}>
            Please verify your email address to access this content. Check your inbox for the
            verification link.
          </Text>
        </View>
      </View>
    );
  }

  if (!hasRequiredRole()) {
    return renderUnauthorized();
  }

  return children;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    maxWidth: 400,
    width: '100%',
  },
  title: {
    marginBottom: 16,
  },
  message: {
    lineHeight: 24,
  },
});
