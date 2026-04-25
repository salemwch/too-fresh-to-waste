import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

import { PrometheusMetricsService } from '../common/services/prometheus-metrics.service';

@Injectable()
export class DatabaseMetricsScheduler {
  private readonly logger = new Logger(DatabaseMetricsScheduler.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly metricsService: PrometheusMetricsService,
  ) {}

  @Interval(30_000)
  async collectPoolMetrics(): Promise<void> {
    try {
      const client = this.connection.getClient();
      if (!client) {
        return;
      }

      const pool = (client as unknown as { topology?: { s?: { pool?: PoolStats } } }).topology?.s
        ?.pool;
      if (pool) {
        const total = pool.totalConnectionCount ?? 0;
        const available = pool.availableConnectionCount ?? 0;
        const active = total - available;
        this.metricsService.updateDatabaseConnectionPool(active, available, total);
        return;
      }

      const db = this.connection.db;
      if (!db) {
        return;
      }
      const status = await db.admin().serverStatus();
      const conns = status?.['connections'] as { current?: number; available?: number } | undefined;
      if (conns) {
        const current = conns.current ?? 0;
        const available = conns.available ?? 0;
        this.metricsService.updateDatabaseConnectionPool(current, available, current + available);
      }
    } catch {
      this.logger.debug('Could not collect pool metrics — non-critical');
    }
  }
}

interface PoolStats {
  totalConnectionCount?: number;
  availableConnectionCount?: number;
}
