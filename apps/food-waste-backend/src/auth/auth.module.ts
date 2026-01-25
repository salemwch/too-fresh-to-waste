import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AuthRedirectController } from './auth-redirect.controller';
import { AuthSecurityService } from './services/auth-security.service';
import { CsrfService } from './services/csrf.service';
import { SessionManagementService } from './services/session-management.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { PasswordHistoryService } from './services/password-history.service';
import { MfaService } from './services/mfa.service';
import { TokenService } from './services/token.service';
import { AuthorizationService } from './services/authorization.service';
import { CaptchaService } from './services/captcha.service';
import { AdminNotificationService } from './services/admin-notification.service';
import { PASSWORD_POLICY_SERVICE_TOKEN, TOKEN_SERVICE_TOKEN } from './interfaces';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RolesGuard } from './guards/roles.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { ResourceOwnershipGuard } from './guards/resource-ownership.guard';
import { TenantIsolationGuard } from './guards/tenant-isolation.guard';
import { UsersModule } from 'src/users/user.module';
import { JwtStrategy } from './strategies/jwt.strategie';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategie';
import { EmailModule } from 'src/email/email.module';
import { CommonModule } from 'src/common/common.module';
import { RefreshToken, RefreshTokenSchema } from './schemas/refresh-token.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { RolePermission, RolePermissionSchema } from './schemas/role-permission.schema';
import { UserPermission, UserPermissionSchema } from './schemas/user-permission.schema';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { PermissionsSeedService } from './seeds/permissions.seed';
import { AdminUserEventsListener } from './listeners/admin-user-events.listener';

@Module({
    imports: [
        UsersModule,
        PassportModule,
        EmailModule,
        CommonModule,
        HttpModule, // PRODUCTION-READY IMPROVEMENT: For CAPTCHA verification
        MongooseModule.forFeature([
            { name: RefreshToken.name, schema: RefreshTokenSchema },
            { name: Permission.name, schema: PermissionSchema },
            { name: RolePermission.name, schema: RolePermissionSchema },
            { name: UserPermission.name, schema: UserPermissionSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => {
                const expiresIn = configService.get<string>('JWT_EXPIRES_IN') || '15m';
                return {
                    secret: configService.get<string>('JWT_SECRET'),
                    signOptions: {
                        expiresIn: expiresIn as StringValue | number,
                    },
                };
            },
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController, AdminAuthController, AuthRedirectController],
    providers: [
        // Core Services
        AuthService,
        AuthSecurityService,
        AuthorizationService,
        CsrfService,
        SessionManagementService,

        // Enterprise pattern: Interface-based dependency injection
        {
            provide: PASSWORD_POLICY_SERVICE_TOKEN,
            useClass: PasswordPolicyService,
        },
        PasswordPolicyService, // Keep for backward compatibility

        {
            provide: TOKEN_SERVICE_TOKEN,
            useClass: TokenService,
        },
        TokenService, // Keep for backward compatibility

        PasswordHistoryService,
        MfaService,

        // PRODUCTION-READY IMPROVEMENT: Security Enhancement Services
        CaptchaService,
        AdminNotificationService,

        // Strategies
        JwtStrategy,
        JwtRefreshStrategy,

        // Guards
        JwtAuthGuard,
        JwtRefreshGuard,
        RolesGuard,
        PermissionsGuard,
        ResourceOwnershipGuard,
        TenantIsolationGuard,

        // Middleware
        TenantContextMiddleware,

        // Seed Service
        PermissionsSeedService,

        // Event Listeners
        AdminUserEventsListener,
    ],
    exports: [
        AuthService,
        PASSWORD_POLICY_SERVICE_TOKEN, // Export interface token
        PasswordPolicyService, // Export concrete class for backward compatibility
        TOKEN_SERVICE_TOKEN, // Export interface token
        TokenService, // Export concrete class for backward compatibility
        AuthorizationService,
        AuthSecurityService, // PRODUCTION-READY IMPROVEMENT: Export for use in other modules
        CaptchaService, // PRODUCTION-READY IMPROVEMENT: Export for use in other modules
        AdminNotificationService, // PRODUCTION-READY IMPROVEMENT: Export for use in other modules
        SessionManagementService, // Export for use in users module
        JwtAuthGuard,
        RolesGuard,
        PermissionsGuard,
        ResourceOwnershipGuard,
        TenantIsolationGuard,
    ],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        // Apply tenant context middleware to all routes
        // Automatically injects tenant context for merchants
        consumer.apply(TenantContextMiddleware).forRoutes('*');
    }
}