import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware that enforces a minimum mobile app version via the X-App-Version header.
 *
 * - If the header is missing or below MIN_APP_VERSION, responds with 426 Upgrade Required.
 * - Health and docs endpoints are excluded so probes and Swagger still work.
 * - Set MIN_APP_VERSION in .env (default: '0.0.0' — effectively disabled).
 */
@Injectable()
export class AppVersionMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AppVersionMiddleware.name);
  private readonly minVersion: string;
  private readonly excludedPaths = [
    '/health', // VERSION_NEUTRAL — Render health probes hit this directly
    '/api/v1/health',
    '/api/v1/api-docs',
  ];
  private readonly loopbackIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];

  constructor(private readonly configService: ConfigService) {
    this.minVersion = this.configService.get<string>('MIN_APP_VERSION', '0.0.0');
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip internal probes (Render health checks, loopback)
    if (this.loopbackIps.includes(req.ip ?? '')) {
      return next();
    }

    // Skip excluded paths (health probes, docs)
    if (this.excludedPaths.some(p => req.originalUrl.startsWith(p))) {
      return next();
    }

    const clientVersion = req.headers['x-app-version'] as string | undefined;

    if (!clientVersion) {
      // No header — allow in development, reject in production
      if (this.configService.get<string>('NODE_ENV') === 'production') {
        this.logger.warn(`Missing X-App-Version header from ${req.ip}`);
        res.status(426).json({
          status: 'error',
          message: 'X-App-Version header is required. Please update your app.',
          data: null,
        });
        return;
      }
      return next();
    }

    if (this.isVersionBelow(clientVersion, this.minVersion)) {
      this.logger.warn(
        `Outdated app version ${clientVersion} (min: ${this.minVersion}) from ${req.ip}`,
      );
      res.status(426).json({
        status: 'error',
        message: `App version ${clientVersion} is no longer supported. Please update to at least ${this.minVersion}.`,
        data: null,
      });
      return;
    }

    next();
  }

  /**
   * Compare two semver-like version strings (e.g. "1.2.3").
   * Returns true if `version` < `minVersion`.
   */
  private isVersionBelow(version: string, minVersion: string): boolean {
    const parse = (v: string): number[] =>
      v
        .split('.')
        .map(n => parseInt(n, 10))
        .map(n => (Number.isNaN(n) ? 0 : n));

    const current = parse(version);
    const minimum = parse(minVersion);
    const maxLen = Math.max(current.length, minimum.length);

    for (let i = 0; i < maxLen; i++) {
      const c = current[i] ?? 0;
      const m = minimum[i] ?? 0;
      if (c < m) {
        return true;
      }
      if (c > m) {
        return false;
      }
    }
    return false; // equal
  }
}
