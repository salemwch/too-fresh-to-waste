import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SearchCacheService {
  private redis: Redis;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT')) || 6379,
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

  async get(key: string): Promise<any> {
    try {
      const cached = await this.redis.get(`search:${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setex(`search:${key}`, ttl, JSON.stringify(value));
    } catch (error) {
      // Fail silently
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(`search:${key}`);
    } catch (error) {
      // Fail silently
    }
  }

  // Enterprise method aliases for backward compatibility
  async setCache(key: string, value: any, ttl: number = 300): Promise<void> {
    return this.set(key, value, ttl);
  }

  async deleteFromCache(key: string): Promise<void> {
    return this.del(key);
  }

  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      // Fail silently
    }
  }
}