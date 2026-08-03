/**
 * `GamificationService.awardReviewPoints` — the idempotency of review points.
 *
 * Loyalty points are currency: they buy discounts. So "award this once" is a
 * money property, not a nicety.
 *
 * The implementation this replaced read the account, checked `reviewedOrderIds`
 * in memory, awarded points, then wrote the whole `reviewTracking` sub-document
 * back. Two overlapping submissions both read the pre-write array and the
 * second write replaced the first, dropping an order id — after which that
 * order was claimable again, for real points. These tests pin the properties
 * that close that window, and they are written against the *shape* of the
 * database call, because the concurrency itself lives inside MongoDB and cannot
 * be observed from here.
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { LOYALTY_REVIEWED_ORDER_IDS_MAX } from '../../../common/constants/document-limits.constant';
import { CronLockService } from '../../../common/services/cron-lock.service';
import { User } from '../../../users/schemas/user.schema';
import { LoyaltyService } from '../../loyalty.service';
import { LoyaltyAccount } from '../../schemas/loyalty-account.schema';
import { ReferredIdentity } from '../../schemas/referred-identity.schema';
import { GAMIFICATION_CONSTANTS, GamificationService } from '../gamification.service';

import type { TestingModule } from '@nestjs/testing';

/** Six words — the minimum the rules accept. */
const VALID_REVIEW = 'the bread here was genuinely excellent';

describe('GamificationService.awardReviewPoints', () => {
  let service: GamificationService;

  const userId = new Types.ObjectId().toHexString();
  const orderId = new Types.ObjectId().toHexString();

  const loyaltyModel = {
    updateOne: jest.fn(),
    exists: jest.fn(),
  };
  const loyaltyService = { addPoints: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    // Default: the claim succeeds — this order had not been reviewed before.
    loyaltyModel.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    loyaltyModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });
    loyaltyService.addPoints.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: getModelToken(LoyaltyAccount.name), useValue: loyaltyModel },
        { provide: getModelToken(ReferredIdentity.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: LoyaltyService, useValue: loyaltyService },
        { provide: CronLockService, useValue: { runExclusive: jest.fn() } },
      ],
    }).compile();

    service = module.get(GamificationService);
  });

  describe('the claim is atomic', () => {
    it('puts the duplicate check in the filter, not in application code', async () => {
      /*
       * This is the whole fix. Evaluating "not already claimed" inside the
       * filter makes MongoDB test it under the document write lock, so exactly
       * one of two concurrent claims can match. Reading the array first and
       * checking it in Node cannot be made safe by any amount of care.
       */
      await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      const [filter] = loyaltyModel.updateOne.mock.calls[0];
      expect(filter).toEqual({
        userId: expect.any(Types.ObjectId),
        'reviewTracking.reviewedOrderIds': { $ne: expect.any(Types.ObjectId) },
      });
      expect(filter['reviewTracking.reviewedOrderIds'].$ne.toHexString()).toBe(orderId);
    });

    it('claims and increments in one update', async () => {
      // Two updates would reintroduce the lost-update window they replaced,
      // just between the push and the $inc instead.
      await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      expect(loyaltyModel.updateOne).toHaveBeenCalledTimes(1);

      const [, update] = loyaltyModel.updateOne.mock.calls[0];
      expect(update.$inc).toEqual({
        'reviewTracking.totalReviewsCount': 1,
        'reviewTracking.totalReviewPoints': GAMIFICATION_CONSTANTS.REVIEW_POINTS,
      });
    });

    it('uses $inc rather than writing a computed total', async () => {
      // A computed total is a read-modify-write wearing a different hat: two
      // concurrent reviews would each write "the count I read, plus one".
      const [, update] = (await service
        .awardReviewPoints(userId, orderId, VALID_REVIEW)
        .then(() => loyaltyModel.updateOne.mock.calls[0])) as [unknown, Record<string, unknown>];

      expect(update).not.toHaveProperty('$set');
      expect(update).toHaveProperty('$inc');
    });

    it('bounds the ledger with $slice so it cannot grow forever', async () => {
      // The array gains an entry per reviewed order and is never pruned by
      // anything else. Unbounded, it walks toward the 16 MB document limit,
      // which fails hard and without warning.
      await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      const [, update] = loyaltyModel.updateOne.mock.calls[0];
      expect(update.$push['reviewTracking.reviewedOrderIds'].$slice).toBe(
        -LOYALTY_REVIEWED_ORDER_IDS_MAX,
      );
    });

    it('stores the order id as an ObjectId, not a string', async () => {
      // The field is `[Types.ObjectId]`. Pushing a string would make the $ne
      // guard never match on the next claim — silently restoring the double-award
      // bug while every test that only checks "it was pushed" still passed.
      await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      const [, update] = loyaltyModel.updateOne.mock.calls[0];
      const [pushed] = update.$push['reviewTracking.reviewedOrderIds'].$each;
      expect(pushed).toBeInstanceOf(Types.ObjectId);
      expect(pushed.toHexString()).toBe(orderId);
    });
  });

  describe('ordering of the two writes', () => {
    it('claims before awarding, so a crash between them cannot pay twice', async () => {
      /*
       * The two writes are not in a transaction, so one must go first and the
       * gap must be survivable. Claim-then-award loses a user 10 points on a
       * crash; award-then-claim lets them re-review and be paid again. Failing
       * closed on the money is the correct trade, and it is invisible unless
       * pinned here.
       */
      await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      // `invocationCallOrder` is a global monotonic counter across all jest
      // mocks, so comparing the two first calls gives real relative ordering
      // without custom mock implementations.
      const [claimedAt] = loyaltyModel.updateOne.mock.invocationCallOrder;
      const [awardedAt] = loyaltyService.addPoints.mock.invocationCallOrder;

      // Both must exist before comparing, or an ordering assertion could pass
      // vacuously because one of the calls never happened at all.
      expect(claimedAt).toBeDefined();
      expect(awardedAt).toBeDefined();
      expect(Number(claimedAt)).toBeLessThan(Number(awardedAt));
    });

    it('propagates a failed award instead of reporting success', async () => {
      // The claim is already committed and the points are not credited. The
      // caller must not be told this succeeded, or the discrepancy is invisible.
      loyaltyService.addPoints.mockRejectedValue(new Error('points ledger unavailable'));

      await expect(service.awardReviewPoints(userId, orderId, VALID_REVIEW)).rejects.toThrow(
        'points ledger unavailable',
      );
    });
  });

  describe('rejections', () => {
    it('rejects a review below the word minimum without writing anything', async () => {
      const result = await service.awardReviewPoints(userId, orderId, 'too short');

      expect(result.awarded).toBe(false);
      expect(result.pointsAwarded).toBe(0);
      // Validating before the write keeps the common rejection off the database
      // entirely — and proves the guard runs first, not merely that it runs.
      expect(loyaltyModel.updateOne).not.toHaveBeenCalled();
      expect(loyaltyService.addPoints).not.toHaveBeenCalled();
    });

    it.each([
      ['   ', 'whitespace only'],
      ['', 'empty'],
      ['one two three four five', 'one word short of the minimum'],
    ])('rejects %s review text (%s)', async text => {
      const result = await service.awardReviewPoints(userId, orderId, text);

      expect(result.awarded).toBe(false);
      expect(loyaltyModel.updateOne).not.toHaveBeenCalled();
    });

    it('accepts a review with irregular spacing at exactly the minimum', async () => {
      // Boundary: six words separated by newlines and doubled spaces. Splitting
      // on /\s+/ without filtering empties would miscount this as seven.
      const result = await service.awardReviewPoints(
        userId,
        orderId,
        '  the  bread\nhere was\t genuinely excellent  ',
      );

      expect(result.awarded).toBe(true);
    });

    it('reports a duplicate when the order was already claimed', async () => {
      loyaltyModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
      loyaltyModel.exists.mockResolvedValue({ _id: new Types.ObjectId() });

      const result = await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      expect(result).toEqual({
        awarded: false,
        pointsAwarded: 0,
        reason: 'Already reviewed this order',
      });
      // The decisive assertion: a duplicate must not reach the points ledger.
      expect(loyaltyService.addPoints).not.toHaveBeenCalled();
    });

    it('distinguishes a missing account from a duplicate', async () => {
      // Both surface as matchedCount 0. Collapsing them would report a genuine
      // data problem as an ordinary duplicate submission and hide it.
      loyaltyModel.updateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
      loyaltyModel.exists.mockResolvedValue(null);

      const result = await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      expect(result.reason).toBe('Loyalty account not found');
      expect(loyaltyService.addPoints).not.toHaveBeenCalled();
    });

    it('does not pay a second time when the same claim is replayed', async () => {
      // End-to-end shape of the bug this fixes: first call wins, second finds
      // the guard already satisfied and is refused.
      loyaltyModel.updateOne
        .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 })
        .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

      const first = await service.awardReviewPoints(userId, orderId, VALID_REVIEW);
      const second = await service.awardReviewPoints(userId, orderId, VALID_REVIEW);

      expect(first.awarded).toBe(true);
      expect(second.awarded).toBe(false);
      expect(loyaltyService.addPoints).toHaveBeenCalledTimes(1);
    });
  });
});
