import { Injectable } from '@nestjs/common';

import { deleteByPattern } from '../../common/utils/redis-scan.util';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class SearchCacheService {
  constructor(private readonly redisService: RedisService) {}

  async get(key: string): Promise<unknown> {
    try {
      const redis = await this.redisService.getClient();
      const cached = await redis.get(`search:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttl: number = 300): Promise<void> {
    try {
      const redis = await this.redisService.getClient();
      await redis.setEx(`search:${key}`, ttl, JSON.stringify(value));
    } catch {
      // Fail silently
    }
  }

  async del(key: string): Promise<void> {
    try {
      const redis = await this.redisService.getClient();
      await redis.del(`search:${key}`);
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
      const redis = await this.redisService.getClient();
      // SCAN, never KEYS — KEYS blocks the shared Redis event loop.
      await deleteByPattern(redis, pattern);
    } catch {
      // Fail silently
    }
  }
}
