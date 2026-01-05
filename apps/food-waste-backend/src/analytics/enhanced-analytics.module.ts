import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { EnhancedAnalyticsController } from './enhanced-analytics.controller';
import { EnhancedAnalyticsService } from './enhanced-analytics.service';
import { MerchantDashboardService } from './services/merchant-dashboard.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { PerformanceAnalyticsService } from './services/performance-analytics.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';

// Analytics schemas
import { MerchantAnalytics, MerchantAnalyticsSchema } from './schemas/merchant-analytics.schema';
import { OfferPerformance, OfferPerformanceSchema } from './schemas/offer-performance.schema';
import { RevenueMetrics, RevenueMetricsSchema } from './schemas/revenue-metrics.schema';
import { CustomerInsights, CustomerInsightsSchema } from './schemas/customer-insights.schema';

// Import existing schemas
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AnalyticsProcessor } from './processors/analytics.processor';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: MerchantAnalytics.name, schema: MerchantAnalyticsSchema },
      { name: OfferPerformance.name, schema: OfferPerformanceSchema },
      { name: RevenueMetrics.name, schema: RevenueMetricsSchema },
      { name: CustomerInsights.name, schema: CustomerInsightsSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    BullModule.registerQueueAsync({
      name: 'analytics-processing',
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST') || 'localhost',
          port: parseInt(configService.get('REDIS_PORT')) || 6379,
          password: configService.get('REDIS_PASSWORD'),
          username: configService.get('REDIS_USERNAME'),
          // Explicitly disable TLS for analytics processing queue
          tls: undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 3,
          connectTimeout: 10000,
          commandTimeout: 5000,
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [EnhancedAnalyticsController],
  providers: [
    EnhancedAnalyticsService,
    MerchantDashboardService,
    RevenueAnalyticsService,
    PerformanceAnalyticsService,
    PredictiveAnalyticsService,
    AnalyticsProcessor,
  ],
  exports: [
    EnhancedAnalyticsService,
    MerchantDashboardService,
    RevenueAnalyticsService,
    PerformanceAnalyticsService,
  ],
})
export class EnhancedAnalyticsModule {}