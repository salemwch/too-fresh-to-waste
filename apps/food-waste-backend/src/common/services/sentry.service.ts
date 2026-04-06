/**
 * ENTERPRISE-GRADE SENTRY ERROR TRACKING SERVICE
 *
 * Features:
 * - Centralized Sentry initialization and configuration
 * - Environment-aware error tracking (production/staging only)
 * - Performance monitoring with transaction tracking
 * - User context enrichment
 * - Custom tags and breadcrumbs
 * - Release tracking for deployment correlation
 * - Source maps support for production debugging
 *
 * @compliance SOC2, GDPR (PII filtering)
 * @rationale Sentry provides real-time error tracking, performance monitoring, and alerting
 * @see https://docs.sentry.io/platforms/node/
 * @see https://docs.sentry.io/platforms/node/guides/nestjs/
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Sentry from '@sentry/node';

export interface SentryUser {
  id: string;
  email?: string;
  username?: string;
  role?: string;
}

export interface SentryContext {
  [key: string]: unknown;
}

@Injectable()
export class SentryService implements OnModuleInit {
  private readonly logger = new Logger(SentryService.name);
  private isInitialized = false;
  private readonly isProduction: boolean;
  private readonly environment: string;

  constructor(private readonly configService: ConfigService) {
    const configuredEnvironment = this.getNonEmptyConfigValue('NODE_ENV');
    this.isProduction = configuredEnvironment === 'production';
    this.environment = configuredEnvironment ?? 'development';
  }

  /**
   * Initialize Sentry on module load
   * Called automatically by NestJS lifecycle
   */
  onModuleInit(): void {
    this.initialize();
  }

  /**
   * Initialize Sentry SDK with enterprise-grade configuration
   */
  initialize(): void {
    const dsn = this.configService.get<string>('SENTRY_DSN');

    // Only initialize if DSN is provided and not already initialized
    if (!dsn || this.isInitialized) {
      if (!dsn) {
        this.logger.warn(
          'DSN not configured. Error tracking disabled. Set SENTRY_DSN environment variable to enable.',
        );
      }
      return;
    }

    try {
      const serverName =
        this.getNonEmptyConfigValue('SERVER_NAME') ??
        this.getNonEmptyConfigValue('HOSTNAME') ??
        'unknown';

      Sentry.init({
        dsn,
        environment: this.environment,

        // Release tracking for deployment correlation
        // Format: project-name@version
        release:
          this.configService.get<string>('SENTRY_RELEASE') ??
          `foodwaste-backend@${this.configService.get<string>('npm_package_version') ?? '1.0.0'}`,

        // Sample rate configuration
        tracesSampleRate: this.getTracesSampleRate(),
        profilesSampleRate: this.getProfilesSampleRate(),

        // Only send errors in production and staging
        enabled: this.environment !== 'development' && this.environment !== 'test',

        // Integrations
        integrations: [
          // Node.js integrations
          Sentry.httpIntegration(),
          Sentry.mongoIntegration(),
          Sentry.mongooseIntegration(),
        ],

        // Before send hook - sanitize sensitive data
        beforeSend: (event, _hint) => this.beforeSend(event) as Sentry.ErrorEvent,

        // Before breadcrumb - filter sensitive breadcrumbs
        beforeBreadcrumb: (breadcrumb, _hint) => this.beforeBreadcrumb(breadcrumb, _hint),

        // Ignore certain errors
        ignoreErrors: [
          // Browser/client errors that shouldn't be tracked server-side
          'Non-Error exception captured',
          'Non-Error promise rejection captured',

          // Validation errors (expected behavior)
          'ValidationError',
          'BadRequestException',

          // Network errors (client-side issues)
          'NetworkError',
          'AbortError',

          // Known safe errors
          'ECONNRESET',
          'ECONNREFUSED',
          'ETIMEDOUT',
        ],

        // Ignore transactions (URLs) that shouldn't be tracked
        ignoreTransactions: [
          '/health',
          '/health/liveness',
          '/health/readiness',
          '/metrics',
          '/favicon.ico',
        ],

        // Maximum breadcrumbs to store
        maxBreadcrumbs: 50,

        // Attach stack traces to all messages
        attachStacktrace: true,

        // Server name (useful for multi-instance deployments)
        serverName,

        // Debug mode (development only)
        debug: this.environment === 'development',

        // Maximum value length before truncation
        maxValueLength: 1000,
      });

      this.isInitialized = true;
      this.logger.log(`Initialized for environment: ${this.environment}`);
    } catch (error) {
      this.logger.error(
        'Failed to initialize Sentry',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private getNonEmptyConfigValue(key: string): string | undefined {
    const value = this.configService.get<string>(key);
    if (value === null || value === undefined) {
      return undefined;
    }

    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : undefined;
  }

  /**
   * Determine traces sample rate based on environment
   * Production: 10% sampling to reduce cost
   * Staging: 50% sampling for better debugging
   * Development: 100% sampling
   */
  private getTracesSampleRate(): number {
    const customRate = this.configService.get<number>('SENTRY_TRACES_SAMPLE_RATE');
    if (customRate !== undefined) {
      return customRate;
    }

    switch (this.environment) {
      case 'production':
        return 0.1; // 10%
      case 'staging':
        return 0.5; // 50%
      default:
        return 1.0; // 100%
    }
  }

  /**
   * Determine profiles sample rate based on environment
   */
  private getProfilesSampleRate(): number {
    const customRate = this.configService.get<number>('SENTRY_PROFILES_SAMPLE_RATE');
    if (customRate !== undefined) {
      return customRate;
    }

    switch (this.environment) {
      case 'production':
        return 0.1; // 10%
      case 'staging':
        return 0.5; // 50%
      default:
        return 0; // Disabled in development
    }
  }

  /**
   * Before send hook - sanitize sensitive data before sending to Sentry
   * CRITICAL: Ensures PII and secrets are not leaked
   */
  private beforeSend(event: Sentry.Event): Sentry.Event | null {
    // Remove sensitive environment variables
    const runtimeEnv = event.contexts?.['runtime']?.['env'];
    if (runtimeEnv !== null && runtimeEnv !== undefined && typeof runtimeEnv === 'object') {
      const sensitiveKeys = [
        'DATABASE_URL',
        'REDIS_PASSWORD',
        'JWT_SECRET',
        'JWT_REFRESH_SECRET',
        'TWILIO_AUTH_TOKEN',
        'STRIPE_SECRET_KEY',
        'AWS_SECRET_ACCESS_KEY',
        'SENDGRID_API_KEY',
        'FIREBASE_PRIVATE_KEY',
        'SESSION_SECRET',
      ];

      const env = runtimeEnv as Record<string, unknown>;
      Object.keys(env).forEach(key => {
        if (sensitiveKeys.some(sensitiveKey => key.includes(sensitiveKey))) {
          env[key] = '[REDACTED]';
        }
      });
    }

    // Sanitize request data
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        const requestHeaders = event.request.headers;
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach(header => {
          if (requestHeaders[header] !== null && requestHeaders[header] !== undefined) {
            requestHeaders[header] = '[REDACTED]';
          }
        });
      }

      // Remove sensitive body fields
      if (
        event.request.data !== null &&
        event.request.data !== undefined &&
        typeof event.request.data === 'object'
      ) {
        const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
        this.redactSensitiveFields(event.request.data as Record<string, unknown>, sensitiveFields);
      }
    }

    // Sanitize extra context
    if (event.extra) {
      const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
      this.redactSensitiveFields(event.extra as Record<string, unknown>, sensitiveFields);
    }

    return event;
  }

  /**
   * Recursively redact sensitive fields from objects
   */
  private redactSensitiveFields(obj: Record<string, unknown>, sensitiveFields: string[]): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return;
    }

    Object.keys(obj).forEach(key => {
      const lowerKey = key.toLowerCase();

      if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.redactSensitiveFields(obj[key] as Record<string, unknown>, sensitiveFields);
      }
    });
  }

  /**
   * Before breadcrumb - filter sensitive breadcrumbs
   */
  private beforeBreadcrumb(
    breadcrumb: Sentry.Breadcrumb,
    _hint?: Sentry.BreadcrumbHint,
  ): Sentry.Breadcrumb | null {
    // Don't track console logs in production (too noisy)
    if (this.isProduction && breadcrumb.category === 'console') {
      return null;
    }

    // Sanitize HTTP request breadcrumbs
    if (
      breadcrumb.category === 'http' &&
      breadcrumb.data !== null &&
      breadcrumb.data !== undefined
    ) {
      if (breadcrumb.data['headers'] !== null && breadcrumb.data['headers'] !== undefined) {
        delete breadcrumb.data['headers'];
      }
    }

    return breadcrumb;
  }

  /**
   * Capture exception with custom context
   */
  captureException(error: Error, context?: SentryContext): string {
    if (!this.isInitialized) {
      return '';
    }

    return Sentry.captureException(
      error,
      (context ? { contexts: context } : undefined) as Parameters<
        typeof Sentry.captureException
      >[1],
    );
  }

  /**
   * Capture message with severity level
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    context?: SentryContext,
  ): string {
    if (!this.isInitialized) {
      return '';
    }

    return Sentry.captureMessage(message, {
      level,
      ...(context ? { contexts: context } : {}),
    } as Parameters<typeof Sentry.captureMessage>[1]);
  }

  /**
   * Set user context for all subsequent events
   */
  setUser(user: SentryUser | null): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setUser(user);
  }

  /**
   * Set custom tags for all subsequent events
   */
  setTag(key: string, value: string): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setTag(key, value);
  }

  /**
   * Set custom context for all subsequent events
   */
  setContext(name: string, context: SentryContext): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.setContext(name, context);
  }

  /**
   * Add breadcrumb for event trail
   */
  addBreadcrumb(breadcrumb: Sentry.Breadcrumb): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.addBreadcrumb(breadcrumb);
  }

  /**
   * Start a new span for performance monitoring
   * Note: Sentry has moved away from manual transaction APIs
   * Use automatic instrumentation or spans instead
   */
  startSpan<T>(name: string, callback: () => T): T {
    if (!this.isInitialized) {
      return callback();
    }

    return Sentry.startSpan({ name, op: 'http.server' }, callback);
  }

  /**
   * Execute function within Sentry scope
   */
  withScope(callback: (scope: Sentry.Scope) => void): void {
    if (!this.isInitialized) {
      return;
    }

    Sentry.withScope(callback);
  }

  /**
   * Flush pending events and wait for completion
   * Useful before application shutdown
   */
  async close(timeout: number = 2000): Promise<boolean> {
    if (!this.isInitialized) {
      return true;
    }

    try {
      await Sentry.close(timeout);
      return true;
    } catch (error) {
      this.logger.error(
        'Failed to close Sentry',
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }

  /**
   * Check if Sentry is initialized and enabled
   */
  isEnabled(): boolean {
    return this.isInitialized;
  }
}
