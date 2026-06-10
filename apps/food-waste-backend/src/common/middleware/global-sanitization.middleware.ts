import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

import { SanitizationUtil } from '../utils/sanitization.util';

/**
 * Global sanitization middleware for enterprise-grade XSS prevention
 * Applies to ALL endpoints, runs BEFORE ValidationPipe
 *
 * @rationale Defense-in-depth: sanitize before validation to prevent
 * malicious payloads from reaching business logic
 *
 * Order of execution:
 * 1. GlobalSanitizationMiddleware (this) - sanitizes raw input
 * 2. ValidationPipe - validates sanitized input
 * 3. Business logic - processes safe, validated data
 */
@Injectable()
export class GlobalSanitizationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(GlobalSanitizationMiddleware.name);

  constructor(private readonly sanitizationUtil: SanitizationUtil) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const startTime = Date.now();

    try {
      // Skip sanitization for health check and metrics endpoints
      if (this.isExcludedPath(req.path)) {
        return next();
      }

      let sanitizedFields = 0;
      let suspiciousDetected = false;

      // Sanitize request body
      const requestBody = req.body as unknown;
      if (requestBody !== null && requestBody !== undefined && typeof requestBody === 'object') {
        const result = this.sanitizeBody(requestBody as Record<string, unknown>);
        req.body = result.sanitized;
        sanitizedFields += result.fieldsModified;
        suspiciousDetected = suspiciousDetected || result.suspiciousDetected;
      }

      // Sanitize query parameters
      if (typeof req.query === 'object') {
        const result = this.sanitizeQuery(req.query);
        // Mutate in place - req.query is read-only (getter only)
        Object.keys(req.query).forEach(key => delete req.query[key]);
        Object.assign(req.query, result.sanitized);
        sanitizedFields += result.fieldsModified;
        suspiciousDetected = suspiciousDetected || result.suspiciousDetected;
      }

      // Sanitize URL parameters
      if (typeof req.params === 'object') {
        const result = this.sanitizeParams(req.params);
        // Mutate in place - req.params is read-only (getter only)
        Object.keys(req.params).forEach(key => delete req.params[key]);
        Object.assign(req.params, result.sanitized);
        sanitizedFields += result.fieldsModified;
        suspiciousDetected = suspiciousDetected || result.suspiciousDetected;
      }

      // Log suspicious activity
      if (suspiciousDetected) {
        const duration = Date.now() - startTime;
        this.logger.warn({
          message: 'Suspicious content sanitized',
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          fieldsModified: sanitizedFields,
          durationMs: duration,
          timestamp: new Date().toISOString(),
        });
      }

      // Performance monitoring for slow sanitization
      const duration = Date.now() - startTime;
      if (duration > 100) {
        this.logger.debug({
          message: 'Slow sanitization detected',
          path: req.path,
          durationMs: duration,
          fieldsModified: sanitizedFields,
        });
      }

      next();
    } catch (error) {
      this.logger.error({
        message: 'Error in global sanitization middleware',
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
      });

      // Continue processing even if sanitization fails
      // This prevents DoS through sanitization errors
      next();
    }
  }

  /**
   * Check if path should be excluded from sanitization
   * Health checks, metrics, and static assets don't need sanitization
   */
  private isExcludedPath(path: string): boolean {
    const excludedPaths = [
      '/health',
      '/metrics',
      '/api/v1/health',
      '/api/v1/metrics',
      '/api/v1/api-docs', // Swagger
      '/favicon.ico',
    ];

    return excludedPaths.some(excluded => path.startsWith(excluded));
  }

  /**
   * Sanitize request body recursively
   */
  private sanitizeBody(body: Record<string, unknown>): {
    sanitized: Record<string, unknown>;
    fieldsModified: number;
    suspiciousDetected: boolean;
  } {
    let fieldsModified = 0;
    let suspiciousDetected = false;

    const sanitize = (obj: unknown): unknown => {
      if (obj === null || obj === undefined) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      }

      if (typeof obj === 'string') {
        const original = obj;
        const sanitized = this.sanitizationUtil.sanitizeText(obj);

        if (original !== sanitized) {
          fieldsModified++;
        }

        if (this.sanitizationUtil.containsSuspiciousContent(original)) {
          suspiciousDetected = true;
        }

        return sanitized;
      }

      if (typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          // Sanitize keys to prevent prototype pollution
          const sanitizedKey = this.sanitizeKey(key);

          if (sanitizedKey) {
            sanitized[sanitizedKey] = sanitize(value);
          } else {
            // Dangerous key blocked
            suspiciousDetected = true;
            fieldsModified++;
          }
        }

        return sanitized;
      }

      return obj;
    };

    return {
      sanitized: sanitize(body) as Record<string, unknown>,
      fieldsModified,
      suspiciousDetected,
    };
  }

  /**
   * Sanitize query parameters
   */
  private sanitizeQuery(query: Record<string, unknown>): {
    sanitized: Record<string, unknown>;
    fieldsModified: number;
    suspiciousDetected: boolean;
  } {
    const sanitized: Record<string, unknown> = {};
    let fieldsModified = 0;
    let suspiciousDetected = false;

    for (const [key, value] of Object.entries(query)) {
      const sanitizedKey = this.sanitizeKey(key);

      if (!sanitizedKey) {
        suspiciousDetected = true;
        fieldsModified++;
        continue;
      }

      if (typeof value === 'string') {
        const original = value;
        const sanitizedValue = this.sanitizationUtil.sanitizeText(value);

        if (original !== sanitizedValue) {
          fieldsModified++;
        }

        if (this.sanitizationUtil.containsSuspiciousContent(original)) {
          suspiciousDetected = true;
        }

        sanitized[sanitizedKey] = sanitizedValue;
      } else if (Array.isArray(value)) {
        sanitized[sanitizedKey] = value.map((item: unknown) => {
          if (typeof item === 'string') {
            const original = item;
            const sanitizedItem = this.sanitizationUtil.sanitizeText(item);

            if (original !== sanitizedItem) {
              fieldsModified++;
            }

            if (this.sanitizationUtil.containsSuspiciousContent(original)) {
              suspiciousDetected = true;
            }

            return sanitizedItem;
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        const flattened = this.flattenQueryObject(value as Record<string, unknown>);
        if (flattened !== undefined) {
          sanitized[sanitizedKey] = flattened;
        } else {
          suspiciousDetected = true;
          fieldsModified++;
        }
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return {
      sanitized,
      fieldsModified,
      suspiciousDetected,
    };
  }

  /**
   * Flatten nested query objects that may contain MongoDB operators.
   * Express's qs parser converts ?field[$ne]=val into {field: {$ne: "val"}}.
   * Returns undefined if the object contains only operator keys (malicious).
   * Returns the first string value if mixed (best-effort recovery).
   */
  private flattenQueryObject(obj: Record<string, unknown>): string | undefined {
    const keys = Object.keys(obj);
    const hasOperatorKeys = keys.some(k => k.startsWith('$'));

    if (hasOperatorKeys) {
      this.logger.warn(
        `Blocked NoSQL operator injection in query parameter: ${JSON.stringify(obj)}`,
      );
      return undefined;
    }

    const firstStringValue = Object.values(obj).find(v => typeof v === 'string');
    return typeof firstStringValue === 'string' ? firstStringValue : undefined;
  }

  /**
   * Sanitize URL parameters
   */
  private sanitizeParams(params: Record<string, string | string[]>): {
    sanitized: Record<string, string>;
    fieldsModified: number;
    suspiciousDetected: boolean;
  } {
    const sanitized: Record<string, string> = {};
    let fieldsModified = 0;
    let suspiciousDetected = false;

    for (const [key, value] of Object.entries(params)) {
      const sanitizedKey = this.sanitizeKey(key);

      if (!sanitizedKey) {
        suspiciousDetected = true;
        fieldsModified++;
        continue;
      }

      if (typeof value === 'string') {
        const original = value;
        const sanitizedValue = this.sanitizationUtil.sanitizeText(value);

        if (original !== sanitizedValue) {
          fieldsModified++;
        }

        if (this.sanitizationUtil.containsSuspiciousContent(original)) {
          suspiciousDetected = true;
        }

        sanitized[sanitizedKey] = sanitizedValue;
      } else {
        sanitized[sanitizedKey] = Array.isArray(value) ? (value[0] ?? '') : value;
      }
    }

    return {
      sanitized,
      fieldsModified,
      suspiciousDetected,
    };
  }

  /**
   * Sanitize object keys to prevent prototype pollution
   * @returns Sanitized key or empty string if dangerous
   */
  private sanitizeKey(key: string): string {
    // Block dangerous prototype pollution keys
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

    if (dangerousKeys.includes(key)) {
      this.logger.warn(`Blocked dangerous object key: ${key}`);
      return '';
    }

    // Allow alphanumeric, underscore, hyphen, and dot
    // More permissive than text sanitization for query params
    const sanitized = key.replace(/[^a-zA-Z0-9_\-\.]/g, '');

    if (sanitized !== key) {
      this.logger.debug(`Sanitized key: ${key} -> ${sanitized}`);
    }

    return sanitized;
  }
}
