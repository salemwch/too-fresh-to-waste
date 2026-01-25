/**
 * METRICS CONTROLLER
 *
 * Exposes Prometheus metrics endpoint for monitoring systems.
 * Used by Prometheus, Grafana, and other monitoring tools.
 *
 * Endpoint: GET /metrics
 *
 * Security:
 * - Public endpoint (no authentication required)
 * - Should be restricted at infrastructure level (firewall/VPC)
 * - Does not expose sensitive data (only aggregated metrics)
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */

import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { PrometheusMetricsService } from '../services/prometheus-metrics.service';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
    constructor(
        private readonly metricsService: PrometheusMetricsService
    ) {}

    /**
     * Prometheus Metrics Endpoint
     *
     * Returns all application metrics in Prometheus exposition format.
     * This endpoint is scraped by Prometheus at regular intervals.
     *
     * @returns Metrics in Prometheus format
     */
    @Get()
    @Public()
    @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    @ApiOperation({
        summary: 'Get Prometheus metrics',
        description: `
Returns application metrics in Prometheus exposition format.

**Metrics Categories:**
- \`http_requests_total\` - Total HTTP requests by method, route, and status
- \`http_request_duration_seconds\` - Request duration histogram
- \`http_requests_in_flight\` - Currently processing requests
- \`database_operations_total\` - Total database operations
- \`database_operation_duration_seconds\` - Database operation duration
- \`business_events_total\` - Business events (orders, offers, etc.)
- \`nodejs_*\` - Node.js runtime metrics (CPU, memory, GC, etc.)

**Security Note:**
This endpoint is public but should be restricted at the infrastructure level.
Configure your firewall/VPC to only allow access from Prometheus servers.
        `,
    })
    @ApiResponse({
        status: 200,
        description: 'Metrics returned in Prometheus format',
        content: {
            'text/plain': {
                example: `# HELP http_requests_total Total number of HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/v1/offers",status_code="200"} 1234

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/v1/offers",status_code="200",le="0.01"} 1000
http_request_duration_seconds_bucket{method="GET",route="/api/v1/offers",status_code="200",le="0.05"} 1200
http_request_duration_seconds_sum{method="GET",route="/api/v1/offers",status_code="200"} 15.5
http_request_duration_seconds_count{method="GET",route="/api/v1/offers",status_code="200"} 1234

# HELP nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes 50331648
`,
            },
        },
    })
    @ApiExcludeEndpoint(false) // Include in Swagger docs
    async getMetrics(): Promise<string> {
        return await this.metricsService.getMetrics();
    }
}
