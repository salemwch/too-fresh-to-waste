/**
 * Root Navigator
 * Orchestrates navigation based on authentication state
 *
 * PRODUCTION BOOT FLOW:
 * 1. Cold boot: Load from Keychain (authoritative) with retry → validate with backend → hydrate Redux
 * 2. Warm reload: Show MMKV-cached UI → validate in background → fallback to Keychain if invalid
 * 3. No logout flash: Preserve previous UI while validation runs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { addEventListener as addNetInfoEventListener } from '@react-native-community/netinfo';
import {
  DefaultTheme,
  NavigationContainer,
  type InitialState,
  type NavigationState,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState, useRef } from 'react';
import {
  InteractionManager,
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';

import { OfflineBanner } from '@/design-system/components/molecules';
import { useTheme } from '@/design-system/providers';
import { loadStoredAuthAsync, logoutAsync } from '@/features/auth/store/authSlice';
import { AuthFlowState } from '@/features/auth/types';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { onboardingStorage } from '@/storage/onboardingStorage';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';
import { networkErrorBus } from '@/utils/networkErrorBus';

import { UserRole } from '@foodwaste/shared';

import { AuthStack } from './AuthStack';
import DriverStack from './DriverStack';
import { linkingConfig } from './linking';
import { MainStack } from './MainStack';
import { navigationRef } from './navigationRef';

import type { RootNavigatorParamList } from './types';
import { colorTokens } from '@/design-system/tokens/colors';

const Stack = createNativeStackNavigator<RootNavigatorParamList>();

// ============================================================================
// PRODUCTION: Navigation State Persistence Key
// ============================================================================
const NAVIGATION_STATE_KEY = '@food_waste_app:navigation_state';

const isPersistedNavigationState = (value: unknown): value is InitialState => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const maybeState = value as { routes?: unknown };
  return Array.isArray(maybeState.routes);
};

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
  const [initialNavigationState, setInitialNavigationState] = useState<InitialState | undefined>();
  const [isNavigationReady, setIsNavigationReady] = useState(!__DEV__);
  const routeNameRef = useRef<string | undefined>(undefined);
  // navigationRef is the module-level ref from navigationRef.ts (shared with NotificationService)

  // Get auth state from Redux (state-driven navigation)
  // NOTE: We intentionally do NOT use isLoading here.
  // isLoading should NOT trigger global LoadingScreen - each screen handles its own loading state.
  // Using isLoading here causes premature unmounting during async operations (login, register, etc.)
  const { flowState, user } = useAppSelector(state => state.auth);

  // ============================================================================
  // DEVICE CONNECTIVITY: Use NetInfo (real network state), NOT auth/API errors
  // isOffline = device has no WiFi/mobile data/airplane mode
  // This is completely separate from authentication state
  // ============================================================================
  const [isDeviceOffline, setIsDeviceOffline] = useState(false);
  const [networkErrorMessage, setNetworkErrorMessage] = useState<string | null>(null);
  const networkErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = addNetInfoEventListener(state => {
      const offline = state.isConnected === false;
      setIsDeviceOffline(offline);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to network error events from ErrorHandler
  // If errors repeat within the dismiss window, extend the timer to avoid flicker
  useEffect(() => {
    let errorCount = 0;
    const DISMISS_BASE_MS = 5000;
    const DISMISS_PERSISTENT_MS = 15000;

    const unsubscribe = networkErrorBus.subscribe((message: string) => {
      errorCount++;
      setNetworkErrorMessage(message);

      if (networkErrorTimerRef.current) {
        clearTimeout(networkErrorTimerRef.current);
      }

      const dismissDelay = errorCount >= 3 ? DISMISS_PERSISTENT_MS : DISMISS_BASE_MS;

      networkErrorTimerRef.current = setTimeout(() => {
        setNetworkErrorMessage(null);
        networkErrorTimerRef.current = null;
        errorCount = 0;
      }, dismissDelay);
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
  const bannerMessage = isDeviceOffline ? 'No internet connection' : (networkErrorMessage ?? '');

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
        const initialURL = await Linking.getInitialURL();

        if (typeof initialURL === 'string' && initialURL !== '') {
          Logger.debug('[RootNavigator] Deep link detected, skipping state restoration', {
            url: initialURL,
          });
          setIsNavigationReady(true);
          return;
        }

        const savedState = await AsyncStorage.getItem(NAVIGATION_STATE_KEY);
        if (savedState) {
          const parsedState = JSON.parse(savedState) as unknown;

          if (isPersistedNavigationState(parsedState)) {
            setInitialNavigationState(parsedState);
            Logger.debug('[RootNavigator] Restored navigation state from storage');
          } else {
            Logger.warn('[RootNavigator] Ignoring invalid persisted navigation state');
          }
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
   * PRODUCTION BOOT FLOW — non-blocking
   *
   * 1. Read onboarding flag (sync, MMKV)
   * 2. Mark app ready immediately — MMKV-cached flowState drives navigation
   * 3. Defer Keychain validation + biometric to after the first frame
   */
  useEffect(() => {
    const welcomeSeen = onboardingStorage.hasSeenWelcome();
    setHasSeenWelcome(welcomeSeen);

    // Show cached UI immediately — PersistGate already populated Redux from MMKV
    setIsAppReady(true);

    // Validate auth from Keychain after the first frame
    const handle = InteractionManager.runAfterInteractions(() => {
      const validateAuth = async () => {
        try {
          Logger.info('[RootNavigator] Validating auth from Keychain');
          const authData = await dispatch(loadStoredAuthAsync()).unwrap();

          if (!authData) {
            Logger.info('[RootNavigator] No auth data in Keychain');
            return;
          }

          Logger.info('[RootNavigator] Auth validated — session middleware will refresh');

          // Biometric check after auth is confirmed
          const { SecureStorage } = await import('@/services/SecureStorage');
          const isBiometricEnabled = await SecureStorage.isBiometricEnabled();

          if (isBiometricEnabled) {
            const { BiometricAuth } = await import('@/services/BiometricAuth');
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
          Logger.info('[RootNavigator] Failed to validate stored auth', {
            error: (error as Error).message,
          });
        }
      };

      void validateAuth();
    });

    return () => handle.cancel();
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
    // GATE 1: Authentication (user-level) - HIGHEST PRIORITY
    // ✅ Authenticated users go directly to MainStack (bypass onboarding)
    switch (flowState) {
      // App is initializing - show loading
      case AuthFlowState.INITIALIZING:
        return null; // Will show LoadingScreen below

      // Admin-created account: must set a new password before using the app
      case AuthFlowState.PASSWORD_CHANGE_REQUIRED:
        return (
          <Stack.Screen name='AuthStack' options={{ headerShown: false }}>
            {() => <AuthStack initialRouteName='ForceChangePassword' />}
          </Stack.Screen>
        );

      // ✅ User is authenticated - route by role
      // BYPASS onboarding check - authenticated users don't need it
      // DRIVER role gets the driver-specific stack; all other roles use MainStack
      case AuthFlowState.AUTHENTICATED:
        return user?.role === UserRole.DRIVER || (user?.role as string) === 'driver' ? (
          <Stack.Screen
            name='DriverStack'
            component={DriverStack}
            options={{ headerShown: false }}
          />
        ) : (
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
      case AuthFlowState.ACCOUNT_SUSPENDED:
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

    // Check killed-state notification tap after nav is ready (lazy import)
    void import('@/services/NotificationService').then(({ notificationService }) =>
      notificationService.handleKilledStateNotification(),
    );
  };

  /**
   * PRODUCTION: Track Navigation State Changes
   * Used for:
   * - Persisting navigation state (DEV only)
   * - Screen view analytics
   * - Performance monitoring
   */
  const handleNavigationStateChange = (state: Readonly<NavigationState> | undefined) => {
    if (__DEV__ && state !== undefined) {
      void AsyncStorage.setItem(NAVIGATION_STATE_KEY, JSON.stringify(state)).catch(error => {
        Logger.warn('[RootNavigator] Failed to save navigation state', {
          error: (error as Error).message,
        });
      });
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
        <ActivityIndicator size='large' color={colorTokens.base.success[500]} />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linkingConfig}
        {...(initialNavigationState !== undefined ? { initialState: initialNavigationState } : {})}
        onReady={handleNavigationReady}
        onStateChange={handleNavigationStateChange}
      >
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {renderNavigator()}
        </Stack.Navigator>
      </NavigationContainer>

      {/* Offline banner - driven by device connectivity (NetInfo) OR API network errors */}
      {showBanner && <OfflineBanner visible message={bannerMessage} />}
    </>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colorTokens.light.background,
  },
});
