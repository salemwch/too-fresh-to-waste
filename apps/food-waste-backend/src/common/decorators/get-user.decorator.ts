import { createParamDecorator } from '@nestjs/common';

import type { UserRole } from '../enums/user.enum';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

/**
 * Express Request extended with the authenticated user payload.
 * Use this as the type for `@Request() req` parameters in controllers
 * that sit behind JwtAuthGuard.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export const GetUser = createParamDecorator(
  (data: keyof AuthUser | 'id' | undefined, ctx: ExecutionContext): AuthUser | string | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (!user) {
      return null;
    }

    // If 'id' is requested (common alias for userId), return userId
    if (data === 'id') {
      return user.userId;
    }

    // If specific property is requested, return that property
    if (data && typeof data === 'string' && data in user) {
      return user[data];
    }

    // Return the entire user object
    return user;
  },
);
