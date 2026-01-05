import {
    Controller,
    Post,
    Body,
    UseGuards,
    Request,
    Response,
    HttpCode,
    HttpStatus,
    Get,
    HttpException,
    Logger,
    ForbiddenException,
    Param,
    BadRequestException,
    InternalServerErrorException,
    NotFoundException,
} from '@nestjs/common';
import { Response as ExpressResponse, Request as ExpressRequest } from 'express';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
    ApiTags,
    ApiOperation,
    ApiOkResponse,
    ApiCreatedResponse as ApiCreatedResponseSwagger,
    ApiBadRequestResponse,
    ApiUnauthorizedResponse,
    ApiForbiddenResponse,
    ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { AuthService, RegisterResponse, LoginResponse } from './auth.service';
import { AuthSecurityService } from './services/auth-security.service';
import { CsrfService } from './services/csrf.service';
import { SessionManagementService } from './services/session-management.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { MfaService } from './services/mfa.service';
import { CookieSecurityUtil } from '../common/utils/cookie-security.util';


import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { RegisterDto } from './DTO/register.dto';
import { LoginDto } from './DTO/login.dto';
import { ForgotPasswordDto } from './DTO/forget-password.dto';
import { ResetPasswordDto } from './DTO/reset-password.dto';
import { VerifyEmailDto } from './DTO/verify-email.dto';
import { Public } from './decorators/public.decorator';

/**
 * AUTHENTICATION CONTROLLER
 *
 * Handles all authentication and authorization operations including:
 * - User registration and email verification
 * - Login/logout with security controls
 * - Password reset flow
 * - Multi-factor authentication (MFA/TOTP)
 * - Session management and device tracking
 * - CSRF token generation
 * - Password policy enforcement
 *
 * @security All endpoints implement rate limiting, CSRF protection, and brute-force prevention
 * @compliance OWASP Top 10, NIST 800-63B
 */
@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    private readonly logger = new Logger(AuthController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
        private readonly authSecurityService: AuthSecurityService,
        private readonly csrfService: CsrfService,
        private readonly sessionManagementService: SessionManagementService,
        private readonly passwordPolicyService: PasswordPolicyService,
        private readonly mfaService: MfaService,
    ) { }
    @Post('register')
    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 minutes
    @ApiOperation({
        summary: 'Register new user account',
        description: `Creates a new user account with email verification flow.

**Features:**
- Email uniqueness validation
- Password strength enforcement (NIST 800-63B compliant)
- Automatic verification email dispatch
- Rate limiting: 5 attempts per 5 minutes per IP
- Input sanitization against XSS/SQL injection

**Flow:**
1. Submit registration form with required fields
2. System validates input and creates unverified account
3. Verification email sent to provided address
4. User must verify email before login (see /verify-email)

**Security:**
- Passwords hashed with bcrypt (cost factor: 12)
- PII sanitization
- Brute-force protection
- CAPTCHA integration (production)`,
    })
    @ApiCreatedResponseSwagger({
        description: 'User registered successfully. Verification email sent.',
        schema: {
            example: {
                success: true,
                message: 'User registered successfully',
                user: {
                    userId: '507f1f77bcf86cd799439011',
                    email: 'user@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    isEmailVerified: false,
                    createdAt: '2025-01-21T10:30:00.000Z',
                },
            },
        },
    })
    @ApiBadRequestResponse({
        description: 'Invalid input data or email already exists',
        schema: {
            example: {
                statusCode: 400,
                message: ['email must be a valid email', 'password is too weak'],
                error: 'Bad Request',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/auth/register',
                method: 'POST',
            },
        },
    })
    @ApiTooManyRequestsResponse({
        description: 'Rate limit exceeded (5 attempts per 5 minutes)',
        schema: {
            example: {
                statusCode: 429,
                message: 'ThrottlerException: Too Many Requests',
                timestamp: '2025-01-21T10:30:00.000Z',
                path: '/api/v1/auth/register',
                method: 'POST',
            },
        },
    })
    async register(@Body() registerDto: RegisterDto): Promise<RegisterResponse> {
        this.logger.log(`Registration attempt for email: ${registerDto.email}`);

        try {
            return await this.authService.register(registerDto);
        } catch (error) {
            this.logger.error(
                `Registration failed for email: ${registerDto.email}`,
                (error as Error).stack,
            );
            // Re-throw the original exception to preserve status code (409 for ConflictException, 400 for BadRequestException)
            // Global exception filter will format the response
            throw error;
        }
    }
    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 10, ttl: 300000 } })
    async verifyEmail(
        @Body() verifyEmailDto: VerifyEmailDto,
        @Request() req: ExpressRequest
    ) {
        try {
            // Extract request info for auto-login token generation
            const requestInfo = {
                ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
                userAgent: req.headers['user-agent'] || 'unknown',
            };

            const result = await this.authService.verifyEmail(verifyEmailDto, requestInfo);
            return result;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }

            this.logger.error('Email verification error', {
                errorName: (error as Error)?.name,
                errorMessage: (error as Error)?.message,
                email: verifyEmailDto.email,
            });

            throw new InternalServerErrorException({
                message: 'Email verification failed. Please try again.',
            });
        }
    }


    @Post('resend-verification')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 attempts / 10 minutes
    async resendVerification(@Body('email') email: string): Promise<{ message: string }> {
        try {
            if (!email || typeof email !== 'string') {
                throw new BadRequestException('Valid email is required.');
            }

            await this.authService.resendVerificationEmail(email);

            return { message: 'Verification email resent successfully.' };
        } catch (error) {
            // Handle specific known errors from AuthService
            if (error.name === 'UserNotFoundError') {
                throw new BadRequestException('No account found with that email.');
            }

            if (error.name === 'AlreadyVerifiedError') {
                throw new BadRequestException('Account is already verified.');
            }

            // Unexpected error
            throw new InternalServerErrorException({
                message: 'Failed to resend verification email.',
                details: error.message,
            });
        }
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 900000 } }) // 5 attempts per 15 minutes
    @ApiOperation({
        summary: 'Authenticate user and obtain JWT tokens',
        description: `Authenticates user credentials and returns JWT access/refresh tokens with session tracking.

**Security Features:**
- IP-based brute-force protection
- Suspicious activity detection
- Failed login attempt tracking
- Device fingerprinting
- Session management with device tracking
- Secure HTTP-only cookies

**Rate Limiting:** 5 attempts per 15 minutes per IP

**Returns:**
- Access token (15min expiry)
- Refresh token (7 days expiry)
- Session ID
- Device information`,
    })
    @ApiOkResponse({
        description: 'Login successful. Tokens set in HTTP-only cookies.',
        schema: {
            example: {
                success: true,
                user: {
                    userId: '507f1f77bcf86cd799439011',
                    email: 'user@example.com',
                    firstName: 'John',
                    role: 'user',
                },
                tokens: {
                    accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                    refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                },
                sessionId: 'sess_abc123def456',
                deviceInfo: {
                    deviceName: 'Chrome on Windows',
                    platform: 'Windows',
                    browser: 'Chrome',
                },
            },
        },
    })
    @ApiBadRequestResponse({ description: 'Invalid email or password' })
    @ApiForbiddenResponse({ description: 'Account locked due to suspicious activity or too many failed attempts' })
    @ApiUnauthorizedResponse({ description: 'Email not verified' })
    @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
    async login(
        @Body() loginDto: LoginDto,
        @Request() req: ExpressRequest,
        @Response({ passthrough: true }) res: ExpressResponse,
    ): Promise<LoginResponse> {
        const requestInfo = {
            ipAddress: req.ip || req.socket?.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
        };

        // Check for security blocks and suspicious activity
        const ipBlocked = await this.authSecurityService.isIpBlocked(requestInfo.ipAddress);
        if (ipBlocked) {
            this.logger.warn(`Login attempt from blocked IP: ${requestInfo.ipAddress}`);
            throw new ForbiddenException('Access temporarily blocked due to suspicious activity');
        }

        const isSuspicious = await this.authSecurityService.detectSuspiciousActivity(
            requestInfo.ipAddress,
            requestInfo.userAgent
        );
        if (isSuspicious) {
            await this.authSecurityService.blockIp(requestInfo.ipAddress, 300000); // 5 minutes block
            throw new ForbiddenException('Suspicious activity detected. Access temporarily blocked');
        }

        // Check login attempts before proceeding
        const attemptCheck = await this.authSecurityService.checkLoginAttempts(
            requestInfo.ipAddress,
            loginDto.email
        );

        if (!attemptCheck.allowed) {
            this.logger.warn(`Login blocked for ${loginDto.email} from ${requestInfo.ipAddress}`);
            throw new ForbiddenException({
                message: 'Too many failed login attempts',
                blockedUntil: attemptCheck.blockedUntil,
            });
        }

        try {
            const loginResponse = await this.authService.login(loginDto, requestInfo);

            // Clear failed attempts on successful login
            await this.authSecurityService.clearLoginAttempts(requestInfo.ipAddress, loginDto.email);

            // Create session with device tracking
            const sessionInfo = await this.sessionManagementService.createSession({
                userId: loginResponse.user.userId,
                userAgent: requestInfo.userAgent,
                ipAddress: requestInfo.ipAddress,
                rememberMe: loginDto.rememberMe || false,
            }, loginResponse.tokens);

            this.setAuthCookies(res, loginResponse.tokens, sessionInfo.sessionId);

            return {
                ...loginResponse,
                sessionId: sessionInfo.sessionId,
                deviceInfo: {
                    deviceName: sessionInfo.deviceInfo.deviceName,
                    platform: sessionInfo.deviceInfo.platform,
                    browser: sessionInfo.deviceInfo.browser,
                },
            };
        } catch (error) {
            // Record failed login attempt
            await this.authSecurityService.recordFailedLoginAttempt(requestInfo.ipAddress, loginDto.email);

            this.logger.warn(`Failed login attempt`, {
                email: loginDto.email,
                ip: requestInfo.ipAddress,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            throw error;
        }
    }


    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 attempts per 15 minutes
    async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
        try {
            const result = await this.authService.forgotPassword(forgotPasswordDto);

            return {
                success: true,
                message: 'Password reset instructions sent successfully.',
                data: result ?? null,
            };
        } catch (error) {
            // Handle and rethrow specific error types for cleaner client responses
            if (error.name === 'UserNotFoundError') {
                throw new NotFoundException('No account found with the provided email.');
            }

            if (error.name === 'EmailSendError') {
                throw new InternalServerErrorException('Failed to send reset email. Please try again later.');
            }

            // Fallback for unexpected errors
            throw new InternalServerErrorException('An unexpected error occurred.');
        }
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 3, ttl: 900000 } }) // 3 attempts per 15 minutes
    async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
        try {
            const result = await this.authService.resetPassword(resetPasswordDto);

            return {
                success: true,
                message: 'Password has been reset successfully.',
                data: result ?? null,
            };
        } catch (error) {
            this.logger.error('Password reset error', {
                errorName: error?.name,
                errorMessage: error?.message,
                email: resetPasswordDto.email,
            });

            // Re-throw all HTTP exceptions as-is (includes BadRequestException, NotFoundException, etc.)
            if (error instanceof HttpException) {
                throw error;
            }

            // Handle known custom error types for better client feedback
            if (error?.name === 'InvalidOrExpiredTokenError') {
                throw new BadRequestException('The reset token is invalid or has expired.');
            }

            if (error?.name === 'UserNotFoundError') {
                throw new NotFoundException('No user found for this token.');
            }

            if (error?.name === 'PasswordPolicyError') {
                throw new BadRequestException(error.message || 'New password does not meet security requirements.');
            }

            // Fallback: Unexpected failure
            throw new InternalServerErrorException('Failed to reset password. Please try again later.');
        }
    }

    @Post('refresh')
    @UseGuards(JwtRefreshGuard)
    @HttpCode(HttpStatus.OK)
    async refresh(
        @Request() req,
        @Response({ passthrough: true }) res: ExpressResponse,
    ) {
        const tokens = await this.authService.refreshTokens(
            req.user.userId,
            req.user.refreshToken,
        );

        this.setAuthCookies(res, tokens);

        return { message: 'Tokens refreshed successfully' };
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(
        @Request() req,
        @Response({ passthrough: true }) res: ExpressResponse,
    ) {
        const sessionId = req.cookies?.['session_id'];

        // Terminate session if exists
        if (sessionId) {
            this.sessionManagementService.terminateSession(sessionId);
        }

        await this.authService.logout(req.user.userId, req.cookies?.['refresh_token']);
        this.clearAuthCookies(res);

        return { message: 'Logout successful' };
    }

    @Post('logout-all')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logoutAll(
        @Request() req,
        @Response({ passthrough: true }) res: ExpressResponse,
    ) {
        const currentSessionId = req.cookies?.['session_id'];

        // Terminate all user sessions
        const terminatedCount = this.sessionManagementService.terminateAllUserSessions(
            req.user.userId,
            currentSessionId // Exclude current session
        );

        await this.authService.logout(req.user.userId, req.cookies?.['refresh_token']);
        this.clearAuthCookies(res);

        return {
            message: 'Logged out from all devices',
            terminatedSessions: terminatedCount
        };
    }

    @Get('sessions')
    @UseGuards(JwtAuthGuard)
    getActiveSessions(@Request() req) {
        const sessions = this.sessionManagementService.getUserActiveSessions(req.user.userId);

        return {
            success: true,
            sessions: sessions.map(session => ({
                sessionId: session.sessionId,
                deviceInfo: {
                    deviceName: session.deviceInfo.deviceName,
                    platform: session.deviceInfo.platform,
                    browser: session.deviceInfo.browser,
                    ipAddress: session.deviceInfo.ipAddress,
                    isTrusted: session.deviceInfo.isTrusted,
                },
                createdAt: session.createdAt,
                lastActivityAt: session.lastActivityAt,
                expiresAt: session.expiresAt,
                isCurrentSession: session.sessionId === req.cookies?.['session_id']
            }))
        };
    }

    @Post('terminate-session/:sessionId')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    terminateSession(
        @Param('sessionId') sessionId: string,
        @Request() req,
    ) {
        // Verify the session belongs to the current user
        const userSessions = this.sessionManagementService.getUserActiveSessions(req.user.userId);
        const sessionExists = userSessions.some(session => session.sessionId === sessionId);

        if (!sessionExists) {
            throw new ForbiddenException('Session not found or does not belong to user');
        }

        this.sessionManagementService.terminateSession(sessionId);

        return {
            success: true,
            message: 'Session terminated successfully'
        };
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getProfile(@Request() req) {
        return req.user;
    }

    @Get('csrf-token')
    @Public()
    @HttpCode(HttpStatus.OK)
    getCsrfToken(@Response({ passthrough: true }) res: ExpressResponse) {
        const { token, expiresAt } = this.csrfService.generateToken();
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

        res.cookie('csrf-token', token, {
            httpOnly: false, // Frontend needs to read this
            secure: isProduction,
            sameSite: isProduction ? 'strict' : 'lax',
            maxAge: 60 * 60 * 1000, // 1 hour
        });

        return {
            token,
            expiresAt,
            message: 'CSRF token generated successfully'
        };
    }

    @Post('check-password-strength')
    @Public()
    @HttpCode(HttpStatus.OK)
    checkPasswordStrength(@Body() body: { password: string; email?: string; firstName?: string; lastName?: string }) {
        const result = this.passwordPolicyService.validatePassword(body.password, {
            email: body.email,
            firstName: body.firstName,
            lastName: body.lastName,
        });

        return {
            success: true,
            strength: {
                score: result.score,
                isValid: result.isValid,
                feedback: result.feedback,
                suggestions: result.suggestions,
                crackTime: result.crackTime,
            },
        };
    }

    @Get('password-policy')
    @Public()
    getPasswordPolicy() {
        const policy = this.passwordPolicyService.getPasswordPolicy();

        return {
            success: true,
            policy: {
                minLength: policy.minLength,
                requireUppercase: policy.requireUppercase,
                requireLowercase: policy.requireLowercase,
                requireNumbers: policy.requireNumbers,
                requireSpecialChars: policy.requireSpecialChars,
                specialCharacters: policy.specialCharacters,
                minScore: policy.minScore,
            },
        };
    }

    @Post('generate-password')
    @Public()
    @HttpCode(HttpStatus.OK)
    generateSecurePassword(@Body() body: { length?: number }) {
        const length = body.length || 16;
        const password = this.passwordPolicyService.generateSecurePassword(length);

        return {
            success: true,
            password,
            strength: this.passwordPolicyService.validatePassword(password),
        };
    }

    // MFA Endpoints
    @Post('mfa/setup')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async setupMfa(@Request() req) {
        const setup = await this.mfaService.setupTotp(req.user.userId);

        return {
            success: true,
            message: 'MFA setup initiated. Please verify with the generated code.',
            qrCode: setup.qrCode,
            backupCodes: setup.backupCodes,
            manualEntryKey: setup.manualEntryKey,
        };
    }

    @Post('mfa/verify-setup')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async verifyMfaSetup(@Request() req, @Body() body: { token: string }) {
        const isValid = await this.mfaService.verifyTotpSetup(req.user.userId, body.token);

        if (!isValid) {
            throw new BadRequestException('Invalid verification code');
        }

        return {
            success: true,
            message: 'MFA has been successfully enabled for your account',
        };
    }

    @Post('mfa/verify')
    @Public()
    @UseGuards(ThrottlerGuard)
    @Throttle({ default: { limit: 5, ttl: 300000 } })
    @HttpCode(HttpStatus.OK)
    async verifyMfa(@Body() body: { userId: string; token: string }) {
        const result = await this.mfaService.verifyTotp(body.userId, body.token);

        return {
            success: result.isValid,
            message: result.isValid ? 'MFA verification successful' : 'Invalid MFA code',
            backupCodeUsed: result.backupCodeUsed,
            remainingBackupCodes: result.remainingAttempts,
        };
    }

    @Post('mfa/disable')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async disableMfa(@Request() req, @Body() body: { token: string }) {
        await this.mfaService.disableMfa(req.user.userId, body.token);

        return {
            success: true,
            message: 'MFA has been disabled for your account',
        };
    }

    @Get('mfa/status')
    @UseGuards(JwtAuthGuard)
    async getMfaStatus(@Request() req) {
        const status = await this.mfaService.getMfaStatus(req.user.userId);

        return {
            success: true,
            mfa: status,
        };
    }

    @Post('mfa/backup-codes/regenerate')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async regenerateBackupCodes(@Request() req) {
        const backupCodes = await this.mfaService.regenerateBackupCodes(req.user.userId);

        return {
            success: true,
            message: 'New backup codes generated. Please store them securely.',
            backupCodes,
        };
    }

    @Post('mfa/emergency-tokens')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async generateEmergencyTokens(@Request() req) {
        const emergencyTokens = await this.mfaService.generateEmergencyTokens(req.user.userId);

        return {
            success: true,
            message: 'Emergency tokens generated. Use these only in case of emergency.',
            emergencyTokens,
        };
    }

    /**
     * ENTERPRISE-GRADE COOKIE SETTER
     *
     * Sets authentication cookies with MANDATORY security attributes:
     * ✓ HttpOnly - Prevents XSS cookie theft (CRITICAL)
     * ✓ Secure - HTTPS only in production (CRITICAL)
     * ✓ SameSite - Prevents CSRF attacks (CRITICAL)
     * ✓ Domain - Restricts cookie scope to prevent subdomain leakage (HIGH)
     * ✓ Path - Minimal scope to reduce attack surface
     *
     * Addresses audit findings in PRODUCTION_READINESS_AUDIT_REPORT.md:379-413
     *
     * @param res - Express response object
     * @param tokens - Access and refresh JWT tokens
     * @param sessionId - Optional session identifier
     */
    private setAuthCookies(res: ExpressResponse, tokens: { accessToken: string; refreshToken: string }, sessionId?: string) {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const domain = this.configService.get<string>('COOKIE_DOMAIN');

        try {
            // ✓ CRITICAL: Set access token with enterprise-grade security
            CookieSecurityUtil.setAccessTokenCookie(
                res,
                tokens.accessToken,
                isProduction,
                domain,
                15 * 60 * 1000  // 15 minutes (short-lived)
            );

            // ✓ CRITICAL: Set refresh token with maximum security
            CookieSecurityUtil.setRefreshTokenCookie(
                res,
                tokens.refreshToken,
                isProduction,
                domain,
                7 * 24 * 60 * 60 * 1000  // 7 days (long-lived but revocable)
            );

            // ✓ Set session cookie if provided
            if (sessionId) {
                CookieSecurityUtil.setSessionCookie(
                    res,
                    sessionId,
                    isProduction,
                    domain,
                    7 * 24 * 60 * 60 * 1000  // 7 days
                );
            }

            this.logger.log('Authentication cookies set with enterprise-grade security', {
                hasAccessToken: !!tokens.accessToken,
                hasRefreshToken: !!tokens.refreshToken,
                hasSession: !!sessionId,
                isProduction,
                domain: domain || 'current-domain-only',
                securityAttributes: {
                    httpOnly: true,
                    secure: isProduction,
                    sameSite: 'strict',
                }
            });
        } catch (error) {
            this.logger.error('Failed to set secure cookies', {
                error: error instanceof Error ? error.message : 'Unknown error',
                isProduction,
                domain,
            });
            throw new InternalServerErrorException('Failed to set authentication cookies');
        }
    }


    /**
     * SECURE COOKIE CLEARER
     *
     * Clears authentication cookies during logout with proper security attributes.
     * IMPORTANT: Must use exact same path and domain as when cookies were set,
     * otherwise cookies will not be properly cleared.
     *
     * @param res - Express response object
     */
    private clearAuthCookies(res: ExpressResponse) {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const domain = this.configService.get<string>('COOKIE_DOMAIN');

        try {
            // ✓ Clear all authentication cookies using enterprise-grade utility
            CookieSecurityUtil.clearAuthCookies(res, isProduction, domain);

            // ✓ Also clear session cookie with matching attributes
            const sessionOptions = CookieSecurityUtil.getSecureOptions(isProduction, domain, {
                maxAge: 0,
                path: '/',
            });
            res.clearCookie('session_id', sessionOptions);

            this.logger.log('Authentication cookies cleared securely', {
                isProduction,
                domain: domain || 'current-domain-only',
            });
        } catch (error) {
            this.logger.error('Failed to clear cookies', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw error - logout should succeed even if cookie clearing fails
        }
    }
}