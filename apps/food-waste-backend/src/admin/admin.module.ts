import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Modules
import { CommonModule } from '../common/common.module';
import { Establishment, EstablishmentSchema } from '../establishments/schemas/establishment.schema';
import { DriversModule } from '../drivers/drivers.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Offer, OfferSchema } from '../offers/schemas/offer.schema';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import {
  CommissionLedger,
  CommissionLedgerSchema,
} from '../payments/schemas/commission-ledger.schema';
import { PaymentModule } from '../payments/payments.module';
import { RefundRequest, RefundRequestSchema } from '../payments/schemas/refund-request.schema';
import { Review, ReviewSchema } from '../reviews/schemas/review.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from '../users/user.module';

// Schemas
import { DriverProfile, DriverProfileSchema } from '../drivers/schemas/driver-profile.schema';
import { LoyaltyAccount, LoyaltyAccountSchema } from '../loyalty/schemas/loyalty-account.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { MerchantWallet, MerchantWalletSchema } from '../payments/schemas/merchant-wallet.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import {
  AdminAnalyticsController,
  AdminDriversController,
  UserManagementController,
  EstablishmentManagementController,
  SystemConfigController,
  OfferManagementController,
  OrderManagementController,
  PaymentManagementController,
  NotificationManagementController,
  LeaderboardManagementController,
  TeamManagementController,
  SupportTicketController,
  AnnouncementController,
  GeozoneController,
  CommissionManagementController,
} from './controllers';
import { AdminOnlyGuard } from './guards/admin-only.guard';
import { AdminAuditLog, AdminAuditLogSchema } from './schemas/admin-audit-log.schema';
import { Announcement, AnnouncementSchema } from './schemas/announcement.schema';
import { Geozone, GeozoneSchema } from './schemas/geozone.schema';
import { SupportTicket, SupportTicketSchema } from './schemas/support-ticket.schema';
import { SystemConfig, SystemConfigSchema } from './schemas/system-config.schema';
// Services
import {
  AdminAnalyticsService,
  AdminAuditService,
  UserManagementService,
  DriverManagementService,
  EstablishmentManagementService,
  SystemConfigService,
  OfferManagementService,
  OrderManagementService,
  PaymentManagementService,
  NotificationManagementService,
  LeaderboardManagementService,
  TeamManagementService,
  SupportTicketService,
  AnnouncementService,
  GeozoneService,
  CommissionManagementService,
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
    DriversModule, // Provides DriversService (earnings roll-up reused by the fleet dashboard)
    PaymentModule, // Provides KonnectOrderService, RefundService, CommissionService

    MongooseModule.forFeature([
      // Admin-specific schemas
      { name: AdminAuditLog.name, schema: AdminAuditLogSchema },
      { name: SystemConfig.name, schema: SystemConfigSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: Announcement.name, schema: AnnouncementSchema },
      { name: Geozone.name, schema: GeozoneSchema },

      // Existing schemas that admin services need access to
      { name: User.name, schema: UserSchema },
      { name: Establishment.name, schema: EstablishmentSchema },
      { name: Order.name, schema: OrderSchema },
      { name: RefundRequest.name, schema: RefundRequestSchema },
      { name: Offer.name, schema: OfferSchema },
      { name: Review.name, schema: ReviewSchema },
      { name: DriverProfile.name, schema: DriverProfileSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: MerchantWallet.name, schema: MerchantWalletSchema },
      { name: Notification.name, schema: NotificationSchema },
      { name: LoyaltyAccount.name, schema: LoyaltyAccountSchema },
      { name: CommissionLedger.name, schema: CommissionLedgerSchema },
    ]),
  ],

  controllers: [
    AdminAnalyticsController,
    AdminDriversController,
    UserManagementController,
    EstablishmentManagementController,
    SystemConfigController,
    OfferManagementController,
    OrderManagementController,
    CommissionManagementController,
    PaymentManagementController,
    NotificationManagementController,
    LeaderboardManagementController,
    TeamManagementController,
    SupportTicketController,
    AnnouncementController,
    GeozoneController,
  ],

  providers: [
    // Core Services
    AdminAnalyticsService,
    AdminAuditService,
    UserManagementService,
    DriverManagementService,
    EstablishmentManagementService,
    SystemConfigService,
    OfferManagementService,
    OrderManagementService,
    CommissionManagementService,
    PaymentManagementService,
    NotificationManagementService,
    LeaderboardManagementService,
    TeamManagementService,
    SupportTicketService,
    AnnouncementService,
    GeozoneService,

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
