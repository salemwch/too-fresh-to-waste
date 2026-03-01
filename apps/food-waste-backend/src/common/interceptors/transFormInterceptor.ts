// src/common/interceptors/transform.interceptor.ts
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standardized API response format
 * ✅ CANONICAL: Matches BackendApiResponse in frontend
 */
export interface ResponseFormat<T> {
    status: number;
    message?: string;
    data: T;
    timestamp: string;
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
export class TransformInterceptor<T>
    implements NestInterceptor<T, ResponseFormat<T>> {
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ResponseFormat<T>> {
        const httpStatusCode = context.switchToHttp().getResponse().statusCode;

        return next.handle().pipe(
            map((response) => {
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
                const hasStatusCode = 'statusCode' in response;
                const hasMessage = 'message' in response;
                const hasData = 'data' in response;

                // If response looks like it's already formatted (has data property)
                if (hasData) {
                    // ✅ FIX: Preserve meta field for paginated responses
                    // Controller returns: { message, data, meta? }
                    // Extract meta if it exists and preserve it at top level
                    const hasMeta = 'meta' in response;

                    return {
                        status: httpStatusCode,
                        ...(hasMessage && { message: response.message }),
                        data: response.data as T,
                        ...(hasMeta && { meta: response.meta }),  // ✅ Preserve meta at top level
                        timestamp: new Date().toISOString(),
                    };
                }

                // If response has message but no data, treat the rest as data
                if (hasMessage && !hasData) {
                    const { message, statusCode: _ignoredStatus, ...rest } = response;
                    return {
                        status: httpStatusCode,
                        message,
                        data: Object.keys(rest).length > 0 ? rest : null as T,
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
