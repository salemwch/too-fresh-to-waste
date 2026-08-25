import * as Sentry from '@sentry/react-native';
import { useQueryClient } from '@tanstack/react-query';
import React, { Component, useEffect, useRef } from 'react';
import { Config } from 'react-native-config';
import { InteractionManager, StatusBar, StyleSheet, View, Text, Pressable } from 'react-native';
import i18n from '@/i18n';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { Provider as ReduxProvider, useSelector } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

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
import { store, persistor } from '@/store';
import { RehydrationGate } from '@/store/rehydrationOrchestrator';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';
import { Logger } from '@/utils/logger';
import { analytics } from '@/utils/analytics';
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
    backgroundColor: colorTokens.light.background,
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

// Sentry is initialized lazily after the first frame paints (see App component)
// so that it does not block the JS thread during cold start. The global error
// handler above still captures crashes before Sentry is ready — they are
// forwarded once Sentry.init() completes.
let _sentryInitialized = false;

function initSentryIfNeeded(): void {
  if (_sentryInitialized) return;
  _sentryInitialized = true;

  try {
    Sentry.init({
      dsn: Config['SENTRY_DSN'] ?? '',
      sendDefaultPii: true,
      enableLogs: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1,
      integrations: [Sentry.mobileReplayIntegration()],
    });
    Logger.info('[App] Sentry initialized successfully');
  } catch (error) {
    Logger.error('[App] Sentry initialization failed', {}, error as Error);
  }
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

  // Defer location data + Google Sign-In config to after first interaction.
  // Neither is needed for the first frame — search screen isn't the landing page
  // and Google sign-in is only on the auth screens.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      const { localLocationService } =
        require('@/services/location/LocalLocationService') as typeof import('@/services/location/LocalLocationService');
      localLocationService.initialize().catch(error => {
        Logger.error('Failed to initialize LocalLocationService', {}, error);
      });

      const { GoogleSignin } =
        require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: Config['GOOGLE_WEB_CLIENT_ID'] ?? '',
      });
    });

    return () => handle.cancel();
  }, []);

  // Track session expiry for retry logic
  const sessionExpiresAt = useSelector((state: RootState) => state.auth.sessionExpiresAt);

  // Connect socket only when authenticated — no point connecting for anonymous users
  useEffect(() => {
    if (flowState !== AuthFlowState.AUTHENTICATED) return;

    const { socketService } =
      require('@/services/socketService') as typeof import('@/services/socketService');
    socketService.connect();

    return () => {
      socketService.disconnect();
    };
  }, [flowState]);

  /*
   * Ask for notification permission once the user is signed in.
   *
   * This used to fire unconditionally at startup, so a fresh install showed the
   * OS notification dialog before the user had signed in or seen what the app
   * does. Android 13+ gives exactly one prompt — a denial there is final and
   * can only be undone in system settings — and that single prompt was being
   * spent on someone with no reason yet to say yes, including people who never
   * signed up at all.
   *
   * Authentication is the first point where the permission has a visible
   * purpose: notifications here are order updates and pickup reminders, which
   * only exist for an account. `ensurePermission` prompts only when the OS has
   * not already decided.
   *
   * The ref keeps it to one attempt per launch. flowState reaches AUTHENTICATED
   * again on token refresh and rehydration, and without the guard each of those
   * would re-enter the request for no benefit.
   */
  const hasRequestedNotificationPermission = useRef(false);
  useEffect(() => {
    if (flowState !== AuthFlowState.AUTHENTICATED) return;
    if (hasRequestedNotificationPermission.current) return;

    hasRequestedNotificationPermission.current = true;

    const { notificationService } =
      require('@/services/NotificationService') as typeof import('@/services/NotificationService');

    void notificationService.ensurePermission().then(granted => {
      Logger.info('[App] Notification permission resolved after sign-in', { granted });
    });
  }, [flowState]);

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
      const registerNotificationToken = async (): Promise<void> => {
        const { notificationService } = await import('@/services/NotificationService');
        const token = await notificationService.getToken();
        if (!token) return;
        await notificationService.registerTokenWithBackend(token);
      };

      registerNotificationToken().catch(error => {
        Logger.error('[App] Failed to register notification token', {}, error as Error);
      });
    } else if (
      flowState === AuthFlowState.UNAUTHENTICATED ||
      flowState === AuthFlowState.SESSION_EXPIRED
    ) {
      const unregisterNotificationToken = async (): Promise<void> => {
        const { notificationService } = await import('@/services/NotificationService');
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
      <SoftUpdateBanner
        visible={versionCheck.updateType === 'soft' && !versionCheck.dismissed}
        updateUrl={versionCheck.updateUrl}
        onDismiss={versionCheck.dismiss}
      />
      {/* Under edge-to-edge, StatusBarModule.setColor and setTranslucent
          are guarded by isEdgeToEdgeFeatureFlagOn and return early —
          backgroundColor and translucent props are no-ops. Only barStyle
          (light/dark icons) is active; screen-level statusBarStyle from
          react-native-screens takes precedence per screen. */}
      <StatusBar barStyle='dark-content' />
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
  const deferredCleanups = useRef<Array<() => void>>([]);

  // Defer all non-critical services to after the first frame renders.
  // This lets the provider tree + navigation mount and paint immediately.
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      // --- Sentry ---
      initSentryIfNeeded();

      // --- Offline manager ---
      const { offlineManager } =
        require('@/utils/offlineManager') as typeof import('@/utils/offlineManager');
      offlineManager.initialize();
      deferredCleanups.current.push(() => offlineManager.cleanup());

      // --- Offline write queue (must run after offlineManager) ---
      const { registerOfflineHandlers, stopOfflineHandlers } =
        require('@/services/offlineHandlers') as typeof import('@/services/offlineHandlers');
      registerOfflineHandlers();
      deferredCleanups.current.push(stopOfflineHandlers);

      // --- Push notifications ---
      const { notificationService } =
        require('@/services/NotificationService') as typeof import('@/services/NotificationService');
      notificationService.initialize((data, title, body) => {
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
      // Listeners are wired up here, but the permission prompt is NOT. It is
      // deferred until the user is authenticated — see the effect below.
      deferredCleanups.current.push(() => notificationService.cleanup());

      // --- Native module debugging (dev only) ---
      if (__DEV__ && environment.debug.enableNativeModuleLogging) {
        const { NativeModuleLogger } =
          require('@/utils/nativeModuleLogger') as typeof import('@/utils/nativeModuleLogger');
        NativeModuleLogger.enable();
        NativeModuleLogger.logMapsDiagnostics();
        deferredCleanups.current.push(() => {
          const report = NativeModuleLogger.exportDebugReport();
          Logger.debug('[App] Native module debug report', { report: report.slice(0, 500) });
          NativeModuleLogger.disable();
        });
      }

      Logger.info('[App] Deferred services initialized');
    });

    return () => {
      handle.cancel();
      deferredCleanups.current.forEach(fn => fn());
      deferredCleanups.current = [];
    };
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
    backgroundColor: colorTokens.light.background,
  },
});

// Wrapped unconditionally, in every build.
//
// This was previously `__DEV__ ? App : Sentry.wrap(App)` as a diagnostic for a
// suspected TouchEventBoundary conflict. Leaving it that way meant dev and
// production ran different component trees and different touch pipelines, so a
// production-only touch-timing bug could not be reproduced locally by
// construction — which is exactly what happened while chasing the first-run
// location crash: two rounds of fixes were written against a theory because no
// debug build could exhibit the behaviour.
//
// If TouchEventBoundary ever does need to be disabled, do it through Sentry
// configuration so both builds stay identical, never by branching on __DEV__.
export default Sentry.wrap(App);
