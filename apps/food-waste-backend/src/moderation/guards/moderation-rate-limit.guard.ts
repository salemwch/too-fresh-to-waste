import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { TooManyRequestsException } from '../../common/validators/to-many-request.exeptition';

interface RequestRecord {
  count: number;
  expiresAt: number;
}

interface ModerationRateLimitUser {
  userId?: string;
  role?: string;
}

interface ModerationRateLimitRequest {
  user?: ModerationRateLimitUser;
  ip: string;
}

@Injectable()
export class ModerationReportRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RequestRecord>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ModerationRateLimitRequest>();
    const user = request.user;
    const ip = request.ip;

    // Create unique key combining user ID and IP for better tracking
    const key =
      typeof user?.userId === 'string' && user.userId.length > 0 ? `${user.userId}-${ip}` : ip;

    // Different rate limits based on user role
    const limits = this.getRateLimits(user?.role);
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || record.expiresAt < now) {
      this.requests.set(key, {
        count: 1,
        expiresAt: now + limits.windowMs,
      });
      return true;
    }

    if (record.count >= limits.maxRequests) {
      throw new TooManyRequestsException(
        `Rate limit exceeded for reporting. You can make ${limits.maxRequests} reports per ${Math.floor(limits.windowMs / 1000 / 60)} minutes. Try again after ${Math.ceil((record.expiresAt - now) / 1000)} seconds`,
      );
    }

    record.count++;
    this.requests.set(key, record);
    return true;
  }

  private getRateLimits(userRole?: string): { maxRequests: number; windowMs: number } {
    if (userRole === undefined) {
      return { maxRequests: 5, windowMs: 60 * 60 * 1000 }; // 5 reports per hour for regular users
    }

    switch (userRole) {
      case 'admin':
        return { maxRequests: 100, windowMs: 15 * 60 * 1000 }; // 100 reports per 15 minutes
      case 'moderator':
        return { maxRequests: 50, windowMs: 15 * 60 * 1000 }; // 50 reports per 15 minutes
      case 'merchant':
        return { maxRequests: 10, windowMs: 60 * 60 * 1000 }; // 10 reports per hour
    }

    return { maxRequests: 5, windowMs: 60 * 60 * 1000 }; // 5 reports per hour for regular users
  }
}

@Injectable()
export class ModerationActionRateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RequestRecord>();

  private readonly maxActions = 20; // Max 20 moderation actions
  private readonly windowMs = 60 * 1000; // per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ModerationRateLimitRequest>();
    const user = request.user;

    // Only track authenticated moderation staff
    if (user === null || user === undefined || !['admin', 'moderator'].includes(user.role ?? '')) {
      return true;
    }

    const userId = user.userId;
    if (typeof userId !== 'string' || userId.length === 0) {
      return true;
    }

    const key = userId;
    const now = Date.now();
    const record = this.requests.get(key);

    if (!record || record.expiresAt < now) {
      this.requests.set(key, {
        count: 1,
        expiresAt: now + this.windowMs,
      });
      return true;
    }

    if (record.count >= this.maxActions) {
      throw new TooManyRequestsException(
        `Moderation action rate limit exceeded. Maximum ${this.maxActions} actions per minute. Try again after ${Math.ceil((record.expiresAt - now) / 1000)} seconds`,
      );
    }

    record.count++;
    this.requests.set(key, record);
    return true;
  }
}
