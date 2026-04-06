import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from 'src/common/common.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

import { PasswordHistoryService } from '../auth/services/password-history.service';
import { PasswordPolicyService } from '../auth/services/password-policy.service';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';

import { PrivacyController } from './controllers/privacy.controller';
import { USERS_SERVICE_TOKEN } from './interfaces';
import { User, UserSchema } from './schemas/user.schema';
import { MfaService } from './services/mfa.service';
import { PrivacyComplianceService } from './services/privacy-compliance.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { UsersController } from './user.controller';
import { UsersService } from './user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema }, // For GDPR data export
    ]),
    CommonModule,
    NotificationsModule, // Provides SmsNotificationService
  ],
  controllers: [UsersController, PrivacyController],
  providers: [
    // Enterprise pattern: Interface-based dependency injection
    // Provides concrete implementation while allowing interface-based consumption
    {
      provide: USERS_SERVICE_TOKEN,
      useClass: UsersService,
    },
    // Keep concrete class for backward compatibility during migration
    UsersService,
    PrivacyComplianceService,
    MfaService,
    PasswordPolicyService,
    PasswordHistoryService,
    UserPreferencesService,
  ],
  exports: [
    MongooseModule, // Export User model for use in other modules (e.g., TenantContextMiddleware)
    USERS_SERVICE_TOKEN, // Export interface token for interface-based consumption
    UsersService, // Export concrete class for backward compatibility
    PrivacyComplianceService,
    MfaService,
    PasswordPolicyService,
    UserPreferencesService,
  ],
})
export class UsersModule {}
