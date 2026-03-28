import { Alert } from 'react-native';

import { environment } from '@/config/environment';

import { Logger } from './logger';
import { networkErrorBus } from './networkErrorBus';
import { showErrorToast } from './toast';

export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  NOT_FOUND = 'NOT_FOUND',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN = 'UNKNOWN',
}

interface AppError {
  type: ErrorType;
  message: string;
  code?: string | number;
  originalError?: Error;
  context?: Record<string, unknown>;
  timestamp: Date;
  userMessage?: string;
  shouldReport?: boolean;
  shouldShowToUser?: boolean;
  validationErrors?: Record<string, string>;
  // Backend field-specific error metadata
  field?: string; // Field name for inline validation errors (e.g., 'email', 'password')
  errorCode?: string; // Backend-specific error type code (e.g., 'EMAIL_NOT_FOUND', 'INVALID_PASSWORD')
  // Account lockout metadata
  isAccountLocked?: boolean; // True if this is an account lockout error
  blockedUntil?: string | Date; // Timestamp when account will be unlocked
}

export class ErrorHandler {
  private static errorQueue: AppError[] = [];
  private static isProcessingQueue = false;

  public static createError(
    type: ErrorType,
    message: string,
    options?: Partial<Omit<AppError, 'type' | 'message' | 'timestamp'>>,
  ): AppError {
    return {
      type,
      message,
      timestamp: new Date(),
      shouldReport: true,
      shouldShowToUser: true,
      ...options,
    };
  }

  public static async handle(
    error: Error | AppError,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const appError = this.normalizeError(error, context);

    // Log the error
    this.logError(appError);

    // Add to queue for processing
    this.errorQueue.push(appError);

    // Process the queue
    await this.processErrorQueue();
  }

  private static normalizeError(
    error: Error | AppError,
    context?: Record<string, unknown>,
  ): AppError {
    if (this.isAppError(error)) {
      return {
        ...error,
        context: { ...error.context, ...context },
      };
    }

    // Convert regular Error to AppError
    const errorType = this.determineErrorType(error);

    return this.createError(errorType, error.message, {
      originalError: error,
      ...(context ? { context } : {}),
      userMessage: this.getUserFriendlyMessage(errorType),
    });
  }

  private static isAppError(error: Error | AppError): error is AppError {
    return 'type' in error && 'timestamp' in error;
  }

  private static determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return ErrorType.NETWORK;
    }

    if (message.includes('unauthorized') || message.includes('401')) {
      return ErrorType.AUTHENTICATION;
    }

    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorType.VALIDATION;
    }

    if (message.includes('permission') || message.includes('403')) {
      return ErrorType.PERMISSION;
    }

    if (message.includes('not found') || message.includes('404')) {
      return ErrorType.NOT_FOUND;
    }

    if (message.includes('500') || message.includes('server error')) {
      return ErrorType.SERVER_ERROR;
    }

    if (message.includes('400') || message.includes('bad request')) {
      return ErrorType.CLIENT_ERROR;
    }

    return ErrorType.UNKNOWN;
  }

  private static getUserFriendlyMessage(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Please check your internet connection and try again.';
      case ErrorType.AUTHENTICATION:
        return 'Please log in again to continue.';
      case ErrorType.VALIDATION:
        return 'Please check your input and try again.';
      case ErrorType.PERMISSION:
        return "You don't have permission to perform this action.";
      case ErrorType.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorType.SERVER_ERROR:
        return 'Server is currently unavailable. Please try again later.';
      case ErrorType.CLIENT_ERROR:
        return 'There was a problem with your request.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private static logError(error: AppError): void {
    const context = {
      type: error.type,
      code: error.code,
      context: error.context,
      userMessage: error.userMessage,
    };

    // ✅ OFFLINE-FIRST: Use appropriate log levels
    // Network errors are expected in mobile apps (poor signal, airplane mode)
    // Don't spam ERROR logs for expected scenarios
    if (error.type === ErrorType.NETWORK) {
      // Network errors are INFO - expected and handled gracefully
      Logger.info(`Handling network error | Context: ${JSON.stringify(context)}`);
    } else if (error.type === ErrorType.VALIDATION || error.type === ErrorType.CLIENT_ERROR) {
      // Validation/client errors are WARN - user input issues
      Logger.warn(error.message, context, error.originalError);
    } else {
      // Server errors, auth errors, unknown errors are ERROR
      Logger.error(error.message, context, error.originalError);
    }
  }

  private static async processErrorQueue(): Promise<void> {
    if (this.isProcessingQueue || this.errorQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      const errorsToProcess = [...this.errorQueue];
      this.errorQueue = [];

      for (const error of errorsToProcess) {
        await this.processError(error);
      }
    } finally {
      this.isProcessingQueue = false;

      // Process any new errors that were added during processing
      if (this.errorQueue.length > 0) {
        setTimeout(() => this.processErrorQueue(), 100);
      }
    }
  }

  private static async processError(error: AppError): Promise<void> {
    // Show user notification if needed
    // ✅ PRODUCTION-SAFE: Always show errors, but use non-intrusive Toast in production
    if (error.shouldShowToUser ?? false) {
      this.showErrorToUser(error);
    }

    // Handle specific error types
    await this.handleSpecificErrorType(error);
  }

  private static showErrorToUser(error: AppError): void {
    const message = error.userMessage ?? error.message;
    const title = this.getErrorTitle(error.type);

    // NETWORK errors → non-intrusive top banner (not Alert or Toast)
    if (error.type === ErrorType.NETWORK) {
      networkErrorBus.emit(message);
      return;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // ENVIRONMENT-AWARE ERROR DISPLAY
    // ──────────────────────────────────────────────────────────────────────────

    if (environment.isProduction) {
      // ✅ PRODUCTION: Show non-intrusive Toast
      // Never block user with Alert dialogs in production
      showErrorToast(title, message);
    } else {
      // ✅ DEVELOPMENT/STAGING: Show blocking Alert for debugging
      // Helps developers notice errors immediately
      Alert.alert(title, message, [{ text: 'OK', style: 'cancel' }]);
    }
  }

  private static getErrorTitle(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Required';
      case ErrorType.VALIDATION:
        return 'Invalid Input';
      case ErrorType.PERMISSION:
        return 'Access Denied';
      case ErrorType.NOT_FOUND:
        return 'Not Found';
      case ErrorType.SERVER_ERROR:
        return 'Server Error';
      default:
        return 'Error';
    }
  }

  private static async handleSpecificErrorType(error: AppError): Promise<void> {
    switch (error.type) {
      case ErrorType.AUTHENTICATION:
        await this.handleAuthenticationError();
        break;
      case ErrorType.NETWORK:
        await this.processNetworkError(error);
        break;
      case ErrorType.PERMISSION:
        await this.handlePermissionError();
        break;
      default:
        // No specific handling needed
        break;
    }
  }

  private static async handleAuthenticationError(): Promise<void> {
    // Clear user session and redirect to login
    // This would typically involve clearing storage and navigation
    Logger.info('Handling authentication error - user session expired');
  }

  private static async processNetworkError(error: AppError): Promise<void> {
    // Implement network error handling logic
    // Could include retry mechanism, offline mode, etc.
    Logger.info('Handling network error', { error: error.message });
  }

  private static async handlePermissionError(): Promise<void> {
    // Handle permission errors
    // Could redirect to appropriate screen or show permission request
    Logger.info('Handling permission error');
  }

  // Utility methods for common error scenarios
  public static async handleNetworkError(
    originalError: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const error = this.createError(ErrorType.NETWORK, originalError.message, {
      originalError,
      ...(context ? { context } : {}),
    });
    await this.handle(error);
  }

  public static async handleValidationError(
    message: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const error = this.createError(ErrorType.VALIDATION, message, {
      ...(context ? { context } : {}),
      shouldReport: false, // Validation errors usually don't need reporting
    });
    await this.handle(error);
  }

  public static async handleUnknownError(
    originalError: Error,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const error = this.createError(ErrorType.UNKNOWN, originalError.message, {
      originalError,
      ...(context ? { context } : {}),
    });
    await this.handle(error);
  }

  // Global error handler setup
  public static setupGlobalErrorHandler(): void {
    // Handle unhandled promise rejections
    // Import ErrorUtils from react-native
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ErrorUtils = require('react-native').ErrorUtils;
    const originalHandler = ErrorUtils?.getGlobalHandler?.();

    ErrorUtils?.setGlobalHandler?.(async (error: Error, isFatal?: boolean) => {
      await this.handle(error, { isFatal, source: 'globalHandler' });

      // Call original handler if it exists
      if (Boolean(originalHandler)) {
        originalHandler(error, isFatal);
      }
    });

    // Handle console errors in development
    if (__DEV__) {
      const originalConsoleError = console.error;
      console.error = (...args: unknown[]) => {
        // Log console errors for debugging
        Logger.debug('Console error:', { args });
        originalConsoleError(...args);
      };
    }
  }
}

// Initialize global error handling
ErrorHandler.setupGlobalErrorHandler();
