/**
 * ENTERPRISE-GRADE PROMETHEUS METRICS SERVICE
 *
 * Provides comprehensive application metrics for Prometheus monitoring.
 * Implements production-ready observability patterns.
 *
 * Metrics Categories:
 * - HTTP Request metrics (counter, histogram)
 * - Database operation metrics (query performance)
 * - Business metrics (orders, offers, users)
 * - System metrics (CPU, memory, event loop lag)
 * - Custom application metrics
 *
 * @compliance Production-ready monitoring (FAANG-level)
 * @see https://prometheus.io/docs/practices/naming/
 * @see https://github.com/siimon/prom-client
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    Counter,
    Gauge,
    Histogram,
    Registry,
    collectDefaultMetrics,
} from 'prom-client';

export interface HttpMetrics {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
}

export interface DatabaseMetrics {
    operation: string;
    collection: string;
    duration: number;
    success: boolean;
}

@Injectable()
export class PrometheusMetricsService implements OnModuleInit {
    public readonly register: Registry;

    // HTTP Metrics
    private readonly httpRequestsTotal: Counter;
    private readonly httpRequestDuration: Histogram;
    private readonly httpRequestsInFlight: Gauge;

    // Database Metrics
    private readonly databaseOperationsTotal: Counter;
    private readonly databaseOperationDuration: Histogram;
    private readonly databaseConnectionPool: Gauge;

    // Business Metrics
    private readonly businessEventsTotal: Counter;
    private readonly activeUsers: Gauge;
    private readonly queuedJobs: Gauge;

    // System Metrics
    private readonly eventLoopLag: Gauge;

    constructor(private readonly configService: ConfigService) {
        // Create a new Registry
        this.register = new Registry();

        // =====================================================================
        // HTTP REQUEST METRICS
        // =====================================================================

        /**
         * Total HTTP requests counter
         * Labels: method, route, status_code
         */
        this.httpRequestsTotal = new Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.register],
        });

        /**
         * HTTP request duration histogram
         * Buckets optimized for typical API response times
         */
        this.httpRequestDuration = new Histogram({
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.register],
        });

        /**
         * HTTP requests currently being processed
         */
        this.httpRequestsInFlight = new Gauge({
            name: 'http_requests_in_flight',
            help: 'Current number of HTTP requests being processed',
            registers: [this.register],
        });

        // =====================================================================
        // DATABASE METRICS
        // =====================================================================

        /**
         * Total database operations counter
         * Labels: operation, collection, status
         */
        this.databaseOperationsTotal = new Counter({
            name: 'database_operations_total',
            help: 'Total number of database operations',
            labelNames: ['operation', 'collection', 'status'],
            registers: [this.register],
        });

        /**
         * Database operation duration histogram
         */
        this.databaseOperationDuration = new Histogram({
            name: 'database_operation_duration_seconds',
            help: 'Database operation duration in seconds',
            labelNames: ['operation', 'collection'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.register],
        });

        /**
         * Database connection pool size
         */
        this.databaseConnectionPool = new Gauge({
            name: 'database_connection_pool_size',
            help: 'Current size of database connection pool',
            labelNames: ['state'], // active, idle, total
            registers: [this.register],
        });

        // =====================================================================
        // BUSINESS METRICS
        // =====================================================================

        /**
         * Business events counter
         * Labels: event_type (order_created, offer_purchased, etc.)
         */
        this.businessEventsTotal = new Counter({
            name: 'business_events_total',
            help: 'Total number of business events',
            labelNames: ['event_type', 'status'],
            registers: [this.register],
        });

        /**
         * Active users gauge
         */
        this.activeUsers = new Gauge({
            name: 'active_users',
            help: 'Number of currently active users',
            labelNames: ['user_type'], // consumer, establishment, admin
            registers: [this.register],
        });

        /**
         * Queued jobs gauge
         */
        this.queuedJobs = new Gauge({
            name: 'queued_jobs',
            help: 'Number of jobs in queue',
            labelNames: ['queue_name', 'status'], // waiting, active, completed, failed
            registers: [this.register],
        });

        // =====================================================================
        // SYSTEM METRICS
        // =====================================================================

        /**
         * Event loop lag gauge
         */
        this.eventLoopLag = new Gauge({
            name: 'nodejs_eventloop_lag_seconds',
            help: 'Event loop lag in seconds',
            registers: [this.register],
        });
    }

    /**
     * Initialize metrics collection
     * Called automatically by NestJS lifecycle
     */
    onModuleInit(): void {
        // Collect default Node.js metrics (CPU, memory, GC, etc.)
        collectDefaultMetrics({
            register: this.register,
            prefix: 'nodejs_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        });

        // Start event loop lag monitoring
        this.startEventLoopMonitoring();

        console.log('[Prometheus] Metrics collection initialized');
    }

    /**
     * Monitor event loop lag
     * Measures how long it takes for the event loop to process events
     */
    private startEventLoopMonitoring(): void {
        const checkInterval = 1000; // Check every second
        let lastCheck = Date.now();

        setInterval(() => {
            const now = Date.now();
            const lag = (now - lastCheck - checkInterval) / 1000;
            this.eventLoopLag.set(Math.max(0, lag));
            lastCheck = now;
        }, checkInterval);
    }

    // =========================================================================
    // HTTP METRICS RECORDING
    // =========================================================================

    /**
     * Record HTTP request metrics
     */
    recordHttpRequest(metrics: HttpMetrics): void {
        const labels = {
            method: metrics.method,
            route: metrics.route,
            status_code: metrics.statusCode.toString(),
        };

        this.httpRequestsTotal.inc(labels);
        this.httpRequestDuration.observe(labels, metrics.duration / 1000);
    }

    /**
     * Increment in-flight HTTP requests
     */
    incrementHttpInFlight(): void {
        this.httpRequestsInFlight.inc();
    }

    /**
     * Decrement in-flight HTTP requests
     */
    decrementHttpInFlight(): void {
        this.httpRequestsInFlight.dec();
    }

    // =========================================================================
    // DATABASE METRICS RECORDING
    // =========================================================================

    /**
     * Record database operation metrics
     */
    recordDatabaseOperation(metrics: DatabaseMetrics): void {
        const labels = {
            operation: metrics.operation,
            collection: metrics.collection,
            status: metrics.success ? 'success' : 'error',
        };

        this.databaseOperationsTotal.inc(labels);

        if (metrics.success) {
            this.databaseOperationDuration.observe(
                {
                    operation: metrics.operation,
                    collection: metrics.collection,
                },
                metrics.duration / 1000
            );
        }
    }

    /**
     * Update database connection pool metrics
     */
    updateDatabaseConnectionPool(active: number, idle: number, total: number): void {
        this.databaseConnectionPool.set({ state: 'active' }, active);
        this.databaseConnectionPool.set({ state: 'idle' }, idle);
        this.databaseConnectionPool.set({ state: 'total' }, total);
    }

    // =========================================================================
    // BUSINESS METRICS RECORDING
    // =========================================================================

    /**
     * Record business event
     */
    recordBusinessEvent(eventType: string, status: 'success' | 'failure' = 'success'): void {
        this.businessEventsTotal.inc({ event_type: eventType, status });
    }

    /**
     * Update active users count
     */
    updateActiveUsers(userType: 'consumer' | 'establishment' | 'admin', count: number): void {
        this.activeUsers.set({ user_type: userType }, count);
    }

    /**
     * Update queued jobs count
     */
    updateQueuedJobs(queueName: string, status: string, count: number): void {
        this.queuedJobs.set({ queue_name: queueName, status }, count);
    }

    // =========================================================================
    // METRICS EXPORT
    // =========================================================================

    /**
     * Get all metrics in Prometheus format
     * Used by /metrics endpoint
     */
    async getMetrics(): Promise<string> {
        return await this.register.metrics();
    }

    /**
     * Get metrics content type
     */
    getContentType(): string {
        return this.register.contentType;
    }

    /**
     * Reset all metrics (for testing)
     */
    resetMetrics(): void {
        this.register.resetMetrics();
    }

    /**
     * Get registry (for custom metrics)
     */
    getRegistry(): Registry {
        return this.register;
    }
}
