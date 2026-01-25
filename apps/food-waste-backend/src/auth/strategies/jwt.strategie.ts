import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
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
                ExtractJwt.fromAuthHeaderAsBearerToken(),  // Mobile: Authorization header
                (request: Request) => {
                    return request?.cookies?.['access_token'];  // Web: Cookie fallback
                },
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
        });
    }

    async validate(payload: JwtPayload) {
        const user = await this.usersService.findByEmail(payload.email);

        if (!user || user.status !== 'active') {
            throw new UnauthorizedException('User not found or inactive');
        }

        return {
            userId: payload.sub,
            email: payload.email,
            role: payload.role,
        };
    }
}