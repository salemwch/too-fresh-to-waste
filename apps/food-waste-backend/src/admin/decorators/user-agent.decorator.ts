import { createParamDecorator } from '@nestjs/common';

import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export const UserAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request: Request = ctx.switchToHttp().getRequest();
  return request.headers['user-agent'] ?? 'Unknown';
});
