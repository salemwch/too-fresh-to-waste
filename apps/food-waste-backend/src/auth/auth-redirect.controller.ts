import { Controller, Get, Query, Req, Res, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { CookieSecurityUtil } from '../common/utils/cookie-security.util';

import { AuthService } from './auth.service';

/**
 * AuthRedirectController
 *
 * Email-link handlers. Verifies server-side and 302-redirects to the Next.js
 * frontend. No HTML is rendered here — the frontend owns all UI.
 *
 * Flow (verify-email):
 *   1. User clicks email link → GET /api/v1/auth/verify-email?token=...
 *   2. Controller verifies token, issues auth cookies
 *   3. 302 redirect → WEB_FRONTEND_URL/verify-email?status=success
 *      (or ?status=error on failure — Next.js page reads this)
 */
@ApiTags('auth-redirect')
@Controller('auth')
export class AuthRedirectController {
  private readonly logger = new Logger(AuthRedirectController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Strip any characters that aren't valid in opaque hex/base64/JWT tokens.
   * The DB lookup hashes the token, so any tampered value will fail to match.
   */
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

  private getClientPlatform(req: Request): 'android' | 'ios' | 'other' {
    const userAgentHeader = req.headers['user-agent'];
    const ua = Array.isArray(userAgentHeader) ? userAgentHeader.join(' ') : (userAgentHeader ?? '');

    if (/Android/i.test(ua)) {
      return 'android';
    }

    if (/iPhone|iPad|iPod/i.test(ua)) {
      return 'ios';
    }

    return 'other';
  }

  /**
   * Smart email-link redirect (Brevo tracking bypass).
   *
   * Brevo rewrites all links through its tracking domain, which breaks Android
   * App Links. By routing the email link through the backend first, we can
   * send Android users to an intent URI with a web fallback, while iOS and
   * desktop continue through the web verification page.
   *
   * The token is NOT consumed here — the actual verification + auto-login
   * happens client-side via POST /auth/verify-email.
   */
  @Get('email-link')
  @ApiOperation({
    summary: 'Smart redirect for email verification links',
    description:
      'Sends Android users to an intent URI with browser fallback, and routes iOS/desktop users to the web frontend. Does not verify the token.',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Email verification token' })
  emailLinkRedirect(
    @Query('token') rawToken: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    if (!rawToken || typeof rawToken !== 'string') {
      this.logger.warn('email-link redirect called without token');
      this.redirectToFrontend(res, '/verify-email', 'error');
      return;
    }

    const safeToken = encodeURIComponent(this.sanitizeToken(rawToken));

    const target = `${this.getWebFrontendUrl()}/verify-email?token=${safeToken}`;
    const platform = this.getClientPlatform(req);

    if (platform === 'android') {
      const webFallback = encodeURIComponent(target);
      // Android Intent URL with browser fallback for when the app isn't installed
      const intentUrl =
        `intent://verify-email?token=${safeToken}` +
        `#Intent;scheme=foodwaste;package=com.toofreshtowaste.app;` +
        `S.browser_fallback_url=${webFallback};end`;

      this.logger.log('Email link redirect → Android app intent');
      res.redirect(302, intentUrl);
      return;
    }

    this.logger.log(
      platform === 'ios'
        ? 'Email link redirect → iOS web verification fallback'
        : 'Email link redirect → web frontend',
    );
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
          7 * 24 * 60 * 60 * 1000,
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

  @Get('reset-password')
  @ApiOperation({ summary: 'Password reset link handler — forwards to frontend (no email in URL)' })
  @ApiQuery({ name: 'token', required: true, description: 'Password reset token' })
  resetPasswordRedirect(@Query('token') rawToken: string | undefined, @Res() res: Response): void {
    if (!rawToken || typeof rawToken !== 'string') {
      this.logger.warn('reset-password redirect called without token');
      res.redirect(302, `${this.getWebFrontendUrl()}/forgot-password?status=error`);
      return;
    }
    const safeToken = encodeURIComponent(this.sanitizeToken(rawToken));
    res.redirect(302, `${this.getWebFrontendUrl()}/reset-password?token=${safeToken}`);
  }
}
