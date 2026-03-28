/**
 * Protected Route Component
 * Wrapper for screens that require authentication and specific roles
 * Handles token expiration and role-based access control
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { refreshTokenAsync, logoutAsync } from '@/features/auth/store/authSlice';
import { useAppSelector, useAppDispatch } from '@/hooks/redux';

import type { UserRole } from '@/features/auth/types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: UserRole[];
  fallback?: React.ReactNode;
}

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

  // Get auth state from Redux
  const { isAuthenticated, isLoading, user, tokens, sessionExpiresAt } = useAppSelector(
    state => state.auth,
  );

  /**
   * Check if user has required role
   */
  const hasRequiredRole = (): boolean => {
    if (!requiredRoles || requiredRoles.length === 0) return true;
    if (!user) return false;
    return requiredRoles.includes(user.role);
  };

  /**
   * Check if token needs refresh
   * Refresh if token expires in less than 5 minutes
   */
  const shouldRefreshToken = (): boolean => {
    if (!sessionExpiresAt || !tokens) return false;

    const now = Date.now();
    const expiresAt = new Date(sessionExpiresAt).getTime();
    const fiveMinutes = 5 * 60 * 1000;

    return expiresAt - now < fiveMinutes;
  };

  /**
   * Handle token refresh
   */
  useEffect(() => {
    const checkAndRefreshToken = async () => {
      if (!isAuthenticated || !tokens?.refreshToken) return;

      if (shouldRefreshToken()) {
        try {
          await dispatch(refreshTokenAsync()).unwrap();
          console.log('Token refreshed successfully');
        } catch (error) {
          // The refreshTokenAsync.rejected reducer already handles the state:
          // - Network errors → keep session alive, show offline banner
          // - Auth errors → set SESSION_EXPIRED
          // Do NOT force logout here — the reducer handles the distinction.
          const rejectionPayload = error as { message?: string; isNetworkError?: boolean } | undefined;
          if (rejectionPayload?.isNetworkError) {
            console.warn('Token refresh failed (network) — session preserved, will retry');
          } else {
            console.error('Token refresh failed (auth) — session expired');
          }
        }
      }
    };

    checkAndRefreshToken();

    // Check every minute
    const intervalId = setInterval(checkAndRefreshToken, 60000);

    return () => clearInterval(intervalId);
  }, [isAuthenticated, tokens, sessionExpiresAt, dispatch]);

  /**
   * Render unauthorized access screen
   */
  const renderUnauthorized = () => {
    if (fallback) return fallback;

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.content}>
          <Text variant='headline' size='lg' color='error' align='center' style={styles.title}>
            Access Denied
          </Text>
          <Text variant='body' size='md' color='secondary' align='center' style={styles.message}>
            You don't have permission to access this content.
            {requiredRoles && `\n\nRequired role: ${requiredRoles.join(', ')}`}
          </Text>
        </View>
      </View>
    );
  };

  /**
   * Render loading state
   */
  const renderLoading = () => (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size='large' color={theme.colors.primary} />
    </View>
  );

  // Show loading during auth checks
  if (isLoading) {
    return renderLoading();
  }

  // User not authenticated - should not happen in MainStack
  // RootNavigator handles this, but as a safety measure
  if (!isAuthenticated) {
    return renderUnauthorized();
  }

  // Check email verification
  if (!user?.isEmailVerified) {
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

  // Check role-based access
  if (!hasRequiredRole()) {
    return renderUnauthorized();
  }

  // Check if session has expired
  if (sessionExpiresAt && new Date(sessionExpiresAt).getTime() < Date.now()) {
    // Trigger logout
    dispatch(logoutAsync({}));
    return renderLoading();
  }

  // All checks passed - render protected content
  return <>{children}</>;
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
