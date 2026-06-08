import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  HttpException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AppVersionGuard implements CanActivate {
  private readonly logger = new Logger(AppVersionGuard.name);
  private readonly minVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.minVersion = this.configService.get<string>('MIN_APP_VERSION', '0.0.0');
  }

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const platform = req.headers['x-platform'] as string | undefined;

    if (platform !== 'mobile') {
      return true;
    }

    const clientVersion = req.headers['x-app-version'] as string | undefined;

    if (!clientVersion) {
      this.logger.warn(`Mobile request without X-App-Version from ${req.ip}`);
      throw new BadRequestException('X-App-Version header is required for mobile clients.');
    }

    if (this.isVersionBelow(clientVersion, this.minVersion)) {
      this.logger.warn(
        `Outdated app version ${clientVersion} (min: ${this.minVersion}) from ${req.ip}`,
      );
      throw new HttpException(
        {
          status: 'error',
          message: `App version ${clientVersion} is no longer supported. Please update to at least ${this.minVersion}.`,
          data: null,
        },
        426,
      );
    }

    return true;
  }

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
    return false;
  }
}
