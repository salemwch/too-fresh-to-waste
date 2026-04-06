import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MongooseModule } from '@nestjs/mongoose';

// Import schemas
import { AppLoggerService } from '../common/services/logger.service';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';

import { AnalyticsController } from './controllers/analytics.controller';
import { DashboardController } from './controllers/dashboard.controller';
import { AlertRule, AlertRuleSchema, Alert, AlertSchema } from './schemas/alert-rule.schema';
import { AnalyticsCache, AnalyticsCacheSchema } from './schemas/analytics-cache.schema';
import { DashboardConfig, DashboardConfigSchema } from './schemas/dashboard-config.schema';
import { AnalyticsService } from './services/analytics.service';
import { DashboardService } from './services/dashboard.service';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    MongooseModule.forFeature([
      // External schemas (for analytics queries)
      { name: User.name, schema: UserSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Payment.name, schema: PaymentSchema },

      // Analytics-specific schemas
      { name: AnalyticsCache.name, schema: AnalyticsCacheSchema },
      { name: DashboardConfig.name, schema: DashboardConfigSchema },
      { name: AlertRule.name, schema: AlertRuleSchema },
      { name: Alert.name, schema: AlertSchema },
    ]),
  ],
  controllers: [AnalyticsController, DashboardController],
  providers: [AnalyticsService, DashboardService, AppLoggerService],
  exports: [AnalyticsService, DashboardService],
})
export class AnalyticsModule {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly logger: AppLoggerService,
  ) {
    // Initialize default dashboard templates on module startup
    void this.initializeDefaultTemplates();
  }

  private async initializeDefaultTemplates(): Promise<void> {
    try {
      await this.dashboardService.createDefaultTemplates();
    } catch (error) {
      this.logger.warn(
        `Failed to initialize default dashboard templates: ${error instanceof Error ? error.message : String(error)}`,
        'AnalyticsModule',
      );
    }
  }
}
