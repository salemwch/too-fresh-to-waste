import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
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
      return user[data as keyof AuthUser];
    }

    // Return the entire user object
    return user;
  },
);