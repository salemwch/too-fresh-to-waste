import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

export interface JwtUser {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface JwtError extends Error {
  name: string;
  message: string;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      // Attempt to populate req.user when a valid token is present.
      // Failures are silently swallowed — public routes must never reject
      // solely because a token is missing or stale.
      try {
        await super.canActivate(context);
      } catch {
        // no-op: no valid token, req.user stays undefined
      }
      return true;
    }
    return super.canActivate(context) as Promise<boolean>;
  }

  override handleRequest<TUser = JwtUser>(
    err: JwtError | null,
    user: JwtUser | null,
    _info: unknown,
    _context: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or expired token');
    }
    return user as TUser;
  }
}
