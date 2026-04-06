import { UserStatus } from '@foodwaste/shared';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { UsersService } from 'src/users/user.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    readonly configService: ConfigService,
    readonly usersService: UsersService,
  ) {
    super({
      // ✅ Priority: Authorization header FIRST (mobile), then cookies (web)
      // This ensures mobile apps don't accidentally use stale cookies
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(), // Mobile: Authorization header
        (request: Request): string | null => {
          const cookies: unknown = request.cookies;
          if (cookies === null || cookies === undefined || typeof cookies !== 'object') {
            return null;
          }

          const accessToken = (cookies as Record<string, unknown>)['access_token'];
          return typeof accessToken === 'string' ? accessToken : null;
        }, // Web: Cookie fallback
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findByEmail(payload.email);

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
