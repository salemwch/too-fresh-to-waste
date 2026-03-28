/**
 * Example: How to update AuthService to use interface-based injection
 *
 * This file demonstrates the migration pattern from concrete types to interfaces.
 * Follow this pattern for all service dependencies.
 */

import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

// Import interfaces instead of concrete classes
import { PhoneNumberService } from '../common/services/phone-number.service';
import { IEmailService, EMAIL_SERVICE_TOKEN } from '../email/interfaces';
import { IUsersService, USERS_SERVICE_TOKEN } from '../users/interfaces';

import { RegisterDto } from './DTO/register.dto';
import {
  IPasswordPolicyService,
  PASSWORD_POLICY_SERVICE_TOKEN,
} from './interfaces/password-policy-service.interface';
import { ITokenService, TOKEN_SERVICE_TOKEN } from './interfaces/token-service.interface';

// Import concrete types only for specific NestJS classes or when required

import { AuthSecurityService } from './services/auth-security.service';
import { CaptchaService } from './services/captcha.service';

/**
 * BEFORE (using concrete types - AVOID):
 *
 * constructor(
 *   private readonly usersService: UsersService,  // ❌ Concrete dependency
 *   private readonly emailService: EmailService,  // ❌ Concrete dependency
 *   ...
 * ) {}
 *
 * Issues:
 * - Tight coupling to concrete implementations
 * - Difficult to test (requires full service initialization)
 * - Violates Dependency Inversion Principle
 * - Cannot swap implementations without code changes
 */

/**
 * AFTER (using interfaces - RECOMMENDED):
 *
 * Enterprise-grade AuthService with interface-based dependencies
 *
 * Benefits:
 * - Loose coupling (depends on abstractions, not concretions)
 * - Easy to test (mock interfaces instead of concrete services)
 * - Follows SOLID principles (Dependency Inversion)
 * - Swappable implementations (e.g., different email providers)
 * - Better maintainability
 */
@Injectable()
export class AuthServiceRefactored {
  constructor(
    // ✅ Inject interfaces using tokens
    @Inject(USERS_SERVICE_TOKEN)
    private readonly usersService: IUsersService,

    @Inject(EMAIL_SERVICE_TOKEN)
    private readonly emailService: IEmailService,

    @Inject(PASSWORD_POLICY_SERVICE_TOKEN)
    private readonly passwordPolicyService: IPasswordPolicyService,

    @Inject(TOKEN_SERVICE_TOKEN)
    private readonly tokenService: ITokenService,

    // NestJS-specific services (JwtService, ConfigService) remain concrete
    // These are framework dependencies, not business logic
    private readonly _jwtService: JwtService,
    private readonly _configService: ConfigService,

    // Services without interfaces yet (migration in progress)
    private readonly _phoneNumberService: PhoneNumberService,
    private readonly _authSecurityService: AuthSecurityService,
    private readonly _captchaService: CaptchaService,
  ) {
    void this._jwtService;
    void this._configService;
    void this._phoneNumberService;
    void this._authSecurityService;
    void this._captchaService;
  }

  /**
   * Example method using interface-based dependencies
   * The implementation doesn't know or care about concrete classes
   */
  async register(registerDto: RegisterDto): Promise<{
    success: boolean;
    user: Awaited<ReturnType<IUsersService['create']>>;
    tokens: { accessToken: string; refreshToken: string };
  }> {
    // Validate password using interface
    const passwordValidation = this.passwordPolicyService.validatePassword(registerDto.password, {
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    if (!passwordValidation.isValid) {
      throw new Error('Password validation failed');
    }

    // Create user using interface
    const user = await this.usersService.create(registerDto);

    // Send email using interface
    await this.emailService.sendVerificationEmail(user, 'token-here');

    // Generate tokens using interface
    const { accessToken, refreshToken } = await this.tokenService.generateTokens(
      user._id.toString(),
      user.email,
      user.role,
    );

    return {
      success: true,
      user,
      tokens: { accessToken, refreshToken },
    };
  }
}

/**
 * TESTING BENEFITS:
 *
 * With interface-based injection, testing becomes trivial:
 */

/**
 * MIGRATION STRATEGY:
 *
 * 1. Create interface for service (IXxxService)
 * 2. Update service to implement interface
 * 3. Add injection token to module providers
 * 4. Update consumers to inject interface via token
 * 5. Keep concrete class injection for backward compatibility during transition
 * 6. Once all consumers migrated, remove concrete class from exports
 *
 * This allows gradual migration without breaking existing code.
 */
