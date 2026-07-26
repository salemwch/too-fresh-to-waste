import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import React, { Component, useEffect } from 'react';
import { Config } from 'react-native-config';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { StatusBar, StyleSheet, View, Text, Pressable } from 'react-native';
import i18n from '@/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Provider as ReduxProvider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { OfflineBanner } from '@/components/Errors';
import { ForceUpdateModal } from '@/components/ForceUpdateModal';
import { SoftUpdateBanner } from '@/components/SoftUpdateBanner';
import { environment, validateEnvironmentConfig } from '@/config/environment';
import { ThemeProvider } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { AuthFlowState } from '@/features/auth/types';
import { authKeys } from '@/features/auth/queryKeys';
import { favoriteKeys } from '@/features/favorites/hooks/favoriteKeys';
import { QueryProvider } from '@/lib/react-query';
import { RootNavigator } from '@/navigation';
import { localLocationService } from '@/services/location/LocalLocationService';
import { notificationService } from '@/services/NotificationService';
import { registerOfflineHandlers, stopOfflineHandlers } from '@/services/offlineHandlers';
import { socketService } from '@/services/socketService';
import { store, persistor } from '@/store';
import { RehydrationGate } from '@/store/rehydrationOrchestrator';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';
import { Logger, NativeModuleLogger } from '@/utils';
import { analytics } from '@/utils/analytics';
import { offlineManager } from '@/utils/offlineManager';
import { toastConfig } from '@/utils/toast';

import type { ErrorInfo, ReactNode } from 'react';
import type { RootState } from '@/store';

// ─── Global Error Boundary ──────────────────────────────────────────────────
interface GlobalErrorBoundaryState {
  hasError: boolean;
}

/**
 * Styles for the crash screen.
 *
 * Reads `colorTokens` directly rather than `useTheme()` on purpose: this is the
 * last line of defence, and it has to render even when the crash it is catching
 * came from ThemeProvider itself. The token module is a plain object with no
 * React context behind it, which keeps the palette honest (no raw hex, per
 * .claude/rules/ui-ux.md) without depending on a provider that may be down.
 */
const crashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: colorTokens.base.neutral[0],
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colorTokens.base.primary[500],
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: colorTokens.base.neutral[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: colorTokens.base.primary[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonLabel: {
    color: colorTokens.base.neutral[0],
    fontSize: 16,
    fontWeight: '600',
  },
});

class GlobalErrorBoundary extends Component<{ children: ReactNode }, GlobalErrorBoundaryState> {
  override state: GlobalErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    Logger.error(
      '[GlobalErrorBoundary] Unrecoverable crash',
      { componentStack: info.componentStack },
      error,
    );
  }

  override render() {
    if (this.state.hasError) {
      return (
        <View style={crashStyles.container}>
          <Text style={crashStyles.title}>{i18n.t('common.somethingWentWrong')}</Text>
          <Text style={crashStyles.body}>{i18n.t('errors.unexpectedErrorRestart')}</Text>
          <Pressable
            accessibilityRole='button'
            onPress={() => this.setState({ hasError: false })}
            style={crashStyles.button}
          >
            <Text style={crashStyles.buttonLabel}>{i18n.t('common.tryAgain')}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

// ─── Global error handler ────────────────────────────────────────────────────
// Must be installed BEFORE Sentry.init so that we can chain handlers correctly.
// In Hermes, ErrorUtils catches both uncaught exceptions AND unhandled Promise
// rejections, so a single handler covers both cases.
const _previousHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
  Logger.error('[App] Uncaught global error', { isFatal: isFatal ?? false }, error);
  // Forward to the previous handler (will be Sentry's after Sentry.init below)
  _previousHandler?.(error, isFatal);
});

// ✅ PRODUCTION: Safe Sentry initialization with error handling
// Prevents app crash if Sentry native module fails to initialize
try {
  Sentry.init({
    // DSN is injected at build time via react-native-config (SENTRY_DSN in .env.*).
    // Never hardcode it — rotation requires a new release if baked in.
    dsn: Config['SENTRY_DSN'] ?? '',

    // Adds more context data to events (IP address, cookies, user, etc.)
    // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
    sendDefaultPii: true,

    // Enable Logs
    enableLogs: false,

    // Configure Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration()],

    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
  Logger.info('[App] Sentry initialized successfully');
} catch (error) {
  // Sentry initialization failed - log but don't crash
  Logger.error('[App] Sentry initialization failed', {}, error as Error);
}

// ─── Startup environment validation ─────────────────────────────────────────
// Runs once at module load. Logs warnings for misconfiguration and, in
// production, reports each issue to Sentry so the team is alerted immediately
// rather than discovering problems at runtime.
{
  const { isValid, errors } = validateEnvironmentConfig();
  if (!isValid) {
    errors.forEach(msg => {
      Logger.warn(`[App] Config issue: ${msg}`);
      if (!__DEV__) {
        Sentry.captureMessage(`[Config] ${msg}`, 'warning');
      }
    });
  }
}

/**
 * Inner App Component (inside Redux Provider)
 * Handles auth-dependent logic like favorites sync
 */
function AppContent(): React.JSX.Element {
  const queryClient = useQueryClient();
  const flowState = useSelector((state: RootState) => state.auth.flowState);
  const userId = useSelector((state: RootState) => state.auth.user?.userId ?? null);
  const versionCheck = useAppVersionCheck();

  // ✅ Initialize Local Location Service on app startup (runs once)
  // Loads tunisian-cities.json into memory for fast local searches
  useEffect(() => {
    localLocationService.initialize().catch(error => {
      Logger.error('Failed to initialize LocalLocationService', {}, error);
    });
  }, []);

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: Config['GOOGLE_WEB_CLIENT_ID'] ?? '',
    });
  }, []);

  // Track session expiry for retry logic
  const sessionExpiresAt = useSelector((state: RootState) => state.auth.sessionExpiresAt);

  // ✅ Sync analytics user identity with auth state
  useEffect(() => {
    if (flowState === AuthFlowState.AUTHENTICATED && userId) {
      analytics.setUserId(userId);
    } else if (
      flowState === AuthFlowState.UNAUTHENTICATED ||
      flowState === AuthFlowState.SESSION_EXPIRED
    ) {
      analytics.setUserId(null);
    }
  }, [flowState, userId]);

  // ✅ Register / unregister FCM token based on auth state
  useEffect(() => {
    if (flowState === AuthFlowState.AUTHENTICATED) {
      // Register token so the backend can send push notifications to this device
      const registerNotificationToken = async (): Promise<void> => {
        const token = await notificationService.getToken();
        if (!token) {
          return;
        }

        await notificationService.registerTokenWithBackend(token);
      };

      registerNotificationToken().catch(error => {
        Logger.error('[App] Failed to register notification token', {}, error as Error);
      });
    } else if (
      flowState === AuthFlowState.UNAUTHENTICATED ||
      flowState === AuthFlowState.SESSION_EXPIRED
    ) {
      // Unregister on logout so the device stops receiving notifications
      const unregisterNotificationToken = async (): Promise<void> => {
        await notificationService.unregisterTokenFromBackend();
      };

      unregisterNotificationToken().catch(error => {
        Logger.error('[App] Failed to unregister notification token', {}, error as Error);
      });
    }
  }, [flowState]);

  // ✅ Sync favorites when user is fully authenticated
  // IMPORTANT: Use flowState instead of isAuthenticated to avoid race condition
  // during app initialization. flowState=AUTHENTICATED is set AFTER token validation,
  // while isAuthenticated can be true from persisted state before tokens are validated.
  //
  // ✅ RACE CONDITION FIX (2026-02-04):
  // Added sessionExpiresAt dependency to retry sync after successful token refresh.
  // When app launches with expired tokens, useFavoriteIds skips the API call.
  // After auth middleware refreshes tokens, sessionExpiresAt changes, triggering retry.
  useEffect(() => {
    if (flowState === AuthFlowState.AUTHENTICATED) {
      // Only sync if session hasn't expired locally
      // (useFavoriteIds has its own auth guard; this avoids pointless work)
      const isSessionValid =
        sessionExpiresAt == null ||
        sessionExpiresAt === '' ||
        new Date(sessionExpiresAt).getTime() > Date.now();

      if (isSessionValid) {
        // Invalidate rather than fetch: useFavoriteIds is already gated on auth
        // readiness, so marking the data stale lets whichever screen needs it
        // refetch on mount. Nothing is requested if no screen is watching.
        void queryClient.invalidateQueries({ queryKey: favoriteKeys.all });
      }
    } else if (
      flowState === AuthFlowState.UNAUTHENTICATED ||
      flowState === AuthFlowState.SESSION_EXPIRED
    ) {
      // Remove, don't invalidate: these are user-scoped, and invalidating would
      // leave the previous account's data readable until a refetch landed.
      // removeQueries drops them from memory and from the persisted cache.
      queryClient.removeQueries({ queryKey: favoriteKeys.all });
      queryClient.removeQueries({ queryKey: authKeys.all });
    }
  }, [flowState, sessionExpiresAt, queryClient]);

  return (
    <>
      <OfflineBanner />
      <SoftUpdateBanner
        visible={versionCheck.updateType === 'soft' && !versionCheck.dismissed}
        updateUrl={versionCheck.updateUrl}
        onDismiss={versionCheck.dismiss}
      />
      <StatusBar translucent backgroundColor='transparent' />
      <RootNavigator />
      <ForceUpdateModal
        visible={versionCheck.updateType === 'force'}
        updateUrl={versionCheck.updateUrl}
        latestVersion={versionCheck.latestVersion}
      />
      <Toast config={toastConfig} />
    </>
  );
}

/**
 * Main App Component
 * Wraps the entire app with necessary providers
 *
 * Provider Hierarchy:
 * 1. GestureHandlerRootView - Gesture handling
 * 2. SafeAreaProvider - Safe area insets
 * 3. ReduxProvider - Global state management
 * 4. PersistGate - Redux persistence
 * 5. QueryProvider - TanStack Query (data fetching, caching)
 * 6. ThemeProvider - Design system theming
 * 7. AppContent - Auth logic + RootNavigator
 */
function App(): React.JSX.Element {
  // ✅ Initialize offline manager (network connectivity)
  useEffect(() => {
    Logger.info('[App] Initializing offline manager...');
    offlineManager.initialize();

    return () => {
      offlineManager.cleanup();
    };
  }, []);

  // Register offline write queue handlers and start listening for reconnect.
  // Must run after offlineManager initialises so the NetInfo subscription does
  // not race the manager's own listener.
  useEffect(() => {
    registerOfflineHandlers();
    return stopOfflineHandlers;
  }, []);

  // ✅ Initialize WebSocket connection for real-time updates (community goal, etc.)
  useEffect(() => {
    socketService.connect();
    return () => {
      socketService.disconnect();
    };
  }, []);

  // ✅ Initialize push notifications (FCM)
  // Request permission + set up foreground handler.
  // Foreground messages show as toast; navigation is handled on tap (background/killed).
  useEffect(() => {
    notificationService.initialize((data, title, body) => {
      // Show in-app toast for foreground messages — do NOT auto-navigate
      Toast.show({
        type: 'info',
        text1: title,
        ...(body ? { text2: body } : {}),
        visibilityTime: 5000,
        onPress: () => {
          const navigateFromForegroundNotification = async (): Promise<void> => {
            const { navigateFromNotification } = await import('@/navigation/navigationRef');

            navigateFromNotification(data);
          };

          // User tapped the foreground toast — navigate as if it were a background tap
          navigateFromForegroundNotification().catch(error => {
            Logger.error(
              '[App] Failed to navigate from foreground notification tap',
              {},
              error as Error,
            );
          });
          Toast.hide();
        },
      });
    });

    // Request permission (non-blocking — ask once, respect user's choice)
    void notificationService.requestPermission();

    return () => {
      notificationService.cleanup();
    };
  }, []);

  // ✅ Initialize native module debugging in development
  useEffect(() => {
    if (__DEV__ && environment.debug.enableNativeModuleLogging) {
      Logger.info('[App] Initializing native module debugging...');

      // Enable native module logger
      NativeModuleLogger.enable();

      // Run Maps diagnostics
      NativeModuleLogger.logMapsDiagnostics();

      // Log debug report on unmount (for diagnostics)
      return () => {
        if (environment.debug.enableNativeModuleLogging) {
          const report = NativeModuleLogger.exportDebugReport();
          Logger.debug('[App] Native module debug report', { report: report.slice(0, 500) });
          NativeModuleLogger.disable();
        }
      };
    }
    return undefined;
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <GlobalErrorBoundary>
        <SafeAreaProvider>
          <ReduxProvider store={store}>
            <PersistGate loading={null} persistor={persistor}>
              <RehydrationGate>
                <QueryProvider>
                  <ThemeProvider defaultTheme='light'>
                    <AppContent />
                  </ThemeProvider>
                </QueryProvider>
              </RehydrationGate>
            </PersistGate>
          </ReduxProvider>
        </SafeAreaProvider>
      </GlobalErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

// ⚠️ DIAGNOSTIC: Temporarily bypass Sentry.wrap to test if TouchEventBoundary
// is blocking touches. Sentry.wrap adds a TouchEventBoundary that may conflict
// with React 19 + RN 0.81 + React Navigation v6.
// If touch issues resolve with this change, the fix is to configure Sentry
// without the touch tracking boundary.
// TODO: Re-enable after confirming Sentry compatibility with React 19
export default __DEV__ ? App : Sentry.wrap(App);
