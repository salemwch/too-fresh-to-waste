import * as Sentry from '@sentry/react-native';
import React, { useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Provider as ReduxProvider, useSelector, useDispatch } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { OfflineBanner } from '@/components/Errors';
import { environment, validateEnvironmentConfig } from '@/config/environment';
import { ThemeProvider } from '@/design-system/providers';
import { AuthFlowState } from '@/features/auth/types';
import { QueryProvider } from '@/lib/react-query';
import { RootNavigator } from '@/navigation';
import { localLocationService } from '@/services/location/LocalLocationService';
import { notificationService } from '@/services/NotificationService';
import { offlineWriteQueue } from '@/services/OfflineWriteQueue';
import { socketService } from '@/services/socketService';
import { store, persistor } from '@/store';
import { RehydrationGate } from '@/store/rehydrationOrchestrator';
import { syncAllFavorites, clearFavorites } from '@/store/slices/favoritesSlice';
import { Logger, NativeModuleLogger } from '@/utils';
import { analytics } from '@/utils/analytics';
import { offlineManager } from '@/utils/offlineManager';
import { toastConfig } from '@/utils/toast';

import type { FavoriteType } from '@/features/favorites/types';
import type { RootState, AppDispatch } from '@/store';

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
    dsn: 'https://3eb5740ce926140949722896873723e8@o4510811308359680.ingest.de.sentry.io/4510811312947280',

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
    errors.forEach((msg) => {
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
  const dispatch = useDispatch<AppDispatch>();
  const flowState = useSelector((state: RootState) => state.auth.flowState);
  const userId = useSelector((state: RootState) => state.auth.user?.userId ?? null);

  // ✅ Initialize Local Location Service on app startup (runs once)
  // Loads tunisian-cities.json into memory for fast local searches
  useEffect(() => {
    localLocationService.initialize().catch((error) => {
      Logger.error('Failed to initialize LocalLocationService', {}, error);
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

      registerNotificationToken().catch((error) => {
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

      unregisterNotificationToken().catch((error) => {
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
  // When app launches with expired tokens, favoritesSlice skips the API call.
  // After auth middleware refreshes tokens, sessionExpiresAt changes, triggering retry.
  useEffect(() => {
    if (flowState === AuthFlowState.AUTHENTICATED) {
      // Only sync if session hasn't expired locally
      // (favoritesSlice has additional guard, but this prevents unnecessary dispatch)
      const isSessionValid =
        sessionExpiresAt == null ||
        sessionExpiresAt === '' ||
        new Date(sessionExpiresAt).getTime() > Date.now();

      if (isSessionValid) {
        const syncFavorites = async (): Promise<void> => {
          await dispatch(syncAllFavorites());
        };

        syncFavorites().catch((error) => {
          Logger.error('[App] Failed to sync favorites', {}, error as Error);
        });
      }
    } else if (
      flowState === AuthFlowState.UNAUTHENTICATED ||
      flowState === AuthFlowState.SESSION_EXPIRED
    ) {
      // ✅ Clear favorites when user logs out or session expires
      // Prevents stale data from previous user persisting
      dispatch(clearFavorites());
    }
  }, [flowState, sessionExpiresAt, dispatch]);

  return (
    <>
      <OfflineBanner />
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <RootNavigator />
      {/* Toast must be last in the component tree to render on top */}
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

  // ✅ Register offline write queue handlers and start listening for reconnect
  // This must run after offlineManager initializes so the NetInfo subscription
  // doesn't race with the manager's own listener.
  useEffect(() => {
    // Lazy import to avoid circular deps at module load time
    const registerFavoritesHandler = async () => {
      const { offlineWriteQueue: queue } = await import('@/services/OfflineWriteQueue');
      const { favoritesService } = await import('@/features/favorites/services');

      queue.registerHandler('FAVORITE_TOGGLE', async (item) => {
        const { favoriteType, offerId, offerName, offerImage } = item.payload;
        const typedFavoriteType = favoriteType as FavoriteType;

        await favoritesService.toggleFavorite(typedFavoriteType, offerId, offerName, offerImage);
      });

      queue.startListening();
    };

    void registerFavoritesHandler();

    return () => {
      offlineWriteQueue.stopListening();
    };
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
          navigateFromForegroundNotification().catch((error) => {
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
      <SafeAreaProvider>
        <ReduxProvider store={store}>
          <PersistGate loading={null} persistor={persistor}>
            <RehydrationGate>
              <QueryProvider>
                <ThemeProvider defaultTheme="light">
                  <AppContent />
                </ThemeProvider>
              </QueryProvider>
            </RehydrationGate>
          </PersistGate>
        </ReduxProvider>
      </SafeAreaProvider>
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
