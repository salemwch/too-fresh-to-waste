import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

interface JwtRefreshPayload {
    sub: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromExtractors([
                (request: Request) => {
                    return request?.cookies?.['refresh_token'];
                },
            ]),
            secretOrKey: configService.get<string>('JWT_REFRESH_SECRET'),
            passReqToCallback: true,
        });
    }

    validate(req: Request, payload: JwtRefreshPayload) {
        const refreshToken = req.cookies?.['refresh_token'];


        if (!refreshToken) {
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
