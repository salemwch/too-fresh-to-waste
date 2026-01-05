/**
 * Redis Health Indicator
 *
 * Custom health indicator for Redis connectivity.
 * Integrates with @nestjs/terminus health check system.
 */

import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    super();

    // Initialize Redis client for health checks
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      tls: this.configService.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Don't retry on health check
    });
  }

  /**
   * Check Redis Health
   *
   * @param key - Health check key name
   * @returns Health indicator result
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Ping Redis
      const result = await this.redis.ping();

      if (result === 'PONG') {
        return this.getStatus(key, true, {
          message: 'Redis is healthy',
          latency: await this.getLatency(),
        });
      }

      throw new Error('Invalid ping response');
    } catch (error) {
      throw new HealthCheckError(
        'Redis health check failed',
        this.getStatus(key, false, {
          message: error.message,
        }),
      );
    }
  }

  /**
   * Get Redis Latency
   *
   * @returns Latency in milliseconds
   */
  private async getLatency(): Promise<number> {
    try {
      const start = Date.now();
      await this.redis.ping();
      return Date.now() - start;
    } catch {
      return -1;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    await this.redis.quit();
  }
}
