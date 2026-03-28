/**
 * Shared Redis Service
 * Enterprise-grade Redis connection pool manager
 * - Singleton pattern: ONE connection for entire app
 * - Lazy initialization
 * - Automatic reconnection
 * - Graceful shutdown
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientOptions } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private client: ReturnType<typeof createClient> | null = null;
  private isConnecting = false;
  private connectionPromise: Promise<void> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    // Initialize connection on module startup
    await this.connect();
  }

  /**
   * Get Redis client instance (singleton)
   * Lazy initialization with connection reuse
   */
  async getClient(): Promise<ReturnType<typeof createClient>> {
    if (this.client && this.client.isOpen) {
      return this.client;
    }

    // If already connecting, wait for that connection
    if (this.isConnecting && this.connectionPromise) {
      await this.connectionPromise;
      return this.client!;
    }

    // Otherwise, initiate new connection
    await this.connect();
    return this.client!;
  }

  /**
   * Connect to Redis (or reuse existing connection)
   */
  private async connect(): Promise<void> {
    if (this.client && this.client.isOpen) {
      this.logger.log('✅ Reusing existing Redis connection');
      return;
    }

    if (this.isConnecting) {
      this.logger.log('⏳ Connection already in progress, waiting...');
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
    const redisConfig = {
      host: this.configService.get<string>('REDIS_HOST'),
      port: parseInt(this.configService.get<string>('REDIS_PORT') || '6379'),
      tlsPort: parseInt(this.configService.get<string>('REDIS_TLS_PORT') || '0'),
      password: this.configService.get<string>('REDIS_PASSWORD'),
      username: this.configService.get<string>('REDIS_USERNAME', 'default'),
      tls: this.configService.get<string>('REDIS_TLS') === 'true',
    };

    const useTLS = redisConfig.tls && redisConfig.tlsPort > 0;
    const port = useTLS ? redisConfig.tlsPort : redisConfig.port;

    this.logger.log(`🔌 Connecting to Redis at ${redisConfig.host}:${port} (TLS: ${useTLS})`);

    const connectTimeout = parseInt(
      this.configService.get<string>('REDIS_CONNECT_TIMEOUT', '10000'),
    );
    const commandTimeout = parseInt(
      this.configService.get<string>('REDIS_COMMAND_TIMEOUT', '5000'),
    );
    void commandTimeout;
    const maxRetries = parseInt(this.configService.get<string>('REDIS_MAX_RETRIES', '10'));

    try {
      const reconnectStrategy = (retries: number) => {
        if (retries > maxRetries) {
          this.logger.error('Max Redis reconnection attempts reached');
          return new Error('Max reconnection attempts reached');
        }
        const delay = Math.min(retries * 100, 3000);
        this.logger.log(`Reconnecting to Redis... (attempt ${retries}, delay: ${delay}ms)`);
        return delay;
      };

      const baseSocket = {
        host: redisConfig.host,
        port,
        connectTimeout,
        keepAlive: true, // TCP keep-alive to detect dead connections
        keepAliveInitialDelay: 5000, // Initial delay 5s
        reconnectStrategy,
      };

      const clientConfig: RedisClientOptions = {
        socket: useTLS
          ? { ...baseSocket, tls: true as const, rejectUnauthorized: false }
          : baseSocket,
        commandsQueueMaxLength: 1000, // Prevent unbounded memory growth if Redis is slow
        disableOfflineQueue: false, // Queue commands while reconnecting
        ...(redisConfig.password ? { password: redisConfig.password } : {}),
        ...(redisConfig.username ? { username: redisConfig.username } : {}),
      };

      const client = createClient(clientConfig);

      // Event handlers
      client.on('error', (err: Error) => {
        this.logger.error(`Redis error: ${err.message}`);
      });

      client.on('connect', () => {
        this.logger.log('🔗 Redis connected');
      });

      client.on('ready', () => {
        this.logger.log(`✅ Redis ready (TLS: ${useTLS}, Port: ${port})`);
      });

      client.on('reconnecting', () => {
        this.logger.warn('🔄 Redis reconnecting...');
      });

      client.on('end', () => {
        this.logger.warn('🔌 Redis connection ended');
      });

      await client.connect();
      await client.ping();
      this.client = client;

      this.logger.log('✅ Redis connection pool established successfully');
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
    if (this.client && this.client.isOpen) {
      try {
        this.logger.log('👋 Disconnecting from Redis...');
        await this.client.quit();
        this.client = null;
        this.logger.log('✅ Redis disconnected gracefully');
      } catch (error) {
        this.logger.warn('⚠️ Error during Redis disconnect (forcing closure):', error);
        // Force disconnect even if quit fails
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
    return !!this.client?.isOpen;
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
