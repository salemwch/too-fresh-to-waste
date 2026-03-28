import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';

import { AppLoggerService } from '../services/logger.service';

/**
 * ENTERPRISE-GRADE GLOBAL EXCEPTION FILTER
 *
 * Handles all uncaught exceptions across the application with:
 * - Unique error IDs for cross-system tracking
 * - Correlation ID preservation for distributed tracing
 * - Secure error responses (no stack trace leakage in production)
 * - Structured logging to Winston for aggregation
 * - Sentry integration for error monitoring
 * - PII protection (no sensitive data in logs)
 *
 * @compliance OWASP Error Handling, CWE-209 (Information Exposure)
 * @rationale Centralized error handling ensures consistency and security
 * @see https://docs.nestjs.com/exception-filters
 */

interface ErrorResponse {
  status: number;
  message: string;
  error?: string;
  errorId: string;
  correlationId?: string;
  timestamp: string;
  path: string;
  method: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger: AppLoggerService;
  private readonly isProduction: boolean;

  constructor() {
    this.logger = new AppLoggerService();
    this.logger.setContext('AllExceptionsFilter');
    this.isProduction = process.env['NODE_ENV'] === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Extract request metadata
    const correlationId = request.correlationId || 'N/A';
    const path = request.url;
    const method = request.method;
    const userId = (request as Request & { user?: { id?: string } }).user?.id || 'anonymous';

    // Determine HTTP status code
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract error message
    let message: string;
    let errorName: string = 'InternalServerError';

    if (exception instanceof HttpException) {
      const exceptionResponse = exception.getResponse();
      errorName = exception.name;

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const msgValue = (exceptionResponse as Record<string, unknown>)['message'];

        // ✅ CRITICAL FIX: Handle validation errors properly
        if (Array.isArray(msgValue)) {
          // Extract readable messages from array elements
          message = msgValue
            .map((item) => {
              // If item is a string, use it directly
              if (typeof item === 'string') {
                return item;
              }
              // If item is an object with a message property, extract it
              if (item && typeof item === 'object' && 'message' in item) {
                return String(item.message);
              }
              // If item is an object, try to stringify it properly
              if (item && typeof item === 'object') {
                return JSON.stringify(item);
              }
              // Fallback to string conversion
              return String(item);
            })
            .join(', ');
        } else if (typeof msgValue === 'string') {
          message = msgValue;
        } else {
          // Handle non-array, non-string message values
          message = String(msgValue);
        }
      } else {
        message = 'An error occurred';
      }
    } else if (exception instanceof Error) {
      message = this.isProduction ? 'Internal server error' : exception.message;
      errorName = exception.name;
    } else {
      message = 'Internal server error';
    }

    // Sanitize message for production (prevent information leakage)
    if (this.isProduction && status === HttpStatus.INTERNAL_SERVER_ERROR) {
      message = 'An unexpected error occurred. Please contact support with the error ID.';
    }

    // Log error with structured logging
    const errorId = this.logger.error(
      `${method} ${path} - ${errorName}: ${message}`,
      exception instanceof Error ? exception : undefined,
      'ExceptionFilter',
      {
        correlationId,
        userId,
        method,
        path,
        statusCode: status,
        errorName,
        userAgent: request.headers['user-agent'],
        ip: request.ip || request.connection.remoteAddress,
        query: request.query,
        // Note: Do NOT log request body as it may contain sensitive data (passwords, etc.)
      },
    );

    // Send error to Sentry (if configured)
    if (process.env['SENTRY_DSN']) {
      Sentry.withScope((scope) => {
        scope.setTag('errorId', errorId);
        scope.setTag('correlationId', correlationId);
        scope.setTag('path', path);
        scope.setTag('method', method);
        scope.setUser({ id: userId });
        scope.setContext('request', {
          url: path,
          method,
          headers: this.sanitizeHeaders(request.headers),
          query: request.query,
        });

        if (exception instanceof Error) {
          Sentry.captureException(exception);
        } else {
          Sentry.captureMessage(`Non-Error exception: ${JSON.stringify(exception)}`, 'error');
        }
      });
    }

    // Build error response
    const errorResponse: ErrorResponse = {
      status,
      message,
      errorId, // Critical: Return error ID to client for support tickets
      correlationId,
      timestamp: new Date().toISOString(),
      path,
      method,
    };

    // Add error type in development only
    if (!this.isProduction) {
      errorResponse.error = errorName;
    }

    // Send response
    response.status(status).json(errorResponse);
  }

  /**
   * Sanitize headers to remove sensitive information before logging
   */
  private sanitizeHeaders(
    headers: Record<string, string | string[] | undefined>,
  ): Record<string, string | string[] | undefined> {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    sensitiveHeaders.forEach((header) => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return sanitized;
  }
}
