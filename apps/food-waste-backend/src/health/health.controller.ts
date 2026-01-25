/**
 * Health Check Controller
 *
 * Provides endpoints for monitoring application health:
 * - /health - Comprehensive health check (database, memory, redis)
 * - /health/liveness - Simple liveness probe (k8s)
 * - /health/readiness - Readiness probe (k8s)
 *
 * Used by:
 * - Kubernetes liveness/readiness probes
 * - Docker health checks
 * - Load balancers
 * - Monitoring systems
 */

import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('Health')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MongooseHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  /**
   * Comprehensive Health Check
   *
   * Checks:
   * - Database connectivity
   * - Redis connectivity
   * - Memory usage (heap & RSS)
   *
   * @returns Health check results with status of all services
   */
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Comprehensive health check',
    description: 'Checks database, Redis, and memory health',
  })
  @ApiResponse({
    status: 200,
    description: 'All health checks passed',
  })
  @ApiResponse({
    status: 503,
    description: 'One or more health checks failed',
  })
  check() {
    return this.health.check([
      // Database health
      () => this.db.pingCheck('database', { timeout: 3000 }),

      // Redis health
      () => this.redis.isHealthy('redis'),

      // Memory health (heap < 150MB)
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),

      // Memory health (RSS < 150MB)
      () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024),
    ]);
  }

  /**
   * Liveness Probe
   *
   * Simple check to verify the application is running.
   * Does not check external dependencies.
   *
   * Used by Kubernetes to restart unhealthy pods.
   *
   * @returns Basic status with timestamp
   */
  @Get('liveness')
  @Public()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple check to verify application is running',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    };
  }

  /**
   * Readiness Probe
   *
   * Checks if the application is ready to accept traffic.
   * Verifies critical dependencies (database).
   *
   * Used by Kubernetes to determine if pod can receive traffic.
   *
   * @returns Readiness check results
   */
  @Get('readiness')
  @Public()
  @HealthCheck()
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Checks if application is ready to accept traffic',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  readiness() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 3000 }),
      () => this.redis.isHealthy('redis'),
    ]);
  }
}
