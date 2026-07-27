/* eslint-disable require-await */
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { PrizeClaimService } from './prize-claim.service';
import { PrizeClaimStatus, PrizeType } from '../schemas/prize-claim.schema';

const USER_ID = '660000000000000000000001';
const USER_ID_OBJ = new Types.ObjectId(USER_ID);
const EST_ID = '670000000000000000000001';

/** Rank 4 in the default fixture — the first rank outside the phone tier. */
const RANK_4_USER = '660000000000000000000004';
/** Rank 6 in the default fixture — comfortably inside the discount tier. */
const RANK_6_USER = '660000000000000000000006';
/** Has no loyalty account at all. */
const UNKNOWN_USER = '660000000000000000000099';

/** A season that ended having met its community bag target. */
const makeGoal = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  cycleNumber: 1,
  endDate: new Date('2025-01-01'),
  currentCount: 30_000,
  targetCount: 30_000,
  ...overrides,
});

/** A season that ended short of its target — no smartphone is unlocked. */
const makeMissedGoal = (overrides: Record<string, unknown> = {}) =>
  makeGoal({ currentCount: 22_000, targetCount: 30_000, ...overrides });

const makeClaim = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  userId: USER_ID_OBJ,
  prizeType: PrizeType.SMARTPHONE,
  status: PrizeClaimStatus.PENDING,
  rank: 1,
  totalPoints: 5000,
  cycleNumber: 1,
  createdAt: new Date(),
  toString() {
    return this._id.toString();
  },
  ...overrides,
});

// ─── Loyalty account fixture ──────────────────────────────────────────────────

interface FakeAccount {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  totalPoints: number;
  isActive: boolean;
  leaderboardConsent: { given: boolean };
}

/**
 * Account ids ascend with rank, so the `_id` tiebreak is predictable: on equal
 * points the lower id — the older account — ranks higher.
 */
const account = (n: number, totalPoints: number, over: Partial<FakeAccount> = {}): FakeAccount => ({
  _id: new Types.ObjectId(`aa000000000000000000000${n}`),
  userId: new Types.ObjectId(`66000000000000000000000${n}`),
  totalPoints,
  isActive: true,
  leaderboardConsent: { given: true },
  ...over,
});

/** Seven ranked users, 5000 points down to 100. */
const defaultAccounts = (): FakeAccount[] => [
  account(1, 5000),
  account(2, 4000),
  account(3, 3000),
  account(4, 2000),
  account(5, 1000),
  account(6, 500),
  account(7, 100),
];

/**
 * Evaluates the `outranking()` filter against the fixture.
 *
 * Written out rather than stubbed to a number so the tests exercise the real
 * ranking predicate — including the consent filter and the `_id` tiebreak,
 * which are the two things that were wrong.
 */
const countOutranking = (accounts: FakeAccount[], filter: Record<string, unknown>): number => {
  const clauses = filter['$or'] as Array<Record<string, unknown>>;

  return accounts.filter(a => {
    if (a.isActive !== filter['isActive']) {
      return false;
    }
    if (a.leaderboardConsent.given !== filter['leaderboardConsent.given']) {
      return false;
    }

    return clauses.some(clause => {
      const points = clause['totalPoints'];
      if (typeof points === 'object' && points !== null && '$gt' in points) {
        return a.totalPoints > (points as { $gt: number }).$gt;
      }
      const idClause = clause['_id'] as { $lt: Types.ObjectId };
      return a.totalPoints === points && a._id.toString() < idClause.$lt.toString();
    });
  }).length;
};

interface FakeQuery<T> {
  select: () => FakeQuery<T>;
  lean: () => Promise<T>;
  exec: () => Promise<T>;
  then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) => Promise<unknown>;
}

/** Awaitable and chainable, because the service uses findOne both ways. */
const chainable = <T>(value: T): FakeQuery<T> => {
  const query: FakeQuery<T> = {
    select: () => query,
    lean: async () => value,
    exec: async () => value,
    then: async (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return query;
};

/** A MongoDB duplicate-key rejection from the named unique index. */
const duplicateKeyError = (keyPattern: Record<string, number>) =>
  Object.assign(new Error('E11000 duplicate key error'), { code: 11000, keyPattern });

const buildMocks = (accounts: FakeAccount[] = defaultAccounts()) => {
  const prizeClaimModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async data => makeClaim(data)),
    exists: jest.fn().mockResolvedValue(null),
  };

  const loyaltyModel = {
    findOne: jest
      .fn()
      .mockImplementation((filter: { userId: Types.ObjectId }) =>
        chainable(accounts.find(a => a.userId.toString() === filter.userId.toString()) ?? null),
      ),
    countDocuments: jest
      .fn()
      .mockImplementation(async (filter: Record<string, unknown>) =>
        countOutranking(accounts, filter),
      ),
    // Present but unused — the ranking must never load the collection.
    find: jest.fn(),
  };

  const goalModel = {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(makeGoal()),
    }),
  };

  const establishmentModel = {
    findById: jest.fn().mockResolvedValue({ _id: EST_ID, name: 'Test Restaurant' }),
  };

  const emailService = { sendTemplateEmail: jest.fn().mockResolvedValue(undefined) };
  const configService = { get: jest.fn().mockReturnValue('admin@test.com') };

  return {
    prizeClaimModel,
    loyaltyModel,
    goalModel,
    establishmentModel,
    emailService,
    configService,
  };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) =>
  new PrizeClaimService(
    mocks.prizeClaimModel as never,
    mocks.loyaltyModel as never,
    mocks.goalModel as never,
    mocks.establishmentModel as never,
    mocks.emailService as never,
    mocks.configService as never,
  );

describe('PrizeClaimService', () => {
  let service: PrizeClaimService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = buildService(mocks);
  });

  afterEach(() => jest.restoreAllMocks());

  // ─── getClaimStatus ─────────────────────────────────────────────────────────

  describe('getClaimStatus', () => {
    it('should return defaults when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      const result = await service.getClaimStatus(USER_ID);

      expect(result).toEqual({
        hasClaimed: false,
        claim: null,
        eligiblePrizeType: null,
        rank: null,
        targetReached: false,
      });
    });

    it('should return smartphone eligible for a top 3 user', async () => {
      const result = await service.getClaimStatus(USER_ID);

      expect(result.hasClaimed).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.SMARTPHONE);
      expect(result.rank).toBe(1);
    });

    it('should return discount eligible for the first rank past the cutoff', async () => {
      const result = await service.getClaimStatus(RANK_4_USER);

      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(4);
    });

    it('should return discount eligible for rank 6+ user', async () => {
      const result = await service.getClaimStatus(RANK_6_USER);

      expect(result.hasClaimed).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(6);
    });

    it('should return hasClaimed=true when user already claimed', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue(makeClaim());

      const result = await service.getClaimStatus(USER_ID);

      expect(result.hasClaimed).toBe(true);
      expect(result.claim).not.toBeNull();
    });

    it('should return null rank for user not on leaderboard', async () => {
      const result = await service.getClaimStatus(UNKNOWN_USER);

      expect(result.rank).toBeNull();
      expect(result.eligiblePrizeType).toBeNull();
    });
  });

  // ─── ranking ────────────────────────────────────────────────────────────────

  describe('ranking', () => {
    const rankOf = async (userId: string) => (await service.getClaimStatus(userId)).rank;

    it.each([
      [USER_ID, 1],
      ['660000000000000000000003', 3],
      [RANK_6_USER, 6],
      ['660000000000000000000007', 7],
    ])('ranks %s at #%i', async (userId, expected) => {
      expect(await rankOf(userId)).toBe(expected);
    });

    /*
     * The reason this was rewritten: the old form ran find() with no limit,
     * sorted every loyalty account and called findIndex — on every prize-screen
     * open, from every user, at the moment the collection is largest.
     */
    it('counts the accounts ahead instead of loading the leaderboard', async () => {
      await rankOf(USER_ID);

      expect(mocks.loyaltyModel.countDocuments).toHaveBeenCalled();
      expect(mocks.loyaltyModel.find).not.toHaveBeenCalled();
    });

    describe('who is ranked', () => {
      const rankWith = async (accounts: FakeAccount[], userId: string) => {
        const scoped = buildMocks(accounts);
        return (await buildService(scoped).getClaimStatus(userId)).rank;
      };

      it('does not rank a user with no loyalty account', async () => {
        expect(await rankOf(UNKNOWN_USER)).toBeNull();
      });

      it('does not rank a deactivated account', async () => {
        const accounts = defaultAccounts();
        accounts[0] = account(1, 5000, { isActive: false });

        expect(await rankWith(accounts, USER_ID)).toBeNull();
      });

      // Opting out of the leaderboard opts you out of the prize it decides.
      it('does not rank a user who declined leaderboard consent', async () => {
        const accounts = defaultAccounts();
        accounts[0] = account(1, 5000, { leaderboardConsent: { given: false } });

        expect(await rankWith(accounts, USER_ID)).toBeNull();
      });

      /*
       * The defect this replaced: prize ranking filtered on isActive alone, so
       * an opted-out user still occupied a rank and pushed everyone below them
       * down one — including across the smartphone boundary.
       */
      it('does not let an opted-out user occupy a rank', async () => {
        const accounts = defaultAccounts();
        accounts[1] = account(2, 4000, { leaderboardConsent: { given: false } });

        expect(await rankWith(accounts, '660000000000000000000003')).toBe(2);
        expect(await rankWith(accounts, RANK_6_USER)).toBe(5);
      });

      it('promotes a user into smartphone range when someone above opts out', async () => {
        const accounts = defaultAccounts();
        accounts[1] = account(2, 4000, { leaderboardConsent: { given: false } });
        const scoped = buildMocks(accounts);

        // Rank 4 → 3, which is the cutoff.
        const result = await buildService(scoped).getClaimStatus(RANK_4_USER);

        expect(result.rank).toBe(3);
        expect(result.eligiblePrizeType).toBe(PrizeType.SMARTPHONE);
      });
    });

    describe('ties', () => {
      /*
       * Sorting on points alone leaves ties in an order MongoDB does not
       * guarantee between calls, so a user could be shown rank 5 and then
       * rejected as rank 6 when they claimed. The _id tiebreak removes that.
       */
      const tied = () => [account(1, 5000), account(2, 5000), account(3, 5000)];

      it('gives tied users distinct ranks', async () => {
        const scoped = buildMocks(tied());
        const svc = buildService(scoped);

        const ranks = await Promise.all(
          ['660000000000000000000001', '660000000000000000000002', '660000000000000000000003'].map(
            async id => (await svc.getClaimStatus(id)).rank,
          ),
        );

        expect(ranks).toEqual([1, 2, 3]);
      });

      it('breaks the tie the same way on every call', async () => {
        const scoped = buildMocks(tied());
        const svc = buildService(scoped);

        const first = await svc.getClaimStatus('660000000000000000000002');
        const second = await svc.getClaimStatus('660000000000000000000002');

        expect(first.rank).toBe(second.rank);
      });
    });

    it('ranks a lone participant first', async () => {
      expect(await rankWithSingle()).toBe(1);
    });

    async function rankWithSingle() {
      const scoped = buildMocks([account(1, 0)]);
      return (await buildService(scoped).getClaimStatus(USER_ID)).rank;
    }
  });

  // ─── claimSmartphone ────────────────────────────────────────────────────────

  describe('claimSmartphone', () => {
    it('should create a pending smartphone claim for rank 1 user', async () => {
      const result = await service.claimSmartphone(USER_ID);

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID_OBJ,
          prizeType: PrizeType.SMARTPHONE,
          status: PrizeClaimStatus.PENDING,
          rank: 1,
        }),
      );
      expect(result.prizeType).toBe(PrizeType.SMARTPHONE);
    });

    it.each([RANK_4_USER, RANK_6_USER])('should reject rank past the cutoff (%s)', async userId => {
      await expect(service.claimSmartphone(userId)).rejects.toThrow(BadRequestException);
    });

    it('should reject when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate claims', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue(makeClaim());

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow(ConflictException);
    });

    it('should send admin notification email on success', async () => {
      await service.claimSmartphone(USER_ID);

      // Allow async fire-and-forget to settle
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mocks.emailService.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Smartphone claimed') }),
        expect.objectContaining({ userId: 'admin@test.com' }),
      );
    });

    it('should not crash when ADMIN_NOTIFICATION_EMAILS is not configured', async () => {
      mocks.configService.get.mockReturnValue(undefined);

      const result = await service.claimSmartphone(USER_ID);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.prizeType).toBe(PrizeType.SMARTPHONE);
      expect(mocks.emailService.sendTemplateEmail).not.toHaveBeenCalled();
    });

    it('should reject user not on the leaderboard', async () => {
      await expect(service.claimSmartphone(UNKNOWN_USER)).rejects.toThrow(BadRequestException);
    });
  });

  // ─── claimDiscount ──────────────────────────────────────────────────────────

  describe('claimDiscount', () => {
    it('should create a pending discount claim with establishment reference', async () => {
      const result = await service.claimDiscount(RANK_6_USER, EST_ID);

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prizeType: PrizeType.DISCOUNT,
          status: PrizeClaimStatus.PENDING,
          rank: 6,
          establishmentName: 'Test Restaurant',
        }),
      );
      expect(result.prizeType).toBe(PrizeType.DISCOUNT);
    });

    it('should reject a top 3 user from claiming discount', async () => {
      await expect(service.claimDiscount(USER_ID, EST_ID)).rejects.toThrow(BadRequestException);
    });

    it('should let the first rank past the cutoff claim a discount', async () => {
      const result = await service.claimDiscount(RANK_4_USER, EST_ID);

      expect(result.prizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(4);
    });

    it('should reject when establishment not found', async () => {
      mocks.establishmentModel.findById.mockResolvedValue(null);

      await expect(service.claimDiscount(RANK_6_USER, EST_ID)).rejects.toThrow(NotFoundException);
    });

    it('should reject duplicate claims', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue(makeClaim({ prizeType: PrizeType.DISCOUNT }));

      await expect(service.claimDiscount(RANK_6_USER, EST_ID)).rejects.toThrow(ConflictException);
    });

    it('should reject when no challenge has ended', async () => {
      mocks.goalModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      await expect(service.claimDiscount(RANK_6_USER, EST_ID)).rejects.toThrow(BadRequestException);
    });

    it('should reject user not on the leaderboard', async () => {
      await expect(service.claimDiscount(UNKNOWN_USER, EST_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── a season that fell short ───────────────────────────────────────────────

  /*
   * The smartphone is the community's prize, unlocked by hitting the bag
   * target; the discount voucher is the personal payout for the points you
   * earned yourself. So a season that fell short pays nobody a phone and pays
   * everybody a discount — the top 3 included.
   *
   * Previously getEndedGoal() selected on endDate alone and never consulted
   * currentCount, so the top ranks collected smartphones for a failed season.
   */
  describe('when the community missed its bag goal', () => {
    let missed: ReturnType<typeof buildMocks>;
    let missedService: PrizeClaimService;

    beforeEach(() => {
      missed = buildMocks();
      missed.goalModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeMissedGoal()),
      });
      missedService = buildService(missed);
    });

    it('reports the goal as missed', async () => {
      const result = await missedService.getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(false);
    });

    it.each([USER_ID, RANK_4_USER, RANK_6_USER])(
      'offers %s a discount rather than a smartphone',
      async userId => {
        const result = await missedService.getClaimStatus(userId);

        expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
      },
    );

    it('refuses a smartphone claim even from rank 1', async () => {
      await expect(missedService.claimSmartphone(USER_ID)).rejects.toThrow(BadRequestException);
    });

    // The user must be told the community fell short, not that they are the
    // wrong rank — they are rank 1.
    it('says the community fell short rather than blaming the rank', async () => {
      const message = await missedService.claimSmartphone(USER_ID).catch((e: Error) => e.message);

      expect(message).toMatch(/did not reach its goal/i);
      expect(message).not.toMatch(/rank/i);
    });

    // The rule this whole block exists for: the top 3 fall back to the
    // discount, so the "claim a smartphone instead" guard must not fire.
    it('lets rank 1 claim a discount instead', async () => {
      const result = await missedService.claimDiscount(USER_ID, EST_ID);

      expect(result.prizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(1);
    });

    it('still refuses an unranked user', async () => {
      await expect(missedService.claimDiscount(UNKNOWN_USER, EST_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    // Exactly on target is a success, not a shortfall.
    it('treats hitting the target exactly as reached', async () => {
      const exact = buildMocks();
      exact.goalModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeGoal({ currentCount: 30_000, targetCount: 30_000 })),
      });

      const result = await buildService(exact).getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(true);
      expect(result.eligiblePrizeType).toBe(PrizeType.SMARTPHONE);
    });

    // One bag short is still short.
    it('treats one bag short as missed', async () => {
      const nearly = buildMocks();
      nearly.goalModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeGoal({ currentCount: 29_999, targetCount: 30_000 })),
      });

      const result = await buildService(nearly).getClaimStatus(USER_ID);

      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
    });

    // Overshooting is normal — the season runs its full term either way.
    it('treats overshooting the target as reached', async () => {
      const over = buildMocks();
      over.goalModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeGoal({ currentCount: 34_000, targetCount: 30_000 })),
      });

      const result = await buildService(over).getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(true);
      expect(result.eligiblePrizeType).toBe(PrizeType.SMARTPHONE);
    });
  });

  // ─── concurrent claims ──────────────────────────────────────────────────────

  /*
   * ensureNoDuplicateClaim reads and then writes, so two requests arriving
   * together both pass the read. The unique index is what actually stops the
   * second claim — but an unhandled E11000 surfaced as a 500, telling the user
   * the app broke when it had correctly refused a double claim.
   */
  describe('when two claims race past the pre-check', () => {
    const claimIndex = { userId: 1, cycleNumber: 1 };
    const votingIndex = { userId: 1, votingCycleId: 1 };

    it.each([
      ['the cycle index', claimIndex],
      ['the voting-cycle index', votingIndex],
    ])('reports a conflict when %s rejects the write', async (_name, keyPattern) => {
      mocks.prizeClaimModel.create.mockRejectedValue(duplicateKeyError(keyPattern));

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow(ConflictException);
    });

    it('gives the same message as the pre-check, so the path taken is invisible', async () => {
      const preChecked = buildMocks();
      preChecked.prizeClaimModel.findOne.mockResolvedValue(makeClaim());
      const preCheckMessage = await buildService(preChecked)
        .claimSmartphone(USER_ID)
        .catch((e: Error) => e.message);

      const racing = buildMocks();
      racing.prizeClaimModel.create.mockRejectedValue(duplicateKeyError(claimIndex));
      const raceMessage = await buildService(racing)
        .claimSmartphone(USER_ID)
        .catch((e: Error) => e.message);

      expect(raceMessage).toBe(preCheckMessage);
      expect(raceMessage).toMatch(/already claimed/);
    });

    it('applies to the discount path too', async () => {
      mocks.prizeClaimModel.create.mockRejectedValue(duplicateKeyError(claimIndex));

      await expect(service.claimDiscount(RANK_6_USER, EST_ID)).rejects.toThrow(ConflictException);
    });

    // A voucher collision is an internal problem, not "you already claimed" —
    // reporting it as a conflict would tell the user to stop trying.
    it('does not treat a voucher-code collision as a duplicate claim', async () => {
      mocks.prizeClaimModel.create.mockRejectedValue(duplicateKeyError({ voucherCode: 1 }));

      await expect(service.claimDiscount(RANK_6_USER, EST_ID)).rejects.not.toThrow(
        ConflictException,
      );
    });

    it('lets an unrelated write failure surface unchanged', async () => {
      mocks.prizeClaimModel.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.claimSmartphone(USER_ID)).rejects.toThrow('connection lost');
    });
  });
});
