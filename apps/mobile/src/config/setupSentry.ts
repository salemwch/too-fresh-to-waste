/**
 * Sentry Configuration for React Native
 *
 * Production-grade error tracking and performance monitoring.
 *
 * Features:
 * - Automatic error capture (JS errors, native crashes)
 * - Performance monitoring (app start, screen loads)
 * - Breadcrumb tracking (user actions, network requests)
 * - Release tracking (version, build number)
 * - Environment-specific configuration (dev/staging/production)
 * - Source maps for readable stack traces
 *
 * Installation Required:
 * ```bash
 * cd apps/mobile
 * npm install @sentry/react-native
 * ```
 *
 * iOS Setup:
 * ```bash
 * cd ios && pod install
 * ```
 *
 * Android Setup:
 * Add to android/app/build.gradle:
 * ```gradle
 * apply from: "../../node_modules/@sentry/react-native/sentry.gradle"
 * ```
 *
 * Usage:
 * ```typescript
 * // In App.tsx (before React component)
 * import { initializeSentry } from './config/setupSentry';
 * initializeSentry();
 * ```
 *
 * Sentry Dashboard:
 * https://sentry.io/organizations/your-org/projects/food-waste-app/
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Config from 'react-native-config';

import { environment } from './environment';
import { Logger } from '@/utils/logger';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Sentry DSN (Data Source Name)
 * Get this from: Sentry Dashboard → Settings → Client Keys (DSN)
 *
 * ⚠️ SECURITY: This is PUBLIC and safe to commit
 * It only allows sending errors TO Sentry, not reading data
 *
 * Format: https://<key>@<org>.ingest.sentry.io/<project-id>
 */
// Sentry DSN should be provided via SENTRY_DSN env variable via react-native-config
// It is not part of EnvironmentConfig to avoid coupling monitoring config to app config
const SENTRY_DSN = (Config['SENTRY_DSN'] as string | undefined) ?? '';

/**
 * Should Sentry be enabled?
 * - Production: Always enabled
 * - Staging: Always enabled
 * - Development: Disabled (use logs instead)
 */
const isSentryEnabled = (): boolean => {
  // Disable if no DSN configured
  if (!SENTRY_DSN) {
    Logger.warn('[Sentry] DSN not configured, skipping initialization');
    return false;
  }

  // Disable in development (use console logs instead)
  const enableSentryInDev = (Config['ENABLE_SENTRY_IN_DEV'] as string | undefined) === 'true';
  if (__DEV__ && !enableSentryInDev) {
    Logger.info('[Sentry] Disabled in development mode');
    return false;
  }

  return true;
};

// ============================================================================
// Sentry Initialization
// ============================================================================

/**
 * Initialize Sentry SDK
 *
 * Call this BEFORE rendering React components (in App.tsx)
 * to ensure all errors are captured.
 *
 * @example
 * ```typescript
 * // App.tsx (top of file, before component definition)
 * import { initializeSentry } from './config/setupSentry';
 * initializeSentry();
 *
 * function App() { ... }
 * ```
 */
export function initializeSentry(): void {
  if (!isSentryEnabled()) {
    return;
  }

  try {
    Sentry.init({
      // ──────────────────────────────────────────────────────────────────────
      // BASIC CONFIGURATION
      // ──────────────────────────────────────────────────────────────────────

      /** Sentry project DSN */
      dsn: SENTRY_DSN,

      /** Environment: production, staging, development */
      environment: environment.environment,

      /** App version for release tracking */
      release: `food-waste-app@${environment.app.version}`,

      /** Build number/distribution (iOS: CFBundleVersion, Android: versionCode) */
      dist: environment.app.version,

      // ──────────────────────────────────────────────────────────────────────
      // ERROR TRACKING
      // ──────────────────────────────────────────────────────────────────────

      /**
       * Enable native crash tracking (iOS/Android crashes)
       * Captures crashes that happen in native code
       */
      enableNative: true,

      /**
       * Enable automatic session tracking
       * Tracks app sessions and crash-free rate
       */
      enableAutoSessionTracking: true,

      /**
       * Session timeout (30 seconds)
       * New session starts if app is backgrounded > 30s
       */
      sessionTrackingIntervalMillis: 30000,

      /**
       * Maximum breadcrumbs to keep (last 100 user actions)
       * Breadcrumbs provide context before errors
       */
      maxBreadcrumbs: 100,

      // ──────────────────────────────────────────────────────────────────────
      // PERFORMANCE MONITORING
      // ──────────────────────────────────────────────────────────────────────

      /**
       * Sample rate for performance traces (10% of sessions)
       * Reduces data volume while getting representative samples
       *
       * 0.0 = disabled
       * 0.1 = 10% of sessions
       * 1.0 = 100% of sessions
       */
      tracesSampleRate: environment.isProduction ? 0.1 : 1.0,

      /**
       * Profile sample rate (10% of traces)
       * Profiles slow transactions for performance optimization
       */
      profilesSampleRate: 0.1,

      // ──────────────────────────────────────────────────────────────────────
      // DATA COLLECTION
      // ──────────────────────────────────────────────────────────────────────

      /**
       * Automatically attach stack traces to messages
       * Helps debug Logger.error() calls
       */
      attachStacktrace: true,

      /**
       * Enable breadcrumbs for user interactions
       * Tracks taps, navigation, etc.
       */
      enableUserInteractionTracing: true,

      /**
       * Track navigation (React Navigation)
       * Automatically creates transactions for screen changes
       */
      enableNativeFramesTracking: true,

      // ──────────────────────────────────────────────────────────────────────
      // INTEGRATIONS
      // ──────────────────────────────────────────────────────────────────────

      integrations: [
        // React Navigation integration (automatic screen tracking)
        Sentry.reactNavigationIntegration(),
      ],

      // ──────────────────────────────────────────────────────────────────────
      // PRIVACY & SECURITY
      // ──────────────────────────────────────────────────────────────────────

      /**
       * Before sending error to Sentry
       * Use this to:
       * - Scrub sensitive data (passwords, tokens, PII)
       * - Filter out noise (ignore certain errors)
       * - Add custom context
       */
      beforeSend(event) {
        // Scrub sensitive data from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
            // Remove sensitive query params
            if (breadcrumb.data?.['url']) {
              breadcrumb.data['url'] = scrubSensitiveData(breadcrumb.data['url'] as string);
            }

            // Remove request/response bodies (may contain tokens)
            if (breadcrumb.data?.['request']) {
              delete (breadcrumb.data['request'] as Record<string, unknown>)['body'];
            }
            if (breadcrumb.data?.['response']) {
              delete (breadcrumb.data['response'] as Record<string, unknown>)['body'];
            }

            return breadcrumb;
          });
        }

        // Scrub sensitive data from request contexts
        if (event.request?.url) {
          event.request.url = scrubSensitiveData(event.request.url);
        }

        // Remove access tokens from headers
        if (event.request?.headers) {
          delete event.request.headers['Authorization'];
          delete event.request.headers['authorization'];
        }

        // Add custom context
        event.contexts = {
          ...event.contexts,
          device: {
            platform: Platform.OS,
            version: Platform.Version,
          },
        };

        return event;
      },

      /**
       * Before sending breadcrumb
       * Filter out noisy breadcrumbs
       */
      beforeBreadcrumb(breadcrumb) {
        // Ignore fetch breadcrumbs to health check endpoints
        if (breadcrumb.category === 'fetch' && (breadcrumb.data?.['url'] as string | undefined)?.includes('/health')) {
          return null;
        }

        return breadcrumb;
      },

      // ──────────────────────────────────────────────────────────────────────
      // DEBUG
      // ──────────────────────────────────────────────────────────────────────

      /** Enable debug logging in development */
      debug: __DEV__,
    });

    // ────────────────────────────────────────────────────────────────────────
    // SET GLOBAL CONTEXT (available in all events)
    // ────────────────────────────────────────────────────────────────────────

    Sentry.setTag('platform', Platform.OS);
    Sentry.setTag('environment', environment.environment);

    Logger.info('[Sentry] Initialized successfully', {
      environment: environment.environment,
      version: environment.app.version,
    });
  } catch (error) {
    // Don't crash app if Sentry fails to initialize
    Logger.error('[Sentry] Initialization failed', {}, error as Error);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Scrub sensitive data from URLs
 * Removes tokens, passwords, and PII from query params
 */
function scrubSensitiveData(url: string): string {
  try {
    const urlObj = new URL(url);

    // Remove sensitive query params
    const sensitiveParams = [
      'token',
      'access_token',
      'refresh_token',
      'password',
      'email',
      'phone',
      'ssn',
      'credit_card',
    ];

    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.set(param, '[REDACTED]');
      }
    });

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return as-is
    return url;
  }
}

/**
 * Manually capture exception
 * Use for caught errors you want to report
 *
 * @example
 * ```typescript
 * try {
 *   riskyOperation();
 * } catch (error) {
 *   captureException(error, {
 *     context: 'riskyOperation failed',
 *     userId: user.id,
 *   });
 * }
 * ```
 */
export function captureException(
  error: Error,
  context?: {
    context?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  },
): void {
  if (!isSentryEnabled()) {
    Logger.error('[Sentry] Would capture exception (disabled)', context, error);
    return;
  }

  Sentry.captureException(error, scope => {
    if (context?.userId) {
      scope.setUser({ id: context.userId });
    }

    if (context?.context) {
      scope.setTag('context', context.context);
    }

    if (context?.extra) {
      scope.setExtras(context.extra);
    }

    return scope;
  });
}

/**
 * Set user context for error tracking
 * Call after login to associate errors with users
 *
 * @example
 * ```typescript
 * setUserContext({
 *   id: user._id,
 *   email: user.email,
 *   role: user.role,
 * });
 * ```
 */
export function setUserContext(user: { id: string; email?: string; role?: string }): void {
  if (!isSentryEnabled()) return;

  Sentry.setUser({
    id: user.id,
    ...(user.email !== undefined && { email: user.email }),
    ...(user.role !== undefined && { username: user.role }),
  });
}

/**
 * Clear user context
 * Call on logout
 */
export function clearUserContext(): void {
  if (!isSentryEnabled()) return;

  Sentry.setUser(null);
}

/**
 * Add breadcrumb (user action tracking)
 *
 * @example
 * ```typescript
 * addBreadcrumb({
 *   category: 'user-action',
 *   message: 'User clicked favorite button',
 *   data: { offerId: '123' },
 * });
 * ```
 */
export function addBreadcrumb(breadcrumb: {
  category: string;
  message: string;
  level?: 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}): void {
  if (!isSentryEnabled()) return;

  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level ?? 'info',
    ...(breadcrumb.data !== undefined && { data: breadcrumb.data }),
    timestamp: Date.now() / 1000,
  });
}
