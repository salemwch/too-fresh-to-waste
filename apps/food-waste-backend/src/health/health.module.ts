/**
 * Health Module
 *
 * Provides health check endpoints for monitoring application status.
 * Integrates with @nestjs/terminus for standardized health checks.
 */

import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { CommonModule } from '../common/common.module';

import { DatabaseMetricsScheduler } from './database-metrics.scheduler';
import { HealthController } from './health.controller';
import { DatabasePoolHealthIndicator } from './indicators/database-pool.health';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [TerminusModule, CommonModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, DatabasePoolHealthIndicator, DatabaseMetricsScheduler],
})
export class HealthModule {}
