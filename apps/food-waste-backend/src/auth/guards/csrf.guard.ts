import * as crypto from 'crypto';

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';

export const CSRF_EXEMPT_KEY = 'csrf_exempt';
export const CsrfExempt = () =>
  Reflector.createDecorator<boolean>({
    key: CSRF_EXEMPT_KEY,
  });

@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly csrfTokenSecret: string;

  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    this.csrfTokenSecret =
      this.configService.get<string>('CSRF_SECRET') || 'default-csrf-secret-change-in-production';
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    // Check if endpoint is exempt from CSRF protection
    const isExempt = this.reflector.getAllAndOverride<boolean>(CSRF_EXEMPT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isExempt) {
      return true;
    }

    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    // Skip CSRF for API requests with valid bearer tokens (for mobile apps)
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return true;
    }

    try {
      // Generate and set CSRF token for GET requests
      if (request.method === 'GET') {
        const csrfToken = this.generateCsrfToken();
        response.cookie('csrf-token', csrfToken, {
          httpOnly: false, // Frontend needs to read this
          secure: this.configService.get<string>('NODE_ENV') === 'production',
          sameSite: 'strict',
          maxAge: 60 * 60 * 1000, // 1 hour
        });
        return true;
      }

      // Verify CSRF token for state-changing requests
      const csrfTokenFromHeader = request.headers['x-csrf-token'] as string;
      const csrfTokenFromBody = request.body?.csrfToken;
      const csrfTokenFromCookie = request.cookies?.['csrf-token'];

      const providedToken = csrfTokenFromHeader || csrfTokenFromBody;

      if (!providedToken || !csrfTokenFromCookie) {
        this.logger.warn(
          `CSRF token missing - IP: ${request.ip}, Method: ${request.method}, URL: ${request.url}`,
        );
        throw new ForbiddenException('CSRF token required');
      }

      if (!this.validateCsrfToken(providedToken, csrfTokenFromCookie)) {
        this.logger.warn(
          `Invalid CSRF token - IP: ${request.ip}, Method: ${request.method}, URL: ${request.url}`,
        );
        throw new ForbiddenException('Invalid CSRF token');
      }

      return true;
    } catch (error) {
      this.logger.error('CSRF validation error:', error);
      throw new ForbiddenException('CSRF validation failed');
    }
  }

  private generateCsrfToken(): string {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const data = `${timestamp}:${randomBytes}`;
    const signature = crypto.createHmac('sha256', this.csrfTokenSecret).update(data).digest('hex');

    return `${data}:${signature}`;
  }

  private validateCsrfToken(providedToken: string, cookieToken: string): boolean {
    try {
      // Both tokens should be identical
      if (providedToken !== cookieToken) {
        return false;
      }

      const parts = providedToken.split(':');
      if (parts.length !== 3) {
        return false;
      }

      const [timestamp = '', randomBytes = '', signature = ''] = parts;
      const data = `${timestamp}:${randomBytes}`;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.csrfTokenSecret)
        .update(data)
        .digest('hex');

      if (signature !== expectedSignature) {
        return false;
      }

      // Check token age (1 hour expiry)
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      const maxAge = 60 * 60 * 1000; // 1 hour

      if (tokenAge > maxAge) {
        this.logger.warn('CSRF token expired');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CSRF token validation error:', error);
      return false;
    }
  }
}
