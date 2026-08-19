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
  Delete,
  HttpException,
  Logger,
  ForbiddenException,
  Param,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Response as ExpressResponse, Request as ExpressRequest } from 'express';

import { UsersService } from 'src/users/user.service';

import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AppVersionGuard } from '../common/guards/app-version.guard';
import { CookieSecurityUtil } from '../common/utils/cookie-security.util';

import { AuthService, RegisterResponse, LoginResponse } from './auth.service';
import { ForgotPasswordDto } from './DTO/forget-password.dto';
import { ForcePasswordChangeDto } from './DTO/force-password-change.dto';
import { GeneratePasswordDto } from './DTO/generate-password.dto';
import { LoginDto } from './DTO/login.dto';
import { RegisterDto } from './DTO/register.dto';
import { ResetPasswordDto } from './DTO/reset-password.dto';
import { VerifyEmailDto } from './DTO/verify-email.dto';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { GoogleAuthDto } from './DTO/google-auth.dto';
import { CsrfService } from './services/csrf.service';
import { GoogleAuthService } from './services/google-auth.service';
import { MfaService } from './services/mfa.service';
import { PasswordPolicyService } from './services/password-policy.service';
import { SessionManagementService } from './services/session-management.service';
import { COOKIE_NAMES } from '../common/utils/cookie-security.util';

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
    private readonly jwtService: JwtService,
    private readonly csrfService: CsrfService,
    private readonly sessionManagementService: SessionManagementService,
    private readonly passwordPolicyService: PasswordPolicyService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
    private readonly googleAuthService: GoogleAuthService,
  ) {}
  @Post('register')
  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 600000 } }) // 10 attempts per 10 minutes
  @ApiOperation({
    summary: 'Register new user account',
    description: `Creates a new user account with email verification flow.

**Features:**
- Email uniqueness validation
- Password strength enforcement (NIST 800-63B compliant)
- Automatic verification email dispatch
- Rate limiting: 10 attempts per 10 minutes per IP
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
        status: 400,
        message: ['email must be a valid email', 'password is too weak'],
        error: 'Bad Request',
        timestamp: '2025-01-21T10:30:00.000Z',
        path: '/api/v1/auth/register',
        method: 'POST',
      },
    },
  })
  @ApiTooManyRequestsResponse({
    description: 'Rate limit exceeded (10 attempts per 10 minutes)',
    schema: {
      example: {
        status: 429,
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
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    try {
      // Extract request info for auto-login token generation
      const requestInfo = {
        ipAddress: req.ip ?? req.connection?.remoteAddress ?? 'unknown',
        userAgent:
          typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : 'unknown',
      };

      const result = await this.authService.verifyEmail(verifyEmailDto, requestInfo);

      // Set HttpOnly cookies for web auto-login after email verification
      if (result.tokens) {
        this.setAuthCookies(res, result.tokens);
      }

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
  @Throttle({ default: { limit: 10, ttl: 600000 } }) // 3 attempts / 10 minutes
  async resendVerification(@Body('email') email: string): Promise<{ message: string }> {
    try {
      if (!email || typeof email !== 'string') {
        throw new BadRequestException('Valid email is required.');
      }

      await this.authService.resendVerificationEmail(email);

      return { message: 'Verification email resent successfully.' };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : undefined;
      const errorMessage = error instanceof Error ? error.message : undefined;

      // Handle specific known errors from AuthService
      if (errorName === 'UserNotFoundError') {
        throw new BadRequestException('No account found with that email.');
      }

      if (errorName === 'AlreadyVerifiedError') {
        throw new BadRequestException('Account is already verified.');
      }

      // Unexpected error
      throw new InternalServerErrorException({
        message: 'Failed to resend verification email.',
        details: errorMessage,
      });
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppVersionGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 attempts per 15 minutes
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

**Rate Limiting:** 10 attempts per 15 minutes per IP

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
  @ApiForbiddenResponse({
    description: 'Account locked due to suspicious activity or too many failed attempts',
  })
  @ApiUnauthorizedResponse({ description: 'Email not verified' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  async login(
    @Body() loginDto: LoginDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponse> {
    const requestInfo = {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.get('User-Agent') ?? 'unknown',
    };

    // All security checks (IP block, suspicious activity, attempt limits)
    // and credential verification live in AuthService — controller is routing only.
    const loginResponse = await this.authService.login(loginDto, requestInfo);

    if (loginResponse.requiresMFA === true) {
      return loginResponse;
    }

    if (!loginResponse.user || !loginResponse.tokens) {
      throw new InternalServerErrorException(
        'Login failed to return the required user session data.',
      );
    }

    // Create session with device tracking
    const sessionInfo = await this.sessionManagementService.createSession({
      userId: loginResponse.user.userId,
      userAgent: requestInfo.userAgent,
      ipAddress: requestInfo.ipAddress,
      rememberMe: loginDto.rememberMe ?? false,
    });

    this.setAuthCookies(res, loginResponse.tokens, sessionInfo.sessionId, loginDto.rememberMe);

    return {
      ...loginResponse,
      sessionId: sessionInfo.sessionId,
      deviceInfo: {
        deviceName: sessionInfo.deviceInfo.deviceName,
        platform: sessionInfo.deviceInfo.platform,
        browser: sessionInfo.deviceInfo.browser,
      },
    };
  }

  @Post('google')
  @Public()
  @HttpCode(HttpStatus.OK)
  @UseGuards(AppVersionGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Sign in or register with Google ID token' })
  async googleSignIn(
    @Body() dto: GoogleAuthDto,
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponse> {
    const requestInfo = {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.get('User-Agent') ?? 'unknown',
    };

    const result = await this.googleAuthService.signIn(dto.idToken, requestInfo, dto.referralCode);

    const sessionInfo = await this.sessionManagementService.createSession({
      userId: result.user.userId,
      userAgent: requestInfo.userAgent,
      ipAddress: requestInfo.ipAddress,
      rememberMe: false,
    });

    this.setAuthCookies(res, result.tokens, sessionInfo.sessionId);

    return {
      success: true,
      message: 'Google Sign-In successful',
      user: result.user,
      tokens: result.tokens,
      sessionId: sessionInfo.sessionId,
    };
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 minutes
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    try {
      const result = await this.authService.forgotPassword(forgotPasswordDto);

      return {
        success: true,
        message: 'Password reset instructions sent successfully.',
        data: result ?? null,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : undefined;

      // Handle and rethrow specific error types for cleaner client responses
      if (errorName === 'UserNotFoundError') {
        throw new NotFoundException('No account found with the provided email.');
      }

      if (errorName === 'EmailSendError') {
        throw new InternalServerErrorException(
          'Failed to send reset email. Please try again later.',
        );
      }

      // Fallback for unexpected errors
      throw new InternalServerErrorException('An unexpected error occurred.');
    }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 300000 } }) // 5 attempts per 5 minutes
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    try {
      const result = await this.authService.resetPassword(resetPasswordDto);

      return {
        success: true,
        message: 'Password has been reset successfully.',
        data: result ?? null,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : undefined;
      const errorMessage = error instanceof Error ? error.message : undefined;

      this.logger.error('Password reset error', {
        errorName,
        errorMessage,
        email: resetPasswordDto.email,
      });

      // Re-throw all HTTP exceptions as-is (includes BadRequestException, NotFoundException, etc.)
      if (error instanceof HttpException) {
        throw error;
      }

      // Handle known custom error types for better client feedback
      if (errorName === 'InvalidOrExpiredTokenError') {
        throw new BadRequestException('The reset token is invalid or has expired.');
      }

      if (errorName === 'UserNotFoundError') {
        throw new NotFoundException('No user found for this token.');
      }

      if (errorName === 'PasswordPolicyError') {
        throw new BadRequestException(
          errorMessage ?? 'New password does not meet security requirements.',
        );
      }

      // Fallback: Unexpected failure
      throw new InternalServerErrorException('Failed to reset password. Please try again later.');
    }
  }

  @Post('refresh')
  @Public()
  @UseGuards(AppVersionGuard, AuthThrottlerGuard)
  @Throttle({ default: { limit: 120, ttl: 3600000 } }) // 120/hour — accounts for multi-tab (each tab refreshes every ~13min) + reactive 401 retries
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description: `Exchanges a valid refresh token for new access/refresh token pair.

**Token Rotation Security:**
- Old refresh token is IMMEDIATELY REVOKED after use
- New token pair is issued with fresh expiry times
- Prevents token replay attacks

**Rate Limiting:** 120 attempts per hour per IP+userId
- Prevents refresh token abuse
- Allows multi-tab usage (~8 tabs × 4 refreshes/hour + reactive retries)

**Mobile Support:**
- Send refresh token in request body: \`{ "refreshToken": "..." }\`
- Web apps can also use HTTP-only cookies`,
  })
  @ApiOkResponse({
    description: 'Tokens refreshed successfully',
    schema: {
      example: {
        message: 'Tokens refreshed successfully',
        tokens: {
          accessToken: 'eyJhbGciOiJIUzI1NiIs...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIs...',
          expiresIn: 900,
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Refresh token missing or invalid' })
  @ApiUnauthorizedResponse({ description: 'Refresh token expired or revoked' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded (10/hour)' })
  async refresh(
    @Request() req: ExpressRequest,
    @Body() body: { refreshToken?: string },
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const userAgent = req.get('User-Agent') ?? 'unknown';

    // ✅ Support both mobile (body) and web (cookies)
    // Priority: 1. Request body (mobile), 2. Cookies (web), 3. Header
    const cookieRefreshToken =
      typeof req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] === 'string'
        ? req.cookies[COOKIE_NAMES.REFRESH_TOKEN]
        : undefined;
    const userRefreshToken = (req.user as Record<string, unknown> | undefined)?.['refreshToken'];
    const refreshToken =
      body?.refreshToken ??
      cookieRefreshToken ??
      (typeof userRefreshToken === 'string' ? userRefreshToken : undefined);

    if (refreshToken === null || refreshToken === undefined) {
      this.logger.warn('Token refresh attempted without refresh token', { ip });
      throw new BadRequestException('Refresh token is required in request body or cookies');
    }

    // Validate and decode refresh token to get userId
    const decoded = await this.authService.validateRefreshToken(refreshToken);

    if (!decoded) {
      this.logger.warn('Token refresh failed - invalid/expired token', {
        ip,
        userAgent: userAgent.substring(0, 100),
      });
      throw new BadRequestException('Invalid or expired refresh token');
    }

    const tokens = await this.authService.refreshTokens(decoded.userId, refreshToken);

    // ✅ Security logging for audit trail
    this.logger.log('Tokens refreshed successfully', {
      userId: decoded.userId,
      ip,
    });

    // Set cookies for web compatibility — preserve rememberMe across rotation
    this.setAuthCookies(res, tokens, undefined, tokens.rememberMe);

    // ✅ Return tokens in response body for mobile app
    return {
      message: 'Tokens refreshed successfully',
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    };
  }

  /**
   * GRACEFUL LOGOUT ENDPOINT
   *
   * CRITICAL: This endpoint ALWAYS returns 200 OK regardless of token validity.
   *
   * Rationale (Industry Best Practice - Facebook, Google, Auth0):
   * - User's goal is "I want to be logged out"
   * - If token is valid → Invalidate it → Goal achieved → 200
   * - If token is invalid → Already invalid → Goal achieved → 200
   * - If token is missing → Nothing to invalidate → Goal achieved → 200
   * - If token is expired → Already unusable → Goal achieved → 200
   *
   * This prevents infinite loops in mobile apps where:
   * 401 → refresh fails → logout API → 401 → refresh fails → ...
   *
   * @security Logout is idempotent - calling it multiple times has same effect
   */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ success: boolean; message: string }> {
    const sessionId =
      typeof req.cookies?.[COOKIE_NAMES.SESSION_ID] === 'string'
        ? req.cookies[COOKIE_NAMES.SESSION_ID]
        : undefined;
    const refreshToken =
      typeof req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] === 'string'
        ? req.cookies[COOKIE_NAMES.REFRESH_TOKEN]
        : undefined;
    const userId = this.extractUserIdFromAuthHeader(req.headers.authorization);

    // Execute cleanup operations in parallel (fire-and-forget, ~2x faster)
    await Promise.allSettled([
      this.destroySessionSafely(sessionId),
      this.invalidateTokensSafely(userId, refreshToken),
    ]);
    this.clearCookiesSafely(res);

    return { success: true, message: 'Logout successful' };
  }

  /**
   * Extract user ID from Authorization header without verification.
   * Uses decode() not verify() - safe for expired/invalid tokens.
   */
  private extractUserIdFromAuthHeader(authHeader: string | undefined): string | undefined {
    if (authHeader?.startsWith('Bearer ') !== true) {
      return undefined;
    }

    try {
      const token = authHeader.substring(7);
      const decoded = this.jwtService.decode<unknown>(token);
      if (
        typeof decoded === 'object' &&
        decoded !== null &&
        'sub' in decoded &&
        typeof decoded.sub === 'string'
      ) {
        return decoded.sub;
      }
      return undefined;
    } catch (error) {
      this.logger.debug('Could not decode token during logout', {
        error: this.getErrorMessage(error),
      });
      return undefined;
    }
  }

  /**
   * Destroy session safely - never throws, logs errors.
   */
  private async destroySessionSafely(sessionId: string | undefined): Promise<void> {
    if (!sessionId) {
      return;
    }

    try {
      await this.sessionManagementService.destroySession(sessionId);
    } catch (error) {
      this.logger.warn('Failed to destroy session during logout', {
        sessionId,
        error: this.getErrorMessage(error),
      });
    }
  }

  /**
   * Invalidate tokens safely - never throws, logs errors.
   */
  private async invalidateTokensSafely(
    userId: string | undefined,
    refreshToken: string | undefined,
  ): Promise<void> {
    if (!userId) {
      this.logger.log('Logout: no valid token to invalidate');
      return;
    }

    try {
      await this.authService.logout(userId, refreshToken);
      this.logger.log('Logout: tokens invalidated', { userId });
    } catch (error) {
      this.logger.warn('Failed to invalidate tokens during logout', {
        userId,
        error: this.getErrorMessage(error),
      });
    }
  }

  /**
   * Clear auth cookies safely - never throws, logs errors.
   */
  private clearCookiesSafely(res: ExpressResponse): void {
    try {
      this.clearAuthCookies(res);
    } catch (error) {
      this.logger.warn('Failed to clear cookies during logout', {
        error: this.getErrorMessage(error),
      });
    }
  }

  /**
   * Extract error message from unknown error type.
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @Request() req: AuthenticatedRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ success: boolean; message: string }> {
    const userId = req.user.userId;

    this.logger.log('Logout from all devices initiated', { userId });

    // Terminate all user sessions and invalidate tokens
    await Promise.allSettled([
      this.sessionManagementService.destroyAllUserSessions(userId),
      this.authService.logout(userId, req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN]),
    ]);

    this.clearCookiesSafely(res);

    return { success: true, message: 'Logged out from all devices' };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getActiveSessions(@Request() req: AuthenticatedRequest) {
    const sessions = await this.sessionManagementService.getUserSessions(req.user.userId);

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
        isCurrentSession: session.sessionId === req.cookies?.[COOKIE_NAMES.SESSION_ID],
      })),
    };
  }

  @Post('terminate-session/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    // Verify the session belongs to the current user
    const userSessions = await this.sessionManagementService.getUserSessions(req.user.userId);
    const sessionExists = userSessions.some(session => session.sessionId === sessionId);

    if (!sessionExists) {
      throw new ForbiddenException('Session not found or does not belong to user');
    }

    await this.sessionManagementService.destroySession(sessionId);

    return {
      success: true,
      message: 'Session terminated successfully',
    };
  }

  @Get('me')
  @UseGuards(AppVersionGuard, JwtAuthGuard)
  async getProfile(@Request() req: AuthenticatedRequest) {
    const user = await this.usersService.findOne(req.user.userId);
    // findOne uses .lean() which skips toJSON virtuals, so _id is a raw ObjectId that
    // serialises to a string — but the frontend UserResponse type expects `userId`.
    // Inject it here so the field is always present regardless of the lean shortcut.
    return { ...user, userId: req.user.userId };
  }

  /**
   * SELF-DELETE ACCOUNT
   *
   * Allows authenticated users to soft-delete their own account.
   * - Soft-deletes user (GDPR-compliant, data retained for legal period)
   * - Destroys all active sessions
   * - Clears auth cookies
   *
   * @security Requires valid JWT. User can only delete their own account.
   */
  @Delete('me')
  @UseGuards(AppVersionGuard, JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete own account (self-service)',
    description:
      "Soft-deletes the authenticated user's account, destroys all sessions, and clears cookies.",
  })
  @ApiOkResponse({
    description: 'Account deleted successfully',
    schema: {
      example: {
        success: true,
        message: 'Account deleted successfully',
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing JWT token' })
  async deleteAccount(
    @Request() req: ExpressRequest,
    @Body() body: { reason?: string },
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<{ success: boolean; message: string }> {
    const userId = (req.user as { userId: string }).userId;
    const reason = body?.reason ?? 'User requested account deletion';
    const ipAddress = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const userAgent = req.get('User-Agent') ?? 'unknown';

    this.logger.log('Account self-deletion initiated', { userId, reason });

    try {
      // 1. Soft-delete user (sets status=DELETED, invalidates tokens, appends audit log)
      await this.usersService.softDelete(userId, reason, { ipAddress, userAgent });

      // 2. Destroy all active sessions for this user
      await this.sessionManagementService.destroyAllUserSessions(userId);

      // 3. Clear auth cookies
      this.clearAuthCookies(res);

      this.logger.log('Account self-deletion completed', { userId });

      return { success: true, message: 'Account deleted successfully' };
    } catch (error) {
      this.logger.error('Account self-deletion failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to delete account. Please try again.');
    }
  }

  @Get('csrf-token')
  @Public()
  @HttpCode(HttpStatus.OK)
  getCsrfToken(@Response({ passthrough: true }) res: ExpressResponse) {
    const { token, expiresAt } = this.csrfService.generateToken();
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, {
      // nosemgrep: tftw-cookie-missing-httponly
      httpOnly: false, // Frontend needs to read this
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    return {
      token,
      expiresAt,
      message: 'CSRF token generated successfully',
    };
  }

  @Post('check-password-strength')
  @Public()
  @HttpCode(HttpStatus.OK)
  checkPasswordStrength(
    @Body() body: { password: string; email?: string; firstName?: string; lastName?: string },
  ) {
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
  // Anonymous, and every call runs a CSPRNG draw plus a zxcvbn analysis. Without
  // a limit it is a free CPU sink for any caller on the internet.
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @HttpCode(HttpStatus.OK)
  generateSecurePassword(@Body() body: GeneratePasswordDto) {
    const length = body.length ?? 16;
    const password = this.passwordPolicyService.generateSecurePassword(length);

    return {
      success: true,
      password,
      strength: this.passwordPolicyService.validatePassword(password),
    };
  }

  @Post('force-password-change')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async forcePasswordChange(
    @Request() req: AuthenticatedRequest,
    @Body() dto: ForcePasswordChangeDto,
  ) {
    const result = await this.authService.forcePasswordChange(req.user.userId, dto.newPassword);
    return {
      status: 'success',
      message: 'Password changed successfully',
      data: result,
    };
  }

  // MFA Endpoints
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async setupMfa(@Request() req: AuthenticatedRequest) {
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
  async verifyMfaSetup(@Request() req: AuthenticatedRequest, @Body() body: { token: string }) {
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
  @Throttle({ default: { limit: 10, ttl: 300000 } })
  @HttpCode(HttpStatus.OK)
  async verifyMfa(
    @Body() body: { mfaToken: string; code: string },
    @Request() req: ExpressRequest,
    @Response({ passthrough: true }) res: ExpressResponse,
  ): Promise<LoginResponse> {
    let payload: { sub?: string; purpose?: string };
    try {
      payload = this.jwtService.verify<{ sub?: string; purpose?: string }>(body.mfaToken);
    } catch {
      throw new BadRequestException('Your verification session has expired. Please sign in again.');
    }

    if (payload.purpose !== 'mfa' || !payload.sub) {
      throw new BadRequestException('Your verification session has expired. Please sign in again.');
    }

    const userId = payload.sub;
    const result = await this.mfaService.verifyTotp(userId, body.code);

    if (!result.isValid) {
      throw new BadRequestException('The verification code is incorrect. Please try again.');
    }

    const requestInfo = {
      ipAddress: req.ip ?? req.socket?.remoteAddress ?? 'unknown',
      userAgent: req.get('User-Agent') ?? 'unknown',
    };

    const loginResponse = await this.authService.completeMfaLogin(userId, requestInfo);

    if (!loginResponse.tokens) {
      throw new InternalServerErrorException('Something went wrong. Please try again.');
    }

    const sessionInfo = await this.sessionManagementService.createSession({
      userId,
      userAgent: requestInfo.userAgent,
      ipAddress: requestInfo.ipAddress,
      rememberMe: false,
    });

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
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disableMfa(@Request() req: AuthenticatedRequest, @Body() body: { token: string }) {
    await this.mfaService.disableMfa(req.user.userId, body.token);

    return {
      success: true,
      message: 'MFA has been disabled for your account',
    };
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  async getMfaStatus(@Request() req: AuthenticatedRequest) {
    const status = await this.mfaService.getMfaStatus(req.user.userId);

    return {
      success: true,
      mfa: status,
    };
  }

  @Post('mfa/backup-codes/regenerate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async regenerateBackupCodes(@Request() req: AuthenticatedRequest) {
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
  async generateEmergencyTokens(@Request() req: AuthenticatedRequest) {
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
  private setAuthCookies(
    res: ExpressResponse,
    tokens: { accessToken: string; refreshToken: string },
    sessionId?: string,
    rememberMe?: boolean,
  ) {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const domain = this.configService.get<string>('COOKIE_DOMAIN');

    try {
      // ✓ CRITICAL: Set access token with enterprise-grade security
      CookieSecurityUtil.setAccessTokenCookie(
        res,
        tokens.accessToken,
        isProduction,
        domain,
        15 * 60 * 1000, // 15 minutes (short-lived)
      );

      // ✓ CRITICAL: Set refresh token with maximum security
      // Cookie maxAge must be >= JWT lifetime so the browser doesn't discard
      // a still-valid token. Token is revocable server-side on logout/password-change.
      const refreshMaxAge =
        rememberMe === true
          ? 365 * 24 * 60 * 60 * 1000 // 365 days — matches JWT_REFRESH_REMEMBER_ME_EXPIRES_IN
          : 30 * 24 * 60 * 60 * 1000; // 30 days — matches default JWT_REFRESH_EXPIRES_IN
      CookieSecurityUtil.setRefreshTokenCookie(
        res,
        tokens.refreshToken,
        isProduction,
        domain,
        refreshMaxAge,
      );

      // ✓ Set session cookie if provided
      if (sessionId) {
        CookieSecurityUtil.setSessionCookie(
          res,
          sessionId,
          isProduction,
          domain,
          365 * 24 * 60 * 60 * 1000, // 365 days — matches refresh token lifetime
        );
      }

      this.logger.log('Authentication cookies set with enterprise-grade security', {
        hasAccessToken: !!tokens.accessToken,
        hasRefreshToken: !!tokens.refreshToken,
        hasSession: !!sessionId,
        isProduction,
        domain: domain ?? 'current-domain-only',
        securityAttributes: {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
        },
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
      res.clearCookie(COOKIE_NAMES.SESSION_ID, sessionOptions);

      this.logger.log('Authentication cookies cleared securely', {
        isProduction,
        domain: domain ?? 'current-domain-only',
      });
    } catch (error) {
      this.logger.error('Failed to clear cookies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Don't throw error - logout should succeed even if cookie clearing fails
    }
  }
}
