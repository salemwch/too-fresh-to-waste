import { Controller, Get, Query, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';

import { CookieSecurityUtil } from '../common/utils/cookie-security.util';

import { AuthService } from './auth.service';

/**
 * AuthRedirectController
 *
 * Browser-based email verification endpoint. Verifies server-side and
 * 302-redirects to the Next.js frontend. No HTML is rendered here — the
 * frontend owns all UI.
 *
 * Flow:
 *   1. User clicks email link → GET /api/v1/auth/verify-email?token=...
 *   2. Controller verifies token, issues auth cookies
 *   3. 302 redirect → WEB_FRONTEND_URL/verify-email?status=success
 *      (or ?status=error on failure — Next.js page reads this)
 *
 * Mobile deep links (verify-email, reset-password) are handled by Android
 * App Links and iOS Universal Links — they point directly to the frontend
 * domain and the OS opens the app natively.
 */
@ApiTags('auth-redirect')
@Controller('auth')
export class AuthRedirectController {
  private readonly logger = new Logger(AuthRedirectController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  private sanitizeToken(token: string): string {
    return token.replace(/[^a-zA-Z0-9\-_.=]/g, '');
  }

  private getWebFrontendUrl(): string {
    const url = this.configService.get<string>('WEB_FRONTEND_URL');
    return url && url.trim().length > 0 ? url.replace(/\/$/, '') : 'http://localhost:3001';
  }

  private redirectToFrontend(res: Response, path: string, status: 'success' | 'error'): void {
    const target = `${this.getWebFrontendUrl()}${path}?status=${status}`;
    res.redirect(302, target);
  }

  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email via link and redirect to frontend',
    description:
      'Verifies the hashed token server-side, sets HttpOnly auth cookies on success, and 302-redirects to the Next.js /verify-email page.',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Email verification token' })
  async verifyEmailRedirect(
    @Query('token') rawToken: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    if (!rawToken || typeof rawToken !== 'string') {
      this.logger.warn('verify-email redirect called without token');
      this.redirectToFrontend(res, '/verify-email', 'error');
      return;
    }

    const token = this.sanitizeToken(rawToken);

    try {
      const result = await this.authService.verifyEmailByToken(token);

      if (result.tokens) {
        const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
        const domain = this.configService.get<string>('COOKIE_DOMAIN');

        CookieSecurityUtil.setAccessTokenCookie(
          res,
          result.tokens.accessToken,
          isProduction,
          domain,
          15 * 60 * 1000,
        );
        CookieSecurityUtil.setRefreshTokenCookie(
          res,
          result.tokens.refreshToken,
          isProduction,
          domain,
          365 * 24 * 60 * 60 * 1000,
        );
      }

      this.logger.log('Email verified via GET redirect', { userId: result.user?.userId });
      this.redirectToFrontend(res, '/verify-email', 'success');
    } catch (error) {
      this.logger.warn('Email verification via GET redirect failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      this.redirectToFrontend(res, '/verify-email', 'error');
    }
  }
}
