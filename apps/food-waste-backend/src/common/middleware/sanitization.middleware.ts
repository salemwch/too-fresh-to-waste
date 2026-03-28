import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SanitizationUtil } from '../utils/sanitization.util';

// Sanitizable input types for request processing
type SanitizableValue = string | number | boolean | null | undefined;

interface SanitizableObject {
  [key: string]: SanitizableValue | SanitizableValue[] | SanitizableObject | SanitizableObject[];
}

interface NotificationRequestBody extends SanitizableObject {
  payload?: SanitizableObject;
  title?: string;
  body?: string;
  message?: string;
  content?: string;
  description?: string;
}

interface QueryParams {
  [key: string]: string | string[] | undefined;
}

// Type guard to check if a value is a valid query parameter type
function isValidQueryParam(value: unknown): value is string | string[] {
  return (
    typeof value === 'string' ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SanitizationMiddleware.name);

  constructor(private readonly sanitizationUtil: SanitizationUtil) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    try {
      // Sanitize request body for notification-related endpoints
      if (this.isNotificationEndpoint(req.path) && req.body) {
        req.body = this.sanitizeRequestBody(req.body);

        // Log if suspicious content was detected
        const bodyString = JSON.stringify(req.body);
        if (this.sanitizationUtil.containsSuspiciousContent(bodyString)) {
          this.logger.warn('Suspicious content sanitized in request', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            suspiciousContent: true,
          });
        }
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeQueryParams(req.query as QueryParams);
      }

      next();
    } catch (error) {
      this.logger.error('Error in sanitization middleware:', error);
      next(); // Continue processing even if sanitization fails
    }
  }

  private isNotificationEndpoint(path: string): boolean {
    const notificationPaths = [
      '/api/v1/notifications',
      '/api/v1/notification',
      '/notifications',
      '/notification',
    ];

    return notificationPaths.some((notifPath) => path.includes(notifPath));
  }

  private sanitizeRequestBody(body: unknown): NotificationRequestBody {
    if (!body || typeof body !== 'object') {
      return {};
    }

    const inputBody = body as NotificationRequestBody;
    const sanitized: NotificationRequestBody = { ...inputBody };

    // Sanitize notification payload fields
    if (sanitized.payload) {
      sanitized.payload = this.sanitizationUtil.sanitizeNotificationPayload(
        sanitized.payload,
      ) as SanitizableObject;
    }

    // Sanitize common string fields
    ['title', 'body', 'message', 'content', 'description'].forEach((field) => {
      if (sanitized[field] && typeof sanitized[field] === 'string') {
        sanitized[field] = this.sanitizationUtil.sanitizeText(sanitized[field]);
      }
    });

    // Sanitize nested objects recursively
    Object.keys(sanitized).forEach((key) => {
      if (
        typeof sanitized[key] === 'object' &&
        sanitized[key] !== null &&
        !Array.isArray(sanitized[key])
      ) {
        sanitized[key] = this.sanitizeRequestBody(sanitized[key]);
      }
    });

    return sanitized;
  }

  private sanitizeQueryParams(query: QueryParams): QueryParams {
    const sanitized: QueryParams = {};

    Object.keys(query).forEach((key) => {
      const sanitizedKey = this.sanitizationUtil.sanitizeText(key);
      const value = query[key];

      if (isValidQueryParam(value)) {
        if (typeof value === 'string') {
          sanitized[sanitizedKey] = this.sanitizationUtil.sanitizeText(value);
        } else if (Array.isArray(value)) {
          sanitized[sanitizedKey] = value.map((item) => this.sanitizationUtil.sanitizeText(item));
        }
      } else {
        // Skip invalid query parameters
        this.logger.warn(`Invalid query parameter skipped: ${key}`);
      }
    });

    return sanitized;
  }
}
