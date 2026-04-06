// src/common/interceptors/transform.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import type { Response } from 'express';

/**
 * Standardized API response format
 * ✅ CANONICAL: Matches BackendApiResponse in frontend
 */
interface ResponseFormat<T> {
  status: number;
  message?: string | undefined;
  data: T;
  timestamp: string;
  meta?: unknown;
}

interface WrappedResponseCandidate {
  message?: string;
  data?: unknown;
  meta?: unknown;
  statusCode?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null && value !== undefined && typeof value === 'object' && !Array.isArray(value)
  );
}

function toWrappedResponseCandidate(value: unknown): WrappedResponseCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  return value;
}

/**
 * Global response transformer interceptor
 *
 * Ensures consistent response format across all endpoints:
 * {
 *   status: 200,
 *   message: "Success message",
 *   data: { ... },
 *   timestamp: "2026-01-10T..."
 * }
 *
 * Handles both old-style responses (with statusCode) and new-style responses
 * to prevent double-wrapping during migration.
 */
@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseFormat<T>> {
    const httpStatusCode = context.switchToHttp().getResponse<Response>().statusCode;

    return next.handle().pipe(
      map((response: unknown): ResponseFormat<T> => {
        // If response is null/undefined, return empty data
        if (response === null || response === undefined) {
          return {
            status: httpStatusCode,
            data: null as T,
            timestamp: new Date().toISOString(),
          };
        }

        // Check if controller returned old-style wrapped response
        // Pattern: { statusCode?: number, message?: string, data?: any }
        const wrappedResponse = toWrappedResponseCandidate(response);
        const hasMessage = typeof wrappedResponse?.message === 'string';
        const hasData =
          wrappedResponse !== null && wrappedResponse !== undefined && 'data' in wrappedResponse;

        // If response looks like it's already formatted (has data property)
        if (wrappedResponse !== null && wrappedResponse !== undefined && hasData) {
          // ✅ FIX: Preserve meta field for paginated responses
          // Controller returns: { message, data, meta? }
          // Extract meta if it exists and preserve it at top level
          const hasMeta = 'meta' in wrappedResponse;

          return {
            status: httpStatusCode,
            ...(hasMessage && { message: wrappedResponse.message }),
            data: wrappedResponse.data as T,
            ...(hasMeta && { meta: wrappedResponse.meta }), // ✅ Preserve meta at top level
            timestamp: new Date().toISOString(),
          };
        }

        // If response has message but no data, treat the rest as data
        if (wrappedResponse !== null && wrappedResponse !== undefined && hasMessage && !hasData) {
          const { message, statusCode: _ignoredStatus, ...rest } = wrappedResponse;
          return {
            status: httpStatusCode,
            message,
            data: (Object.keys(rest).length > 0 ? rest : null) as T,
            timestamp: new Date().toISOString(),
          };
        }

        // Raw response - wrap it as data
        return {
          status: httpStatusCode,
          data: response as T,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
