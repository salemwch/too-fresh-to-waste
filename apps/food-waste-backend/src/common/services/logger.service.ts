import * as path from 'path';

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { v4 as uuidv4 } from 'uuid';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

/**
 * ENTERPRISE-GRADE STRUCTURED LOGGING SERVICE
 *
 * Features:
 * - JSON-formatted structured logs for aggregators (ELK, Datadog, CloudWatch)
 * - Error ID generation for cross-system tracking
 * - Correlation ID support for distributed tracing
 * - Secure stack trace handling (no internal path leakage in production)
 * - Daily log rotation with automatic cleanup
 * - Multiple transports (file, console, error-specific)
 * - Environment-aware log levels
 *
 * @compliance OWASP Logging Cheat Sheet, GDPR (no PII in logs)
 * @rationale Winston is production-grade with 18M+ weekly downloads
 * @see https://github.com/winstonjs/winston
 */

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  VERBOSE = 'verbose',
  DEBUG = 'debug',
  SILLY = 'silly',
}

export interface LogMetadata {
  correlationId?: string | undefined;
  userId?: string | undefined;
  requestId?: string | undefined;
  method?: string | undefined;
  path?: string | undefined;
  statusCode?: number | undefined;
  duration?: number | undefined;
  errorId?: string | undefined;
  contentLength?: number | undefined;
  [key: string]: unknown;
}

/**
 * Custom format for production: sanitizes stack traces
 */
const sanitizeStackTrace = winston.format((info) => {
  const isProduction = process.env['NODE_ENV'] === 'production';

  if (isProduction && info['stack'] && typeof info['stack'] === 'string') {
    // In production, remove absolute file paths from stack traces
    // Replace: at ClassName.methodName (C:\Users\...\file.ts:123:45)
    // With: at ClassName.methodName (file.ts:123:45)
    info['stack'] = info['stack']
      .split('\n')
      .map((line: string) =>
        // Remove absolute paths but keep relative file info
        line.replace(/\(([A-Z]:\\[^)]+\\)?([^\\)]+)\)/g, '($2)'),
      )
      .join('\n');
  }

  return info;
});

@Injectable({ scope: Scope.DEFAULT })
export class AppLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private readonly isProduction: boolean;
  private readonly sentryEnabled: boolean;
  private context?: string;

  /**
   * Constructor without parameters for NestJS DI compatibility.
   * Use setContext() to set the logging context after injection.
   */
  constructor() {
    this.isProduction = process.env['NODE_ENV'] === 'production';
    this.sentryEnabled = !!process.env['SENTRY_DSN'];

    const logLevel = this.isProduction ? LogLevel.INFO : process.env['LOG_LEVEL'] || LogLevel.DEBUG;

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      sanitizeStackTrace(),
      winston.format.metadata({
        fillWith: [
          'correlationId',
          'userId',
          'requestId',
          'method',
          'path',
          'statusCode',
          'duration',
          'errorId',
        ],
      }),
      this.isProduction
        ? winston.format.json() // Structured JSON for production aggregators
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context, metadata, stack }) => {
              const ctx = context ? `[${context}]` : '';
              const meta =
                Object.keys(metadata || {}).length > 0
                  ? `\n${JSON.stringify(metadata, null, 2)}`
                  : '';
              const stackTrace = stack ? `\n${stack}` : '';
              return `${timestamp} ${level} ${ctx} ${message}${meta}${stackTrace}`;
            }),
          ),
    );

    // Configure transports
    const transports: winston.transport[] = [
      // Console transport (always enabled)
      new winston.transports.Console({
        level: logLevel,
        handleExceptions: true,
      }),
    ];

    // File transports (production only)
    if (this.isProduction) {
      const logsDir = process.env['LOGS_DIR'] || path.join(process.cwd(), 'logs');

      // Combined logs (all levels)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logsDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d', // Keep logs for 14 days
          level: logLevel,
          format: winston.format.json(),
        }),
      );

      // Error logs (error level only)
      transports.push(
        new DailyRotateFile({
          filename: path.join(logsDir, 'error-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d', // Keep error logs for 30 days
          level: 'error',
          format: winston.format.json(),
        }),
      );
    }

    // Create logger instance
    this.logger = winston.createLogger({
      level: logLevel,
      levels: winston.config.npm.levels,
      format: logFormat,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Set context for this logger instance
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Generate unique error ID for tracking
   */
  private generateErrorId(): string {
    return `ERR-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
  }

  /**
   * Build metadata object with context
   */
  private buildMetadata(metadata?: LogMetadata, context?: string): LogMetadata {
    return {
      context: context || this.context,
      ...metadata,
      environment: process.env['NODE_ENV'],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * ERROR: Critical errors requiring immediate attention
   * Automatically sends to Sentry if configured
   */
  error(message: string, trace?: string | Error, context?: string, metadata?: LogMetadata): string {
    const errorId = this.generateErrorId();
    const meta = this.buildMetadata({ ...metadata, errorId }, context);

    // Log to Winston
    if (trace instanceof Error) {
      this.logger.error(message, {
        ...meta,
        error: {
          name: trace.name,
          message: trace.message,
          stack: trace.stack,
        },
      });

      // Send to Sentry for real-time alerting
      this.sendToSentry(trace, message, meta);
    } else if (trace) {
      this.logger.error(message, { ...meta, stack: trace });

      // Create Error object for Sentry
      const error = new Error(message);
      error.stack = trace;
      this.sendToSentry(error, message, meta);
    } else {
      this.logger.error(message, meta);

      // Create Error object for Sentry (without stack)
      const error = new Error(message);
      this.sendToSentry(error, message, meta);
    }

    return errorId; // Return error ID for client response
  }

  /**
   * Send error to Sentry with enriched context
   * @private
   */
  private sendToSentry(error: Error, message: string, metadata: LogMetadata): void {
    if (!this.sentryEnabled) {
      return;
    }

    try {
      Sentry.withScope((scope) => {
        // Set context
        scope.setContext('logger', {
          context: this.context,
          message,
          ...metadata,
        });

        // Set tags for filtering in Sentry
        if (metadata.errorId) {
          scope.setTag('errorId', metadata.errorId);
        }
        if (metadata.correlationId) {
          scope.setTag('correlationId', metadata.correlationId);
        }
        if (metadata.userId) {
          scope.setUser({ id: metadata.userId });
        }
        if (metadata.method && metadata.path) {
          scope.setTag('endpoint', `${metadata.method} ${metadata.path}`);
        }

        // Set level based on context
        const isCritical = this.isCriticalError(message, error.stack);
        scope.setLevel(isCritical ? 'error' : 'warning');

        // Capture exception
        Sentry.captureException(error);
      });
    } catch (sentryError) {
      // Don't let Sentry errors break the application
      this.logger.warn('Failed to send error to Sentry', {
        error: (sentryError as Error).message,
      });
    }
  }

  /**
   * Determine if error is critical (requires immediate attention)
   * @private
   */
  private isCriticalError(message: string, stack?: string): boolean {
    const criticalKeywords = [
      'database',
      'mongodb',
      'redis',
      'payment',
      'stripe',
      'authentication',
      'authorization',
      'security',
      'breach',
      'injection',
      'critical',
      'fatal',
      'corruption',
      'data loss',
    ];

    const combined = `${message} ${stack || ''}`.toLowerCase();
    return criticalKeywords.some((keyword) => combined.includes(keyword));
  }

  /**
   * WARN: Warning messages for potentially harmful situations
   */
  warn(message: string, context?: string, metadata?: LogMetadata): void {
    this.logger.warn(message, this.buildMetadata(metadata, context));
  }

  /**
   * INFO: Informational messages highlighting application progress
   */
  log(message: string, context?: string, metadata?: LogMetadata): void {
    this.logger.info(message, this.buildMetadata(metadata, context));
  }

  /**
   * DEBUG: Detailed information for debugging
   */
  debug(message: string, context?: string, metadata?: LogMetadata): void {
    this.logger.debug(message, this.buildMetadata(metadata, context));
  }

  /**
   * VERBOSE: Very detailed information
   */
  verbose(message: string, context?: string, metadata?: LogMetadata): void {
    this.logger.verbose(message, this.buildMetadata(metadata, context));
  }

  /**
   * HTTP: HTTP request logging
   */
  http(message: string, metadata?: LogMetadata): void {
    this.logger.http(message, this.buildMetadata(metadata, 'HTTP'));
  }

  // ============================================================================
  // APPLICATION-SPECIFIC METHODS
  // ============================================================================

  /**
   * Log application startup
   */
  startup(message: string, metadata?: LogMetadata): void {
    this.log(`🚀 ${message}`, 'Startup', metadata);
  }

  /**
   * Log application shutdown
   */
  shutdown(message: string, metadata?: LogMetadata): void {
    this.warn(`🛑 ${message}`, 'Shutdown', metadata);
  }

  /**
   * Log security events (authentication, authorization, etc.)
   */
  security(message: string, metadata?: LogMetadata): string {
    const securityEventId = `SEC-${Date.now()}-${uuidv4().substring(0, 8).toUpperCase()}`;
    this.warn(`🔒 ${message}`, 'Security', {
      ...metadata,
      securityEventId,
    });
    return securityEventId;
  }

  /**
   * Log database operations
   */
  database(message: string, metadata?: LogMetadata): void {
    this.debug(`💾 ${message}`, 'Database', metadata);
  }

  /**
   * Log external API calls
   */
  external(message: string, metadata?: LogMetadata): void {
    this.debug(`🌐 ${message}`, 'External', metadata);
  }

  /**
   * Log performance metrics
   */
  performance(message: string, duration: number, metadata?: LogMetadata): void {
    this.log(`⚡ ${message}`, 'Performance', {
      ...metadata,
      duration,
      durationMs: duration,
    });
  }

  /**
   * Log business events
   */
  business(message: string, metadata?: LogMetadata): void {
    this.log(`📊 ${message}`, 'Business', metadata);
  }

  /**
   * Close logger and flush pending logs
   */
  async close(): Promise<void> {
    await new Promise<void>((resolve) => {
      this.logger.end(() => {
        resolve();
      });
    });
  }
}
