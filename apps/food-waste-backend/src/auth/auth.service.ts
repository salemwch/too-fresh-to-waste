import { UserRole, UserStatus } from '@foodwaste/shared';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  HttpException,
  HttpStatus,
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

import { appError } from '../common/errors';
import { loginFailureReason, type LoginFailureReason } from './utils/login-failure';
import {
  getDummyPasswordHash,
  USER_PASSWORD_HASH_OPTIONS,
  verifyUserPassword,
} from './utils/password-hash';
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Seconds until access token expires
  tokenType: 'Bearer';
  rememberMe?: boolean;
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
  requiresMFA?: boolean;
  mfaToken?: string;
}

interface RefreshTokenPayload {
  sub?: string;
  jti?: string;
}

/**
 * Account states allowed to receive authentication mail (password reset,
 * verification).
 *
 * PENDING is included deliberately: a user who registered but has not verified
 * yet is precisely who needs a verification — or reset — link. Every other
 * state (suspended, blocked, deleted, anonymized) describes a disabled account,
 * and a working link would hand back a way in.
 *
 * @see .claude/rules/auth-scenarios.md — "Never send auth emails to inactive accounts"
 */
const MAILABLE_STATUSES: ReadonlySet<UserStatus> = new Set([UserStatus.ACTIVE, UserStatus.PENDING]);

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
    // Build the dummy hash now, so even the first unknown-email login in a
    // worker costs the same as a real one (no one-off slow request).
    getDummyPasswordHash().catch((error: unknown) =>
      this.logger.error('Could not prepare the dummy password hash', {
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }

  async register(registerDto: RegisterDto): Promise<RegisterResponse> {
    // Check if email already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException(appError('EMAIL_ALREADY_REGISTERED'));
    }

    // Normalize and validate phone number if provided
    let normalizedPhone: string | undefined;
    if (registerDto.phoneNumber) {
      const phoneValidation = this.phoneNumberService.validatePhoneNumber(
        registerDto.phoneNumber,
        'TN', // Tunisia as default country
      );

      if (!phoneValidation.isValid) {
        throw new BadRequestException(appError('INVALID_PHONE'));
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

    // Create user with normalized phone number + persist referral code on the document
    const user = await this.usersService.create({
      ...registerDto,
      ...(normalizedPhone !== undefined ? { phoneNumber: normalizedPhone } : {}),
      ...(registerDto.referralCode ? { referredByCode: registerDto.referralCode } : {}),
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

    const userId = user._id.toString();

    // Emit event — loyalty account creation and referral processing handled by loyalty listener
    try {
      await this.eventBus.emit(
        'user.registered',
        new UserRegisteredEvent(
          userId,
          user.email,
          role,
          new Date(),
          registerDto.businessInfo,
          normalizedPhone,
          registerDto.referralCode,
        ),
      );
    } catch (eventError) {
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
      throw new BadRequestException(appError('VERIFICATION_TOKEN_INVALID'));
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
      false,
      false,
      user.organizationId?.toString(),
      user.assignedEstablishmentId?.toString(),
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
      throw new ForbiddenException(appError('ACCESS_BLOCKED_SUSPICIOUS'));
    }

    // 2. Bot / suspicious user-agent detection
    const isSuspicious = await this.authSecurityService.detectSuspiciousActivity(
      ipAddress,
      userAgent,
    );
    if (isSuspicious) {
      await this.authSecurityService.blockIp(ipAddress, 300000); // 5 min
      throw new ForbiddenException(appError('ACCESS_BLOCKED_SUSPICIOUS'));
    }

    // 3. Redis-based attempt-count gate
    const securityCheck = await this.authSecurityService.checkLoginAttempts(
      ipAddress,
      loginDto.email,
    );

    // Too many recent failures for this IP or this email. The counters are
    // keyed on the email string, not on an account, so this answer is the same
    // for a registered email and an unknown one.
    if (!securityCheck.allowed) {
      this.logger.warn('Login blocked by attempt limit', {
        email: loginDto.email,
        ip: ipAddress,
        blockedUntil: securityCheck.blockedUntil,
      });
      throw this.loginBlocked(securityCheck.blockedUntil);
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
                    // No attempts count to the client (enumeration + brute-force aid).
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

    /*
     * Account enumeration: an unauthenticated caller must not be able to tell
     * an unknown email from a wrong password, an unverified, suspended or
     * social-only account. So the password is checked FIRST, and every failure
     * before it is proven gets one identical response.
     *
     * The same argon2 work is done in every case - against the account's hash,
     * or a dummy hash when there is no account or no password - so response
     * time does not give it away either.
     */
    const passwordMatches = await verifyUserPassword(user?.password, loginDto.password);
    const failure = loginFailureReason(user, passwordMatches);
    if (failure !== null || !user) {
      throw await this.rejectLogin(failure ?? 'USER_NOT_FOUND', {
        email: loginDto.email,
        ipAddress,
        userAgent,
        ...(user ? { userId: user._id.toString() } : {}),
      });
    }

    /*
     * The password is proven, so the caller owns this account: its state can
     * be disclosed without revealing anything they do not already know. This
     * is what lets an unverified user be told to verify, and a suspended one
     * to contact support.
     */
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      this.logger.warn('Login on an administratively locked account', {
        userId: user._id,
        lockedUntil: user.accountLockedUntil,
      });
      throw new UnauthorizedException(
        appError('ACCOUNT_LOCKED', undefined, {
          type: 'ACCOUNT_LOCKED',
          blockedUntil: user.accountLockedUntil,
        }),
      );
    }

    if (!user.isEmailVerified) {
      this.logger.warn('Login with correct password on an unverified email', {
        userId: user._id,
      });
      throw new UnauthorizedException(appError('EMAIL_NOT_VERIFIED'));
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn('Login with correct password on an inactive account', {
        userId: user._id,
        status: user.status,
      });
      throw new UnauthorizedException(
        user.status === UserStatus.SUSPENDED
          ? appError('ACCOUNT_SUSPENDED', undefined, { type: 'ACCOUNT_SUSPENDED' })
          : appError('ACCOUNT_INACTIVE', undefined, { type: 'ACCOUNT_INACTIVE' }),
      );
    }

    this.logger.log('User login successful', { userId: user._id, email: user.email });

    // MFA gate: if user has TOTP enabled, return a short-lived mfaToken
    // instead of full auth tokens. The client must call /mfa/verify next.
    if (user.mfaSettings?.isEnabled === true) {
      await Promise.all([
        this.authSecurityService.clearLoginAttempts(ipAddress, loginDto.email),
        this.usersService.resetFailedLoginAttempts(user._id.toString()),
      ]);

      const mfaToken = this.jwtService.sign(
        { sub: user._id.toString(), purpose: 'mfa' },
        { expiresIn: '5m' },
      );

      return {
        success: true,
        message: 'MFA verification required',
        requiresMFA: true,
        mfaToken,
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
      };
    }

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
        user.organizationId?.toString(),
        user.assignedEstablishmentId?.toString(),
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

  async completeMfaLogin(
    userId: string,
    requestInfo: { ipAddress: string; userAgent: string },
  ): Promise<LoginResponse> {
    const user = await this.usersService.findOne(userId);
    if (!user) {
      throw new UnauthorizedException(appError('USER_NOT_FOUND'));
    }

    const deviceInfo: DeviceInfo = {
      ipAddress: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      platform: this.extractPlatform(requestInfo.userAgent),
      browser: this.extractBrowser(requestInfo.userAgent),
    };

    const [tokenPair] = await Promise.all([
      this.tokenService.generateTokenPair(
        userId,
        user.email,
        user.role,
        deviceInfo,
        undefined,
        undefined,
        user.tokenRevocationVersion || 0,
        false,
        user.requiresPasswordChange ?? false,
        user.organizationId?.toString(),
        user.assignedEstablishmentId?.toString(),
      ),
      this.usersService.updateLastLogin(userId, requestInfo.ipAddress, requestInfo.userAgent),
    ]);

    return {
      success: true,
      message: 'MFA verification successful',
      user: {
        userId,
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

  /**
   * Records a failed credential check and returns the exception to throw.
   *
   * The public answer is INVALID_CREDENTIALS - identical for every reason, with
   * no attempts count and no account metadata - or, once the attempt limit is
   * reached, the same blocked answer the gate gives. Only the log knows why.
   */
  private async rejectLogin(
    reason: LoginFailureReason,
    context: { email: string; ipAddress: string; userAgent: string; userId?: string },
  ): Promise<HttpException> {
    const attempt = await this.authSecurityService.recordFailedLoginAttempt(
      context.ipAddress,
      context.email,
    );

    const { userId } = context;
    if (userId) {
      // Audit trail only; not awaited so an existing account does no extra
      // round trip an unknown email would not (a timing difference).
      // Promise.resolve().then(): a synchronous throw is caught too.
      void Promise.resolve()
        .then(async () => {
          await this.usersService.incrementFailedLoginAttempts(
            userId,
            context.ipAddress,
            context.userAgent,
          );
        })
        .catch((error: unknown) =>
          this.logger.error('Could not record failed login for audit', {
            userId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
    }

    // Never the password, a token or a hash.
    this.logger.warn('Login failed', {
      reason,
      ...(context.userId ? { userId: context.userId } : { email: context.email }),
      ip: context.ipAddress,
      attempts: attempt.currentAttempts,
      locked: attempt.isLocked,
    });

    if (attempt.isLocked) {
      return this.loginBlocked(attempt.blockedUntil);
    }
    return new UnauthorizedException(appError('INVALID_CREDENTIALS'));
  }

  /**
   * Too many attempts for this IP or email. `blockedUntil` is the same for a
   * registered and an unknown email, so it is safe to return - and it lets the
   * app show a countdown instead of a dead end.
   */
  private loginBlocked(blockedUntil: Date | undefined): HttpException {
    return new HttpException(
      appError('LOGIN_TEMPORARILY_BLOCKED', undefined, blockedUntil ? { blockedUntil } : undefined),
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  /**
   * Runs an account email - and the token write it depends on - without making
   * the caller wait for either.
   *
   * Forgot-password and resend-verification answer the same message whether
   * or not the email has an account. Awaiting the SMTP send, or the token
   * write before it (a majority-acknowledged, journaled write), only for real
   * accounts made the response slower exactly when the account exists - the
   * same oracle, measured in milliseconds instead of words. The write stays
   * before the send inside `sending`, so no link goes out for a token that was
   * not stored.
   */
  private sendAuthEmailInBackground(kind: string, userId: string, sending: Promise<unknown>): void {
    void sending
      .then(sent => {
        if (sent === false) {
          this.logger.error(`Failed to send ${kind} email`, { userId });
        }
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send ${kind} email`, {
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
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

    // Suspended / soft-deleted accounts get the same neutral response as an
    // unknown email, and no mail at all. Sending a working reset link to a
    // disabled account would hand back a way in.
    if (!MAILABLE_STATUSES.has(user.status)) {
      this.logger.warn('Password reset requested for inactive account', {
        userId: user._id.toString(),
      });
      return {
        message: 'If an account with this email exists, you will receive a password reset link.',
      };
    }

    // OAuth accounts have no password — send a "sign in with <provider>" email instead
    // of a reset link that would fail at the reset step.
    if (user.authProvider !== 'local') {
      this.logger.warn('Password reset requested for OAuth account', {
        userId: user._id.toString(),
        authProvider: user.authProvider,
      });
      this.sendAuthEmailInBackground(
        'oauth sign-in reminder',
        user._id.toString(),
        this.emailService.sendOAuthSignInEmail(user),
      );
      return {
        message: 'If an account with this email exists, you will receive a password reset link.',
      };
    }

    const resetToken = CryptoUtil.generateRandomToken(32);
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const userId = user._id.toString();
    this.sendAuthEmailInBackground(
      'password reset',
      userId,
      (async () => {
        await this.usersService.setPasswordResetToken(userId, resetToken, resetExpires);
        const sent = await this.emailService.sendPasswordResetEmail(user, resetToken);
        return sent;
      })(),
    );

    return {
      message: 'If an account with this email exists, you will receive a password reset link.',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { email, token, newPassword } = resetPasswordDto;

    const user = await this.usersService.findByPasswordResetToken(token, email);

    if (!user || !(user.passwordResetExpires && user.passwordResetExpires >= new Date())) {
      throw new BadRequestException(appError('RESET_TOKEN_INVALID'));
    }

    // A link issued before the account was suspended or deleted must not set
    // a password on it. Same answer as a bad token: the link holder learns
    // nothing about why.
    if (!MAILABLE_STATUSES.has(user.status)) {
      this.logger.warn('Password reset attempted on an inactive account', {
        userId: user._id.toString(),
        status: user.status,
      });
      throw new BadRequestException(appError('RESET_TOKEN_INVALID'));
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

    // Same rule as forgotPassword: no auth mail to a disabled account, and the
    // response stays neutral so it cannot be used to probe account state.
    if (!MAILABLE_STATUSES.has(user.status)) {
      this.logger.warn('Verification email requested for inactive account', {
        userId: user._id.toString(),
      });
      return {
        message:
          'If an account with this email exists and is not verified, a new verification email will be sent.',
      };
    }

    // An error here ("already verified") confirmed the account exists and its
    // state to anyone who typed the address. Same neutral answer instead.
    if (user.isEmailVerified) {
      this.logger.log('Verification email requested for a verified account', {
        userId: user._id.toString(),
      });
      return {
        message:
          'If an account with this email exists and is not verified, a new verification email will be sent.',
      };
    }

    // Generate new verification token with 24h expiry
    const emailVerificationToken = CryptoUtil.generateRandomToken(32);
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const userId = user._id.toString();
    this.sendAuthEmailInBackground(
      'verification',
      userId,
      (async () => {
        await this.usersService.updateEmailVerificationToken(
          userId,
          emailVerificationToken,
          emailVerificationExpires,
        );
        const sent = await this.emailService.sendVerificationEmail(user, emailVerificationToken);
        return sent;
      })(),
    );

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
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    }

    const user = await this.usersService.findOneWithTokens(userId);

    if (user === null || user === undefined) {
      // SECURITY: Never reveal user existence - use generic message for all auth failures
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    }

    // SECURITY: Block deleted/suspended/blocked users from refreshing tokens.
    // Use 403 (not 401) so clients can distinguish "account suspended" from
    // "token expired" and show the appropriate screen instead of login.
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException(
        appError('ACCOUNT_INACTIVE', undefined, { type: 'ACCOUNT_INACTIVE' }),
      );
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

      // validationResult.error is logged above; it is not written for users.
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    }

    if (!validationResult.jti) {
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
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
      false,
      user.organizationId?.toString(),
      user.assignedEstablishmentId?.toString(),
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
      rememberMe: validationResult.rememberMe ?? false,
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

      // The token is revoked above via rotateToken(jti) against the hashed
      // RefreshToken collection — that is the whole of single-session logout.
    } else {
      // Logout from all devices
      await this.tokenService.revokeAllUserTokens(userId, 'User logout (all devices)');

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
    // Fallback mirrors the Joi default in env.validation.ts. Unreachable in
    // practice (Joi always supplies the value) but must not contradict it —
    // the previous '365d' here read as the real policy and hid the drift.
    const refreshExpiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ??
      '30d') as NonNullable<JwtSignOptions['expiresIn']>;

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
      throw new ForbiddenException(appError('PASSWORD_CHANGE_NOT_REQUIRED'));
    }

    // A forced change replaces an admin-issued temporary password; it gets the
    // same strength rules as every other way to choose one.
    this.passwordPolicyService.validatePasswordStrength(newPassword, {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    const hashedPassword = await argon2.hash(newPassword, USER_PASSWORD_HASH_OPTIONS);

    await this.usersService.completePasswordChange(userId, hashedPassword);

    await this.tokenService.revokeAllUserTokens(userId, 'Forced password change');
    await this.usersService.markTokenInvalidation(userId);
    await this.usersService.incrementTokenRevocationVersion(userId);

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
      user.organizationId?.toString(),
      user.assignedEstablishmentId?.toString(),
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
        throw new UnauthorizedException(appError('ACCOUNT_INACTIVE'));
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
