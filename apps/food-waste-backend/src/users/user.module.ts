import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './user.controller';
import { PrivacyController } from './controllers/privacy.controller';
import { UsersService } from './user.service';
import { USERS_SERVICE_TOKEN } from './interfaces';
import { PrivacyComplianceService } from './services/privacy-compliance.service';
import { MfaService } from './services/mfa.service';
// PasswordPolicyService is imported from AuthModule (no need to import here - DRY principle)
import { PasswordHistoryService } from '../auth/services/password-history.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { Order, OrderSchema } from '../orders/schemas/order.schema';
import { Favorite, FavoriteSchema } from '../favorites/schemas/favorite.schema';
import { Review, ReviewSchema } from '../reviwes/schemas/reviwe.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';
import { ReviewsModule } from 'src/reviwes/reviwes.module';
import { CommonModule } from 'src/common/common.module';
import { AuthModule } from 'src/auth/auth.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Order.name, schema: OrderSchema }, // For GDPR data export
            { name: Favorite.name, schema: FavoriteSchema }, // For GDPR data export
            { name: Review.name, schema: ReviewSchema }, // For GDPR data export
            { name: Notification.name, schema: NotificationSchema }, // For GDPR data export
        ]),
        forwardRef(() => ReviewsModule),
        CommonModule,
        forwardRef(() => AuthModule),
        NotificationsModule, // Provides SmsNotificationService
    ],
    controllers: [
        UsersController,
        PrivacyController
    ],
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
        // PasswordPolicyService provided by AuthModule (imported above)
        PasswordHistoryService,
        UserPreferencesService
    ],
    exports: [
        MongooseModule, // Export User model for use in other modules (e.g., TenantContextMiddleware)
        USERS_SERVICE_TOKEN, // Export interface token for interface-based consumption
        UsersService, // Export concrete class for backward compatibility
        PrivacyComplianceService,
        MfaService,
        // PasswordPolicyService exported by AuthModule
        UserPreferencesService
    ],
})
export class UsersModule { }