import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: any,
    storageService: any,
    reflector: Reflector,
  ) {
    super(options, storageService, reflector);
  }

  protected generateKey(context: ExecutionContext, suffix: string): string {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.connection?.remoteAddress || 'unknown';

    // For auth endpoints, include both IP and email if available
    if (request.body?.email) {
      return `${ip}-${request.body.email}-${suffix}`;
    }

    return `${ip}-${suffix}`;
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';

    // Enhanced tracking for auth endpoints
    if (req.body?.email) {
      return `${ip}-${req.body.email}`;
    }

    return ip;
  }
}