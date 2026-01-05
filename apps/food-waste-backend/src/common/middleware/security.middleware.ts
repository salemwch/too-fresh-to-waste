import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class SecurityMiddleware implements NestMiddleware {
    use(req: Request, res: Response, next: NextFunction) {
        // Remove X-Powered-By header
        res.removeHeader('X-Powered-By');

        // Add security headers
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'geolocation=(self), microphone=(), camera=()');

        // Strict Transport Security (HTTPS only)
        if (req.secure) {
            res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
        }

        next();
    }
}