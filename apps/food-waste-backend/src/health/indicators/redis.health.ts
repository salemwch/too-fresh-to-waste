/**
 * Redis Health Indicator
 *
 * Custom health indicator for Redis connectivity.
 * Integrates with @nestjs/terminus health check system.
 */

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  /**
   * Check Redis Health
   *
   * @param key - Health check key name
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const redis = await this.redisService.getClient();
      const start = Date.now();
      const result = await redis.ping();

      if (result === 'PONG') {
        return this.getStatus(key, true, {
          message: 'Redis is healthy',
          latency: Date.now() - start,
        });
      }

      throw new Error('Invalid ping response');
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}
