import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Modules
import { CommonModule } from '../common/common.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/user.module';

// Schemas
import { AdminAuditLog, AdminAuditLogSchema } from './schemas/admin-audit-log.schema';
import { SystemConfig, SystemConfigSchema } from './schemas/system-config.schema';

// Import existing schemas that admin module needs
import { User, UserSchema } from '../users/schemas/user.schema';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Review, ReviewSchema } from '../reviwes/schemas/reviwe.schema';

// Services
import {
  AdminAnalyticsService,
  AdminAuditService,
  UserManagementService,
  EstablishmentManagementService,
  SystemConfigService
} from './services';

// Controllers
import {
  AdminAnalyticsController,
  UserManagementController,
  EstablishmentManagementController,
  SystemConfigController
} from './controllers';

// Guards
import { AdminOnlyGuard } from './guards/admin-only.guard';

@Module({
  imports: [
    // Shared modules
    CommonModule, // Provides EventBusService, LoggerService, etc.
    NotificationsModule, // Provides NotificationService
    UsersModule, // Provides UsersService (for delegated soft-delete in UserManagementService)

    MongooseModule.forFeature([
      // Admin-specific schemas
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },

      // Existing schemas that admin services need access to
      { name: User.name, schema: UserSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Review.name, schema: ReviewSchema },
    ]),
  ],

  controllers: [
    AdminAnalyticsController,
    UserManagementController,
    EstablishmentManagementController,
    SystemConfigController,
  ],

  providers: [
    // Core Services
    AdminAnalyticsService,
    AdminAuditService,
    UserManagementService,
    EstablishmentManagementService,
    SystemConfigService,

    // Guards
    AdminOnlyGuard,
  ],

  exports: [
    // Export services that might be used by other modules
    AdminAuditService,
    SystemConfigService,
    AdminAnalyticsService,
  ],
})
export class AdminModule {}