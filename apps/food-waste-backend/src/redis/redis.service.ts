/**
 * Shared Redis Service
 * Enterprise-grade Redis connection pool manager
 * - Singleton pattern: ONE connection for entire app
 * - Lazy initialization
 * - Automatic reconnection
 * - Graceful shutdown
 */

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientOptions } from 'redis';

import { buildRedisTlsOptions, getRedisConnectionConfig } from './redis.config';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  private getConnectedClientOrThrow(): ReturnType<typeof createClient> {
    if (!this.client?.isOpen) {
      throw new Error('Redis client is not connected');
    }

    return this.client;
  }

  async onModuleInit() {
    // Initialize connection on module startup
    await this.connect();
  }

  async onModuleDestroy() {
    // Close connection on module teardown (dev hot-reload + graceful shutdown)
    await this.disconnect();
  }

  /**
   * Get Redis client instance (singleton)
   * Lazy initialization with connection reuse
   */
  async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client?.isOpen) {
      return this.client;
    }

    // If already connecting, wait for that connection
    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      return this.getConnectedClientOrThrow();
    }

    // Otherwise, initiate new connection
    await this.connect();
    return this.getConnectedClientOrThrow();
  }

  /**
   * Connect to Redis (or reuse existing connection)
   */
  private async connect(): Promise<void> {
    if (this.client?.isOpen) {
      this.logger.log('Redis connection already open, reusing client');
      return;
    }

    if (this.isConnecting) {
      this.logger.log('Redis connection already in progress, waiting for completion');
      await this.connectionPromise;
      return;
    }

    this.isConnecting = true;
    this.connectionPromise = this.establishConnection();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  /**
   * Establish Redis connection with retry logic
   */
  private async establishConnection(): Promise<void> {
    const redisConfig = getRedisConnectionConfig(this.configService);

    this.logger.log(
      `Connecting to Redis at ${redisConfig.host}:${redisConfig.port} (TLS: ${redisConfig.useTls})`,
    );

    try {
      const reconnectStrategy = (retries: number) => {
        if (retries > redisConfig.maxRetries) {
          this.logger.error('Max Redis reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }

        const delay = Math.min(retries * 100, 3000);
        this.logger.log(`Reconnecting to Redis... (attempt ${retries}, delay: ${delay}ms)`);
        return delay;
      };

      const baseSocket = {
        host: redisConfig.host,
        port: redisConfig.port,
        connectTimeout: redisConfig.connectTimeout,
        keepAlive: true,
        keepAliveInitialDelay: 5000,
        reconnectStrategy,
      };

      const tlsOptions = buildRedisTlsOptions(redisConfig);

      const clientConfig: RedisClientOptions = {
        socket: redisConfig.useTls
          ? { ...baseSocket, tls: true as const, ...tlsOptions }
          : baseSocket,
        commandsQueueMaxLength: 1000,
        disableOfflineQueue: false,
        ...(redisConfig.password ? { password: redisConfig.password } : {}),
        ...(redisConfig.username ? { username: redisConfig.username } : {}),
      };

      const client = createClient(clientConfig);

      client.on('error', (err: Error) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      client.on('connect', () => {
        this.logger.log('Redis connected');
      });

      client.on('ready', () => {
        this.logger.log(`Redis ready (TLS: ${redisConfig.useTls}, Port: ${redisConfig.port})`);
      });

      client.on('reconnecting', () => {
        this.logger.warn('Redis reconnecting...');
      });

      client.on('end', () => {
        this.logger.warn('Redis connection ended');
      });

      await client.connect();
      await client.ping();
      this.client = client;

      this.logger.log('Redis connection pool established successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect to Redis: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.client = null;
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   * Called on application shutdown
   */
  async disconnect(): Promise<void> {
    if (this.client?.isOpen) {
      try {
        this.logger.log('Disconnecting from Redis...');
        await this.client.quit();
        this.client = null;
        this.logger.log('Redis disconnected gracefully');
      } catch (error) {
        this.logger.warn('Error during Redis disconnect (forcing closure):', error);
        try {
          await this.client?.disconnect();
        } catch (disconnectError) {
          this.logger.error('Failed to force disconnect:', disconnectError);
        }
        this.client = null;
      }
    }
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.client?.isOpen === true;
  }

  /**
   * Get connection stats for monitoring
   */
  getConnectionInfo() {
    return {
      isConnected: this.isConnected(),
      isConnecting: this.isConnecting,
    };
  }
}
