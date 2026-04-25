import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { Connection } from 'mongoose';

const UNREADY_THRESHOLD = 0.9;
const RECOVERY_THRESHOLD = 0.75;

@Injectable()
export class DatabasePoolHealthIndicator extends HealthIndicator {
  private wasUnhealthy = false;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      await Promise.resolve();
      const maxPoolSize = Number.parseInt(this.configService.get('MONGO_MAX_POOL_SIZE', '100'), 10);

      const client = this.connection.getClient();
      const topology = (client as unknown as { topology?: TopologyLike }).topology;
      const pool = topology?.s?.pool;

      if (pool?.totalConnectionCount === undefined) {
        return this.getStatus(key, true, { message: 'Pool stats unavailable — skipped' });
      }

      const inUse = pool.totalConnectionCount - (pool.availableConnectionCount ?? 0);
      const saturation = maxPoolSize > 0 ? inUse / maxPoolSize : 0;

      const threshold = this.wasUnhealthy ? RECOVERY_THRESHOLD : UNREADY_THRESHOLD;
      const isUnhealthy = saturation >= threshold;
      this.wasUnhealthy = isUnhealthy;

      const detail = {
        inUse,
        available: pool.availableConnectionCount ?? 0,
        maxPoolSize,
        saturation: `${(saturation * 100).toFixed(1)}%`,
      };

      if (isUnhealthy) {
        throw new HealthCheckError(
          `Connection pool saturation at ${(saturation * 100).toFixed(0)}%`,
          this.getStatus(key, false, detail),
        );
      }

      return this.getStatus(key, true, detail);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }
      throw new HealthCheckError(
        'Database pool health check failed',
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}

interface TopologyLike {
  s?: {
    pool?: {
      totalConnectionCount?: number;
      availableConnectionCount?: number;
    };
  };
}
