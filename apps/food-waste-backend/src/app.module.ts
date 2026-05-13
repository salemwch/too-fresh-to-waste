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
import { DriversModule } from './drivers/drivers.module';
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
import {
  buildBullRedisOptions,
  buildRedisUrl,
  buildThrottlerRedisOptions,
  getRedisConnectionConfig,
} from './redis/redis.config';
import { RedisModule } from './redis/redis.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchModule } from './search/search.module';
import { SustainabilityModule } from './sustainability/sustainability.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { UsersModule } from './users/user.module';
import { WebSocketModule } from './websocket/websocket.module';
//import { SocialModule } from './social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: envValidationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    CommonModule,
    RedisModule,
    RabbitMQModule.forRoot(),
    ThrottlerModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const redisConfig = getRedisConnectionConfig(configService);

        return {
          throttlers: [
            {
              ttl: Number.parseInt(configService.get('THROTTLE_TTL', '60000')),
              limit: Number.parseInt(configService.get('THROTTLE_LIMIT', '100')),
            },
          ],
          storage: new ThrottlerStorageRedisService(
            buildRedisUrl(redisConfig),
            buildThrottlerRedisOptions(redisConfig),
          ),
        };
      },
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: buildBullRedisOptions(getRedisConnectionConfig(configService)),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DATABASE_URL') ?? 'mongodb://localhost:27017/foodwaste',
        maxPoolSize: Number.parseInt(configService.get('MONGO_MAX_POOL_SIZE', '100'), 10) || 100,
        minPoolSize: Number.parseInt(configService.get('MONGO_MIN_POOL_SIZE', '10'), 10) || 10,
        maxIdleTimeMS:
          Number.parseInt(configService.get('MONGO_MAX_IDLE_TIME_MS', '60000'), 10) || 60000,
        waitQueueTimeoutMS:
          Number.parseInt(configService.get('MONGO_WAIT_QUEUE_TIMEOUT_MS', '10000'), 10) || 10000,
        socketTimeoutMS:
          Number.parseInt(configService.get('MONGO_SOCKET_TIMEOUT_MS', '45000'), 10) || 45000,
        connectTimeoutMS:
          Number.parseInt(configService.get('MONGO_CONNECT_TIMEOUT_MS', '30000'), 10) || 30000,
        serverSelectionTimeoutMS:
          Number.parseInt(configService.get('MONGO_SERVER_SELECTION_TIMEOUT_MS', '30000'), 10) ||
          30000,
        heartbeatFrequencyMS:
          Number.parseInt(configService.get('MONGO_HEARTBEAT_FREQUENCY_MS', '10000'), 10) || 10000,
        retryWrites: true,
        retryReads: true,
        compressors: ['zstd', 'snappy', 'zlib'],
        readConcern: { level: 'majority' },
        writeConcern: {
          w: configService.get('NODE_ENV') === 'production' ? 'majority' : 1,
          j: configService.get('NODE_ENV') === 'production',
        },
        bufferCommands: false,
        autoIndex: configService.get('NODE_ENV') !== 'production',
        monitorCommands: configService.get('NODE_ENV') === 'development',
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
    DriversModule,
    CommunityGoalModule,
    SustainabilityModule,
    LeaderboardModule,
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
   * Order matters: CorrelationIdMiddleware -> Sanitization -> ValidationPipe (in main.ts)
   */
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, GlobalSanitizationMiddleware, AppVersionMiddleware)
      .forRoutes('*');
  }
}
