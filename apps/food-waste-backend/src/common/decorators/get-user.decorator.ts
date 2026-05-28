import { createParamDecorator } from '@nestjs/common';

import type { UserRole } from '@foodwaste/shared';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  organizationId?: string;
  assignedEstablishmentId?: string;
}

/**
 * Express Request extended with the authenticated user payload.
 * Use this as the type for `@Request() req` parameters in controllers
 * that sit behind JwtAuthGuard.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

type RequestWithOptionalAuthUser = Request & {
  user?: AuthUser;
};

export const GetUser = createParamDecorator(
  (data: keyof AuthUser | 'id' | undefined, ctx: ExecutionContext): AuthUser | string | null => {
    const request = ctx.switchToHttp().getRequest<RequestWithOptionalAuthUser>();
    const user = request.user;

    if (user === null || user === undefined) {
      return null;
    }

    // If 'id' is requested (common alias for userId), return userId
    if (data === 'id') {
      return user.userId;
    }

    // If specific property is requested, return that property
    // Optional fields (organizationId, assignedEstablishmentId) may be undefined;
    // coerce to null to stay within the declared return type.
    if (data && typeof data === 'string' && data in user) {
      return user[data] ?? null;
    }

    // Return the entire user object
    return user;
  },
);
