import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bull';
import { Types } from 'mongoose';

import { DonationGoalCategory } from '@foodwaste/shared';

import { CronLockService } from '../../common/services/cron-lock.service';
import { DonationsService } from '../donations.service';
import { DEFAULT_CATEGORY_PRICES } from '../interfaces/donation.interface';
import { DonationPool, DonationPoolStatus } from '../schemas/donation-pool.schema';
import { DonationPoolSnapshot } from '../schemas/donation-pool-snapshot.schema';
import { UserDonation } from '../schemas/user-donation.schema';
import { PlatformTransaction } from '../../payments/schemas/platform-transaction.schema';

/**
 * Regression cover for the donation pool double-rotation.
 *
 * Two donations landing together on a pool that is one contribution away from
 * its target both used to advance the goal: each `$inc` returns its own
 * post-image and neither had written FUNDED by the time the other read it, so
 * the `currentAmount >= targetAmount && status === ACTIVE` check passed twice.
 * That created two ACTIVE pools for one category, pushed `completedGoals`
 * twice, and seeded each new pool with its own caller's overflow — crediting
 * the public charity ledger with money nobody donated.
 *
 * The fix is an atomic ACTIVE -> FUNDED compare-and-set. These tests drive the
 * two sides of that claim directly, because the losing caller returning early
 * is the entire behaviour: everything else about rotation was already correct.
 */
/** Shape of the compare-and-set the rotation claim must issue. */
interface ClaimFilter {
  _id: Types.ObjectId;
  status: DonationPoolStatus;
  $expr: { $gte: [string, string] };
}

interface ClaimUpdate {
  $set: { status: DonationPoolStatus; currentAmount: number };
  $push: { completedGoals: DonationGoalCategory };
}

describe('donation pool rotation under concurrency', () => {
  const POOL_ID = new Types.ObjectId();
  const TARGET = DEFAULT_CATEGORY_PRICES[DonationGoalCategory.TSHIRTS];
  const TARGET_AMOUNT = TARGET.itemPrice * TARGET.targetCount;

  let service: DonationsService;
  let donationPoolModel: {
    findOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findByIdAndUpdate: jest.Mock;
    create: jest.Mock;
  };
  let createdPools: Record<string, unknown>[];

  /** A pool sitting past its target — the state both racing callers observe. */
  const fundedPoolDoc = (currentAmount: number) => ({
    _id: POOL_ID,
    currentAmount,
    targetAmount: TARGET_AMOUNT,
    status: DonationPoolStatus.ACTIVE,
    activeGoalCategory: DonationGoalCategory.TSHIRTS,
    cause: 'clothing',
    season: 1,
    goalIndex: 0,
    completedGoals: [],
  });

  beforeEach(async () => {
    createdPools = [];

    // `new this.donationPoolModel({...})` is how the service creates a pool, so
    // the mock model has to be constructible and record what it was given.
    const PoolModel = function (this: { save?: unknown }, doc: Record<string, unknown>) {
      Object.assign(this, doc);
      createdPools.push(doc);
      this.save = jest.fn().mockResolvedValue(doc);
    } as unknown as jest.Mock & Record<string, jest.Mock>;

    donationPoolModel = PoolModel as never;
    // The constructor calls initializeDefaultPool(), which creates a pool when
    // none exists. Return one so startup does not land in `createdPools` and
    // mask what the rotation itself created.
    donationPoolModel.findOne = jest.fn().mockResolvedValue(fundedPoolDoc(0));
    donationPoolModel.findOneAndUpdate = jest.fn();
    donationPoolModel.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
    donationPoolModel.create = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationsService,
        { provide: getModelToken(DonationPool.name), useValue: donationPoolModel },
        {
          provide: getModelToken(DonationPoolSnapshot.name),
          useValue: { updateOne: jest.fn().mockResolvedValue({}), find: jest.fn() },
        },
        {
          provide: getModelToken(UserDonation.name),
          useValue: { findOne: jest.fn(), aggregate: jest.fn() },
        },
        { provide: getModelToken(PlatformTransaction.name), useValue: { create: jest.fn() } },
        { provide: getQueueToken('donations'), useValue: { add: jest.fn() } },
        { provide: CronLockService, useValue: { runExclusive: jest.fn() } },
      ],
    }).compile();

    service = module.get<DonationsService>(DonationsService);
  });

  /** rotateIfFunded is private — this is the seam the race actually runs through. */
  const rotate = async (pool: ReturnType<typeof fundedPoolDoc>): Promise<void> => {
    await (service as unknown as { rotateIfFunded: (p: unknown) => Promise<void> }).rotateIfFunded(
      pool,
    );
  };

  it('claims the rotation with a filter that only an ACTIVE, at-target pool can match', async () => {
    donationPoolModel.findOneAndUpdate.mockResolvedValue(fundedPoolDoc(TARGET_AMOUNT + 5));

    await rotate(fundedPoolDoc(TARGET_AMOUNT + 5));

    const [filter, update, options] = donationPoolModel.findOneAndUpdate.mock.calls[0] as [
      ClaimFilter,
      ClaimUpdate,
      { new: boolean },
    ];

    expect(filter).toMatchObject({ _id: POOL_ID, status: DonationPoolStatus.ACTIVE });
    // Without the target guard in the filter, a pool that has already been
    // capped could be re-claimed by a late caller.
    expect(filter.$expr).toEqual({ $gte: ['$currentAmount', '$targetAmount'] });
    expect(update.$set).toMatchObject({ status: DonationPoolStatus.FUNDED });
    // The pre-image carries the true post-increment total; `new: true` would
    // return the capped value and silently zero every overflow.
    expect(options).toMatchObject({ new: false });
  });

  it('creates no pool when the claim is lost', async () => {
    // The other caller got there first, so the conditional update matches nothing.
    donationPoolModel.findOneAndUpdate.mockResolvedValue(null);

    await rotate(fundedPoolDoc(TARGET_AMOUNT + 8));

    expect(createdPools).toHaveLength(0);
  });

  it('creates exactly one successor pool when two callers race the same funded pool', async () => {
    // Both callers observe an over-target pool — this is the real race: each
    // holds its own `$inc` post-image, 3 TND and 8 TND past target respectively.
    // Only the first claim matches.
    donationPoolModel.findOneAndUpdate
      .mockResolvedValueOnce(fundedPoolDoc(TARGET_AMOUNT + 8))
      .mockResolvedValueOnce(null);

    await Promise.all([
      rotate(fundedPoolDoc(TARGET_AMOUNT + 3)),
      rotate(fundedPoolDoc(TARGET_AMOUNT + 8)),
    ]);

    expect(createdPools).toHaveLength(1);
  });

  it('seeds the successor from the claim pre-image, not the caller that lost', async () => {
    // The winner's own view said +3, but the pool really holds +8. Deriving
    // overflow from the caller would lose 5 TND; deriving it from the caller
    // *and* letting both run would invent 3 TND. Only the pre-image is right.
    donationPoolModel.findOneAndUpdate.mockResolvedValue(fundedPoolDoc(TARGET_AMOUNT + 8));

    await rotate(fundedPoolDoc(TARGET_AMOUNT + 3));

    expect(createdPools).toHaveLength(1);
    expect(createdPools[0]).toMatchObject({
      currentAmount: 8,
      status: DonationPoolStatus.ACTIVE,
      activeGoalCategory: DonationGoalCategory.PANTS,
      goalIndex: 1,
      completedGoals: [DonationGoalCategory.TSHIRTS],
    });
  });

  it('completes the season instead of rotating when the last goal is funded', async () => {
    const lastGoal = {
      ...fundedPoolDoc(TARGET_AMOUNT + 2),
      activeGoalCategory: DonationGoalCategory.MEDICINE,
      goalIndex: 4,
    };
    donationPoolModel.findOneAndUpdate.mockResolvedValue(lastGoal);

    await rotate(lastGoal);

    const [, update] = donationPoolModel.findOneAndUpdate.mock.calls[0] as [unknown, ClaimUpdate];
    expect(update.$set.status).toBe(DonationPoolStatus.SEASON_COMPLETE);
    // A new season is an admin decision, so nothing is created here.
    expect(createdPools).toHaveLength(0);
  });

  it('does not rotate a season-complete pool a second time', async () => {
    // The claim filter requires ACTIVE, so a SEASON_COMPLETE pool matches
    // nothing and the late caller exits without touching the ledger.
    donationPoolModel.findOneAndUpdate.mockResolvedValue(null);

    await rotate({
      ...fundedPoolDoc(TARGET_AMOUNT),
      activeGoalCategory: DonationGoalCategory.MEDICINE,
      status: DonationPoolStatus.SEASON_COMPLETE,
    });

    expect(createdPools).toHaveLength(0);
  });
});
