/**
 * Root Navigator
 * Orchestrates navigation based on authentication state
 * Handles initial auth loading and conditional rendering
 */

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';

import { useTheme } from '@/design-system/providers';
import { loadStoredAuthAsync, logoutAsync } from '@/features/auth/store/authSlice';
import { AuthFlowState } from '@/features/auth/types';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { BiometricAuth } from '@/services/BiometricAuth';
import { SecureStorage } from '@/services/SecureStorage';
import { onboardingStorage } from '@/storage/onboardingStorage';

import { AuthStack } from './AuthStack';
import { linkingConfig } from './linking';
import { MainStack } from './MainStack';

import type { RootNavigatorParamList } from './types';

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

/**
 * Loading Screen Component
 * Displayed while checking authentication state
 */
const LoadingScreen: React.FC = () => {
  const theme = useTheme();

  return (
    <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size='large' color={theme.colors.primary} />
    </View>
  );
};

/**
 * Root Navigator Component
 * Entry point for all navigation
 */
export const RootNavigator: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const [isAppReady, setIsAppReady] = useState(false);

  // SYNCHRONOUS onboarding check (no await/Promise - instant read)
  // This must happen BEFORE rendering navigators to avoid flicker
  // Device-level flag that survives login/logout
  const hasSeenWelcome = onboardingStorage.hasSeenWelcome();

  // Get auth state from Redux (state-driven navigation)
  // NOTE: We intentionally do NOT use isLoading here.
  // isLoading should NOT trigger global LoadingScreen - each screen handles its own loading state.
  // Using isLoading here causes premature unmounting during async operations (login, register, etc.)
  const { flowState, sessionExpiresAt } = useAppSelector(state => state.auth);

  /**
   * Initialize app by loading stored authentication
   * Runs once on mount
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Load stored auth tokens and user data from Keychain
        const authData = await dispatch(loadStoredAuthAsync()).unwrap();

        // If auth data loaded successfully, check for biometric authentication
        if (authData) {
          const isBiometricEnabled = await SecureStorage.isBiometricEnabled();

          if (isBiometricEnabled) {
            // Check if device supports biometric authentication
            const biometricSupport = await BiometricAuth.isSupported();

            if (biometricSupport.success) {
              // Prompt for biometric authentication
              const biometricName = BiometricAuth.getBiometricTypeName(
                biometricSupport.biometricType!,
              );

              const authResult = await BiometricAuth.authenticate(
                `Unlock Food Waste App with ${biometricName}`,
              );

              if (!authResult.success) {
                // Biometric authentication failed or was cancelled
                console.log('Biometric authentication failed:', authResult.error);

                // Clear session and show login screen
                await dispatch(logoutAsync()).unwrap();

                Alert.alert(
                  'Authentication Failed',
                  typeof authResult.errorMessage === 'string' &&
                    authResult.errorMessage.trim().length > 0
                    ? authResult.errorMessage
                    : 'Please login with your credentials.',
                  [{ text: 'OK' }],
                );
              }
              // If biometric succeeded, continue with loaded session
            }
            // If biometric not supported but enabled, continue with session
            // (biometric might have been disabled on device after being enabled in app)
          }
        }
      } catch (error) {
        // If loading stored auth fails, user will see login screen
        console.log('No stored authentication found or session expired');
      } finally {
        // Mark app as ready to show navigation
        setIsAppReady(true);
      }
    };

    void initializeAuth();
  }, [dispatch]);

  /**
   * Check session expiration periodically
   * Auto-logout if session has expired
   */
  useEffect(() => {
    if (
      flowState !== AuthFlowState.AUTHENTICATED ||
      sessionExpiresAt === null ||
      sessionExpiresAt === undefined ||
      sessionExpiresAt === ''
    ) {
      return;
    }

    const checkSessionExpiration = () => {
      const now = Date.now();
      const expiresAt = new Date(sessionExpiresAt).getTime();

      if (now >= expiresAt) {
        console.warn('[STATE-DRIVEN NAV] Session expired, logging out...');
        // Session expired - Redux will handle logout via token refresh failure
      }
    };

    // Check immediately
    checkSessionExpiration();

    // Check every minute
    const intervalId = setInterval(checkSessionExpiration, 60000);

    return () => clearInterval(intervalId);
  }, [flowState, sessionExpiresAt]);

  /**
   * Show loading screen ONLY during initial app load
   *
   * IMPORTANT: Do NOT add isLoading here!
   * Adding isLoading causes premature unmounting of screens during async operations.
   * Each screen (LoginScreen, RegisterScreen, etc.) handles its own loading state
   * via the button's `loading` prop.
   */
  if (!isAppReady) {
    return <LoadingScreen />;
  }

  /**
   * Navigation theme configuration
   */
  const navigationTheme = {
    dark: theme.mode === 'dark',
    colors: {
      primary: theme.colors.primary,
      background: theme.colors.background,
      card: theme.colors.surface,
      text: theme.colors.onSurface,
      border: theme.colors.outline,
      notification: theme.colors.error,
    },
  };

  /**
   * STATE-DRIVEN NAVIGATION
   * Determine which screen to show based on onboarding state and auth flow state
   * This is the enterprise-grade approach used by Uber, Airbnb, Instagram
   *
   * PRIORITY (checked in order):
   * 1. Onboarding gate (device-level, checked first)
   * 2. Auth state (user-level)
   */
  const renderNavigator = () => {
    if (__DEV__) {
      console.log('[STATE-DRIVEN NAV] hasSeenWelcome:', hasSeenWelcome, 'flowState:', flowState);
    }

    // GATE 1: Onboarding (device-level, persists across login/logout)
    // If user hasn't seen welcome screen, show it regardless of auth state
    if (!hasSeenWelcome) {
      // AuthStack will render Welcome screen as initial route
      return (
        <Stack.Screen name='AuthStack' component={AuthStack} options={{ headerShown: false }} />
      );
    }

    // GATE 2: Authentication (user-level)
    switch (flowState) {
      // App is initializing - show loading
      case AuthFlowState.INITIALIZING:
        return null; // Will show LoadingScreen below

      // User is fully authenticated and verified - show main app
      case AuthFlowState.AUTHENTICATED:
        return (
          <Stack.Screen name='MainStack' component={MainStack} options={{ headerShown: false }} />
        );

      // All other states show AuthStack (will skip Welcome and go to Login)
      case AuthFlowState.UNAUTHENTICATED:
      case AuthFlowState.REGISTRATION_PENDING:
      case AuthFlowState.EMAIL_VERIFICATION_PENDING:
      case AuthFlowState.PHONE_VERIFICATION_PENDING:
      case AuthFlowState.MFA_REQUIRED:
      case AuthFlowState.PASSWORD_RESET_REQUESTED:
      case AuthFlowState.PASSWORD_RESET_VERIFIED:
      case AuthFlowState.SESSION_EXPIRED:
      default:
        return (
          <Stack.Screen name='AuthStack' component={AuthStack} options={{ headerShown: false }} />
        );
    }
  };

  return (
    <NavigationContainer theme={navigationTheme} linking={linkingConfig}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>{renderNavigator()}</Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
