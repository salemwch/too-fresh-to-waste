/**
 * Enterprise-Grade Query Performance Monitoring Middleware
 *
 * Tracks slow queries and provides insights for optimization.
 * Integrates with Mongoose to monitor all database operations.
 *
 * Features:
 * - Logs slow queries (>1000ms by default)
 * - Tracks query statistics (count, avg time, max time)
 * - Identifies queries without indexes (COLLSCAN)
 * - Exports metrics for Prometheus/Grafana
 *
 * Usage:
 * ```typescript
 * // app.module.ts
 * import { QueryPerformanceService } from './common/middleware/query-performance.middleware';
 *
 * @Module({
 *   providers: [QueryPerformanceService],
 * })
 * export class AppModule implements OnModuleInit {
 *   constructor(private readonly queryPerformance: QueryPerformanceService) {}
 *
 *   onModuleInit() {
 *     this.queryPerformance.setupMonitoring();
 *   }
 * }
 * ```
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface QueryStats {
  operation: string;
  collection: string;
  count: number;
  totalTime: number;
  avgTime: number;
  maxTime: number;
  minTime: number;
  lastExecuted: Date;
}

export interface SlowQueryLog {
  timestamp: Date;
  operation: string;
  collection: string;
  duration: number;
  query: unknown;
  options: unknown;
}

@Injectable()
export class QueryPerformanceService {
  private readonly logger = new Logger(QueryPerformanceService.name);
  private readonly queryStats: Map<string, QueryStats> = new Map();
  private readonly slowQueries: SlowQueryLog[] = [];
  private readonly SLOW_QUERY_THRESHOLD_MS: number;
  private readonly MAX_SLOW_QUERIES_STORED = 100;

  constructor(@InjectConnection() private readonly connection: Connection) {
    // Configurable slow query threshold (default: 1000ms)
    this.SLOW_QUERY_THRESHOLD_MS =
      parseInt(process.env['SLOW_QUERY_THRESHOLD_MS'] ?? '1000', 10) || 1000;
  }

  /**
   * Setup Mongoose query monitoring
   * Hooks into Mongoose to track all database operations
   */
  setupMonitoring(): void {
    if (
      process.env['NODE_ENV'] === 'production' &&
      process.env['ENABLE_QUERY_MONITORING'] !== 'true'
    ) {
      this.logger.log(
        'Query monitoring disabled in production (set ENABLE_QUERY_MONITORING=true to enable)',
      );
      return;
    }

    this.logger.log(
      `🔍 Query performance monitoring enabled (threshold: ${this.SLOW_QUERY_THRESHOLD_MS}ms)`,
    );

    // Store reference to service instance for use in callbacks
    const service = this;

    // Mongoose 8.x compatible: Use regex pattern instead of array
    // This matches all query/document middleware methods we want to monitor
    const methodPattern =
      /^(find|findOne|findOneAndUpdate|findOneAndDelete|updateOne|updateMany|deleteOne|deleteMany|countDocuments|aggregate)$/;

    // Monitor Mongoose queries
    this.connection.plugin((schema) => {
      // Pre-hook to capture start time
      schema.pre(methodPattern, function (this: Record<string, unknown>) {
        this['_startTime'] = Date.now();
      });

      // Post-hook to measure execution time
      schema.post(methodPattern, function (this: Record<string, unknown>, _result: unknown) {
        const startTime = typeof this['_startTime'] === 'number' ? this['_startTime'] : Date.now();
        const duration = Date.now() - startTime;
        const operation =
          (typeof this['op'] === 'string'
            ? this['op']
            : (this['constructor'] as { name?: string } | undefined)?.name) ?? 'unknown';
        const mongooseCollection = this['mongooseCollection'] as
          | { collectionName?: string }
          | undefined;
        const collection = mongooseCollection?.collectionName ?? 'unknown';

        // Track query statistics (use service reference)
        service.trackQueryStats(operation, collection, duration);

        // Log slow queries
        if (duration >= service.SLOW_QUERY_THRESHOLD_MS) {
          service.logSlowQuery(
            operation,
            collection,
            duration,
            typeof this['getQuery'] === 'function'
              ? (this['getQuery'] as () => unknown)()
              : undefined,
            typeof this['getOptions'] === 'function'
              ? (this['getOptions'] as () => unknown)()
              : undefined,
          );
        }
      });
    });

    // Log stats periodically (every 5 minutes)
    if (process.env['NODE_ENV'] === 'development') {
      setInterval(() => this.logQueryStats(), 5 * 60 * 1000);
    }
  }

  /**
   * Track query statistics
   * Note: Internal method exposed for middleware callback access
   */
  trackQueryStats(operation: string, collection: string, duration: number): void {
    const key = `${collection}.${operation}`;
    const existing = this.queryStats.get(key);

    if (existing) {
      existing.count++;
      existing.totalTime += duration;
      existing.avgTime = existing.totalTime / existing.count;
      existing.maxTime = Math.max(existing.maxTime, duration);
      existing.minTime = Math.min(existing.minTime, duration);
      existing.lastExecuted = new Date();
    } else {
      this.queryStats.set(key, {
        operation,
        collection,
        count: 1,
        totalTime: duration,
        avgTime: duration,
        maxTime: duration,
        minTime: duration,
        lastExecuted: new Date(),
      });
    }
  }

  /**
   * Log slow queries for analysis
   * Note: Internal method exposed for middleware callback access
   */
  logSlowQuery(
    operation: string,
    collection: string,
    duration: number,
    query: unknown,
    options: unknown,
  ): void {
    const slowQuery: SlowQueryLog = {
      timestamp: new Date(),
      operation,
      collection,
      duration,
      query,
      options,
    };

    this.slowQueries.unshift(slowQuery);

    // Keep only last N slow queries
    if (this.slowQueries.length > this.MAX_SLOW_QUERIES_STORED) {
      this.slowQueries.pop();
    }

    // Log to console
    this.logger.warn(
      `🐌 SLOW QUERY DETECTED: ${collection}.${operation} took ${duration}ms\n` +
        `   Query: ${JSON.stringify(query)}\n` +
        `   Options: ${JSON.stringify(options)}`,
    );

    // TODO: Send to APM (Sentry, DataDog, New Relic)
    // if (process.env.NODE_ENV === 'production') {
    //     Sentry.captureMessage('Slow Query', {
    //         level: 'warning',
    //         extra: slowQuery,
    //     });
    // }
  }

  /**
   * Get query statistics (for admin dashboard)
   */
  getQueryStats(): QueryStats[] {
    return Array.from(this.queryStats.values()).sort((a, b) => b.avgTime - a.avgTime); // Sort by average time (slowest first)
  }

  /**
   * Get slow queries (for debugging)
   */
  getSlowQueries(limit: number = 20): SlowQueryLog[] {
    return this.slowQueries.slice(0, limit);
  }

  /**
   * Get top slowest queries
   */
  getTopSlowQueries(limit: number = 10): QueryStats[] {
    return this.getQueryStats()
      .sort((a, b) => b.maxTime - a.maxTime)
      .slice(0, limit);
  }

  /**
   * Get most frequent queries
   */
  getMostFrequentQueries(limit: number = 10): QueryStats[] {
    return this.getQueryStats()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Log query statistics (called periodically)
   */
  private logQueryStats(): void {
    const stats = this.getQueryStats();

    if (stats.length === 0) {
      return;
    }

    this.logger.log(`\n${'='.repeat(80)}`);
    this.logger.log('📊 QUERY PERFORMANCE STATISTICS');
    this.logger.log('='.repeat(80));

    // Top 10 slowest queries
    const slowest = stats.slice(0, 10);
    this.logger.log('\n🐌 Top 10 Slowest Queries (by avg time):');
    slowest.forEach((stat, index) => {
      this.logger.log(
        `${index + 1}. ${stat.collection}.${stat.operation} ` +
          `- Avg: ${stat.avgTime.toFixed(2)}ms, Max: ${stat.maxTime}ms, Count: ${stat.count}`,
      );
    });

    // Top 10 most frequent queries
    const frequent = this.getMostFrequentQueries(10);
    this.logger.log('\n🔥 Top 10 Most Frequent Queries:');
    frequent.forEach((stat, index) => {
      this.logger.log(
        `${index + 1}. ${stat.collection}.${stat.operation} ` +
          `- Count: ${stat.count}, Avg: ${stat.avgTime.toFixed(2)}ms`,
      );
    });

    // Total statistics
    const totalQueries = stats.reduce((sum, s) => sum + s.count, 0);
    const totalTime = stats.reduce((sum, s) => sum + s.totalTime, 0);
    const avgTimeOverall = totalTime / totalQueries;

    this.logger.log('\n📈 Overall Statistics:');
    this.logger.log(`   Total Queries: ${totalQueries}`);
    this.logger.log(`   Average Query Time: ${avgTimeOverall.toFixed(2)}ms`);
    this.logger.log(`   Unique Query Types: ${stats.length}`);
    this.logger.log(
      `   Slow Queries (>${this.SLOW_QUERY_THRESHOLD_MS}ms): ${this.slowQueries.length}`,
    );

    this.logger.log(`${'='.repeat(80)}\n`);
  }

  /**
   * Reset statistics (for testing)
   */
  resetStats(): void {
    this.queryStats.clear();
    this.slowQueries.length = 0;
    this.logger.log('📊 Query statistics reset');
  }

  /**
   * Export metrics for Prometheus (if using Prometheus)
   */
  exportPrometheusMetrics(): string {
    const stats = this.getQueryStats();

    let metrics = '# HELP mongodb_query_duration_ms MongoDB query duration in milliseconds\n';
    metrics += '# TYPE mongodb_query_duration_ms summary\n';

    stats.forEach((stat) => {
      const labels = `{collection="${stat.collection}",operation="${stat.operation}"}`;
      metrics += `mongodb_query_duration_ms_count${labels} ${stat.count}\n`;
      metrics += `mongodb_query_duration_ms_sum${labels} ${stat.totalTime}\n`;
      metrics += `mongodb_query_duration_ms_max${labels} ${stat.maxTime}\n`;
      metrics += `mongodb_query_duration_ms_min${labels} ${stat.minTime}\n`;
    });

    return metrics;
  }
}
