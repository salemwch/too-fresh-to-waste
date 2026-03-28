import * as crypto from 'crypto';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface CsrfTokenResponse {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class CsrfService {
  private readonly logger = new Logger(CsrfService.name);
  private readonly csrfTokenSecret: string;
  private readonly tokenDuration = 60 * 60 * 1000; // 1 hour

  constructor(private readonly configService: ConfigService) {
    this.csrfTokenSecret =
      this.configService.get<string>('CSRF_SECRET') || 'default-csrf-secret-change-in-production';
  }

  generateToken(): CsrfTokenResponse {
    const timestamp = Date.now().toString();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const data = `${timestamp}:${randomBytes}`;
    const signature = crypto.createHmac('sha256', this.csrfTokenSecret).update(data).digest('hex');

    const token = `${data}:${signature}`;
    const expiresAt = new Date(Date.now() + this.tokenDuration);

    this.logger.debug(`Generated CSRF token expires at: ${expiresAt}`);

    return {
      token,
      expiresAt,
    };
  }

  validateToken(token: string): boolean {
    try {
      const parts = token.split(':');
      if (parts.length !== 3) {
        this.logger.warn('Invalid CSRF token format');
        return false;
      }

      const [timestamp = '', randomBytes = '', signature = ''] = parts;
      const data = `${timestamp}:${randomBytes}`;

      // Verify signature
      const expectedSignature = crypto
        .createHmac('sha256', this.csrfTokenSecret)
        .update(data)
        .digest('hex');

      if (signature !== expectedSignature) {
        this.logger.warn('CSRF token signature mismatch');
        return false;
      }

      // Check token age
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      if (tokenAge > this.tokenDuration) {
        this.logger.warn('CSRF token expired');
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('CSRF token validation error:', error);
      return false;
    }
  }

  refreshTokenIfNeeded(token: string): CsrfTokenResponse | null {
    try {
      const parts = token.split(':');
      if (parts.length !== 3) {
        return null;
      }

      const [timestamp = ''] = parts;
      const tokenAge = Date.now() - parseInt(timestamp, 10);
      const refreshThreshold = this.tokenDuration * 0.75; // Refresh after 75% of lifetime

      if (tokenAge > refreshThreshold) {
        this.logger.debug('Refreshing CSRF token');
        return this.generateToken();
      }

      return null;
    } catch (error) {
      this.logger.error('Error checking token refresh:', error);
      return null;
    }
  }
}
