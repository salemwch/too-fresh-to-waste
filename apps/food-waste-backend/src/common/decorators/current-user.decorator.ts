import { createParamDecorator } from '@nestjs/common';

import type { UserRole } from '@foodwaste/shared';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

type CurrentUserField = '_id' | 'id' | 'userId' | 'email' | 'role';

interface CurrentUserPayload {
  _id?: string;
  id?: string;
  userId?: string;
  email?: string;
  role?: UserRole;
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
