import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

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

          const refreshToken = (cookies as Record<string, unknown>)['refresh_token'];
          return typeof refreshToken === 'string' ? refreshToken : null;
        },
      ]),
      secretOrKey: configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload) {
    const refreshToken =
      typeof req.cookies?.['refresh_token'] === 'string' ? req.cookies['refresh_token'] : undefined;

    if (refreshToken === null || refreshToken === undefined) {
      throw new UnauthorizedException('Refresh token not found');
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      refreshToken,
    };
  }
}
