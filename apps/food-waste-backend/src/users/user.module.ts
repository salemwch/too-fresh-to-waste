import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/user.schema';
import { UsersController } from './user.controller';
import { PrivacyController } from './controllers/privacy.controller';
import { UsersService } from './user.service';
import { USERS_SERVICE_TOKEN } from './interfaces';
import { PrivacyComplianceService } from './services/privacy-compliance.service';
import { MfaService } from './services/mfa.service';
import { SessionManagementService } from './services/session-management.service';
import { PasswordValidationService } from './services/password-validation.service';
import { PasswordHistoryService } from '../auth/services/password-history.service';
import { UserPreferencesService } from './services/user-preferences.service';
import { OrdersModule } from 'src/orders/order.module';
import { FavoritesModule } from 'src/favorites/favorites.module';
import { ReviewsModule } from 'src/reviwes/reviwes.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { CommonModule } from 'src/common/common.module';

@Module({
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        OrdersModule,
        FavoritesModule,
        forwardRef(() => ReviewsModule),
        NotificationsModule,
        CommonModule,
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
        SessionManagementService,
        PasswordValidationService,
        PasswordHistoryService,
        UserPreferencesService
    ],
    exports: [
        MongooseModule, // Export User model for use in other modules (e.g., TenantContextMiddleware)
        USERS_SERVICE_TOKEN, // Export interface token for interface-based consumption
        UsersService, // Export concrete class for backward compatibility
        PrivacyComplianceService,
        MfaService,
        SessionManagementService,
        PasswordValidationService,
        UserPreferencesService
    ],
})
export class UsersModule { }