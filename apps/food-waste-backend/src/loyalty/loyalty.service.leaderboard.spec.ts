/* eslint-disable require-await */
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { LoyaltyService } from './loyalty.service';

const USER_A = '660000000000000000000001';
const USER_B = '660000000000000000000002';
const USER_A_OBJ = new Types.ObjectId(USER_A);

const makeAccount = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: USER_A_OBJ,
  totalPoints: 1000,
  availablePoints: 1000,
  currentTier: 'Gold',
  isActive: true,
  leaderboardConsent: { given: true, showRealName: true },
  badges: [{ type: 'NEWCOMER', name: 'Welcome' }],
  ...overrides,
});

const makeAggDoc = (userId: string, totalPoints: number, showRealName = true) => ({
  userId: new Types.ObjectId(userId),
  totalPoints,
  currentTier: 'Gold',
  badges: [{ type: 'NEWCOMER', name: 'Welcome' }],
  userInfo: { firstName: 'Test', lastName: 'User', profileImage: null, avatar: null },
  leaderboardConsent: { given: true, showRealName },
});

const buildMocks = () => {
  const loyaltyModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(makeAccount()),
    }),
    find: jest.fn().mockReturnValue({
      lean: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([makeAccount()]),
      }),
    }),
    aggregate: jest.fn().mockResolvedValue([makeAggDoc(USER_A, 1000)]),
    countDocuments: jest.fn().mockResolvedValue(100),
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  };

  const orderModel = {
    aggregate: jest.fn().mockReturnValue([]),
  };

  const donationsService = {
    getActivePool: jest.fn(),
  };

  const leaderboardCache = {
    getTopLoyalty: jest.fn().mockResolvedValue(null),
    getLoyaltyTotal: jest.fn().mockResolvedValue(100),
    getLoyaltyRankData: jest.fn().mockResolvedValue(null),
    setLoyaltyScore: jest.fn(),
    removeLoyaltyEntry: jest.fn(),
    getLoyaltyNeighborhood: jest.fn().mockResolvedValue(null),
    getCachedChampion: jest.fn().mockResolvedValue(null),
    setCachedChampion: jest.fn(),
    invalidateChampionCache: jest.fn(),
  };

  const leaderboardNotification = {
    checkRankChangeNotifications: jest.fn().mockResolvedValue(undefined),
  };

  return { loyaltyModel, orderModel, donationsService, leaderboardCache, leaderboardNotification };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) => {
  return new LoyaltyService(
    mocks.loyaltyModel as never,
    mocks.orderModel as never,
    mocks.donationsService as never,
    mocks.leaderboardCache as never,
    mocks.leaderboardNotification as never,
  );
};

describe('LoyaltyService — Leaderboard', () => {
  let service: LoyaltyService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getLeaderboard ─────────────────────────────────────────────────────────

  describe('getLeaderboard', () => {
    it('should return hasMore=true when more entries exist within 200 cap', async () => {
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_A, totalPoints: 1000 },
        { userId: USER_B, totalPoints: 900 },
      ]);
      mocks.leaderboardCache.getLoyaltyTotal.mockResolvedValue(500);

      const result = await service.getLeaderboard(USER_A, 2, 0);

      expect(result.hasMore).toBe(true);
    });

    it('should return hasMore=false when offset+entries >= 200', async () => {
      const entries = Array.from({ length: 50 }, (_, i) => ({
        userId: new Types.ObjectId().toString(),
        totalPoints: 5000 - i * 10,
      }));
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue(entries);
      mocks.leaderboardCache.getLoyaltyTotal.mockResolvedValue(10000);

      const result = await service.getLeaderboard(USER_A, 50, 150);

      expect(result.hasMore).toBe(false);
    });

    it('should return hasMore=false when all entries are loaded', async () => {
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_A, totalPoints: 1000 },
      ]);
      mocks.leaderboardCache.getLoyaltyTotal.mockResolvedValue(1);

      const result = await service.getLeaderboard(USER_A, 50, 0);

      expect(result.hasMore).toBe(false);
    });

    it('should compute percentile on currentUserEntry', async () => {
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_B, totalPoints: 2000 },
      ]);
      mocks.leaderboardCache.getLoyaltyTotal.mockResolvedValue(100);

      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 10,
        totalPoints: 1000,
      });

      const result = await service.getLeaderboard(USER_A, 50, 0);

      expect(result.currentUserEntry).not.toBeNull();
      expect(result.currentUserEntry!.percentile).toBe(90);
    });

    it('should fall back to DB when Redis cache is empty', async () => {
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue(null);

      const aggDocs = [makeAggDoc(USER_A, 1000), makeAggDoc(USER_B, 900)];
      mocks.loyaltyModel.aggregate.mockResolvedValue(aggDocs);
      mocks.loyaltyModel.countDocuments.mockResolvedValue(2);

      const result = await service.getLeaderboard(USER_A, 50, 0);

      expect(result.entries).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(result.total).toBe(2);
    });
  });

  // ─── getNeighborhood ────────────────────────────────────────────────────────

  describe('getNeighborhood', () => {
    it('should return hydrated entries with correct ranks and isAnchor', async () => {
      mocks.leaderboardCache.getLoyaltyNeighborhood.mockResolvedValue({
        entries: [
          { userId: USER_B, totalPoints: 1100 },
          { userId: USER_A, totalPoints: 1000 },
        ],
        rank: 50,
        total: 500,
      });

      const result = await service.getNeighborhood(USER_A);

      expect(result.anchorRank).toBe(50);
      expect(result.total).toBe(500);
      expect(result.entries).toHaveLength(2);

      const anchor = result.entries.find(e => e.isAnchor);
      expect(anchor).toBeDefined();
      expect(anchor!.userId).toBe(USER_A);

      const nonAnchor = result.entries.find(e => !e.isAnchor);
      expect(nonAnchor).toBeDefined();
    });

    it('should throw NotFoundException when user not on leaderboard', async () => {
      mocks.leaderboardCache.getLoyaltyNeighborhood.mockResolvedValue(null);

      await expect(service.getNeighborhood(USER_A)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── getChampion ────────────────────────────────────────────────────────────

  describe('getChampion', () => {
    it('should return cached champion when available', async () => {
      const champion = {
        userId: USER_A,
        firstName: 'John',
        lastName: 'Doe',
        profileImage: null,
        totalPoints: 5000,
        currentTier: 'Platinum',
        currentBadge: 'Eco Warrior',
      };
      mocks.leaderboardCache.getCachedChampion.mockResolvedValue(JSON.stringify(champion));

      const result = await service.getChampion();

      expect(result).toEqual(champion);
      expect(mocks.leaderboardCache.getTopLoyalty).not.toHaveBeenCalled();
    });

    it('should return null when leaderboard is empty', async () => {
      mocks.leaderboardCache.getCachedChampion.mockResolvedValue(null);
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([]);

      const result = await service.getChampion();

      expect(result).toBeNull();
    });

    it('should fetch, hydrate, and cache champion when not in cache', async () => {
      mocks.leaderboardCache.getCachedChampion.mockResolvedValue(null);
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_A, totalPoints: 5000 },
      ]);

      const result = await service.getChampion();

      expect(result).not.toBeNull();
      expect(result!.userId).toBe(USER_A);
      expect(result!.totalPoints).toBe(5000);
      expect(mocks.leaderboardCache.setCachedChampion).toHaveBeenCalledWith(expect.any(String));
    });

    it('should respect anonymous display when showRealName=false', async () => {
      mocks.leaderboardCache.getCachedChampion.mockResolvedValue(null);
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_A, totalPoints: 5000 },
      ]);

      const anonAccount = makeAccount({ leaderboardConsent: { given: true, showRealName: false } });
      mocks.loyaltyModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([anonAccount]),
        }),
      });
      mocks.loyaltyModel.aggregate.mockResolvedValue([makeAggDoc(USER_A, 5000, false)]);

      const result = await service.getChampion();

      expect(result).not.toBeNull();
      expect(result!.firstName).toBe('Anonymous');
      expect(result!.lastName).toBe('');
      expect(result!.profileImage).toBeNull();
    });
  });
});
