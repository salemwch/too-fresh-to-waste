import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

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

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
            context.getHandler(),
            context.getClass(),
        ]);
        if (isPublic) {return true;} // skip JWT check
        return super.canActivate(context);
    }

    handleRequest<TUser = JwtUser>(err: JwtError | null, user: JwtUser | null, _info: unknown, _context: ExecutionContext): TUser {
        if (err || !user) {
            throw err || new UnauthorizedException('Invalid or expired token');
        }
        return user as TUser;
    }
}
