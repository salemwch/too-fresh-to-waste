/**
 * Shared Redis Module
 * Provides a singleton Redis connection pool for the entire application
 * Prevents connection exhaustion by reusing connections across services
 */

import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisService } from './redis.service';

/**
 * Global Redis Module
 * - Singleton pattern: ONE connection pool for entire app
 * - Automatic cleanup on module destruction
 * - Shared across all modules without re-importing
 */
@Global()
@Module({
    imports: [ConfigModule],
    providers: [RedisService],
    exports: [RedisService],
})
export class RedisModule implements OnModuleDestroy {
    constructor(private readonly redisService: RedisService) {}

    async onModuleDestroy() {
        try {
            await this.redisService.disconnect();
        } catch (error) {
            // Silently handle disconnect errors during shutdown
            console.error('Redis disconnect error during shutdown:', error);
        }
    }
}
