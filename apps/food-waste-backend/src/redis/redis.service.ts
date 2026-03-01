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
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit {
    private readonly logger = new Logger(RedisService.name);
    private client: RedisClientType | null = null;
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
    async getClient(): Promise<RedisClientType> {
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
        const maxRetries = parseInt(
            this.configService.get<string>('REDIS_MAX_RETRIES', '10'),
        );

        try {
            const clientConfig: any = {
                socket: {
                    host: redisConfig.host,
                    port,
                    connectTimeout,
                    keepAlive: 5000,       // TCP keep-alive every 5s to detect dead connections
                    reconnectStrategy: (retries: number) => {
                        if (retries > maxRetries) {
                            this.logger.error('Max Redis reconnection attempts reached');
                            return new Error('Max reconnection attempts reached');
                        }
                        const delay = Math.min(retries * 100, 3000);
                        this.logger.log(`Reconnecting to Redis... (attempt ${retries}, delay: ${delay}ms)`);
                        return delay;
                    },
                },
                commandsQueueMaxLength: 1000,  // Prevent unbounded memory growth if Redis is slow
                disableOfflineQueue: false,     // Queue commands while reconnecting
            };

            // Add TLS configuration if enabled
            if (useTLS) {
                clientConfig.socket.tls = true;
                clientConfig.socket.rejectUnauthorized = false; // For self-signed certs
            }

            // Add authentication
            if (redisConfig.password) {
                clientConfig.password = redisConfig.password;
            }
            if (redisConfig.username) {
                clientConfig.username = redisConfig.username;
            }

            this.client = createClient(clientConfig);

            // Event handlers
            this.client.on('error', (err) => {
                this.logger.error(`Redis error: ${err.message}`);
            });

            this.client.on('connect', () => {
                this.logger.log('🔗 Redis connected');
            });

            this.client.on('ready', () => {
                this.logger.log(`✅ Redis ready (TLS: ${useTLS}, Port: ${port})`);
            });

            this.client.on('reconnecting', () => {
                this.logger.warn('🔄 Redis reconnecting...');
            });

            this.client.on('end', () => {
                this.logger.warn('🔌 Redis connection ended');
            });

            await this.client.connect();
            await this.client.ping();

            this.logger.log('✅ Redis connection pool established successfully');
        } catch (error) {
            this.logger.error(`Failed to connect to Redis: ${error.message}`);
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
                    await this.client.disconnect();
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
