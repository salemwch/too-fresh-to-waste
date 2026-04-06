/**
 * Logging Interceptor
 *
 * Automatically logs all HTTP requests and responses.
 * Tracks request duration and status codes.
 *
 * Features:
 * - Request/response logging
 * - Performance tracking
 * - Error logging
 * - Correlation ID tracking
 */

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { WinstonLoggerService } from '../services/winston-logger.service';

import type { Request, Response } from 'express';

type CorrelationRequest = Request & { correlationId?: string };

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<CorrelationRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method, url, correlationId } = request;
    const ip = request.ip ?? 'unknown';
    const cid = correlationId ?? '';
    const body: unknown = request.body;
    const userAgent = request.get('user-agent') ?? '';
    const startTime = Date.now();

    // Log incoming request
    this.logger.logWithCorrelationId('info', `Incoming ${method} ${url}`, cid, {
      method,
      url,
      ip,
      userAgent,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap(_data => {
        const { statusCode } = response;
        const duration = Date.now() - startTime;

        // Log successful response
        this.logger.logWithCorrelationId('info', `Outgoing ${method} ${url} - ${statusCode}`, cid, {
          method,
          url,
          statusCode,
          duration,
        });

        // Log performance warning for slow requests
        if (duration > 3000) {
          this.logger.logPerformance(`Slow request: ${method} ${url}`, duration, {
            method,
            url,
            statusCode,
          });
        }
      }),
      catchError((error: unknown) => {
        const duration = Date.now() - startTime;
        const statusCode = this.getErrorStatusCode(error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;

        // Log error
        this.logger.logWithCorrelationId('error', `Error ${method} ${url} - ${statusCode}`, cid, {
          method,
          url,
          duration,
          error: errorMessage,
          stack: errorStack,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Sanitize Request Body
   *
   * Remove sensitive fields from logs
   */
  private sanitizeBody(body: unknown): Record<string, unknown> {
    if (body === null || body === undefined || typeof body !== 'object') {
      return {};
    }

    const sanitized: Record<string, unknown> = { ...(body as Record<string, unknown>) };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field] !== null && sanitized[field] !== undefined) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private getErrorStatusCode(error: unknown): number {
    if (error !== null && error !== undefined && typeof error === 'object') {
      const maybeHttpError = error as { status?: unknown };
      if (typeof maybeHttpError.status === 'number') {
        return maybeHttpError.status;
      }
    }

    return 500;
  }
}
