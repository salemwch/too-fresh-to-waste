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

import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';

import { Public } from '../common/decorators/public.decorator';

import { DatabasePoolHealthIndicator } from './indicators/database-pool.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@ApiTags('Health')
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MongooseHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly dbPool: DatabasePoolHealthIndicator,
    private readonly configService: ConfigService,
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
  async check() {
    const result = await this.health.check([
      // Database health
      async () => {
        const r = await this.db.pingCheck('database', { timeout: 3000 });
        return r;
      },

      // Redis health
      async () => {
        const r = await this.redis.isHealthy('redis');
        return r;
      },

      // Memory health (heap < 300MB)
      async () => {
        const r = await this.memory.checkHeap('memory_heap', 300 * 1024 * 1024);
        return r;
      },

      // Memory health (RSS < 512MB)
      async () => {
        const r = await this.memory.checkRSS('memory_rss', 512 * 1024 * 1024);
        return r;
      },
    ]);
    return result;
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
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Verifies application is running and memory is within safe limits',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
  })
  @ApiResponse({
    status: 503,
    description: 'Application memory exceeded safe thresholds — pod should restart',
  })
  async liveness() {
    const result = await this.health.check([
      // Restart pod only when heap is truly exhausted (900 MB)
      async () => {
        const r = await this.memory.checkHeap('memory_heap', 900 * 1024 * 1024);
        return r;
      },
      // Restart pod when RSS exceeds 1.2 GB
      async () => {
        const r = await this.memory.checkRSS('memory_rss', 1200 * 1024 * 1024);
        return r;
      },
    ]);

    return {
      ...result,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>('NODE_ENV', 'development'),
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
  async readiness() {
    const result = await this.health.check([
      async () => {
        const r = await this.db.pingCheck('database', { timeout: 3000 });
        return r;
      },
      async () => {
        const r = await this.redis.isHealthy('redis');
        return r;
      },
      async () => {
        const r = await this.dbPool.isHealthy('database_pool');
        return r;
      },
    ]);
    return result;
  }
}
