/**
 * `acquireOnce` is the atomic "report this at most once per window" primitive
 * behind `MerchantSalesService.reportUnverified` (Task 17, A4): PM2 forks one
 * worker per core, so a non-atomic get-then-set would let two workers both
 * see "not reported yet" and both report. `SET key val NX EX ttl` is atomic in
 * Redis, so exactly one caller within the window ever gets `true`.
 */

import { Test } from '@nestjs/testing';

import { RedisService } from '../../../redis/redis.service';
import { CacheService } from '../cache.service';

import type { TestingModule } from '@nestjs/testing';

describe('CacheService.acquireOnce', () => {
  let service: CacheService;

  const redis = { set: jest.fn() };
  const redisService = { getClient: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    redisService.getClient.mockResolvedValue(redis);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CacheService, { provide: RedisService, useValue: redisService }],
    }).compile();

    service = module.get(CacheService);
  });

  it('returns true and sets NX+EX when the key is free - the first caller in the window', async () => {
    redis.set.mockResolvedValue('OK');

    const won = await service.acquireOnce('key-1', 3600);

    expect(won).toBe(true);
    expect(redis.set).toHaveBeenCalledWith('key-1', '1', { NX: true, EX: 3600 });
  });

  it('returns false when another caller already holds the key - node-redis returns null for a failed NX', async () => {
    redis.set.mockResolvedValue(null);

    const won = await service.acquireOnce('key-1', 3600);

    expect(won).toBe(false);
  });

  it('fails open (returns true) when Redis is unreachable - a real integrity failure must never be silently swallowed by an outage', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));

    const won = await service.acquireOnce('key-1', 3600);

    expect(won).toBe(true);
  });
});
