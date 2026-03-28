import crashlytics from '@react-native-firebase/crashlytics';

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

    // Keep only the latest logs
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

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted, error);
        break;
      case LogLevel.ERROR:
        console.error(formatted, error);
        break;
    }
  }

  private logToCrashlytics(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): void {
    if (!environment.monitoring.enableCrashlytics) return;

    try {
      const logMessage = this.formatMessage(level, message, context);

      crashlytics().log(logMessage);

      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          crashlytics().setAttribute(key, String(value));
        });
      }

      if (error && level === LogLevel.ERROR) {
        crashlytics().recordError(error);
      }
    } catch (crashlyticsError) {
      // Fallback to console if Crashlytics fails
      console.warn('Failed to log to Crashlytics:', crashlyticsError);
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
    this.logToCrashlytics(LogLevel.INFO, message, context);
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
    this.logToCrashlytics(LogLevel.WARN, message, context, error);
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
    this.logToCrashlytics(LogLevel.ERROR, message, context, error);
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
    if (environment.monitoring.enableCrashlytics) {
      crashlytics().setUserId(userId);
    }
    this.info('User ID set for logging', { userId });
  }

  public setUserAttributes(attributes: Record<string, string>): void {
    if (environment.monitoring.enableCrashlytics) {
      Object.entries(attributes).forEach(([key, value]) => {
        crashlytics().setAttribute(key, value);
      });
    }
    this.info('User attributes set for logging', attributes);
  }

  public breadcrumb(message: string, category?: string, data?: LogContext): void {
    const breadcrumbData = {
      message,
      category: category || 'general',
      timestamp: new Date().toISOString(),
      ...data,
    };

    if (environment.monitoring.enableCrashlytics) {
      crashlytics().log(`Breadcrumb: ${JSON.stringify(breadcrumbData)}`);
    }

    this.debug(`Breadcrumb: ${message}`, breadcrumbData);
  }
}

// Performance logging utilities
export class PerformanceLogger {
  private static readonly timers: Map<string, number> = new Map();

  public static startTimer(label: string): void {
    this.timers.set(label, Date.now());
    Logger.debug(`Performance timer started: ${label}`);
  }

  public static endTimer(label: string): number {
    const startTime = this.timers.get(label);
    if (!startTime) {
      Logger.warn(`Performance timer not found: ${label}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(label);

    Logger.info(`Performance timer ended: ${label}`, { duration });
    return duration;
  }

  public static measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(label);
    return fn().finally(() => {
      this.endTimer(label);
    });
  }

  public static measure<T>(label: string, fn: () => T): T {
    this.startTimer(label);
    try {
      return fn();
    } finally {
      this.endTimer(label);
    }
  }
}

// Network logging utilities
export class NetworkLogger {
  public static logRequest(url: string, method: string, headers?: Record<string, string>): void {
    if (!environment.debug.enableNetworkLogging) return;

    Logger.debug('Network request started', {
      url,
      method,
      headers: headers ? Object.keys(headers) : undefined, // Don't log actual header values for security
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
;
