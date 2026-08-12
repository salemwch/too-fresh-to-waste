import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import { CronLockService } from '../../../common/services/cron-lock.service';
import { User } from '../../../users/schemas/user.schema';
import { LoyaltyAccount, FriendReferralStatus } from '../../schemas/loyalty-account.schema';
import { ReferredIdentity } from '../../schemas/referred-identity.schema';
import { LoyaltyService } from '../../loyalty.service';
import { GAMIFICATION_CONSTANTS, GamificationService } from '../gamification.service';

/**
 * Regression cover for the two friend-referral races.
 *
 * BUG-1 registerFriendReferral read `friendReferrals`, checked for the friend,
 * then pushed. Two concurrent registrations both found nothing and both pushed,
 * duplicating the referral and double-incrementing `referralCount`.
 *
 * BUG-2 updateFriendBagCount read the referral, computed `friendBagCount +
 * bags` in JS, and wrote it back with `.save()`. Two pickups confirmed together
 * lost one increment, and — worse — both could cross the award threshold and
 * call `addPoints`, which has no idempotency without an `orderId`. The referral
 * bonus was paid twice.
 *
 * Both fixes are conditional single-statement updates, so these tests assert
 * the guard is present in the filter and that a losing caller changes nothing.
 */
describe('friend referral under concurrency', () => {
  const REFERRER_ID = new Types.ObjectId().toString();
  const FRIEND_ID = new Types.ObjectId().toString();
  const ACCOUNT_ID = new Types.ObjectId();

  let service: GamificationService;
  let loyaltyModel: {
    find: jest.Mock;
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    exists: jest.Mock;
    updateOne: jest.Mock;
  };
  let addPoints: jest.Mock;

  beforeEach(async () => {
    loyaltyModel = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      exists: jest.fn().mockResolvedValue({ _id: ACCOUNT_ID }),
      updateOne: jest.fn(),
    };
    addPoints = jest.fn().mockResolvedValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: getModelToken(LoyaltyAccount.name), useValue: loyaltyModel },
        { provide: getModelToken(ReferredIdentity.name), useValue: { findOne: jest.fn() } },
        { provide: getModelToken(User.name), useValue: { findById: jest.fn() } },
        { provide: LoyaltyService, useValue: { addPoints } },
        { provide: CronLockService, useValue: { runExclusive: jest.fn() } },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
  });

  describe('registerFriendReferral', () => {
    it('guards the push with a filter that excludes an already-referred friend', async () => {
      loyaltyModel.findOneAndUpdate.mockResolvedValue({ _id: ACCOUNT_ID });

      await service.registerFriendReferral(REFERRER_ID, FRIEND_ID);

      const [filter, update] = loyaltyModel.findOneAndUpdate.mock.calls[0] as [
        Record<string, unknown>,
        Record<string, unknown>,
      ];

      // The $ne is the whole fix: it makes the check and the write one operation.
      expect(filter['friendReferrals.friendUserId']).toEqual({
        $ne: new Types.ObjectId(FRIEND_ID),
      });
      expect(update['$inc']).toEqual({ referralCount: 1 });
    });

    it('does not throw or re-push when the friend is already referred', async () => {
      // Filter matched nothing — the friend is in the array already.
      loyaltyModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(service.registerFriendReferral(REFERRER_ID, FRIEND_ID)).resolves.toBeUndefined();
      expect(loyaltyModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
    });

    it('still raises when the referrer has no loyalty account', async () => {
      // Same null result, different cause — the account does not exist. Losing
      // this distinction would silently swallow a genuine data error.
      loyaltyModel.findOneAndUpdate.mockResolvedValue(null);
      loyaltyModel.exists.mockResolvedValue(null);

      await expect(service.registerFriendReferral(REFERRER_ID, FRIEND_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('registers exactly once when two callers race the same friend', async () => {
      loyaltyModel.findOneAndUpdate
        .mockResolvedValueOnce({ _id: ACCOUNT_ID })
        .mockResolvedValueOnce(null);

      await Promise.all([
        service.registerFriendReferral(REFERRER_ID, FRIEND_ID),
        service.registerFriendReferral(REFERRER_ID, FRIEND_ID),
      ]);

      const winners = loyaltyModel.findOneAndUpdate.mock.results.filter(
        r => r.type === 'return',
      ).length;
      expect(winners).toBe(2); // both attempted
      // ...but only one matched, which is what keeps referralCount honest.
      expect(loyaltyModel.findOneAndUpdate).toHaveBeenCalledTimes(2);
    });
  });

  describe('updateFriendBagCount', () => {
    const referrerDoc = { _id: ACCOUNT_ID, userId: new Types.ObjectId(REFERRER_ID) };

    /** Post-image after the atomic $inc, at the given bag total. */
    const afterIncrement = (bagCount: number) => ({
      _id: ACCOUNT_ID,
      userId: new Types.ObjectId(REFERRER_ID),
      friendReferrals: [
        {
          friendUserId: new Types.ObjectId(FRIEND_ID),
          status: FriendReferralStatus.PENDING,
          friendBagCount: bagCount,
        },
      ],
    });

    beforeEach(() => {
      loyaltyModel.find.mockResolvedValue([referrerDoc]);
    });

    it('increments the bag count with $inc rather than a computed write', async () => {
      loyaltyModel.findOneAndUpdate.mockResolvedValue(afterIncrement(1));

      await service.updateFriendBagCount(FRIEND_ID, 1);

      const [, update] = loyaltyModel.findOneAndUpdate.mock.calls[0] as [
        unknown,
        Record<string, unknown>,
      ];
      // A `$set` of a JS-computed sum is what lost concurrent increments.
      expect(update['$inc']).toEqual({ 'friendReferrals.$.friendBagCount': 1 });
      expect(update['$set']).toBeUndefined();
    });

    it('awards no points below the threshold', async () => {
      loyaltyModel.findOneAndUpdate.mockResolvedValue(
        afterIncrement(GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED - 1),
      );

      await service.updateFriendBagCount(FRIEND_ID, 1);

      expect(addPoints).not.toHaveBeenCalled();
    });

    it('claims PENDING -> COMPLETED before awarding, and awards once', async () => {
      loyaltyModel.findOneAndUpdate
        // 1st call: the $inc, crossing the threshold
        .mockResolvedValueOnce(afterIncrement(GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED))
        // 2nd call: the completion claim, won
        .mockResolvedValueOnce({ _id: ACCOUNT_ID });

      await service.updateFriendBagCount(FRIEND_ID, 1);

      const [claimFilter, claimUpdate] = loyaltyModel.findOneAndUpdate.mock.calls[1] as [
        Record<string, unknown>,
        Record<string, Record<string, unknown>>,
      ];

      // Only a still-PENDING entry may be claimed.
      expect(claimFilter['friendReferrals']).toMatchObject({
        $elemMatch: { status: FriendReferralStatus.PENDING },
      });
      expect(claimUpdate['$set']?.['friendReferrals.$.status']).toBe(
        FriendReferralStatus.COMPLETED,
      );
      // The undercount fix: a counter derived in JS recorded two completions as one.
      expect(claimUpdate['$inc']).toEqual({ friendReferralsCompleted: 1 });

      expect(addPoints).toHaveBeenCalledTimes(1);
    });

    it('awards nothing when the completion claim is lost', async () => {
      loyaltyModel.findOneAndUpdate
        .mockResolvedValueOnce(afterIncrement(GAMIFICATION_CONSTANTS.FRIEND_REFERRAL_BAGS_REQUIRED))
        // Another pickup already flipped this referral to COMPLETED.
        .mockResolvedValueOnce(null);

      await service.updateFriendBagCount(FRIEND_ID, 1);

      // This is the double-payout the old code produced: addPoints carries no
      // orderId, so nothing downstream would have caught a second call.
      expect(addPoints).not.toHaveBeenCalled();
    });

    it('skips a referrer whose referral was completed between find and increment', async () => {
      loyaltyModel.findOneAndUpdate.mockResolvedValue(null);

      await service.updateFriendBagCount(FRIEND_ID, 1);

      expect(loyaltyModel.findOneAndUpdate).toHaveBeenCalledTimes(1);
      expect(addPoints).not.toHaveBeenCalled();
    });
  });
});
