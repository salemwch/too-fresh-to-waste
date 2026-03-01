/**
 * Root Navigator
 * Orchestrates navigation based on authentication state
 *
 * PRODUCTION BOOT FLOW:
 * 1. Cold boot: Load from Keychain (authoritative) with retry → validate with backend → hydrate Redux
 * 2. Warm reload: Show MMKV-cached UI → validate in background → fallback to Keychain if invalid
 * 3. No logout flash: Preserve previous UI while validation runs
 */

import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { useTheme } from '@/design-system/providers';
import { loadStoredAuthAsync, logoutAsync } from '@/features/auth/store/authSlice';
import { Logger } from '@/utils/logger';
import { analytics } from '@/utils/analytics';
import { AuthFlowState } from '@/features/auth/types';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { BiometricAuth } from '@/services/BiometricAuth';
import { SecureStorage } from '@/services/SecureStorage';
import { onboardingStorage } from '@/storage/onboardingStorage';
import { OfflineBanner } from '@/design-system/components/molecules';
import { networkErrorBus } from '@/utils/networkErrorBus';

import { AuthStack } from './AuthStack';
import { linkingConfig } from './linking';
import { MainStack } from './MainStack';
import { navigationRef } from './navigationRef';
import { notificationService } from '@/services/NotificationService';

import type { RootNavigatorParamList } from './types';

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

// ============================================================================
// PRODUCTION: Navigation State Persistence Key
// ============================================================================
const NAVIGATION_STATE_KEY = '@food_waste_app:navigation_state';

/**
 * Root Navigator Component
 * Entry point for all navigation
 *
 * PRODUCTION FEATURES:
 * - Navigation state persistence (restore user's screen after app restart)
 * - Performance monitoring via onStateChange
 * - Ready callback for analytics initialization
 */
export const RootNavigator: React.FC = () => {
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  // ============================================================================
  // PRODUCTION: Navigation State Persistence
  // ============================================================================
  const [initialNavigationState, setInitialNavigationState] = useState<any>();
  const [isNavigationReady, setIsNavigationReady] = useState(!__DEV__);
  const routeNameRef = useRef<string | undefined>(undefined);
  // navigationRef is the module-level ref from navigationRef.ts (shared with NotificationService)

  // Get auth state from Redux (state-driven navigation)
  // NOTE: We intentionally do NOT use isLoading here.
  // isLoading should NOT trigger global LoadingScreen - each screen handles its own loading state.
  // Using isLoading here causes premature unmounting during async operations (login, register, etc.)
  const { flowState } = useAppSelector(state => state.auth);

  // ============================================================================
  // DEVICE CONNECTIVITY: Use NetInfo (real network state), NOT auth/API errors
  // isOffline = device has no WiFi/mobile data/airplane mode
  // This is completely separate from authentication state
  // ============================================================================
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState<string | null>(null);
  const networkErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || state.isInternetReachable === false;
      setIsDeviceOffline(offline);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to network error events from ErrorHandler
  useEffect(() => {
    const unsubscribe = networkErrorBus.subscribe((message: string) => {
      setNetworkErrorMessage(message);

      // Clear any existing dismiss timer
      if (networkErrorTimerRef.current) {
        clearTimeout(networkErrorTimerRef.current);
      }

      // Auto-dismiss after 5 seconds
      networkErrorTimerRef.current = setTimeout(() => {
        setNetworkErrorMessage(null);
        networkErrorTimerRef.current = null;
      }, 5000);
    });

    return () => {
      unsubscribe();
      if (networkErrorTimerRef.current) {
        clearTimeout(networkErrorTimerRef.current);
      }
    };
  }, []);

  // Determine banner visibility and message
  const showBanner = isDeviceOffline || networkErrorMessage !== null;
  const bannerMessage = isDeviceOffline
    ? 'No internet connection. Check your WiFi or mobile data.'
    : networkErrorMessage ?? '';

  /**
   * PRODUCTION: Restore Navigation State on App Launch
   * Provides better UX by returning user to their last screen
   * Only enabled in DEV for faster debugging
   */
  useEffect(() => {
    const restoreNavigationState = async () => {
      try {
        if (!__DEV__) {
          setIsNavigationReady(true);
          return;
        }

        // Check if app was opened with a deep link (cold start)
        // If so, skip saved state restoration to let linking config handle navigation
        const { Linking } = require('react-native');
        const initialURL = await Linking.getInitialURL();

        if (initialURL) {
          Logger.debug('[RootNavigator] Deep link detected, skipping state restoration', {
            url: initialURL,
          });
          setIsNavigationReady(true);
          return;
        }

        const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        if (savedState) {
          setInitialNavigationState(JSON.parse(savedState));
          Logger.debug('[RootNavigator] Restored navigation state from storage');
        }
      } catch (error) {
        Logger.warn('[RootNavigator] Failed to restore navigation state', {
          error: (error as Error).message,
        });
      } finally {
        setIsNavigationReady(true);
      }
    };

    void restoreNavigationState();
  }, []);

  /**
   * PRODUCTION BOOT FLOW
   *
   * Strategy:
   * 1. Check if MMKV has cached auth (warm reload)
   * 2. If cached: Show UI immediately, validate in background
   * 3. If not cached: Load from Keychain (cold boot)
   * 4. Always validate tokens with backend (refresh call)
   * 5. Never flash logout during validation
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check onboarding status first
        const welcomeSeen = await onboardingStorage.hasSeenWelcome();
        setHasSeenWelcome(welcomeSeen);

        // ✅ PRODUCTION: Load from authoritative source (Keychain) with retry
        // This will return null if no tokens in Keychain (clean install)
        Logger.info('[RootNavigator] Loading auth from Keychain (authoritative source)');
        const authData = await dispatch(loadStoredAuthAsync()).unwrap();

        // If no auth data in Keychain, user needs to login
        if (!authData) {
          Logger.info('[RootNavigator] No auth data in Keychain - user needs to login');
          setIsAppReady(true);
          return;
        }

        Logger.info('[RootNavigator] Auth loaded from Keychain - session middleware will validate');

        // NOTE: Token refresh is NOT dispatched here.
        // authSessionMiddleware starts immediately once flowState === AUTHENTICATED
        // after rehydration and handles proactive refresh with its own lock.
        // A second concurrent refresh here would race the middleware, sending the
        // same refresh token twice; the backend revokes it on first use, so the
        // second call returns 401 "Token has been revoked".

        // Check for biometric authentication
        const isBiometricEnabled = await SecureStorage.isBiometricEnabled();

        if (isBiometricEnabled) {
          const biometricSupport = await BiometricAuth.isSupported();

          if (biometricSupport.success) {
            const biometricName = BiometricAuth.getBiometricTypeName(
              biometricSupport.biometricType!,
            );

            const authResult = await BiometricAuth.authenticate(
              `Unlock Food Waste App with ${biometricName}`,
            );

            if (!authResult.success) {
              Logger.warn('[RootNavigator] Biometric auth failed - clearing session');

              await dispatch(logoutAsync({})).unwrap();

              Alert.alert(
                'Authentication Failed',
                typeof authResult.errorMessage === 'string' &&
                  authResult.errorMessage.trim().length > 0
                  ? authResult.errorMessage
                  : 'Please login with your credentials.',
                [{ text: 'OK' }],
              );
            }
          }
        }
      } catch (error) {
        // Loading stored auth failed - user will see login screen
        Logger.info('[RootNavigator] Failed to load stored auth - showing login', {
          error: (error as Error).message,
        });
      } finally {
        // Mark app as ready to show navigation
        setIsAppReady(true);
      }
    };

    void initializeAuth();
  }, [dispatch]);


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
    fonts: DefaultTheme.fonts,
  };

  /**
   * STATE-DRIVEN NAVIGATION
   * Determine which screen to show based on auth flow state and onboarding state
   * This is the enterprise-grade approach used by Uber, Airbnb, Instagram
   *
   * ✅ CRITICAL FIX: Check auth state FIRST, then onboarding
   * PRIORITY (checked in order):
   * 1. Authentication state (HIGHEST PRIORITY - authenticated users bypass onboarding)
   * 2. Onboarding gate (device-level, only for unauthenticated users)
   */
  const renderNavigator = () => {
    if (__DEV__) {
      console.log('[STATE-DRIVEN NAV] hasSeenWelcome:', hasSeenWelcome, 'flowState:', flowState);
    }

    // GATE 1: Authentication (user-level) - HIGHEST PRIORITY
    // ✅ Authenticated users go directly to MainStack (bypass onboarding)
    switch (flowState) {
      // App is initializing - show loading
      case AuthFlowState.INITIALIZING:
        return null; // Will show LoadingScreen below

      // ✅ User is authenticated - show main app immediately
      // BYPASS onboarding check - authenticated users don't need it
      case AuthFlowState.AUTHENTICATED:
        return (
          <Stack.Screen name='MainStack' component={MainStack} options={{ headerShown: false }} />
        );

      // For all other flow states, check onboarding gate
      case AuthFlowState.UNAUTHENTICATED:
      case AuthFlowState.REGISTRATION_PENDING:
      case AuthFlowState.EMAIL_VERIFICATION_PENDING:
      case AuthFlowState.PHONE_VERIFICATION_PENDING:
      case AuthFlowState.MFA_REQUIRED:
      case AuthFlowState.PASSWORD_RESET_REQUESTED:
      case AuthFlowState.PASSWORD_RESET_VERIFIED:
      case AuthFlowState.SESSION_EXPIRED:
      default:
        // GATE 2: Onboarding (device-level, only for unauthenticated users)
        if (!hasSeenWelcome) {
          // New user - show Welcome/Onboarding screen
          return (
            <Stack.Screen name='AuthStack' component={AuthStack} options={{ headerShown: false }} />
          );
        }

        // Returning user (seen welcome) but not authenticated - show Login
        return (
          <Stack.Screen name='AuthStack' component={AuthStack} options={{ headerShown: false }} />
        );
    }
  };

  /**
   * PRODUCTION: Navigation Ready Callback
   * Used for:
   * - Analytics initialization
   * - Performance monitoring
   * - Screen view tracking
   */
  const handleNavigationReady = () => {
    routeNameRef.current = navigationRef.getCurrentRoute()?.name;
    Logger.info('[RootNavigator] Navigation ready', { initialRoute: routeNameRef.current });

    // Check if app was opened from a killed-state notification tap.
    // Must run AFTER NavigationContainer is mounted so navigationRef.isReady() === true.
    void notificationService.handleKilledStateNotification();
  };

  /**
   * PRODUCTION: Track Navigation State Changes
   * Used for:
   * - Persisting navigation state (DEV only)
   * - Screen view analytics
   * - Performance monitoring
   */
  const handleNavigationStateChange = async (state: any) => {
    // Save state for restoration (DEV only)
    if (__DEV__) {
      try {
        await AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state));
      } catch (error) {
        Logger.warn('[RootNavigator] Failed to save navigation state', {
          error: (error as Error).message,
        });
      }
    }

    // Track screen views for analytics
    const previousRouteName = routeNameRef.current;
    const currentRoute = navigationRef.getCurrentRoute();
    const currentRouteName = currentRoute?.name;

    if (previousRouteName !== currentRouteName && currentRouteName) {
      Logger.debug('[RootNavigator] Screen changed', {
        from: previousRouteName,
        to: currentRouteName,
        params: currentRoute?.params,
      });

      analytics.trackScreenView(currentRouteName);
    }

    routeNameRef.current = currentRouteName;
  };

  /**
   * Wait for both auth AND navigation to be ready
   */
  if (!isAppReady || !isNavigationReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linkingConfig}
        initialState={initialNavigationState}
        onReady={handleNavigationReady}
        onStateChange={handleNavigationStateChange as any}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>{renderNavigator()}</Stack.Navigator>
      </NavigationContainer>

      {/* Offline banner - driven by device connectivity (NetInfo) OR API network errors */}
      {showBanner && (
        <OfflineBanner
          visible
          message={bannerMessage}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
