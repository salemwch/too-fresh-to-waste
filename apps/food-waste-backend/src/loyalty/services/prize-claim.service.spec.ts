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

/**
 * A season that ended having met its bag target.
 *
 * A VotingCycle, not a MonthlyBagGoal. The two both count bags but are
 * different features — the mini-goal repeats every 500 bags and pays points,
 * the season runs to 30,000 and unlocks the grand prize. Gating prizes on the
 * mini-goal meant they unlocked at 500.
 */
const makeGoal = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  cycleNumber: 1,
  cycleEndDate: new Date('2025-01-01'),
  seasonBagProgress: 30_000,
  seasonBagTarget: 30_000,
  // How many top ranks win — admin-set per cycle, no longer hardcoded.
  recipientCount: 3,
  ...overrides,
});

/** A season that ended short of its target — no grand prize is unlocked. */
const makeMissedGoal = (overrides: Record<string, unknown> = {}) =>
  makeGoal({ seasonBagProgress: 22_000, seasonBagTarget: 30_000, ...overrides });

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
  totalBagsSaved: number;
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
  // Anyone with points has saved bags; the zero case is tested explicitly.
  totalBagsSaved: 1,
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

  /*
   * Fail on any predicate key this mock does not implement.
   *
   * Without it the mock silently ignores whatever it does not understand, so a
   * ranking filter that started excluding people again would be invisible here
   * — every test would keep passing against the bug. Learned the hard way: the
   * first version asserted `not.toHaveProperty('leaderboardConsent.given')`,
   * which Jest reads as the *path* leaderboardConsent → given, so it never
   * matched the literal dotted key and the mutation slipped through.
   */
  const supported = new Set(['isActive', '$or']);
  const unsupported = Object.keys(filter).filter(k => !supported.has(k));
  if (unsupported.length > 0) {
    throw new Error(
      `countOutranking does not implement filter key(s): ${unsupported.join(', ')}. ` +
        'Update the mock to match the real predicate, then check the tests still hold.',
    );
  }

  return accounts.filter(a => {
    if (a.isActive !== filter['isActive']) {
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

  const seasonModel = {
    findOne: jest.fn().mockReturnValue({
      sort: jest.fn().mockResolvedValue(makeGoal()),
    }),
  };

  const establishmentModel = {
    findById: jest.fn().mockResolvedValue({ _id: EST_ID, name: 'Test Restaurant' }),
  };

  return {
    prizeClaimModel,
    loyaltyModel,
    seasonModel,
    establishmentModel,
  };
};

const buildService = (mocks: ReturnType<typeof buildMocks>) =>
  new PrizeClaimService(
    mocks.prizeClaimModel as never,
    mocks.loyaltyModel as never,
    mocks.seasonModel as never,
    mocks.establishmentModel as never,
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
      mocks.seasonModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      const result = await service.getClaimStatus(USER_ID);

      expect(result).toEqual({
        hasClaimed: false,
        claim: null,
        eligiblePrizeType: null,
        rank: null,
        targetReached: false,
        recipientCount: 0,
      });
    });

    it('should return the grand prize as eligible for a top-ranked user', async () => {
      const result = await service.getClaimStatus(USER_ID);

      expect(result.hasClaimed).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.GRAND_PRIZE);
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

      /*
       * Hiding your name hides the name, not the player. Consent controls
       * whether the leaderboard prints "Sara" or "Anonymous"; it has nothing to
       * do with whether Sara is ranked or whether she wins.
       *
       * This was briefly implemented the other way, and it produced exactly the
       * defect it was meant to prevent: the public list renumbered around the
       * hidden user, so the rank shown to everyone below was not the rank their
       * prize was decided on.
       */
      describe('a user who has not consented to show their name', () => {
        const hidden = () => {
          const accounts = defaultAccounts();
          accounts[1] = account(2, 4000, { leaderboardConsent: { given: false } });
          return accounts;
        };

        it('is still ranked', async () => {
          const accounts = defaultAccounts();
          accounts[0] = account(1, 5000, { leaderboardConsent: { given: false } });

          expect(await rankWith(accounts, USER_ID)).toBe(1);
        });

        it('still wins the prize their rank earns', async () => {
          const accounts = defaultAccounts();
          accounts[0] = account(1, 5000, { leaderboardConsent: { given: false } });
          const scoped = buildMocks(accounts);

          const result = await buildService(scoped).getClaimStatus(USER_ID);

          expect(result.eligiblePrizeType).toBe(PrizeType.GRAND_PRIZE);
        });

        it('is offered the grand prize their rank earns', async () => {
          const accounts = defaultAccounts();
          accounts[0] = account(1, 5000, { leaderboardConsent: { given: false } });
          const scoped = buildMocks(accounts);

          const result = await buildService(scoped).getClaimStatus(USER_ID);

          expect(result.eligiblePrizeType).toBe(PrizeType.GRAND_PRIZE);
          expect(result.rank).toBe(1);
        });

        // The point of the whole rule: nobody below them moves.
        it('does not shift the ranks below them', async () => {
          expect(await rankWith(hidden(), '660000000000000000000003')).toBe(3);
          expect(await rankWith(hidden(), RANK_4_USER)).toBe(4);
          expect(await rankWith(hidden(), RANK_6_USER)).toBe(6);
        });

        it('does not push anyone into smartphone range', async () => {
          const scoped = buildMocks(hidden());

          const result = await buildService(scoped).getClaimStatus(RANK_4_USER);

          expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
        });
      });

      // Deactivation removes a player, and it does renumber — a closed account
      // is not in the running at all.
      it('closes the gap left by a deactivated account', async () => {
        const accounts = defaultAccounts();
        accounts[1] = account(2, 4000, { isActive: false });

        expect(await rankWith(accounts, '660000000000000000000003')).toBe(2);
      });

      /*
       * The entry price: you take part by rescuing food. An account that has
       * saved nothing has not taken part, so it does not place and cannot claim
       * the discount — otherwise a brand-new account would be handed a voucher
       * for having done nothing.
       */
      describe('a user who has never saved a bag', () => {
        const noBags = () => {
          const accounts = defaultAccounts();
          accounts[0] = account(1, 5000, { totalBagsSaved: 0 });
          return accounts;
        };

        it('is not ranked', async () => {
          expect(await rankWith(noBags(), USER_ID)).toBeNull();
        });

        it('cannot claim a discount', async () => {
          const scoped = buildMocks(noBags());

          await expect(buildService(scoped).claimDiscount(USER_ID, EST_ID)).rejects.toThrow(
            BadRequestException,
          );
        });

        // One bag is the whole requirement — the boundary, stated.
        it('places as soon as they save one', async () => {
          const accounts = defaultAccounts();
          accounts[0] = account(1, 5000, { totalBagsSaved: 1 });

          expect(await rankWith(accounts, USER_ID)).toBe(1);
        });
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
      mocks.seasonModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

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
      missed.seasonModel.findOne.mockReturnValue({
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

    // The rule this block exists for: with no grand prize unlocked, the top
    // ranks are not steered away from the discount.
    it('does not steer rank 1 toward a grand prize that was not unlocked', async () => {
      const result = await missedService.claimDiscount(USER_ID, EST_ID);

      expect(result.prizeType).toBe(PrizeType.DISCOUNT);
      expect(result.rank).toBe(1);
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
      exact.seasonModel.findOne.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue(makeGoal({ seasonBagProgress: 30_000, seasonBagTarget: 30_000 })),
      });

      const result = await buildService(exact).getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(true);
      expect(result.eligiblePrizeType).toBe(PrizeType.GRAND_PRIZE);
    });

    // One bag short is still short.
    it('treats one bag short as missed', async () => {
      const nearly = buildMocks();
      nearly.seasonModel.findOne.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue(makeGoal({ seasonBagProgress: 29_999, seasonBagTarget: 30_000 })),
      });

      const result = await buildService(nearly).getClaimStatus(USER_ID);

      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
    });

    // Overshooting is normal — the season runs its full term either way.
    it('treats overshooting the target as reached', async () => {
      const over = buildMocks();
      over.seasonModel.findOne.mockReturnValue({
        sort: jest
          .fn()
          .mockResolvedValue(makeGoal({ seasonBagProgress: 34_000, seasonBagTarget: 30_000 })),
      });

      const result = await buildService(over).getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(true);
      expect(result.eligiblePrizeType).toBe(PrizeType.GRAND_PRIZE);
    });
  });

  // ─── season vs mini-goal ────────────────────────────────────────────────────

  /*
   * Two features both count bags and must not be confused:
   *
   *   MonthlyBagGoal  500 bags   → pays points, resets, repeats
   *   VotingCycle       30,000     → unlocks the grand prize, once per season
   *
   * Prize claiming read the mini-goal, so the grand prize unlocked at 500 and
   * claims were filed against the mini-goal's cycle number. These tests pin the
   * season as the only thing consulted.
   */
  describe('reads the season, not the recurring mini-goal', () => {
    it('is unlocked by the season target, not by 500 bags', async () => {
      const scoped = buildMocks();
      scoped.seasonModel.findOne.mockReturnValue({
        // Past the 500 mini-goal, nowhere near the 30,000 season target.
        sort: jest
          .fn()
          .mockResolvedValue(makeGoal({ seasonBagProgress: 600, seasonBagTarget: 30_000 })),
      });

      const result = await buildService(scoped).getClaimStatus(USER_ID);

      expect(result.targetReached).toBe(false);
      expect(result.eligiblePrizeType).toBe(PrizeType.DISCOUNT);
    });

    it('files the claim against the season cycle number', async () => {
      const scoped = buildMocks();
      scoped.seasonModel.findOne.mockReturnValue({
        sort: jest.fn().mockResolvedValue(makeGoal({ cycleNumber: 7 })),
      });

      await buildService(scoped).claimDiscount(RANK_4_USER, EST_ID);

      expect(scoped.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ cycleNumber: 7 }),
      );
    });

    // Scenario F: no season means no grand prize, not a fallback to the
    // mini-goal — which is exactly how the bug read.
    it('reports nothing to claim when no season has ended', async () => {
      const scoped = buildMocks();
      scoped.seasonModel.findOne.mockReturnValue({ sort: jest.fn().mockResolvedValue(null) });

      const result = await buildService(scoped).getClaimStatus(USER_ID);

      expect(result.eligiblePrizeType).toBeNull();
      expect(result.targetReached).toBe(false);
    });

    it('ends the season on cycleEndDate', async () => {
      const scoped = buildMocks();

      await buildService(scoped).getClaimStatus(USER_ID);

      expect(scoped.seasonModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ cycleEndDate: expect.anything() }),
      );
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

      await expect(service.claimDiscount(RANK_4_USER, EST_ID)).rejects.toThrow(ConflictException);
    });

    it('gives the same message as the pre-check, so the path taken is invisible', async () => {
      const preChecked = buildMocks();
      preChecked.prizeClaimModel.findOne.mockResolvedValue(makeClaim());
      const preCheckMessage = await buildService(preChecked)
        .claimDiscount(RANK_4_USER, EST_ID)
        .catch((e: Error) => e.message);

      const racing = buildMocks();
      racing.prizeClaimModel.create.mockRejectedValue(duplicateKeyError(claimIndex));
      const raceMessage = await buildService(racing)
        .claimDiscount(RANK_4_USER, EST_ID)
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

      await expect(service.claimDiscount(RANK_4_USER, EST_ID)).rejects.toThrow('connection lost');
    });
  });
});
