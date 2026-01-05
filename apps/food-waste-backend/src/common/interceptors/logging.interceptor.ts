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

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { WinstonLoggerService } from '../services/winston-logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: WinstonLoggerService) {
    this.logger.setContext('HTTP');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const { method, url, body, ip, correlationId } = request;
    const userAgent = request.get('user-agent') || '';
    const startTime = Date.now();

    // Log incoming request
    this.logger.logWithCorrelationId(
      'info',
      `Incoming ${method} ${url}`,
      correlationId,
      {
        method,
        url,
        ip,
        userAgent,
        body: this.sanitizeBody(body),
      }
    );

    return next.handle().pipe(
      tap((data) => {
        const { statusCode } = response;
        const duration = Date.now() - startTime;

        // Log successful response
        this.logger.logWithCorrelationId(
          'info',
          `Outgoing ${method} ${url} - ${statusCode}`,
          correlationId,
          {
            method,
            url,
            statusCode,
            duration,
          }
        );

        // Log performance warning for slow requests
        if (duration > 3000) {
          this.logger.logPerformance(
            `Slow request: ${method} ${url}`,
            duration,
            {
              method,
              url,
              statusCode,
            }
          );
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;

        // Log error
        this.logger.logWithCorrelationId(
          'error',
          `Error ${method} ${url} - ${error.status || 500}`,
          correlationId,
          {
            method,
            url,
            duration,
            error: error.message,
            stack: error.stack,
          }
        );

        return throwError(() => error);
      })
    );
  }

  /**
   * Sanitize Request Body
   *
   * Remove sensitive fields from logs
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'accessToken',
      'refreshToken',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
