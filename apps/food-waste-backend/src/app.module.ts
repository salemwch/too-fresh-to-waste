// src/app.module.ts
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { BullModule } from '@nestjs/bull';
import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import * as mongoose from 'mongoose';

import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ArchiveModule } from './archive/archive.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { AppVersionMiddleware } from './common/middleware/app-version.middleware';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { GlobalSanitizationMiddleware } from './common/middleware/global-sanitization.middleware';
import { CommunityGoalModule } from './community-goal/community-goal.module';
import { envValidationSchema } from './config/env.validation';
import { DonationsModule } from './donations/donations.module';
import { EmailModule } from './email/email.module';
import { EstablishmentsModule } from './establishments/establishments.module';
import { FavoritesModule } from './favorites/favorites.module';
import { GeolocationModule } from './geolocation/geolocation.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OffersModule } from './offers/offers.module';
import { OrdersModule } from './orders/order.module';
import { PaymentModule } from './payments/payments.module';
import { RabbitMQModule } from './rabbitmq/rabbitmq.module';
import { RedisModule } from './redis/redis.module';
import { ReviewsModule } from './reviwes/reviwes.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/user.module';
import { WebSocketModule } from './websocket/websocket.module';
//import { SocialModule } from './social/social.module';

// Global middleware

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false, // Report ALL missing vars, not just the first
      },
    }),
    CommonModule, // Common utilities including sanitization (MUST be early)
    RedisModule, // Shared Redis connection pool (MUST be first after Config)
    RabbitMQModule.forRoot(), // Message broker for event-driven architecture
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: Number.parseInt(configService.get('THROTTLE_TTL', '60000')),
            limit: Number.parseInt(configService.get('THROTTLE_LIMIT', '100')),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          `redis://${configService.get('REDIS_USERNAME', 'default')}:${configService.get('REDIS_PASSWORD', '')}@${configService.get('REDIS_HOST', 'localhost')}:${configService.get('REDIS_PORT', '6379')}`,
        ),
      }),
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(), // Required for @Cron decorators in DonationsService
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') ?? 'localhost',
          port: Number.parseInt(configService.get('REDIS_PORT', '6379'), 10) || 6379,
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
        uri: configService.get<string>('DATABASE_URL') ?? 'mongodb://localhost:27017/foodwaste',
        // Enterprise-grade connection pooling configuration
        // Ref: https://www.mongodb.com/docs/drivers/node/current/fundamentals/connection/connection-options/
        maxPoolSize: Number.parseInt(configService.get('MONGO_MAX_POOL_SIZE', '100'), 10) || 100, // Max connections (default: 100)
        minPoolSize: Number.parseInt(configService.get('MONGO_MIN_POOL_SIZE', '10'), 10) || 10, // Min connections (default: 10)
        maxIdleTimeMS:
          Number.parseInt(configService.get('MONGO_MAX_IDLE_TIME_MS', '60000'), 10) || 60000, // 60s - close idle connections
        waitQueueTimeoutMS:
          Number.parseInt(configService.get('MONGO_WAIT_QUEUE_TIMEOUT_MS', '10000'), 10) || 10000, // 10s - wait for available connection
        socketTimeoutMS:
          Number.parseInt(configService.get('MONGO_SOCKET_TIMEOUT_MS', '45000'), 10) || 45000, // 45s - socket timeout
        connectTimeoutMS:
          Number.parseInt(configService.get('MONGO_CONNECT_TIMEOUT_MS', '30000'), 10) || 30000, // 30s - initial connection timeout
        serverSelectionTimeoutMS:
          Number.parseInt(configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '30000'), 10) ||
          30000, // 30s - server selection
        heartbeatFrequencyMS:
          Number.parseInt(configService.get('MONGO_HEARTBEAT_FREQUENCY_MS', '10000'), 10) || 10000, // 10s - health check interval
        // Performance optimizations
        retryWrites: true, // Automatic retry for write operations
        retryReads: true, // Automatic retry for read operations
        compressors: ['zstd', 'snappy', 'zlib'], // Network compression: zstd (30-50% better than snappy), with fallbacks
        // Read/Write concerns for production
        readConcern: { level: 'majority' }, // Read committed data
        writeConcern: {
          w: configService.get('NODE_ENV') === 'production' ? 'majority' : 1,
          j: configService.get('NODE_ENV') === 'production', // Journal sync in production
        },
        // Production safety: fail fast on DB disconnect instead of buffering requests in memory
        // Ref: https://mongoosejs.com/docs/guide.html#bufferCommands
        bufferCommands: false,
        // Production safety: disable auto-index creation at startup to avoid collection locks under load
        // Run `pnpm verify:indexes` manually after deploying schema changes
        // Ref: https://mongoosejs.com/docs/guide.html#autoIndex
        autoIndex: configService.get('NODE_ENV') !== 'production',
        // Monitoring
        monitorCommands: configService.get('NODE_ENV') === 'development',
        // Disable __v versionKey globally — no code uses optimistic concurrency via __v
        // Existing documents keep their __v (harmless, ignored on read)
        connectionFactory: (connection: mongoose.Connection) => {
          connection.set('versionKey', false);
          return connection;
        },
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
    DonationsModule,
    CommunityGoalModule,

    WebSocketModule,
    SearchModule,
    //SocialModule,

    ArchiveModule,

    HealthModule,
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
      .apply(CorrelationIdMiddleware, GlobalSanitizationMiddleware, AppVersionMiddleware)
      .forRoutes('*');
  }
}
