/**
 * METRICS CONTROLLER
 *
 * Exposes Prometheus metrics endpoint for monitoring systems.
 * Used by Prometheus, Grafana, and other monitoring tools.
 *
 * Endpoint: GET /metrics
 *
 * Security:
 * - Protected by global JwtAuthGuard (requires authentication)
 * - Should also be restricted at infrastructure level (firewall/VPC)
 * - Does not expose sensitive data (only aggregated metrics)
 *
 * @see https://prometheus.io/docs/instrumenting/exposition_formats/
 */

import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiExcludeEndpoint,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { UserRole } from '@foodwaste/shared';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { PrometheusMetricsService } from '../services/prometheus-metrics.service';

@ApiTags('Monitoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: PrometheusMetricsService) {}

  /**
   * Prometheus Metrics Endpoint
   *
   * Returns all application metrics in Prometheus exposition format.
   * This endpoint is scraped by Prometheus at regular intervals.
   *
   * @returns Metrics in Prometheus format
   */
  @Get()
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
This endpoint requires authentication (JWT). Configure Prometheus with a service
account token, or restrict at the infrastructure level (firewall/VPC).
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
    const metrics = await this.metricsService.getMetrics();
    return metrics;
  }
}
