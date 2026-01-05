import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException,
    Logger,
    Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { UserRole, UserStatus } from 'src/users/schemas/user.schema';
import { EmailService } from 'src/email/email.service';
import { RegisterDto } from 'src/auth/DTO/register.dto';
import { PasswordPolicyService } from './services/password-policy.service';
import { TokenService, DeviceInfo } from './services/token.service';
import { CryptoUtil } from 'src/common/utils/crypto.util';
import { VerifyEmailDto } from 'src/auth/DTO/verify-email.dto';
import { LoginDto } from 'src/auth/DTO/login.dto';
import { ForgotPasswordDto } from 'src/auth/DTO/forget-password.dto';
import { ResetPasswordDto } from 'src/auth/DTO/reset-password.dto';
import { UsersService } from 'src/users/user.service';
import { PhoneNumberService } from 'src/common/services/phone-number.service';
import { AuthSecurityService } from './services/auth-security.service';
import { CaptchaService } from './services/captcha.service';
import { GamificationService } from '../loyalty/services/gamification.service';

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;      // Seconds until access token expires
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
    avatar?: string;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date;
}

export interface RegisterResponse {
    success: boolean;
    message: string;
    user: Partial<UserResponse>;
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
        @Optional() private readonly gamificationService?: GamificationService,
    ) { }

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
                'TN'  // Tunisia as default country
            );

            if (!phoneValidation.isValid) {
                throw new BadRequestException(
                    phoneValidation.error || 'Invalid phone number format'
                );
            }

            // Store in E.164 format for consistency
            normalizedPhone = phoneValidation.details?.formatted.e164;

            this.logger.log(`Phone number normalized during registration: ${registerDto.phoneNumber} -> ${normalizedPhone}`);
        }

        // Validate password against security policy
        this.passwordPolicyService.validatePasswordStrength(registerDto.password, {
            email: registerDto.email,
            firstName: registerDto.firstName,
            lastName: registerDto.lastName,
        });

        const emailVerificationToken = CryptoUtil.generateRandomToken(32);

        let role: UserRole = UserRole.CONSUMER;

        if (registerDto.role && registerDto.role !== UserRole.ADMIN) {
            role = registerDto.role;
        }

        // Create user with normalized phone number
        const user = await this.usersService.create({
            ...registerDto,
            phoneNumber: normalizedPhone,  // Use normalized E.164 format
            role,
            emailVerificationToken,
        });

        try {
            await this.emailService.sendVerificationEmail(user, emailVerificationToken);
        } catch (error) {
            this.logger.warn('Failed to send verification email during registration', {
                email: user.email,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        // Handle referral registration if referral code was provided
        if (registerDto.referralCode && this.gamificationService) {
            try {
                const referrer = await this.gamificationService.findReferrerByCode(registerDto.referralCode);

                if (referrer) {
                    // Register referral based on user role
                    if (role === UserRole.MERCHANT) {
                        // Business referral: business must sell 30 orders in first month for referrer to get 30 pts
                        await this.gamificationService.registerBusinessReferral(
                            referrer.userId.toString(),
                            user.id,
                        );
                        this.logger.log(`Registered business referral: ${user.id} referred by ${referrer.userId}`);
                    } else {
                        // Friend referral: friend must buy 10 bags in first month for referrer to get 15 pts
                        await this.gamificationService.registerFriendReferral(
                            referrer.userId.toString(),
                            user.id,
                        );
                        this.logger.log(`Registered friend referral: ${user.id} referred by ${referrer.userId}`);
                    }
                } else {
                    this.logger.warn(`Invalid referral code used during registration: ${registerDto.referralCode}`);
                }
            } catch (referralError) {
                // Log error but don't fail registration
                this.logger.error(
                    `Failed to process referral during registration: ${(referralError as Error).message}`,
                    (referralError as Error).stack
                );
            }
        }

        const { password: _password, refreshTokens: _refreshTokens, emailVerificationToken: _token, id, ...result } = user.toObject();

        return {
            success: true,
            message: 'Registration successful. Please check your email to verify your account before logging in.',
            user: { ...result, userId: id },
        };
    }
    async verifyEmail(
        verifyEmailDto: VerifyEmailDto,
        requestInfo?: { ipAddress?: string; userAgent?: string; location?: string }
    ): Promise<LoginResponse> {
        const { email, token } = verifyEmailDto;

        const user = await this.usersService.findByEmailVerificationToken(email, token);

        if (!user) {
            throw new BadRequestException('Invalid or expired verification token');
        }

        // Mark email as verified
        await this.usersService.verifyEmail(user.id);
        this.logger.log('Email verification successful', { userId: user.id });

        // Send welcome email (non-blocking)
        try {
            await this.emailService.sendWelcomeEmail(user);
        } catch (error) {
            this.logger.warn('Failed to send welcome email after verification', {
                userId: user.id,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        // AUTO-LOGIN: Generate tokens so user goes directly to home
        // This is the same pattern used in login() for seamless UX
        const deviceInfo: DeviceInfo = {
            ipAddress: requestInfo?.ipAddress || 'unknown',
            userAgent: requestInfo?.userAgent || 'unknown',
            platform: this.extractPlatform(requestInfo?.userAgent),
            browser: this.extractBrowser(requestInfo?.userAgent),
        };

        const tokenPair = await this.tokenService.generateTokenPair(
            user.id,
            user.email,
            user.role,
            deviceInfo,
            undefined,
            undefined,
            user.tokenRevocationVersion || 0,
        );

        // Update last login timestamp
        await this.usersService.updateLastLogin(
            user.id,
            requestInfo?.ipAddress || 'unknown',
            requestInfo?.userAgent || 'unknown',
            requestInfo?.location
        );

        // Prepare user response (exclude sensitive fields)
        const { password: _password, refreshTokens: _refreshTokens, emailVerificationToken: _emailVerificationToken, passwordResetToken: _passwordResetToken, id, ...userResult } = user.toObject();

        this.logger.log('Email verification with auto-login successful', { userId: user.id });

        return {
            success: true,
            message: 'Email verified successfully',
            user: { ...userResult, userId: id, isEmailVerified: true },
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
        requestInfo?: { ipAddress?: string; userAgent?: string; location?: string }
    ): Promise<LoginResponse> {
        const ipAddress = requestInfo?.ipAddress || 'unknown';

        // PRODUCTION-READY IMPROVEMENT: Check if CAPTCHA is required before proceeding
        const securityCheck = await this.authSecurityService.checkLoginAttempts(
            ipAddress,
            loginDto.email
        );

        // If account is locked, return immediately
        if (!securityCheck.allowed) {
            this.logger.warn('Login attempt on locked account', {
                email: loginDto.email,
                ip: ipAddress,
                blockedUntil: securityCheck.blockedUntil
            });

            throw new UnauthorizedException({
                message: 'Too many failed login attempts. Please try again later.',
                blockedUntil: securityCheck.blockedUntil,
                type: 'ACCOUNT_LOCKED',
            });
        }

        // PRODUCTION-READY IMPROVEMENT: Validate CAPTCHA if required
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

        const user = await this.usersService.findByEmail(loginDto.email);

        if (!user) {
            this.logger.warn('Login attempt with invalid email', { email: loginDto.email });

            // Record failed attempt for rate limiting
            await this.authSecurityService.recordFailedLoginAttempt(ipAddress, loginDto.email);

            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isEmailVerified) {
            this.logger.warn('Login attempt with unverified email', { userId: user.id });
            throw new UnauthorizedException('Please verify your email before logging in');
        }

        // Phone verification is now deferred to order placement
        // Users can login without phone verification, but will be prompted
        // when attempting to create an order

        // Check account lockout status
        if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
            this.logger.warn('Login attempt on locked account', {
                userId: user.id,
                lockedUntil: user.accountLockedUntil
            });
            throw new UnauthorizedException({
                message: 'Account is temporarily locked due to multiple failed login attempts',
                lockedUntil: user.accountLockedUntil,
                type: 'ACCOUNT_LOCKED'
            });
        }

        if (user.status !== UserStatus.ACTIVE) {
            this.logger.warn('Login attempt with inactive account', { userId: user.id, status: user.status });

            if (user.status === UserStatus.SUSPENDED) {
                throw new UnauthorizedException({
                    message: 'Account is suspended',
                    type: 'ACCOUNT_SUSPENDED'
                });
            }

            throw new UnauthorizedException('Account is not active');
        }

        const isPasswordValid = await argon2.verify(user.password, loginDto.password);

        if (!isPasswordValid) {
            // Record failed login attempt in both systems
            const lockoutResult = await this.usersService.recordFailedLogin(
                user.id,
                ipAddress,
                requestInfo?.userAgent || 'unknown'
            );

            // PRODUCTION-READY IMPROVEMENT: Record in auth security service for rate limiting
            await this.authSecurityService.recordFailedLoginAttempt(ipAddress, loginDto.email);

            this.logger.warn('Login attempt with invalid password', {
                userId: user.id,
                attempts: lockoutResult.attemptsRemaining,
                isLocked: lockoutResult.isLocked
            });

            if (lockoutResult.isLocked) {
                throw new UnauthorizedException({
                    message: 'Account has been locked due to multiple failed login attempts',
                    type: 'ACCOUNT_LOCKED',
                    attemptsRemaining: 0
                });
            }

            throw new UnauthorizedException({
                message: 'Invalid credentials',
                attemptsRemaining: lockoutResult.attemptsRemaining,
                type: 'INVALID_CREDENTIALS',
                captchaRequired: securityCheck.captchaRequired, // PRODUCTION-READY IMPROVEMENT
            });
        }

        this.logger.log('User login successful', { userId: user.id, email: user.email });

        // Reset failed login attempts on successful login
        await this.usersService.resetFailedLoginAttempts(user.id);

        // PRODUCTION-READY IMPROVEMENT: Clear auth security service attempts
        await this.authSecurityService.clearLoginAttempts(ipAddress, loginDto.email);

        // Generate tokens with JTI, family tracking, and device info
        const deviceInfo: DeviceInfo = {
            ipAddress: requestInfo?.ipAddress || 'unknown',
            userAgent: requestInfo?.userAgent || 'unknown',
            platform: this.extractPlatform(requestInfo?.userAgent),
            browser: this.extractBrowser(requestInfo?.userAgent),
        };

        const tokenPair = await this.tokenService.generateTokenPair(
            user.id,
            user.email,
            user.role,
            deviceInfo,
            undefined, // No parent JTI (new login)
            undefined, // No existing family (new login)
            user.tokenRevocationVersion || 0,
        );

        await this.usersService.updateLastLogin(
            user.id,
            requestInfo?.ipAddress || 'unknown',
            requestInfo?.userAgent || 'unknown',
            requestInfo?.location
        );

        const { password: _password, refreshTokens: _refreshTokens, emailVerificationToken: _emailVerificationToken, passwordResetToken: _passwordResetToken, id, ...userResult } = user.toObject();

        return {
            success: true,
            message: 'Login successful',
            user: { ...userResult, userId: id },
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
        const expiration = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
        const match = expiration.match(/^(\d+)([smhd])$/);
        if (!match) return 900; // 15 minutes default

        const [, value, unit] = match;
        const num = parseInt(value, 10);
        const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        return num * (multipliers[unit] || 60);
    }

    async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
        const { email } = forgotPasswordDto;
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            return {
                message: 'If an account with this email exists, you will receive a password reset link.',
            };
        }
        const resetToken = CryptoUtil.generateRandomToken(32);
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await this.usersService.setPasswordResetToken(user.id, resetToken, resetExpires);

        try {
            await this.emailService.sendPasswordResetEmail(user, resetToken);
        } catch (error) {
            this.logger.warn('Failed to send password reset email', {
                email,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        return {
            message: 'If an account with this email exists, you will receive a password reset link.',
        };
    }

    async resetPassword(resetPasswordDto: ResetPasswordDto) {
        const { email, token, newPassword } = resetPasswordDto;

        const user = await this.usersService.findByPasswordResetToken(email, token);

        if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
            throw new BadRequestException('Invalid or expired password reset token');
        }

        // Validate new password against security policy
        this.passwordPolicyService.validatePasswordStrength(newPassword, {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
        });

        // Update password and clear reset token
        await this.usersService.updatePassword(user.id, newPassword);
        this.logger.log('Password reset successful', { userId: user.id });

        // Security: Revoke all tokens and mark security event
        await this.tokenService.revokeAllUserTokens(user.id, 'Password reset');
        await this.usersService.markTokenInvalidation(user.id);
        await this.usersService.incrementTokenRevocationVersion(user.id);
        await this.usersService.clearAllRefreshTokens(user.id); // Backward compatibility

        return {
            message: 'Password reset successful. Please log in with your new password.',
        };
    }

    async resendVerificationEmail(email: string) {
        const user = await this.usersService.findByEmail(email);

        if (!user) {
            return {
                message: 'If an account with this email exists and is not verified, a new verification email will be sent.',
            };
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Email is already verified');
        }

        // Generate new verification token
        const emailVerificationToken = CryptoUtil.generateRandomToken(32);
        await this.usersService.updateEmailVerificationToken(user.id, emailVerificationToken);

        // Send new verification email
        try {
            await this.emailService.sendVerificationEmail(user, emailVerificationToken);
        } catch (error) {
            this.logger.warn('Failed to resend verification email', {
                email,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }

        return {
            message: 'If an account with this email exists and is not verified, a new verification email will be sent.',
        };
    }

    async refreshTokens(
        userId: string,
        refreshToken: string,
        requestInfo?: { ipAddress?: string; userAgent?: string }
    ): Promise<AuthTokens> {
        if (!userId || !refreshToken) {
            throw new UnauthorizedException('Missing userId or refresh token');
        }

        const user = await this.usersService.findOneWithTokens(userId);

        if (!user) {
            throw new UnauthorizedException('User not found');
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
            if (validationResult.shouldRevokeFamily && validationResult.familyId) {
                await this.tokenService.revokeFamilyTokens(
                    validationResult.familyId,
                    'Token reuse detected - possible theft'
                );

                this.logger.error('Token theft detected - family revoked', {
                    userId,
                    familyId: validationResult.familyId,
                });
            }

            throw new UnauthorizedException(validationResult.error || 'Invalid refresh token');
        }

        if (!validationResult.jti) {
            throw new UnauthorizedException('Invalid refresh token: missing JTI');
        }
        await this.tokenService.rotateToken(validationResult.jti);

        // Generate new tokens in the same family
        const deviceInfo: DeviceInfo = {
            ipAddress: requestInfo?.ipAddress || 'unknown',
            userAgent: requestInfo?.userAgent || 'unknown',
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
                const payload = await this.jwtService.verifyAsync(refreshToken, {
                    secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                });

                if (payload.jti) {
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

    private async generateTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
        const payload = { sub: userId, email, role };

        const accessExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
        const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_SECRET'),
                expiresIn: accessExpiresIn as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: refreshExpiresIn as any,
            }),
        ]);

        return {
            accessToken,
            refreshToken,
            expiresIn: this.getAccessTokenExpiresInSeconds(),
            tokenType: 'Bearer' as const,
        };
    }

    async validateUser(email: string, password: string): Promise<UserResponse | null> {
        const user = await this.usersService.findByEmail(email);

        if (user && (await argon2.verify(user.password, password))) {
            const { password: _password, id, ...result } = user.toObject();
            return { ...result, userId: id };
        }

        return null;
    }

    /**
     * Extract platform from user agent string
     * @param userAgent - User agent string
     */
    private extractPlatform(userAgent?: string): string {
        if (!userAgent) { return 'unknown'; }

        const ua = userAgent.toLowerCase();

        if (ua.includes('windows')) { return 'Windows'; }
        if (ua.includes('mac os')) { return 'macOS'; }
        if (ua.includes('linux')) { return 'Linux'; }
        if (ua.includes('android')) { return 'Android'; }
        if (ua.includes('iphone') || ua.includes('ipad')) { return 'iOS'; }

        return 'unknown';
    }

    /**
     * Extract browser from user agent string
     * @param userAgent - User agent string
     */
    private extractBrowser(userAgent?: string): string {
        if (!userAgent) { return 'unknown'; }

        const ua = userAgent.toLowerCase();

        if (ua.includes('edg')) { return 'Edge'; }
        if (ua.includes('chrome')) { return 'Chrome'; }
        if (ua.includes('firefox')) { return 'Firefox'; }
        if (ua.includes('safari')) { return 'Safari'; }
        if (ua.includes('opera')) { return 'Opera'; }

        return 'unknown';
    }
}