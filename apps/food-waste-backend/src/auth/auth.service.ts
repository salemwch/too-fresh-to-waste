import { UserRole, UserStatus } from '@foodwaste/shared';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as argon2 from 'argon2';

import { ForgotPasswordDto } from 'src/auth/DTO/forget-password.dto';
import { LoginDto } from 'src/auth/DTO/login.dto';
import { RegisterDto } from 'src/auth/DTO/register.dto';
import { ResetPasswordDto } from 'src/auth/DTO/reset-password.dto';
import { VerifyEmailDto } from 'src/auth/DTO/verify-email.dto';
import { EventBusService } from 'src/common/services/event-bus/event-bus.service';
import { PhoneNumberService } from 'src/common/services/phone-number.service';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { EmailService } from 'src/email/email.service';
import { UsersService } from 'src/users/user.service';

import { UserRegisteredEvent } from '../common/events';

import { mapToSafeUserResponse, SafeUserResponse } from './DTO/safe-user-response.dto';
import { AuthSecurityService } from './services/auth-security.service';
import { CaptchaService } from './services/captcha.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { TokenService, DeviceInfo } from './services/token.service';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until access token expires
  tokenType: 'Bearer';
}

export interface UserResponse {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  profileImage?: string | null | undefined; // ✅ FIX: Matches database field name
  phoneNumber?: string | undefined; // ✅ FIX: Added phoneNumber
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date | undefined;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  user: SafeUserResponse;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user?: UserResponse;
  tokens?: AuthTokens;
  sessionId?: string;
  deviceInfo?: {
    deviceName: string;
    platform: string;
    browser: string;
  };
  captchaRequired?: boolean; // PRODUCTION-READY IMPROVEMENT
  remainingAttempts?: number; // PRODUCTION-READY IMPROVEMENT
}

interface RefreshTokenPayload {
  sub?: string;
  jti?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly phoneNumberService: PhoneNumberService,
    private readonly tokenService: TokenService,
    private readonly authSecurityService: AuthSecurityService,
    private readonly captchaService: CaptchaService,
    private readonly eventBus: EventBusService,
  ) {
    void this.captchaService;
    void this._generateTokens;
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    // Check if email already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Normalize and validate phone number if provided
    let normalizedPhone: string | undefined;
    if (registerDto.phoneNumber) {
      const phoneValidation = this.phoneNumberService.validatePhoneNumber(
        registerDto.phoneNumber,
        'TN', // Tunisia as default country
      );

      if (!phoneValidation.isValid) {
        throw new BadRequestException(phoneValidation.error ?? 'Invalid phone number format');
      }

      // Store in E.164 format for consistency
      normalizedPhone = phoneValidation.details?.formatted.e164;

      this.logger.log(
        `Phone number normalized during registration: ${registerDto.phoneNumber} -> ${normalizedPhone}`,
      );
    }

    // Validate password against security policy
    this.passwordPolicyService.validatePasswordStrength(registerDto.password, {
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
    });

    const emailVerificationToken = CryptoUtil.generateRandomToken(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    let role: UserRole = UserRole.CONSUMER;

    if (
      registerDto.role !== null &&
      registerDto.role !== undefined &&
      registerDto.role !== UserRole.ADMIN
    ) {
      role = registerDto.role;
    }

    // Create user with normalized phone number
    const user = await this.usersService.create({
      ...registerDto,
      ...(normalizedPhone !== undefined ? { phoneNumber: normalizedPhone } : {}), // Use normalized E.164 format
      role,
      emailVerificationToken,
      emailVerificationExpires,
    });

    try {
      await this.emailService.sendVerificationEmail(user, emailVerificationToken);
    } catch (error) {
      this.logger.warn('Failed to send verification email during registration', {
        email: user.email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Emit user registered event for cross-module reactions (loyalty, notifications, analytics)
    try {
      await this.eventBus.emit(
        'user.registered',
        new UserRegisteredEvent(
          user._id.toString(),
          user.email,
          role,
          new Date(),
          registerDto.businessInfo,
          normalizedPhone,
          registerDto.referralCode,
        ),
      );
      this.logger.log(`User registered event emitted for user: ${user._id}`);
    } catch (eventError) {
      // Log error but don't fail registration
      this.logger.error(
        `Failed to emit user registered event: ${(eventError as Error).message}`,
        (eventError as Error).stack,
      );
    }

    // SECURITY: Use safe mapper to exclude sensitive fields (passwordHistory, loginHistory, etc.)
    const safeUser = mapToSafeUserResponse(user.toObject());

    return {
      success: true,
      message:
        'Registration successful. Please check your email to verify your account before logging in.',
      user: safeUser,
    };
  }

  async verifyEmail(
    verifyEmailDto: VerifyEmailDto,
    requestInfo?: { ipAddress?: string; userAgent?: string; location?: string },
  ): Promise<LoginResponse> {
    const result = await this.verifyEmailByToken(
      verifyEmailDto.token,
      requestInfo,
      verifyEmailDto.email,
    );
    return result;
  }

  async verifyEmailByToken(
    token: string,
    requestInfo?: { ipAddress?: string; userAgent?: string; location?: string },
    expectedEmail?: string,
  ): Promise<LoginResponse> {
    const user = await this.usersService.findByEmailVerificationToken(token, expectedEmail);

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    // Mark email as verified
    await this.usersService.verifyEmail(user._id.toString());
    this.logger.log('Email verification successful', { userId: user._id });

    // AUTO-LOGIN: Generate tokens so user goes directly to home
    // This is the same pattern used in login() for seamless UX
    const deviceInfo: DeviceInfo = {
      ipAddress: requestInfo?.ipAddress ?? 'unknown',
      userAgent: requestInfo?.userAgent ?? 'unknown',
      platform: this.extractPlatform(requestInfo?.userAgent),
      browser: this.extractBrowser(requestInfo?.userAgent),
    };

    const tokenPair = await this.tokenService.generateTokenPair(
      user._id.toString(),
      user.email,
      user.role,
      deviceInfo,
      undefined,
      undefined,
      user.tokenRevocationVersion || 0,
    );

    // Update last login timestamp
    await this.usersService.updateLastLogin(
      user._id.toString(),
      requestInfo?.ipAddress ?? 'unknown',
      requestInfo?.userAgent ?? 'unknown',
      requestInfo?.location,
    );

    this.logger.log('Email verification with auto-login successful', { userId: user._id });

    // ✅ SECURITY: Use DTO - only send what frontend needs
    return {
      success: true,
      message: 'Email verified successfully',
      user: {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isEmailVerified: true,
        isPhoneVerified: user.isPhoneVerified,
        profileImage: user.profileImage,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
      },
      tokens: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: this.getAccessTokenExpiresInSeconds(),
        tokenType: 'Bearer' as const,
      },
    };
  }

  async login(
    loginDto: LoginDto,
    requestInfo?: { ipAddress?: string; userAgent?: string; location?: string },
  ): Promise<LoginResponse> {
    const ipAddress = requestInfo?.ipAddress ?? 'unknown';
    const userAgent = requestInfo?.userAgent ?? 'unknown';

    // 1. Explicit IP block list (set by previous suspicious-activity detection)
    const ipBlocked = await this.authSecurityService.isIpBlocked(ipAddress);
    if (ipBlocked) {
      this.logger.warn('Login attempt from blocked IP', { ip: ipAddress, email: loginDto.email });
      throw new ForbiddenException('Access temporarily blocked due to suspicious activity');
    }

    // 2. Bot / suspicious user-agent detection
    const isSuspicious = await this.authSecurityService.detectSuspiciousActivity(
      ipAddress,
      userAgent,
    );
    if (isSuspicious) {
      await this.authSecurityService.blockIp(ipAddress, 300000); // 5 min
      throw new ForbiddenException('Suspicious activity detected. Access temporarily blocked');
    }

    // 3. Redis-based attempt-count gate
    const securityCheck = await this.authSecurityService.checkLoginAttempts(
      ipAddress,
      loginDto.email,
    );

    // If account is locked, return immediately
    if (!securityCheck.allowed) {
      this.logger.warn('Login attempt on locked account', {
        email: loginDto.email,
        ip: ipAddress,
        blockedUntil: securityCheck.blockedUntil,
      });

      throw new UnauthorizedException({
        message: 'Too many failed login attempts. Please try again later.',
        blockedUntil: securityCheck.blockedUntil,
        type: 'ACCOUNT_LOCKED',
      });
    }

    // PRODUCTION-READY IMPROVEMENT: Validate CAPTCHA if required
    // DISABLED: CAPTCHA validation temporarily disabled for development
    /*
        if (securityCheck.captchaRequired) {
            if (!loginDto.captchaToken) {
                this.logger.warn('CAPTCHA required but not provided', {
                    email: loginDto.email,
                    ip: ipAddress,
                    remainingAttempts: securityCheck.remainingAttempts
                });

                throw new UnauthorizedException({
                    message: 'CAPTCHA verification required. Please complete the CAPTCHA challenge.',
                    captchaRequired: true,
                    remainingAttempts: securityCheck.remainingAttempts,
                    type: 'CAPTCHA_REQUIRED',
                });
            }

            // Verify CAPTCHA token
            const captchaResult = await this.captchaService.verifyCaptcha(
                loginDto.captchaToken,
                'login', // expected action
                ipAddress
            );

            if (!captchaResult.isValid) {
                this.logger.warn('CAPTCHA verification failed', {
                    email: loginDto.email,
                    ip: ipAddress,
                    error: captchaResult.error,
                    score: captchaResult.score
                });

                // Record failed CAPTCHA attempt
                await this.authSecurityService.recordFailedLoginAttempt(ipAddress, loginDto.email);

                throw new UnauthorizedException({
                    message: captchaResult.error || 'CAPTCHA verification failed',
                    captchaRequired: true,
                    type: 'CAPTCHA_FAILED',
                });
            }

            this.logger.log('CAPTCHA verification passed', {
                email: loginDto.email,
                ip: ipAddress,
                score: captchaResult.score
            });
        }
        */

    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      this.logger.warn('Login attempt with invalid email', { email: loginDto.email });

      // Record failed attempt for rate limiting
      await this.authSecurityService.recordFailedLoginAttempt(ipAddress, loginDto.email);

      // SECURITY: Never reveal user existence - prevents account enumeration attacks
      throw new UnauthorizedException({
        message: 'Invalid email or password',
        type: 'INVALID_CREDENTIALS',
        field: 'credentials',
      });
    }

    if (!user.isEmailVerified) {
      this.logger.warn('Login attempt with unverified email', { userId: user._id });
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    // Phone verification is now deferred to order placement
    // Users can login without phone verification, but will be prompted
    // when attempting to create an order

    // Check account lockout status
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      this.logger.warn('Login attempt on locked account', {
        userId: user._id,
        lockedUntil: user.accountLockedUntil,
      });
      throw new UnauthorizedException({
        message: 'Account is temporarily locked due to multiple failed login attempts',
        lockedUntil: user.accountLockedUntil,
        type: 'ACCOUNT_LOCKED',
      });
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn('Login attempt with inactive account', {
        userId: user._id,
        status: user.status,
      });

      if (user.status === UserStatus.SUSPENDED) {
        throw new UnauthorizedException({
          message: 'Account is suspended',
          type: 'ACCOUNT_SUSPENDED',
        });
      }

      throw new UnauthorizedException('Account is not active');
    }

    if (!user.password) {
      throw new UnauthorizedException({
        message: 'This account uses Google Sign-In. Please sign in with Google.',
        type: 'SOCIAL_AUTH_ONLY',
      });
    }

    const isPasswordValid = await argon2.verify(user.password, loginDto.password);

    if (!isPasswordValid) {
      // Redis: runtime gate (drives the lockout decision)
      const securityResult = await this.authSecurityService.recordFailedLoginAttempt(
        ipAddress,
        loginDto.email,
      );
      // MongoDB: audit trail (atomic increment, no lockout logic)
      await this.usersService.incrementFailedLoginAttempts(
        user._id.toString(),
        ipAddress,
        userAgent,
      );

      this.logger.warn('Login attempt with invalid password', {
        userId: user._id,
        attempts: securityResult.currentAttempts,
        maxAttempts: securityResult.maxAttempts,
        attemptsRemaining: securityResult.attemptsRemaining,
        isLocked: securityResult.isLocked,
      });

      if (securityResult.isLocked) {
        throw new UnauthorizedException({
          message: 'Account has been locked due to multiple failed login attempts',
          type: 'ACCOUNT_LOCKED',
          attemptsRemaining: 0,
          blockedUntil: securityResult.blockedUntil,
        });
      }

      throw new UnauthorizedException({
        message: 'The password you entered is incorrect',
        field: 'password',
        attemptsRemaining: securityResult.attemptsRemaining,
        type: 'INVALID_PASSWORD',
        // captchaRequired: securityCheck.captchaRequired, // DISABLED for development
      });
    }

    this.logger.log('User login successful', { userId: user._id, email: user.email });

    // Generate tokens (on critical path — needed for response)
    const deviceInfo: DeviceInfo = {
      ipAddress: requestInfo?.ipAddress ?? 'unknown',
      userAgent: requestInfo?.userAgent ?? 'unknown',
      platform: this.extractPlatform(requestInfo?.userAgent),
      browser: this.extractBrowser(requestInfo?.userAgent),
    };

    // Run token generation in parallel with cleanup + audit writes.
    // Token generation is the only result needed for the response;
    // clearing attempts and updating lastLogin are independent side effects.
    const [tokenPair] = await Promise.all([
      this.tokenService.generateTokenPair(
        user._id.toString(),
        user.email,
        user.role,
        deviceInfo,
        undefined, // No parent JTI (new login)
        undefined, // No existing family (new login)
        user.tokenRevocationVersion || 0,
        loginDto.rememberMe ?? false,
        user.requiresPasswordChange ?? false,
      ),
      // Side effects — independent, no return value needed
      this.authSecurityService.clearLoginAttempts(ipAddress, loginDto.email),
      this.usersService.resetFailedLoginAttempts(user._id.toString()),
      this.usersService.updateLastLogin(
        user._id.toString(),
        requestInfo?.ipAddress ?? 'unknown',
        requestInfo?.userAgent ?? 'unknown',
        requestInfo?.location,
      ),
    ]);

    // ✅ SECURITY: Use DTO - only send what frontend needs (NO history/audit logs)
    // History endpoints should be separate: GET /users/me/login-history, GET /users/me/audit-log
    return {
      success: true,
      message: 'Login successful',
      user: {
        userId: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        profileImage: user.profileImage,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt ?? new Date(),
        updatedAt: user.updatedAt ?? new Date(),
      },
      tokens: {
        accessToken: tokenPair.accessToken,
        refreshToken: tokenPair.refreshToken,
        expiresIn: this.getAccessTokenExpiresInSeconds(),
        tokenType: 'Bearer' as const,
      },
    };
  }

  /**
   * Parse JWT expiration string (e.g., '15m', '1h', '7d') to seconds
   */
  private getAccessTokenExpiresInSeconds(): number {
    const expiration = this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m';
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 900;
    } // 15 minutes default

    const [, value, unit] = match;
    const num = parseInt(value ?? '15', 10);
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return num * (multipliers[unit ?? 'm'] ?? 60);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      this.logger.warn('Password reset requested for non-existent email', { email });
      return {
        message: 'If an account with this email exists, you will receive a password reset link.',
      };
    }

    const resetToken = CryptoUtil.generateRandomToken(32);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.usersService.setPasswordResetToken(user._id.toString(), resetToken, resetExpires);

    const emailSent = await this.emailService.sendPasswordResetEmail(user, resetToken);

    if (!emailSent) {
      this.logger.error('Failed to send password reset email', {
        userId: user._id.toString(),
        email,
      });
    } else {
      this.logger.log('Password reset email sent successfully', {
        userId: user._id.toString(),
        email,
      });
    }

    return {
      message: 'If an account with this email exists, you will receive a password reset link.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, token, newPassword } = resetPasswordDto;

    const user = await this.usersService.findByPasswordResetToken(token, email);

    if (!user || !(user.passwordResetExpires && user.passwordResetExpires >= new Date())) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    // Validate new password against security policy
    this.passwordPolicyService.validatePasswordStrength(newPassword, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    // Update password and clear reset token
    await this.usersService.updatePassword(user._id.toString(), newPassword);
    this.logger.log('Password reset successful', { userId: user._id });

    // Security: Revoke all tokens and mark security event
    await this.tokenService.revokeAllUserTokens(user._id.toString(), 'Password reset');
    await this.usersService.markTokenInvalidation(user._id.toString());
    await this.usersService.incrementTokenRevocationVersion(user._id.toString());
    await this.usersService.clearAllRefreshTokens(user._id.toString()); // Backward compatibility

    return {
      message: 'Password reset successful. Please log in with your new password.',
    };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user) {
      return {
        message:
          'If an account with this email exists and is not verified, a new verification email will be sent.',
      };
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token with 24h expiry
    const emailVerificationToken = CryptoUtil.generateRandomToken(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.updateEmailVerificationToken(
      user._id.toString(),
      emailVerificationToken,
      emailVerificationExpires,
    );

    // Send new verification email
    try {
      await this.emailService.sendVerificationEmail(user, emailVerificationToken);
    } catch (error) {
      this.logger.warn('Failed to resend verification email', {
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return {
      message:
        'If an account with this email exists and is not verified, a new verification email will be sent.',
    };
  }

  async refreshTokens(
    userId: string,
    refreshToken: string,
    requestInfo?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    if (!userId || !refreshToken) {
      throw new UnauthorizedException('Missing userId or refresh token');
    }

    const user = await this.usersService.findOneWithTokens(userId);

    if (user === null || user === undefined) {
      // SECURITY: Never reveal user existence - use generic message for all auth failures
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // SECURITY: Block deleted/suspended/blocked users from refreshing tokens
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is no longer active');
    }

    // Validate refresh token with token fixation attack prevention
    const validationResult = await this.tokenService.validateRefreshToken(
      refreshToken,
      user.lastTokenInvalidation,
      user.tokenRevocationVersion || 0,
    );

    if (!validationResult.isValid) {
      this.logger.warn('Token validation failed during refresh', {
        userId,
        error: validationResult.error,
        shouldRevokeFamily: validationResult.shouldRevokeFamily,
      });

      // If token family compromise detected, revoke entire family
      if (validationResult.shouldRevokeFamily === true && validationResult.familyId) {
        await this.tokenService.revokeFamilyTokens(
          validationResult.familyId,
          'Token reuse detected - possible theft',
        );

        this.logger.error('Token theft detected - family revoked', {
          userId,
          familyId: validationResult.familyId,
        });
      }

      throw new UnauthorizedException(validationResult.error ?? 'Invalid refresh token');
    }

    if (!validationResult.jti) {
      throw new UnauthorizedException('Invalid refresh token: missing JTI');
    }
    await this.tokenService.rotateToken(validationResult.jti);

    // Generate new tokens in the same family
    const deviceInfo: DeviceInfo = {
      ipAddress: requestInfo?.ipAddress ?? 'unknown',
      userAgent: requestInfo?.userAgent ?? 'unknown',
      platform: this.extractPlatform(requestInfo?.userAgent),
      browser: this.extractBrowser(requestInfo?.userAgent),
    };

    const tokenPair = await this.tokenService.generateTokenPair(
      userId,
      user.email,
      user.role,
      deviceInfo,
      validationResult.jti, // Parent JTI (rotated token)
      validationResult.familyId, // Existing family ID
      user.tokenRevocationVersion || 0,
      validationResult.rememberMe ?? false, // Preserve session duration across rotation
    );

    this.logger.log('Tokens refreshed successfully', {
      userId,
      oldJti: validationResult.jti,
      newJti: tokenPair.jti,
      familyId: tokenPair.familyId,
    });

    return {
      accessToken: tokenPair.accessToken,
      refreshToken: tokenPair.refreshToken,
      expiresIn: this.getAccessTokenExpiresInSeconds(),
      tokenType: 'Bearer' as const,
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Decode token to get JTI
      try {
        const jwtRefreshSecret1 = this.configService.get<string>('JWT_REFRESH_SECRET');
        const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
          ...(jwtRefreshSecret1 !== undefined ? { secret: jwtRefreshSecret1 } : {}),
        });

        if (payload.jti !== null && payload.jti !== undefined) {
          // Revoke the specific token
          await this.tokenService.rotateToken(payload.jti);
          this.logger.log('Single token revoked during logout', {
            userId,
            jti: payload.jti,
          });
        }
      } catch (error) {
        this.logger.warn('Failed to decode refresh token during logout', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Backward compatibility
      await this.usersService.removeRefreshToken(userId, refreshToken);
    } else {
      // Logout from all devices
      await this.tokenService.revokeAllUserTokens(userId, 'User logout (all devices)');
      await this.usersService.clearAllRefreshTokens(userId);

      this.logger.log('All tokens revoked - logout from all devices', { userId });
    }
  }

  private async _generateTokens(
    userId: string,
    email: string,
    role: UserRole,
  ): Promise<AuthTokens> {
    const payload = { sub: userId, email, role };

    const accessExpiresIn = (this.configService.get<string>('JWT_EXPIRES_IN') ??
      '15m') as NonNullable<JwtSignOptions['expiresIn']>;
    const refreshExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '7d') as NonNullable<JwtSignOptions['expiresIn']>;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET') ?? '',
        expiresIn: accessExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET') ?? '',
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getAccessTokenExpiresInSeconds(),
      tokenType: 'Bearer' as const,
    };
  }

  async forcePasswordChange(
    userId: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: object }> {
    const user = await this.usersService.findById(userId);
    if (!user?.requiresPasswordChange) {
      throw new ForbiddenException('Password change is not required for this account');
    }

    const hashedPassword = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    await this.usersService.completePasswordChange(userId, hashedPassword);

    const tokens = await this.tokenService.generateTokenPair(
      userId,
      user.email,
      user.role,
      undefined,
      undefined,
      undefined,
      user.tokenRevocationVersion ?? 0,
      false,
      false, // requiresPasswordChange is now false
    );

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        _id: userId,
        email: user.email,
        role: user.role,
        requiresPasswordChange: false,
      },
    };
  }

  async validateUser(email: string, password: string): Promise<UserResponse | null> {
    const user = await this.usersService.findByEmail(email);

    if (user?.password && (await argon2.verify(user.password, password))) {
      // SECURITY: Reject login for non-active accounts
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('Account is no longer active');
      }
      const {
        password: _password,
        _id,
        ...result
      } = user.toObject() as UserResponse & {
        _id: { toString(): string };
        password: string;
      };
      return { ...result, userId: _id.toString() };
    }

    return null;
  }

  /**
   * Validate and decode refresh token (for mobile app refresh endpoint)
   * @param refreshToken - JWT refresh token
   * @returns Decoded payload with userId, or null if invalid
   */
  async validateRefreshToken(refreshToken: string): Promise<{ userId: string } | null> {
    try {
      // ✅ Use JWT_REFRESH_SECRET for refresh tokens (not JWT_SECRET)
      const jwtRefreshSecret2 = this.configService.get<string>('JWT_REFRESH_SECRET');
      const decoded = await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        ...(jwtRefreshSecret2 !== undefined ? { secret: jwtRefreshSecret2 } : {}),
      });
      if (decoded?.sub === null || decoded?.sub === undefined) {
        return null;
      }
      return { userId: decoded.sub };
    } catch (error) {
      this.logger.warn('Failed to decode refresh token', { error: (error as Error).message });
      return null;
    }
  }

  /**
   * Extract platform from user agent string
   * @param userAgent - User agent string
   */
  private extractPlatform(userAgent?: string): string {
    if (!userAgent) {
      return 'unknown';
    }

    const ua = userAgent.toLowerCase();

    if (ua.includes('windows')) {
      return 'Windows';
    }
    if (ua.includes('mac os')) {
      return 'macOS';
    }
    if (ua.includes('linux')) {
      return 'Linux';
    }
    if (ua.includes('android')) {
      return 'Android';
    }
    if (ua.includes('iphone') || ua.includes('ipad')) {
      return 'iOS';
    }

    return 'unknown';
  }

  /**
   * Extract browser from user agent string
   * @param userAgent - User agent string
   */
  private extractBrowser(userAgent?: string): string {
    if (!userAgent) {
      return 'unknown';
    }

    const ua = userAgent.toLowerCase();

    if (ua.includes('edg')) {
      return 'Edge';
    }
    if (ua.includes('chrome')) {
      return 'Chrome';
    }
    if (ua.includes('firefox')) {
      return 'Firefox';
    }
    if (ua.includes('safari')) {
      return 'Safari';
    }
    if (ua.includes('opera')) {
      return 'Opera';
    }

    return 'unknown';
  }
}
