/* eslint-disable require-await */
import { LeaderboardCacheService } from './leaderboard-cache.service';

const USER_A = '660000000000000000000001';
const USER_B = '660000000000000000000002';
const USER_C = '660000000000000000000003';

const buildMocks = () => {
  const redisClient = {
    zRevRank: jest.fn(),
    zCard: jest.fn(),
    zRangeWithScores: jest.fn(),
    zScore: jest.fn(),
    zAdd: jest.fn(),
    zIncrBy: jest.fn(),
    zRem: jest.fn(),
    del: jest.fn(),
    get: jest.fn().mockResolvedValue('1'),
    set: jest.fn(),
  };

  const redisService = {
    getClient: jest.fn().mockResolvedValue(redisClient),
  };

  const orderModel = {
    aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
  };
  const loyaltyModel = {
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    }),
  };

  return { redisClient, redisService, orderModel, loyaltyModel };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) => {
  return new LeaderboardCacheService(
    mocks.redisService as never,
    mocks.orderModel as never,
    mocks.loyaltyModel as never,
  );
};

describe('LeaderboardCacheService', () => {
  let service: LeaderboardCacheService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getLoyaltyNeighborhood ──────────────────────────────────────────────────

  describe('getLoyaltyNeighborhood', () => {
    it('should return ±5 neighbors when user exists in sorted set', async () => {
      mocks.redisClient.zRevRank.mockResolvedValue(10);
      mocks.redisClient.zCard.mockResolvedValue(100);
      mocks.redisClient.zRangeWithScores.mockResolvedValue([
        { value: '600000000000000000000005', score: 900 },
        { value: '600000000000000000000006', score: 850 },
        { value: USER_A, score: 800 },
        { value: '600000000000000000000007', score: 750 },
        { value: '600000000000000000000008', score: 700 },
      ]);

      const result = await service.getLoyaltyNeighborhood(USER_A);

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(11);
      expect(result!.total).toBe(100);
      expect(result!.entries).toHaveLength(5);
      expect(result!.entries[2]!.userId).toBe(USER_A);
      expect(mocks.redisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:loyalty:scores',
        5,
        15,
        { REV: true },
      );
    });

    it('should return null when user not found in sorted set', async () => {
      mocks.redisClient.zRevRank.mockResolvedValue(null);
      mocks.redisClient.zCard.mockResolvedValue(100);

      const result = await service.getLoyaltyNeighborhood(USER_A);

      expect(result).toBeNull();
    });

    it('should handle Redis connection errors gracefully', async () => {
      mocks.redisService.getClient.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getLoyaltyNeighborhood(USER_A);

      expect(result).toBeNull();
    });

    it('should clamp start to 0 when user is at rank 1', async () => {
      mocks.redisClient.zRevRank.mockResolvedValue(0);
      mocks.redisClient.zCard.mockResolvedValue(50);
      mocks.redisClient.zRangeWithScores.mockResolvedValue([
        { value: USER_A, score: 1000 },
        { value: USER_B, score: 900 },
        { value: USER_C, score: 800 },
      ]);

      const result = await service.getLoyaltyNeighborhood(USER_A);

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(1);
      expect(mocks.redisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:loyalty:scores',
        0,
        5,
        { REV: true },
      );
    });

    it('should clamp stop when user is at last rank', async () => {
      mocks.redisClient.zRevRank.mockResolvedValue(49);
      mocks.redisClient.zCard.mockResolvedValue(50);
      mocks.redisClient.zRangeWithScores.mockResolvedValue([
        { value: USER_B, score: 200 },
        { value: USER_A, score: 100 },
      ]);

      const result = await service.getLoyaltyNeighborhood(USER_A);

      expect(result).not.toBeNull();
      expect(result!.rank).toBe(50);
      expect(mocks.redisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:loyalty:scores',
        44,
        49,
        { REV: true },
      );
    });

    it('should use custom radius when provided', async () => {
      mocks.redisClient.zRevRank.mockResolvedValue(20);
      mocks.redisClient.zCard.mockResolvedValue(100);
      mocks.redisClient.zRangeWithScores.mockResolvedValue([]);

      await service.getLoyaltyNeighborhood(USER_A, 3);

      expect(mocks.redisClient.zRangeWithScores).toHaveBeenCalledWith(
        'leaderboard:loyalty:scores',
        17,
        23,
        { REV: true },
      );
    });
  });

  // ─── Champion cache ──────────────────────────────────────────────────────────

  describe('getCachedChampion', () => {
    it('should return cached JSON string when present', async () => {
      const champion = JSON.stringify({ userId: USER_A, firstName: 'John' });
      mocks.redisClient.get.mockResolvedValue(champion);

      const result = await service.getCachedChampion();

      expect(result).toBe(champion);
    });

    it('should return null when cache is empty', async () => {
      mocks.redisClient.get.mockResolvedValue(null);

      const result = await service.getCachedChampion();

      expect(result).toBeNull();
    });

    it('should return null on Redis error', async () => {
      mocks.redisService.getClient.mockRejectedValue(new Error('Connection refused'));

      const result = await service.getCachedChampion();

      expect(result).toBeNull();
    });
  });

  describe('setCachedChampion', () => {
    it('should set champion with 5 minute TTL', async () => {
      const json = JSON.stringify({ userId: USER_A });

      await service.setCachedChampion(json);

      expect(mocks.redisClient.set).toHaveBeenCalledWith('leaderboard:loyalty:champion', json, {
        EX: 300,
      });
    });

    it('should not throw on Redis error', async () => {
      mocks.redisClient.set.mockRejectedValue(new Error('WRITE ERROR'));

      await expect(service.setCachedChampion('{}')).resolves.toBeUndefined();
    });
  });

  describe('invalidateChampionCache', () => {
    it('should delete the champion cache key', async () => {
      await service.invalidateChampionCache();

      expect(mocks.redisClient.del).toHaveBeenCalledWith('leaderboard:loyalty:champion');
    });

    it('should not throw on Redis error', async () => {
      mocks.redisClient.del.mockRejectedValue(new Error('DEL ERROR'));

      await expect(service.invalidateChampionCache()).resolves.toBeUndefined();
    });
  });
});
