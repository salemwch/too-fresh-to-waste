import * as Sentry from '@sentry/react-native';

import { environment } from '@/config/environment';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

/**
 * Keys whose values must never leave the device.
 * Matched case-insensitively against a substring of the key name, so
 * `accessToken`, `refresh_token` and `Authorization` are all covered.
 */
const SENSITIVE_KEY_PATTERN =
  /token|password|secret|authorization|credential|apikey|api_key|email|phone|pin|otp|cvv/i;

const REDACTED = '[REDACTED]';

/**
 * Deep-redacts sensitive values from a log context before it is sent to Sentry.
 * Depth-limited so a cyclic or pathological object can never hang logging.
 */
function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;

  if (Array.isArray(value)) {
    return value.map(item => redactSensitive(item, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, val]) => [
      key,
      SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactSensitive(val, depth + 1),
    ]),
  );
}

class LoggerService {
  private logs: LogEntry[] = [];
  private readonly maxLogs = 1000;
  private readonly logLevel: LogLevel;

  constructor() {
    this.logLevel = this.getLogLevel(environment.debug.logLevel);
  }

  private getLogLevel(level: string): LogLevel {
    switch (level) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private addLog(entry: LogEntry): void {
    this.logs.push(entry);

    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const levelName = LogLevel[level];
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${levelName}] ${message}`;

    if (context) {
      formatted += ` | Context: ${JSON.stringify(context)}`;
    }

    return formatted;
  }

  private logToConsole(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    if (!this.shouldLog(level)) return;

    const formatted = this.formatMessage(level, message, context);
    const consoleSink = globalThis.console;

    switch (level) {
      case LogLevel.DEBUG:
        consoleSink.debug(formatted);
        break;
      case LogLevel.INFO:
        consoleSink.info(formatted);
        break;
      case LogLevel.WARN:
        consoleSink.warn(formatted, error);
        break;
      case LogLevel.ERROR:
        consoleSink.error(formatted, error);
        break;
    }
  }

  private logToSentry(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!environment.monitoring.enableCrashlytics) return;

    try {
      // Callers pass arbitrary context objects; redact before anything leaves
      // the device so credentials and PII never land in Sentry.
      const safeContext = redactSensitive(context);

      Sentry.addBreadcrumb({
        message,
        level: level === LogLevel.ERROR ? 'error' : level === LogLevel.WARN ? 'warning' : 'info',
        data: safeContext as Record<string, string>,
      });

      if (error && level === LogLevel.ERROR) {
        Sentry.captureException(error, { extra: safeContext as Record<string, string> });
      }
    } catch (sentryError) {
      const fallbackError =
        sentryError instanceof Error ? sentryError : new Error(String(sentryError));
      this.logToConsole(LogLevel.WARN, 'Failed to log to Sentry', undefined, fallbackError);
    }
  }

  public debug(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level: LogLevel.DEBUG,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    this.addLog(entry);
    this.logToConsole(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: LogContext): void {
    const entry: LogEntry = {
      level: LogLevel.INFO,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    this.addLog(entry);
    this.logToConsole(LogLevel.INFO, message, context);
    this.logToSentry(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level: LogLevel.WARN,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
      ...(error && { error }),
    };

    this.addLog(entry);
    this.logToConsole(LogLevel.WARN, message, context, error);
    this.logToSentry(LogLevel.WARN, message, context, error);
  }

  public error(message: string, context?: LogContext, error?: Error): void {
    const entry: LogEntry = {
      level: LogLevel.ERROR,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
      ...(error && { error }),
    };

    this.addLog(entry);
    this.logToConsole(LogLevel.ERROR, message, context, error);
    this.logToSentry(LogLevel.ERROR, message, context, error);
  }

  public getLogs(level?: LogLevel): LogEntry[] {
    if (level !== undefined) {
      return this.logs.filter(log => log.level >= level);
    }
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
  }

  public exportLogs(): string {
    return this.logs
      .map(log => {
        const levelName = LogLevel[log.level];
        let line = `[${log.timestamp}] [${levelName}] ${log.message}`;

        if (log.context) {
          line += ` | Context: ${JSON.stringify(log.context)}`;
        }

        if (log.error) {
          line += ` | Error: ${log.error.message}`;
          if (log.error.stack) {
            line += ` | Stack: ${log.error.stack}`;
          }
        }

        return line;
      })
      .join('\n');
  }

  public setUserId(userId: string): void {
    Sentry.setUser({ id: userId });
    this.info('User ID set for logging', { userId });
  }

  public setUserAttributes(attributes: Record<string, string>): void {
    Sentry.setContext('user_attributes', attributes);
    this.info('User attributes set for logging', attributes);
  }

  public breadcrumb(message: string, category?: string, data?: LogContext): void {
    const breadcrumbData = {
      message,
      category: category ?? 'general',
      timestamp: new Date().toISOString(),
      ...data,
    };

    Sentry.addBreadcrumb({
      message,
      category: category ?? 'general',
      data: data as Record<string, string>,
    });

    this.debug(`Breadcrumb: ${message}`, breadcrumbData);
  }
}

// Network logging utilities
export class NetworkLogger {
  public static logRequest(url: string, method: string, headers?: Record<string, string>): void {
    if (!environment.debug.enableNetworkLogging) return;

    Logger.debug('Network request started', {
      url,
      method,
      headers: headers ? Object.keys(headers) : undefined,
    });
  }

  public static logResponse(url: string, status: number, duration: number): void {
    if (!environment.debug.enableNetworkLogging) return;

    const level = status >= 400 ? LogLevel.WARN : LogLevel.DEBUG;
    const message = `Network response received: ${status}`;

    const context = {
      url,
      status,
      duration,
    };

    if (level === LogLevel.WARN) {
      Logger.warn(message, context);
    } else {
      Logger.debug(message, context);
    }
  }

  public static logError(url: string, error: Error): void {
    Logger.error('Network request failed', { url }, error);
  }
}

// Create singleton instance
export const Logger = new LoggerService();

// Export for easy testing
