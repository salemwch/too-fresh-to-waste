import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { COOKIE_NAMES } from 'src/common/utils/cookie-security.util';

import { appError } from '../../common/errors';
interface JwtRefreshPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request): string | null => {
          const cookies: unknown = request.cookies;
          if (cookies === null || cookies === undefined || typeof cookies !== 'object') {
            return null;
          }

          const refreshToken = (cookies as Record<string, unknown>)[COOKIE_NAMES.REFRESH_TOKEN];
          return typeof refreshToken === 'string' ? refreshToken : null;
        },
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      algorithms: ['HS256'] as const,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken =
      typeof req.cookies?.[COOKIE_NAMES.REFRESH_TOKEN] === 'string'
        ? req.cookies[COOKIE_NAMES.REFRESH_TOKEN]
        : undefined;

    if (refreshToken === null || refreshToken === undefined) {
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
