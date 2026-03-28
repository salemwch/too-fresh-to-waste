import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const IpAddress = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request: Request = ctx.switchToHttp().getRequest();

  const ip =
    request.headers['x-forwarded-for'] ||
    request.headers['x-real-ip'] ||
    request.headers['x-client-ip'] ||
    request.socket.remoteAddress ||
    '0.0.0.0';

  // Handle comma-separated IPs (x-forwarded-for can contain multiple IPs)
  return (
    (Array.isArray(ip) ? (ip[0] ?? '0.0.0.0') : ip.toString()).split(',')[0]?.trim() ?? '0.0.0.0'
  );
});
