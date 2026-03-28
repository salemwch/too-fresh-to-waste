import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

@Injectable()
export class PaymentSecurityMiddleware implements NestMiddleware {
  private readonly paymentRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Too many payment requests from this IP, please try again later',
  });

  use(req: Request, res: Response, next: NextFunction): void {
    // Apply rate limiting for payment endpoints
    if (req.path.includes('/payments') && req.method === 'POST') {
      this.paymentRateLimit(req, res, next);
      return;
    }

    // Validate request size for payment data
    if (req.path.includes('/payments') && req.body) {
      const bodySize = JSON.stringify(req.body).length;
      if (bodySize > 50000) {
        // 50KB limit
        throw new BadRequestException('Request payload too large');
      }
    }

    next();
  }
}
