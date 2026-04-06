import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ThrottlerGuard,
  ThrottlerModuleOptions,
  ThrottlerStorage,
  ThrottlerLimitDetail,
} from '@nestjs/throttler';
import { Request } from 'express';

/**
 * PickupThrottlerGuard
 *
 * Stricter rate limiting specifically for pickup validation endpoint.
 * Prevents brute-force attacks on 6-digit pickup codes.
 *
 * Tracking key: IP + OrderId + UserId
 * This ensures:
 * - Same user can't spam attempts on one order
 * - Same IP can't try multiple orders rapidly
 * - Different users/IPs don't affect each other's limits
 *
 * Default limit: 5 requests per 60 seconds per order
 */
@Injectable()
export class PickupThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  private getNonEmptyString(value: string | undefined, fallback: string): string {
    return value !== null && value !== undefined && value.length > 0 ? value : fallback;
  }

  /**
   * Generate a unique key for rate limiting
   * Combines IP + OrderId + UserId for precise tracking
   */
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    // Cast to typed Express Request for safe property access
    const request = req as unknown as Request & { user?: { userId?: string } };
    const ip = this.getNonEmptyString(request.ip ?? request.socket?.remoteAddress, 'unknown');
    const userId = this.getNonEmptyString(request.user?.userId, 'anonymous');
    const orderId = request.params?.['id'] ?? 'unknown';

    // Key format: pickup-{ip}-{orderId}-{userId}
    const key = await Promise.resolve(`pickup-${ip}-${orderId}-${userId}`);
    return key;
  }

  /**
   * Override to provide custom error message
   */
  protected override async getErrorMessage(
    _context: ExecutionContext,
    _throttlerLimitDetail: ThrottlerLimitDetail,
  ): Promise<string> {
    const msg = await Promise.resolve(
      'Too many pickup attempts. Please wait before trying again. If you need assistance, contact the merchant directly.',
    );
    return msg;
  }
}
