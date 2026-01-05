/**
 * METRICS INTERCEPTOR
 *
 * Automatically records HTTP request metrics for Prometheus monitoring.
 * Tracks request count, duration, and status codes.
 *
 * Applied globally in main.ts to capture all HTTP requests.
 *
 * @see PrometheusMetricsService
 */

import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrometheusMetricsService } from '../services/prometheus-metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(private readonly metricsService: PrometheusMetricsService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        // Only process HTTP requests
        if (context.getType() !== 'http') {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();

        // Extract request details
        const method = request.method;
        const route = this.getRoutePattern(request);

        // Increment in-flight requests
        this.metricsService.incrementHttpInFlight();

        // Record start time
        const startTime = Date.now();

        // Process request and record metrics after completion
        return next.handle().pipe(
            tap({
                next: () => {
                    // Success - record metrics
                    const duration = Date.now() - startTime;
                    const statusCode = response.statusCode || 200;

                    this.metricsService.recordHttpRequest({
                        method,
                        route,
                        statusCode,
                        duration,
                    });

                    this.metricsService.decrementHttpInFlight();
                },
                error: (error) => {
                    // Error - record metrics with error status code
                    const duration = Date.now() - startTime;
                    const statusCode = error?.status || error?.statusCode || 500;

                    this.metricsService.recordHttpRequest({
                        method,
                        route,
                        statusCode,
                        duration,
                    });

                    this.metricsService.decrementHttpInFlight();
                },
            })
        );
    }

    /**
     * Extract route pattern from request
     * Converts /api/v1/offers/123 to /api/v1/offers/:id
     *
     * This prevents high cardinality metrics by grouping similar routes.
     */
    private getRoutePattern(request: any): string {
        // Try to get the route pattern from Express/NestJS
        if (request.route && request.route.path) {
            // Express route pattern (e.g., /api/v1/offers/:id)
            return request.route.path;
        }

        // Fallback to request path (may include actual IDs)
        // This is not ideal for Prometheus but better than nothing
        const path = request.path || request.url;

        // Remove query strings
        return path.split('?')[0];
    }
}
