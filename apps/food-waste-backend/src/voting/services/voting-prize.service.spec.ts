/**
 * The vote decides WHAT the prize is. The leaderboard decides WHO gets it.
 *
 * These two rules used to be one, and it produced a perverse outcome: winners
 * were the top *voters who had backed the winning prize*, so the #1 user in the
 * country won nothing if they voted for the phone and the scooter won, while
 * someone at rank #14 who happened to back the scooter took a prize. Voting is
 * not a lottery ticket, and these tests exist to keep it that way.
 */

import { BadRequestException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { LoyaltyAccount } from '../../loyalty/schemas/loyalty-account.schema';
import { PrizeClaim, PrizeType } from '../../loyalty/schemas/prize-claim.schema';
import { EmailNotificationService } from '../../notifications/services/email-notification.service';
import { PushNotificationService } from '../../notifications/services/push-notification.service';
import { VotingCycle } from '../schemas/voting-cycle.schema';

import { VotingPrizeService } from './voting-prize.service';

const PRIZE_ID = new Types.ObjectId();
const CYCLE_ID = new Types.ObjectId();

/** Leaderboard positions 1..5, descending by points. */
const leaderboard = [
  { userId: new Types.ObjectId(), totalPoints: 5000 },
  { userId: new Types.ObjectId(), totalPoints: 4000 },
  { userId: new Types.ObjectId(), totalPoints: 3000 },
  { userId: new Types.ObjectId(), totalPoints: 2000 },
  { userId: new Types.ObjectId(), totalPoints: 1000 },
];

const idAt = (position: number): string => {
  const row = leaderboard[position - 1];
  if (!row) {
    throw new Error(`No fixture at position ${position}`);
  }
  return row.userId.toString();
};

const makeCycle = (over: Record<string, unknown> = {}) => ({
  _id: CYCLE_ID,
  name: 'Season 1',
  cycleNumber: 1,
  recipientCount: 3,
  winnerPrizeId: PRIZE_ID,
  winner: { prizeId: PRIZE_ID, name: 'Electric Scooter', totalWeightedVotes: 90, voterCount: 40 },
  prizes: [{ _id: PRIZE_ID, name: 'Electric Scooter', category: 'ELECTRIC_SCOOTER' }],
  ...over,
});

/**
 * Mirrors `find().sort().limit().select().lean()`.
 *
 * `limit` is applied for real rather than ignored — otherwise a service that
 * forgot to limit would still pass, which is the whole point of recipientCount.
 */
interface FakeLeaderboardQuery {
  sort: jest.Mock;
  limit: jest.Mock;
  select: jest.Mock;
  lean: jest.Mock;
}

const buildLoyaltyModel = (rows: typeof leaderboard = leaderboard) => {
  const query: FakeLeaderboardQuery = {
    sort: jest.fn(() => query),
    // Re-arms `lean` rather than storing the count, so a service that forgets
    // to call limit() resolves the whole list and the recipientCount tests fail.
    limit: jest.fn((n: number) => {
      query.lean.mockResolvedValue(rows.slice(0, n));
      return query;
    }),
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(rows),
  };
  return { find: jest.fn(() => query), _query: query };
};

const buildMocks = (over: { cycle?: unknown; rows?: typeof leaderboard } = {}) => {
  const loyaltyModel = buildLoyaltyModel(over.rows ?? leaderboard);
  const cycle = 'cycle' in over ? over.cycle : makeCycle();
  const cycleModel = {
    findOne: jest.fn(() => ({
      sort: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(cycle) })),
    })),
  };
  const prizeClaimModel = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
  };
  const push = { send: jest.fn().mockResolvedValue(undefined) };
  const email = { sendTemplateEmail: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('admin@test.com') };

  return { loyaltyModel, cycleModel, prizeClaimModel, push, email, config };
};

const buildService = async (mocks: ReturnType<typeof buildMocks>) => {
  const moduleRef = await Test.createTestingModule({
    providers: [
      VotingPrizeService,
      { provide: getModelToken(VotingCycle.name), useValue: mocks.cycleModel },
      { provide: getModelToken(LoyaltyAccount.name), useValue: mocks.loyaltyModel },
      { provide: getModelToken(PrizeClaim.name), useValue: mocks.prizeClaimModel },
      { provide: PushNotificationService, useValue: mocks.push },
      { provide: EmailNotificationService, useValue: mocks.email },
      { provide: ConfigService, useValue: mocks.config },
    ],
  }).compile();
  return moduleRef.get(VotingPrizeService);
};

describe('VotingPrizeService', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let service: VotingPrizeService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mocks = buildMocks();
    service = await buildService(mocks);
  });

  // ─── who wins ───────────────────────────────────────────────────────────────

  describe('getPrizeWinners', () => {
    it('takes the leaderboard top N in order', async () => {
      const rows = await service.getPrizeWinners(3);

      expect(rows).toEqual([
        { userId: idAt(1), rank: 1, pointsSnapshot: 5000 },
        { userId: idAt(2), rank: 2, pointsSnapshot: 4000 },
        { userId: idAt(3), rank: 3, pointsSnapshot: 3000 },
      ]);
    });

    // The whole point of the rewrite: nobody's vote is consulted.
    it('does not read votes at all', async () => {
      await service.getPrizeWinners(3);

      expect(mocks.loyaltyModel.find).toHaveBeenCalled();
    });

    it('ranks by the shared leaderboard predicate and sort', async () => {
      await service.getPrizeWinners(3);

      expect(mocks.loyaltyModel.find).toHaveBeenCalledWith({ isActive: true });
      // The _id tiebreak matters: without it ties resolve in an order MongoDB
      // does not guarantee, so the winner set could change under the same data.
      expect(mocks.loyaltyModel._query.sort).toHaveBeenCalledWith({ totalPoints: -1, _id: 1 });
    });

    it('is configurable — an admin can run a 5-winner season', async () => {
      const rows = await service.getPrizeWinners(5);

      expect(rows).toHaveLength(5);
      expect(rows[4]).toEqual({ userId: idAt(5), rank: 5, pointsSnapshot: 1000 });
    });

    it.each([0, -1])('returns nothing for a recipientCount of %i', async count => {
      expect(await service.getPrizeWinners(count)).toEqual([]);
    });

    // Fewer players than prize slots — a young season, or a tiny community.
    it('returns everyone when there are fewer users than slots', async () => {
      const small = buildMocks({ rows: leaderboard.slice(0, 2) });

      const rows = await (await buildService(small)).getPrizeWinners(3);

      expect(rows).toHaveLength(2);
    });

    it('returns nothing when the leaderboard is empty', async () => {
      const empty = buildMocks({ rows: [] });

      expect(await (await buildService(empty)).getPrizeWinners(3)).toEqual([]);
    });
  });

  // ─── my prize ───────────────────────────────────────────────────────────────

  describe('getMyPrize', () => {
    it('tells the top rank they won, and what they won', async () => {
      const result = await service.getMyPrize(idAt(1));

      expect(result.isWinner).toBe(true);
      expect(result.rank).toBe(1);
      expect(result.prizeName).toBe('Electric Scooter');
    });

    it('includes the last winning rank', async () => {
      expect((await service.getMyPrize(idAt(3))).isWinner).toBe(true);
    });

    // The boundary: recipientCount is 3, so #4 misses.
    it('tells the first rank past the cutoff they did not win', async () => {
      const result = await service.getMyPrize(idAt(4));

      expect(result.isWinner).toBe(false);
      expect(result.rank).toBeNull();
    });

    // Still worth naming the prize — the screen says what the community chose.
    it('names the prize even for a non-winner', async () => {
      expect((await service.getMyPrize(idAt(4))).prizeName).toBe('Electric Scooter');
    });

    it('reports nothing when no cycle has completed', async () => {
      const none = buildMocks({ cycle: null });

      expect((await (await buildService(none)).getMyPrize(idAt(1))).isWinner).toBe(false);
    });

    it('reports nothing when a completed cycle has no winning prize', async () => {
      const noWinner = buildMocks({ cycle: makeCycle({ winnerPrizeId: null }) });

      expect((await (await buildService(noWinner)).getMyPrize(idAt(1))).isWinner).toBe(false);
    });

    it('reflects an existing claim', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue({ status: 'pending' });

      expect((await service.getMyPrize(idAt(1))).hasClaimed).toBe(true);
    });
  });

  // ─── claiming ───────────────────────────────────────────────────────────────

  describe('claimPrize', () => {
    it('records what was actually won, not a discount', async () => {
      await service.claimPrize(idAt(1));

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          prizeType: PrizeType.GRAND_PRIZE,
          prizeName: 'Electric Scooter',
          prizeCategory: 'ELECTRIC_SCOOTER',
          rank: 1,
        }),
      );
    });

    /*
     * The grand prize is a physical item an admin delivers. Demanding an
     * establishment for a scooter asked a question with no answer, and the
     * voucher code implied a redemption that never happens.
     */
    it('asks for no establishment and mints no voucher', async () => {
      await service.claimPrize(idAt(1));

      const written = mocks.prizeClaimModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(written).not.toHaveProperty('establishmentId');
      expect(written).not.toHaveProperty('voucherCode');
    });

    it('refuses a rank past the cutoff', async () => {
      await expect(service.claimPrize(idAt(4))).rejects.toThrow(BadRequestException);
    });

    // Tells them the rule, not just "no".
    it('says how many ranks win', async () => {
      const message = await service.claimPrize(idAt(4)).catch((e: Error) => e.message);

      expect(message).toMatch(/top 3/i);
    });

    it('refuses a user who is not on the leaderboard at all', async () => {
      await expect(service.claimPrize(new Types.ObjectId().toString())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses when no cycle has completed', async () => {
      const none = buildMocks({ cycle: null });

      await expect((await buildService(none)).claimPrize(idAt(1))).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuses a second claim', async () => {
      mocks.prizeClaimModel.findOne.mockResolvedValue({ _id: new Types.ObjectId() });

      await expect(service.claimPrize(idAt(1))).rejects.toThrow(ConflictException);
    });

    /*
     * The pre-check reads then writes, so two requests arriving together both
     * pass it. The partial unique index is what actually stops the second, and
     * an unhandled E11000 would surface as a 500 — the app reporting a fault
     * when it had correctly refused a double claim.
     */
    it('turns a racing duplicate into the same conflict', async () => {
      mocks.prizeClaimModel.create.mockRejectedValue(
        Object.assign(new Error('dup'), { code: 11000 }),
      );

      await expect(service.claimPrize(idAt(1))).rejects.toThrow(ConflictException);
    });

    it('lets an unrelated write failure surface unchanged', async () => {
      mocks.prizeClaimModel.create.mockRejectedValue(new Error('connection lost'));

      await expect(service.claimPrize(idAt(1))).rejects.toThrow('connection lost');
    });

    // An admin editing the catalogue later must not rewrite what a user was
    // told they won, so the name is copied onto the claim rather than referenced.
    it('snapshots the prize name onto the claim', async () => {
      await service.claimPrize(idAt(2));

      expect(mocks.prizeClaimModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ prizeName: 'Electric Scooter' }),
      );
    });

    it('claims without a prize name when the cycle has no winner record', async () => {
      const nameless = buildMocks({ cycle: makeCycle({ winner: undefined }) });

      await (await buildService(nameless)).claimPrize(idAt(1));

      const written = nameless.prizeClaimModel.create.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(written).not.toHaveProperty('prizeName');
    });
  });

  // ─── admin notification ─────────────────────────────────────────────────────

  /*
   * Moved here from the deleted bag-goal claim path. A grand prize is
   * physically shipped, so an admin has to learn a claim is waiting — losing
   * this in the consolidation would have been silent.
   */
  describe('telling the admins', () => {
    const flush = async () => {
      const done = await new Promise(resolve => setTimeout(resolve, 10));
      return done;
    };

    it('emails the admins when a prize is claimed', async () => {
      await service.claimPrize(idAt(1));
      await flush();

      expect(mocks.email.sendTemplateEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: expect.stringContaining('Electric Scooter') }),
        expect.objectContaining({ userId: 'admin@test.com' }),
      );
    });

    it('names the winner rank and prize in the email', async () => {
      await service.claimPrize(idAt(2));
      await flush();

      const [payload] = mocks.email.sendTemplateEmail.mock.calls[0] as [{ textBody: string }];
      expect(payload.textBody).toContain('#2');
      expect(payload.textBody).toContain('Electric Scooter');
    });

    it('emails every configured admin', async () => {
      const many = buildMocks();
      many.config.get.mockReturnValue('a@test.com, b@test.com');

      await (await buildService(many)).claimPrize(idAt(1));
      await flush();

      expect(many.email.sendTemplateEmail).toHaveBeenCalledTimes(2);
    });

    it('skips quietly when no admin address is configured', async () => {
      const none = buildMocks();
      none.config.get.mockReturnValue(undefined);

      const result = await (await buildService(none)).claimPrize(idAt(1));
      await flush();

      expect(result.hasClaimed).toBe(false); // claim still succeeded
      expect(none.email.sendTemplateEmail).not.toHaveBeenCalled();
    });

    // A broken mail server must not turn a successful claim into an error.
    it('does not fail the claim when the email fails', async () => {
      mocks.email.sendTemplateEmail.mockRejectedValue(new Error('smtp down'));

      await expect(service.claimPrize(idAt(1))).resolves.toBeDefined();
      await flush();
    });
  });

  // ─── notifications ──────────────────────────────────────────────────────────

  describe('notifyWinners', () => {
    it('notifies exactly the leaderboard top N', async () => {
      await service.notifyWinners(CYCLE_ID.toString(), 3, 'Electric Scooter');

      expect(mocks.push.send).toHaveBeenCalledTimes(3);
    });

    // The message must not say "in the vote" — the vote picked the prize, the
    // leaderboard picked the winners, and telling them otherwise re-teaches the
    // wrong rule.
    it('credits the leaderboard, not the vote', async () => {
      await service.notifyWinners(CYCLE_ID.toString(), 1, 'Electric Scooter');

      const [payload] = mocks.push.send.mock.calls[0] as [{ body: string }];
      expect(payload.body).toMatch(/leaderboard/i);
      expect(payload.body).not.toMatch(/in the community vote/i);
    });

    it('names the prize that was won', async () => {
      await service.notifyWinners(CYCLE_ID.toString(), 1, 'Electric Scooter');

      const [payload] = mocks.push.send.mock.calls[0] as [{ body: string }];
      expect(payload.body).toContain('Electric Scooter');
    });

    // Never blocks tally — one dead device token must not stop the season.
    it('survives a push failure', async () => {
      mocks.push.send.mockRejectedValue(new Error('no device token'));

      await expect(
        service.notifyWinners(CYCLE_ID.toString(), 3, 'Electric Scooter'),
      ).resolves.toBeUndefined();
    });

    it('survives the winner lookup failing', async () => {
      mocks.loyaltyModel.find.mockImplementation(() => {
        throw new Error('db down');
      });

      await expect(
        service.notifyWinners(CYCLE_ID.toString(), 3, 'Electric Scooter'),
      ).resolves.toBeUndefined();
    });

    it('sends nothing when there is nobody to notify', async () => {
      const empty = buildMocks({ rows: [] });

      await (await buildService(empty)).notifyWinners(CYCLE_ID.toString(), 3, 'Scooter');

      expect(empty.push.send).not.toHaveBeenCalled();
    });
  });
});
