/**
 * Enterprise-Grade Winston Logger Service
 *
 * Features:
 * - Structured JSON logging for production
 * - Daily log rotation with compression
 * - Separate error log files
 * - Correlation ID tracking
 * - Performance monitoring
 * - Sentry integration ready
 *
 * References:
 * - https://github.com/winstonjs/winston
 * - https://docs.nestjs.com/techniques/logger
 */

import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

@Injectable({ scope: Scope.TRANSIENT })
export class WinstonLoggerService implements LoggerService {
  private readonly logger: winston.Logger;
  private context?: string | undefined;

  constructor(context?: string) {
    if (context !== undefined) {
      this.context = context;
    }
    this.logger = this.createLogger();
  }

  /**
   * Create Winston Logger Instance
   */
  private createLogger(): winston.Logger {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const logLevel = process.env['LOG_LEVEL'] || (isProduction ? 'info' : 'debug');

    // Common log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp', 'label'],
      }),
    );

    const transports: winston.transport[] = [];

    // Console transport (all environments)
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          logFormat,
          isProduction
            ? winston.format.json()
            : winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(this.consoleFormatter),
              ),
        ),
      }),
    );

    // File transports (production only)
    if (isProduction) {
      // Combined logs with rotation
      transports.push(
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d',
          format: winston.format.combine(logFormat, winston.format.json()),
        }),
      );

      // Error logs with rotation
      transports.push(
        new DailyRotateFile({
          level: 'error',
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '30d',
          format: winston.format.combine(logFormat, winston.format.json()),
        }),
      );

      // Critical errors (separate file, longer retention)
      transports.push(
        new DailyRotateFile({
          level: 'error',
          filename: 'logs/critical-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '90d',
          format: winston.format.combine(
            winston.format((info) => {
              // Only log critical errors
              const metadata = info['metadata'] as { critical?: boolean } | undefined;
              return metadata?.critical ? info : false;
            })(),
            logFormat,
            winston.format.json(),
          ),
        }),
      );
    }

    return winston.createLogger({
      level: logLevel,
      defaultMeta: {
        service: 'foodwaste-backend',
        environment: process.env['NODE_ENV'],
        version: process.env['npm_package_version'] || '1.0.0',
      },
      transports,
      exitOnError: false,
    });
  }

  /**
   * Console Formatter for Development
   */
  private consoleFormatter(info: winston.Logform.TransformableInfo): string {
    const { timestamp, level, message } = info;
    const infoMetadata = info['metadata'] as { context?: string } | undefined;
    const context = (info as Record<string, unknown>)['context'] as string | undefined;

    const ctx = context || infoMetadata?.context || 'Application';
    const metaStr =
      Object.keys(infoMetadata || {}).length > 0
        ? `\n${JSON.stringify(infoMetadata, null, 2)}`
        : '';

    return `${timestamp} [${level}] [${ctx}] ${message}${metaStr}`;
  }

  /**
   * Set Context for Logger
   */
  setContext(context: string): void {
    this.context = context;
  }

  /**
   * Log Message
   */
  log(message: string, context?: string): void {
    this.logger.info(message, {
      context: context || this.context,
    });
  }

  /**
   * Log Error
   */
  error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, {
      context: context || this.context,
      trace,
      critical: this.isCriticalError(message, trace),
    });
  }

  /**
   * Log Warning
   */
  warn(message: string, context?: string): void {
    this.logger.warn(message, {
      context: context || this.context,
    });
  }

  /**
   * Log Debug
   */
  debug(message: string, context?: string): void {
    this.logger.debug(message, {
      context: context || this.context,
    });
  }

  /**
   * Log Verbose
   */
  verbose(message: string, context?: string): void {
    this.logger.verbose(message, {
      context: context || this.context,
    });
  }

  /**
   * Log with Correlation ID
   *
   * Useful for tracing requests across services
   */
  logWithCorrelationId(
    level: string,
    message: string,
    correlationId: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.logger.log(level, message, {
      context: this.context,
      correlationId,
      ...metadata,
    });
  }

  /**
   * Log Performance Metric
   */
  logPerformance(operation: string, duration: number, metadata?: Record<string, unknown>): void {
    this.logger.info(`Performance: ${operation}`, {
      context: this.context,
      operation,
      duration,
      ...metadata,
    });
  }

  /**
   * Log Security Event
   */
  logSecurity(event: string, metadata?: Record<string, unknown>): void {
    this.logger.warn(`Security: ${event}`, {
      context: this.context,
      security: true,
      event,
      ...metadata,
    });
  }

  /**
   * Determine if Error is Critical
   *
   * Critical errors require immediate attention
   */
  private isCriticalError(message: string, trace?: string): boolean {
    const criticalKeywords = [
      'database',
      'redis',
      'payment',
      'authentication',
      'authorization',
      'security',
      'critical',
      'fatal',
    ];

    const messageAndTrace = `${message} ${trace || ''}`.toLowerCase();

    return criticalKeywords.some((keyword) => messageAndTrace.includes(keyword));
  }
}
