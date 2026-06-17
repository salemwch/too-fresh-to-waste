/* eslint-disable require-await */
import { LeaderboardNotificationService } from './leaderboard-notification.service';

const USER_CHAMPION = '660000000000000000000001';
const USER_CHALLENGER = '660000000000000000000002';

const buildMocks = () => {
  const redisClient = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
  };

  const redisService = {
    getClient: jest.fn().mockResolvedValue(redisClient),
  };

  const leaderboardCache = {
    getLoyaltyRankData: jest.fn().mockResolvedValue(null),
    getTopLoyalty: jest.fn().mockResolvedValue(null),
    invalidateChampionCache: jest.fn().mockResolvedValue(undefined),
  };

  const notificationService = {
    sendTriggeredNotification: jest.fn().mockResolvedValue([{ success: true }]),
  };

  const loyaltyModel = {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    }),
    aggregate: jest.fn().mockResolvedValue([]),
  };

  return { redisClient, redisService, leaderboardCache, notificationService, loyaltyModel };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) => {
  return new LeaderboardNotificationService(
    mocks.leaderboardCache as never,
    mocks.notificationService as never,
    mocks.redisService as never,
    mocks.loyaltyModel as never,
  );
};

describe('LeaderboardNotificationService', () => {
  let service: LeaderboardNotificationService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── checkRankChangeNotifications ────────────────────────────────────────

  describe('checkRankChangeNotifications', () => {
    it('should send DETHRONED when user becomes #1', async () => {
      // Challenger is now ranked #1
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 1,
        totalPoints: 1050,
      });
      // Top 2: challenger (#1), former champion (#2)
      mocks.leaderboardCache.getTopLoyalty
        .mockResolvedValueOnce([{ userId: USER_CHALLENGER, totalPoints: 1050 }]) // top 1
        .mockResolvedValueOnce([
          { userId: USER_CHALLENGER, totalPoints: 1050 },
          { userId: USER_CHAMPION, totalPoints: 1000 },
        ]); // top 2

      // Display name lookup
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: true },
        }),
      });
      mocks.loyaltyModel.aggregate.mockResolvedValue([{ userInfo: { firstName: 'Challenger' } }]);

      // previousRank=2 means user was NOT #1 before → dethrone should fire
      await service.checkRankChangeNotifications(USER_CHALLENGER, 1050, 2);

      expect(mocks.notificationService.sendTriggeredNotification).toHaveBeenCalledWith(
        'leaderboard_dethroned',
        expect.objectContaining({ userId: USER_CHAMPION }),
        expect.objectContaining({
          type: 'push',
          target: { userId: USER_CHAMPION },
        }),
      );
      expect(mocks.leaderboardCache.invalidateChampionCache).toHaveBeenCalled();
    });

    it('should send UNDER_ATTACK when user is within 50pts of #1', async () => {
      // Challenger is ranked #2 with 960pts
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 960,
      });
      // Champion has 1000pts
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);

      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: true },
        }),
      });
      mocks.loyaltyModel.aggregate.mockResolvedValue([{ userInfo: { firstName: 'Challenger' } }]);

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);

      expect(mocks.notificationService.sendTriggeredNotification).toHaveBeenCalledWith(
        'leaderboard_under_attack',
        expect.objectContaining({ userId: USER_CHAMPION }),
        expect.objectContaining({
          type: 'push',
          target: { userId: USER_CHAMPION },
        }),
      );
    });

    it('should NOT send UNDER_ATTACK when gap > 50pts', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 900,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);

      await service.checkRankChangeNotifications(USER_CHALLENGER, 900, 5);

      expect(mocks.notificationService.sendTriggeredNotification).not.toHaveBeenCalled();
    });

    it('should NOT send UNDER_ATTACK when throttled (within 1 hour)', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 960,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);
      // Throttle key already exists
      mocks.redisClient.get.mockResolvedValue('1');

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);

      expect(mocks.notificationService.sendTriggeredNotification).not.toHaveBeenCalled();
    });

    it('should send UNDER_ATTACK after throttle TTL expires', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 960,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);
      // No throttle key (expired)
      mocks.redisClient.get.mockResolvedValue(null);

      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: false },
        }),
      });

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);

      expect(mocks.notificationService.sendTriggeredNotification).toHaveBeenCalled();
      expect(mocks.redisClient.set).toHaveBeenCalledWith(
        `leaderboard:throttle:under_attack:${USER_CHALLENGER}`,
        '1',
        { EX: 3600 },
      );
    });

    it('should NOT send notification when champion earns more points (already #1)', async () => {
      // Champion gains more points — still #1, previousRank was already 1
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 1,
        totalPoints: 1100,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1100 },
      ]);

      // previousRank=1 means user was already #1 → no dethrone should fire
      await service.checkRankChangeNotifications(USER_CHAMPION, 1100, 1);

      expect(mocks.notificationService.sendTriggeredNotification).not.toHaveBeenCalled();
    });

    it('should use anonymous display name when showRealName=false', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 960,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: false },
        }),
      });

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);

      expect(mocks.notificationService.sendTriggeredNotification).toHaveBeenCalledWith(
        'leaderboard_under_attack',
        expect.objectContaining({
          variables: { challengerName: 'An anonymous challenger' },
        }),
        expect.anything(),
      );
    });

    it('should use real firstName when showRealName=true', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 2,
        totalPoints: 960,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([
        { userId: USER_CHAMPION, totalPoints: 1000 },
      ]);
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: true },
        }),
      });
      mocks.loyaltyModel.aggregate.mockResolvedValue([{ userInfo: { firstName: 'Salem' } }]);

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);

      expect(mocks.notificationService.sendTriggeredNotification).toHaveBeenCalledWith(
        'leaderboard_under_attack',
        expect.objectContaining({
          variables: { challengerName: 'Salem' },
        }),
        expect.anything(),
      );
    });

    it('should handle Redis errors gracefully (no crash, warning logged)', async () => {
      mocks.redisService.getClient.mockRejectedValue(new Error('Redis down'));

      await expect(
        service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3),
      ).resolves.toBeUndefined();
    });

    it('should not block — errors are caught and logged', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockRejectedValue(new Error('Cache error'));

      const start = Date.now();
      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 3);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(1000);
    });

    it('should invalidate champion cache on dethrone', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 1,
        totalPoints: 1050,
      });
      mocks.leaderboardCache.getTopLoyalty
        .mockResolvedValueOnce([{ userId: USER_CHALLENGER, totalPoints: 1050 }])
        .mockResolvedValueOnce([
          { userId: USER_CHALLENGER, totalPoints: 1050 },
          { userId: USER_CHAMPION, totalPoints: 1000 },
        ]);
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: false },
        }),
      });

      // previousRank=2 → user just became #1
      await service.checkRankChangeNotifications(USER_CHALLENGER, 1050, 2);

      expect(mocks.leaderboardCache.invalidateChampionCache).toHaveBeenCalled();
    });

    it('should do nothing when user rank data is not available', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue(null);

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, null);

      expect(mocks.notificationService.sendTriggeredNotification).not.toHaveBeenCalled();
    });

    it('should do nothing when leaderboard is empty', async () => {
      mocks.leaderboardCache.getLoyaltyRankData.mockResolvedValue({
        rank: 1,
        totalPoints: 960,
      });
      mocks.leaderboardCache.getTopLoyalty.mockResolvedValue([]);

      await service.checkRankChangeNotifications(USER_CHALLENGER, 960, 5);

      expect(mocks.notificationService.sendTriggeredNotification).not.toHaveBeenCalled();
    });
  });

  // ─── getDisplayName ──────────────────────────────────────────────────────

  describe('getDisplayName', () => {
    it('should return "An anonymous challenger" when showRealName=false', async () => {
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: false },
        }),
      });

      const name = await service.getDisplayName(USER_CHALLENGER);

      expect(name).toBe('An anonymous challenger');
    });

    it('should return real firstName when showRealName=true', async () => {
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          leaderboardConsent: { showRealName: true },
        }),
      });
      mocks.loyaltyModel.aggregate.mockResolvedValue([{ userInfo: { firstName: 'Salem' } }]);

      const name = await service.getDisplayName(USER_CHALLENGER);

      expect(name).toBe('Salem');
    });

    it('should return "An anonymous challenger" when no account found', async () => {
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const name = await service.getDisplayName(USER_CHALLENGER);

      expect(name).toBe('An anonymous challenger');
    });

    it('should return "A challenger" on error', async () => {
      mocks.loyaltyModel.findOne.mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      const name = await service.getDisplayName(USER_CHALLENGER);

      expect(name).toBe('A challenger');
    });
  });
});
