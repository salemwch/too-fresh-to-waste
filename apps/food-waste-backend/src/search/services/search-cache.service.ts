import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class SearchCacheService {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get<string>('REDIS_PORT') ?? '6379', 10) || 6379,
      password: this.configService.get('REDIS_PASSWORD'),
      username: this.configService.get('REDIS_USERNAME'),
      // Explicitly disable TLS for search cache service
      tls: undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
    });
  }

  async get(key: string): Promise<unknown> {
    try {
      const cached = await this.redis.get(`search:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setex(`search:${key}`, ttl, JSON.stringify(value));
    } catch {
      // Fail silently
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(`search:${key}`);
    } catch {
      // Fail silently
    }
  }

  // Enterprise method aliases for backward compatibility
  async setCache(key: string, value: unknown, ttl: number = 300): Promise<void> {
    await this.set(key, value, ttl);
  }

  async deleteFromCache(key: string): Promise<void> {
    await this.del(key);
  }

  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch {
      // Fail silently
    }
  }
}
