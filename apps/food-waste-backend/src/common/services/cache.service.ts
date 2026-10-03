import { Injectable, Logger } from '@nestjs/common';

import { RedisService } from '../../redis/redis.service';
import { deleteByPattern } from '../utils/redis-scan.util';

/**
 * Generic Redis caching service.
 *
 * Design:
 * - Fail-silent: any Redis error falls through to the factory (never crashes the request)
 * - SCAN-based prefix deletion: non-blocking, safe in production
 * - getOrSet: standard cache-aside pattern
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redisService: RedisService) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await this.redisService.getClient();
      const raw = await client.get(key);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as T;
    } catch (err) {
      this.logger.warn(`Cache GET failed for "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      this.logger.warn(`Cache SET failed for "${key}": ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      const client = await this.redisService.getClient();
      await client.del(key);
    } catch (err) {
      this.logger.warn(`Cache DEL failed for "${key}": ${(err as Error).message}`);
    }
  }

  /**
   * Atomic "has this already happened in this window" check, for dedupe
   * across PM2 workers (one process per core - a non-atomic get-then-set lets
   * two workers both see "not yet" and both act). Returns `true` only for the
   * caller that actually set the key (the one allowed to proceed), `false`
   * for every other caller within `ttlSeconds`.
   *
   * Fails open (`true`) when Redis is unreachable: this guards reporting a
   * real data-integrity failure, and a Redis outage must never silently
   * suppress that report.
   */
  async acquireOnce(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const client = await this.redisService.getClient();
      const reply = await client.set(key, '1', { NX: true, EX: ttlSeconds });
      return reply !== null;
    } catch (err) {
      this.logger.warn(`Cache ACQUIRE_ONCE failed for "${key}": ${(err as Error).message}`);
      return true;
    }
  }

  /**
   * Delete all keys matching a prefix using SCAN (non-blocking, cursor-based).
   * Never use KEYS in production — it blocks the Redis event loop.
   *
   * @returns the number of keys removed (0 when Redis is unreachable)
   */
  async delByPrefix(prefix: string): Promise<number> {
    try {
      const client = await this.redisService.getClient();
      return await deleteByPattern(client, `${prefix}*`);
    } catch (err) {
      this.logger.warn(`Cache DEL_BY_PREFIX failed for "${prefix}": ${(err as Error).message}`);
      return 0;
    }
  }

  /**
   * Cache-aside: return cached value when found, otherwise call factory,
   * store the result, and return it. Always returns a value even when Redis is down.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      this.logger.debug(`HIT  ${key}`);
      return cached;
    }
    this.logger.debug(`MISS ${key}`);
    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
