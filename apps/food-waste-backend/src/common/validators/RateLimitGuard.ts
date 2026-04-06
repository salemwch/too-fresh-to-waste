import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

import { TooManyRequestsException } from './to-many-request.exeptition';

import type { Request } from 'express';

interface RequestRecord {
  count: number;
  expiresAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly requests = new Map<string, RequestRecord>();

  private readonly maxRequests = 10; // e.g. 10 requests
  private readonly ttlSeconds = 60; // per 1 minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = request.ip ?? 'unknown';

    const now = Date.now();
    const record = this.requests.get(ip);

    if (!record || record.expiresAt < now) {
      this.requests.set(ip, {
        count: 1,
        expiresAt: now + this.ttlSeconds * 1000,
      });
      return true;
    }

    if (record.count >= this.maxRequests) {
      throw new TooManyRequestsException(
        `Rate limit exceeded. Try again after ${Math.ceil(
          (record.expiresAt - now) / 1000,
        )} seconds`,
      );
    }

    record.count++;
    this.requests.set(ip, record);
    return true;
  }
}
