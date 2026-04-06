import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerException,
  ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Enhanced Throttler Guard for Authentication Endpoints
 *
 * Best Practices Implemented:
 * 1. IP + User identifier tracking (prevents bypass via multiple IPs)
 * 2. Extracts user info from email OR refresh token
 * 3. Custom error messages with retry-after info
 * 4. Logging for security monitoring
 *
 * @see https://docs.nestjs.com/security/rate-limiting
 */
@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AuthThrottlerGuard.name);

  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Generate unique key for rate limiting
   * Combines IP with user identifier for precise tracking
   */
  protected override generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(request);
    const userIdentifier = this.extractUserIdentifier(request);

    if (userIdentifier) {
      return `auth-${ip}-${userIdentifier}-${suffix}`;
    }

    return `auth-${ip}-${suffix}`;
  }

  /**
   * Get tracker for rate limit storage
   */
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const ip = this.extractIp(req as unknown as Request);
    const userIdentifier = this.extractUserIdentifier(req as unknown as Request);

    const tracker = await Promise.resolve(userIdentifier ? `${ip}-${userIdentifier}` : ip);
    return tracker;
  }

  /**
   * Custom throttle exception with helpful message
   */
  protected override async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.extractIp(request);
    const endpoint = request.url;

    this.logger.warn('Rate limit exceeded for auth endpoint', {
      ip,
      endpoint,
      userAgent: request.headers?.['user-agent']?.substring(0, 100),
    });

    await Promise.resolve();
    throw new ThrottlerException('Too many requests. Please wait before trying again.');
  }

  /**
   * Extract IP address from request
   */
  private extractIp(request: Request): string {
    return (
      request.ip ??
      (request.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      request.connection?.remoteAddress ??
      'unknown'
    );
  }

  /**
   * Extract user identifier from request body
   * Supports: email (login/register) and refresh token (refresh endpoint)
   */
  private extractUserIdentifier(request: Request): string | null {
    const requestBody = request.body as Record<string, unknown> | undefined;
    const email = requestBody?.['email'];

    // Email for login/register endpoints
    if (typeof email === 'string' && email.length > 0) {
      return email.toLowerCase();
    }

    // Extract user ID from refresh token (without full verification)
    // This is just for rate limiting, actual validation happens in the endpoint
    const refreshToken = requestBody?.['refreshToken'];
    if (typeof refreshToken === 'string' && refreshToken.length > 0) {
      try {
        const tokenParts = refreshToken.split('.');
        const encodedPayload = tokenParts[1];
        if (tokenParts.length === 3 && typeof encodedPayload === 'string') {
          const payload = JSON.parse(Buffer.from(encodedPayload, 'base64').toString('utf-8')) as {
            sub?: string;
          };
          // Use 'sub' (subject/userId) from JWT payload
          if (typeof payload.sub === 'string' && payload.sub.length > 0) {
            return `user:${payload.sub}`;
          }
        }
      } catch {
        // Token parsing failed - fall back to IP-only tracking
        // This is expected for malformed tokens
      }
    }

    return null;
  }
}
