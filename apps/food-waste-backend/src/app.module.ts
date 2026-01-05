// src/app.module.ts
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AuthModule } from './auth/auth.module';
import { EmailModule } from './email/email.module';
import { UsersModule } from './users/user.module';
import { EstablishmentsModule } from './establishments/establishments.module';
import { OffersModule } from './offers/offers.module';
import { OrdersModule } from './orders/order.module';
import { PaymentModule } from './payments/payments.module';
import { ReviewsModule } from './reviwes/reviwes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ModerationModule } from './moderation/moderation.module';
import { AdminModule } from './admin/admin.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { InventoryModule } from './inventory/inventory.module';
import { FavoritesModule } from './favorites/favorites.module';
import { DonationsModule } from './donations/donations.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';

// New enhanced modules
import { WebSocketModule } from './websocket/websocket.module';
import { SearchModule } from './search/search.module';
//import { SocialModule } from './social/social.module';
import { EnhancedAnalyticsModule } from './analytics/enhanced-analytics.module';

// Global middleware
import { GlobalSanitizationMiddleware } from './common/middleware/global-sanitization.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        CommonModule, // Common utilities including sanitization (MUST be early)
        RedisModule, // Shared Redis connection pool (MUST be first after Config)
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        EventEmitterModule.forRoot(),
        ScheduleModule.forRoot(), // Required for @Cron decorators in DonationsService
        BullModule.forRootAsync({
            useFactory: (configService: ConfigService) => ({
                redis: {
                    host: configService.get('REDIS_HOST') || 'localhost',
                    port: parseInt(configService.get('REDIS_PORT')) || 6379,
                    password: configService.get('REDIS_PASSWORD'),
                    username: configService.get('REDIS_USERNAME'),
                    // Explicitly disable TLS for development/internal networks
                    tls: undefined,
                    // Additional Redis options for better connectivity
                    lazyConnect: true,
                    maxRetriesPerRequest: 3,
                    retryDelayOnFailover: 100,
                    connectTimeout: 10000,
                    commandTimeout: 5000,
                },
            }),
            inject: [ConfigService],
        }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                uri: configService.get<string>('DATABASE_URL') || 'mongodb://localhost:27017/foodwaste',
                // Enterprise-grade connection pooling configuration
                // Ref: https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connection-options/
                maxPoolSize: parseInt(configService.get('MONGO_MAX_POOL_SIZE')) || 100, // Max connections (default: 100)
                minPoolSize: parseInt(configService.get('MONGO_MIN_POOL_SIZE')) || 10,  // Min connections (default: 10)
                maxIdleTimeMS: parseInt(configService.get('MONGO_MAX_IDLE_TIME_MS')) || 60000, // 60s - close idle connections
                waitQueueTimeoutMS: parseInt(configService.get('MONGO_WAIT_QUEUE_TIMEOUT_MS')) || 10000, // 10s - wait for available connection
                socketTimeoutMS: parseInt(configService.get('MONGO_SOCKET_TIMEOUT_MS')) || 45000, // 45s - socket timeout
                connectTimeoutMS: parseInt(configService.get('MONGO_CONNECT_TIMEOUT_MS')) || 30000, // 30s - initial connection timeout
                serverSelectionTimeoutMS: parseInt(configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS')) || 30000, // 30s - server selection
                heartbeatFrequencyMS: parseInt(configService.get('MONGO_HEARTBEAT_FREQUENCY_MS')) || 10000, // 10s - health check interval
                // Performance optimizations
                retryWrites: true, // Automatic retry for write operations
                retryReads: true,  // Automatic retry for read operations
                compressors: ['snappy', 'zlib'], // Network compression for large payloads
                // Read/Write concerns for production
                readConcern: { level: 'majority' }, // Read committed data
                writeConcern: {
                    w: configService.get('NODE_ENV') === 'production' ? 'majority' : 1,
                    j: configService.get('NODE_ENV') === 'production', // Journal sync in production
                },
                // Monitoring
                monitorCommands: configService.get('NODE_ENV') === 'development',
            }),
            inject: [ConfigService],
        }),
        EmailModule,
        AuthModule,
        UsersModule,
        EstablishmentsModule,
        OffersModule,
        OrdersModule,
        PaymentModule,
        ReviewsModule,
        NotificationsModule,
        GeolocationModule,
        AnalyticsModule,
        ModerationModule,
        AdminModule,
        LoyaltyModule,
        InventoryModule,
        FavoritesModule,
        DonationsModule, // Community donation tracking and impact

        // Enhanced modules for production-ready features
        WebSocketModule,
        SearchModule,
        //SocialModule,
        EnhancedAnalyticsModule,

        // Monitoring and health checks
        HealthModule, // Health check endpoints (liveness/readiness probes)
    ],
    controllers: [],
    providers: [],
})
export class AppModule implements NestModule {
    /**
     * Configure global middleware
     * Order matters: Correlation ID → Sanitization → ValidationPipe (in main.ts)
     *
     * @rationale
     * 1. CorrelationIdMiddleware: Generates unique request IDs for tracing
     * 2. GlobalSanitizationMiddleware: Sanitizes input before validation
     * 3. ValidationPipe (main.ts): Validates sanitized data
     */
    configure(consumer: MiddlewareConsumer) {
        consumer
            .apply(CorrelationIdMiddleware, GlobalSanitizationMiddleware)
            .forRoutes('*'); // Apply to all routes
    }
}