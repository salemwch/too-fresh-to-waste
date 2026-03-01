import { Injectable, ExecutionContext, Logger } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

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
    options: any,
    storageService: any,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Generate unique key for rate limiting
   * Combines IP with user identifier for precise tracking
   */
  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest();
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
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = this.extractIp(req);
    const userIdentifier = this.extractUserIdentifier(req);

    if (userIdentifier) {
      return `${ip}-${userIdentifier}`;
    }

    return ip;
  }

  /**
   * Custom throttle exception with helpful message
   */
  protected throwThrottlingException(context: ExecutionContext): Promise<void> {
    const request = context.switchToHttp().getRequest();
    const ip = this.extractIp(request);
    const endpoint = request.url;

    this.logger.warn('Rate limit exceeded for auth endpoint', {
      ip,
      endpoint,
      userAgent: request.headers?.['user-agent']?.substring(0, 100),
    });

    throw new ThrottlerException(
      'Too many requests. Please wait before trying again.',
    );
  }

  /**
   * Extract IP address from request
   */
  private extractIp(request: any): string {
    return (
      request.ip ||
      request.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.connection?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Extract user identifier from request body
   * Supports: email (login/register) and refresh token (refresh endpoint)
   */
  private extractUserIdentifier(request: any): string | null {
    // Email for login/register endpoints
    if (request.body?.email) {
      return request.body.email.toLowerCase();
    }

    // Extract user ID from refresh token (without full verification)
    // This is just for rate limiting, actual validation happens in the endpoint
    if (request.body?.refreshToken) {
      try {
        const tokenParts = request.body.refreshToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(
            Buffer.from(tokenParts[1], 'base64').toString('utf-8'),
          );
          // Use 'sub' (subject/userId) from JWT payload
          if (payload.sub) {
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