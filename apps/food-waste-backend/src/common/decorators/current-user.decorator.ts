import { createParamDecorator } from '@nestjs/common';

import type { UserRole } from '@foodwaste/shared';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Must match the object returned by JwtStrategy.validate() exactly.
// Using a field not in this list is a compile-time error.
type CurrentUserField = 'userId' | 'email' | 'role' | 'organizationId' | 'assignedEstablishmentId';

interface CurrentUserPayload {
  userId?: string;
  email?: string;
  role?: UserRole;
  organizationId?: string;
  assignedEstablishmentId?: string;
}

type RequestWithCurrentUser = Request & {
  user?: CurrentUserPayload;
};

type CurrentUserValue = CurrentUserPayload | CurrentUserPayload[CurrentUserField] | undefined;

export const CurrentUser = createParamDecorator(
  (data: CurrentUserField | undefined, ctx: ExecutionContext): CurrentUserValue => {
    const request = ctx.switchToHttp().getRequest<RequestWithCurrentUser>();
    const user = request.user;

    return data === null || data === undefined ? user : user?.[data];
  },
);
