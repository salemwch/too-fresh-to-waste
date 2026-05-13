import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Modules
import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/user.module';

// Schemas
import { DriverProfile, DriverProfileSchema } from '../drivers/schemas/driver-profile.schema';
import {
  AdminAnalyticsController,
  AdminDriversController,
  UserManagementController,
  EstablishmentManagementController,
  SystemConfigController,
  OfferManagementController,
} from './controllers';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { AdminAuditLog, AdminAuditLogSchema } from './schemas/admin-audit-log.schema';
import { SystemConfig, SystemConfigSchema } from './schemas/system-config.schema';
// Services
import {
  AdminAnalyticsService,
  AdminAuditService,
  UserManagementService,
  EstablishmentManagementService,
  SystemConfigService,
  OfferManagementService,
} from './services';
import { TrialExpiryTask } from './tasks/trial-expiry.task';

// Controllers

// Guards

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
      { name: DriverProfile.name, schema: DriverProfileSchema },
    ]),
  ],

  controllers: [
    AdminAnalyticsController,
    AdminDriversController,
    UserManagementController,
    EstablishmentManagementController,
    SystemConfigController,
    OfferManagementController,
  ],

  providers: [
    // Core Services
    AdminAnalyticsService,
    AdminAuditService,
    UserManagementService,
    EstablishmentManagementService,
    SystemConfigService,
    OfferManagementService,

    // Scheduled tasks
    TrialExpiryTask,

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
