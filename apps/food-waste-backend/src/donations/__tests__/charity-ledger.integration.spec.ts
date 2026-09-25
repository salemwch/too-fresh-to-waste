/**
 * The charity contribution of an order, and TFTW's ledger entry for it,
 * against a real MongoDB replica set (the writes are transactional).
 *
 * The product rule (2026-09-25): every completed order pledges 0.95% of its
 * subtotal - pickup and delivery, cash and online, NORMAL and SETTLEMENT - and
 * a refunded sale takes its pledge back. What these tests pin down:
 *
 * - the pool, the category snapshot, the contribution and the DONATION ledger
 *   row move together, once per order;
 * - an order whose payment already booked a DONATION row (before revenue moved
 *   to completion) is not pledged twice;
 * - a refund gives the money back to a goal still being funded, and is
 *   absorbed by TFTW when the goal was already funded - the ledger ending at
 *   what the charity actually keeps, in both cases;
 * - a reversed contribution stops counting as the customer's.
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import { DonationGoalCategory } from '@foodwaste/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';

import {
  PlatformTransactionSchema,
  type PlatformTransactionDocument,
} from '../../payments/schemas/platform-transaction.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { DonationsService } from '../donations.service';
import {
  DonationPoolSchema,
  DonationPoolStatus,
  type DonationPoolDocument,
} from '../schemas/donation-pool.schema';
import {
  DonationPoolSnapshotSchema,
  type DonationPoolSnapshotDocument,
} from '../schemas/donation-pool-snapshot.schema';
import { UserDonationSchema, type UserDonationDocument } from '../schemas/user-donation.schema';

const MONGO_URI = requireMongoTestUri();

describe('DonationsService charity ledger — against a real MongoDB', () => {
  let connection: Connection;
  let poolModel: Model<DonationPoolDocument>;
  let snapshotModel: Model<DonationPoolSnapshotDocument>;
  let donationModel: Model<UserDonationDocument>;
  let platformTxModel: Model<PlatformTransactionDocument>;
  let queueAdd: jest.Mock;
  let service: DonationsService;
  let poolId: Types.ObjectId;

  const USER_ID = new Types.ObjectId();
  const CATEGORY = DonationGoalCategory.TSHIRTS;

  const pool = () => poolModel.findById(poolId).lean();
  const snapshot = () => snapshotModel.findOne({ category: CATEGORY }).lean();
  const netPledged = async (orderId: Types.ObjectId) => {
    const rows = await platformTxModel.find({ orderId, type: 'DONATION' }).lean();
    return parseFloat(rows.reduce((sum, r) => sum + r.amount, 0).toFixed(3));
  };
  const donate = async (orderId: Types.ObjectId, amount = 0.095) => {
    const donation = await service.createDonation({
      userId: USER_ID,
      orderId,
      merchantId: new Types.ObjectId(),
      amount,
    });
    return donation;
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `charity_ledger_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();

    poolModel = connection.model(
      'DonationPool',
      DonationPoolSchema,
    ) as unknown as Model<DonationPoolDocument>;
    snapshotModel = connection.model(
      'DonationPoolSnapshot',
      DonationPoolSnapshotSchema,
    ) as unknown as Model<DonationPoolSnapshotDocument>;
    donationModel = connection.model(
      'UserDonation',
      UserDonationSchema,
    ) as unknown as Model<UserDonationDocument>;
    platformTxModel = connection.model(
      'PlatformTransaction',
      PlatformTransactionSchema,
    ) as unknown as Model<PlatformTransactionDocument>;
    // Collections must exist before a transaction writes to them.
    await Promise.all([
      poolModel.syncIndexes(),
      snapshotModel.syncIndexes(),
      donationModel.syncIndexes(),
      platformTxModel.syncIndexes(),
    ]);

    queueAdd = jest.fn().mockResolvedValue(undefined);
    service = Object.create(DonationsService.prototype) as DonationsService;
    Object.assign(service, {
      donationPoolModel: poolModel,
      snapshotModel,
      userDonationModel: donationModel,
      platformTxModel,
      donationsQueue: { add: queueAdd },
      cronLock: { runExclusive: jest.fn() },
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
    });
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await Promise.all([
      poolModel.deleteMany({}),
      snapshotModel.deleteMany({}),
      donationModel.collection.deleteMany({}),
      platformTxModel.deleteMany({}),
    ]);
    const created = await poolModel.create({
      currentAmount: 0,
      targetAmount: 1000,
      mealCount: 0,
      status: DonationPoolStatus.ACTIVE,
      activeGoalCategory: CATEGORY,
      startDate: new Date(),
      season: 1,
      goalIndex: 0,
      isArchived: false,
    });
    poolId = created._id as Types.ObjectId;
    await snapshotModel.create({
      category: CATEGORY,
      totalAmount: 0,
      totalItems: 0,
      percent: 0,
      targetAmount: 1000,
      itemPrice: 10,
      targetCount: 100,
    });
  });

  it('pledges once: contribution, pool, snapshot and ledger together', async () => {
    const orderId = new Types.ObjectId();

    await donate(orderId, 0.095);

    expect((await pool())?.currentAmount).toBe(0.095);
    expect((await snapshot())?.totalAmount).toBe(0.095);
    expect(await donationModel.countDocuments({ orderId })).toBe(1);
    expect(await netPledged(orderId)).toBe(0.095);
  });

  it('does not pledge twice when order.completed is delivered twice', async () => {
    const orderId = new Types.ObjectId();

    await donate(orderId);
    await donate(orderId);

    expect((await pool())?.currentAmount).toBe(0.095);
    expect(await platformTxModel.countDocuments({ orderId })).toBe(1);
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  // PM2 workers race: two redeliveries both pass the findOne guard, one
  // insert wins the orderId unique index and the other gets E11000. That is
  // the losing worker's normal path - the donation exists - so it must not
  // surface as DONATION_FAILED (which makes RabbitMQ redeliver for nothing)
  // and must not count the money twice.
  it('treats a concurrent duplicate as success, and counts the pledge once', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId); // the other worker, first

    // This worker's guard ran before the other's insert committed.
    const guard = jest
      .spyOn(donationModel, 'findOne')
      .mockImplementationOnce(() => ({ setOptions: jest.fn().mockResolvedValue(null) }) as never);
    const mine = await donate(orderId);
    guard.mockRestore();

    expect(mine.orderId.toString()).toBe(orderId.toString());
    expect(await donationModel.countDocuments({ orderId })).toBe(1);
    expect((await pool())?.currentAmount).toBe(0.095);
    expect(await netPledged(orderId)).toBe(0.095);
  });

  it('does not book a second pledge for an order its payment already pledged', async () => {
    const orderId = new Types.ObjectId();
    await platformTxModel.create({
      orderId,
      type: 'DONATION',
      amount: 0.095,
      reference: 'DONATION-ORD-LEGACY',
    });

    await donate(orderId);

    // The pool is the charity's record and still receives it; only the
    // ledger row already exists.
    expect((await pool())?.currentAmount).toBe(0.095);
    expect(await netPledged(orderId)).toBe(0.095);
  });

  it('gives a refunded pledge back to a goal still being funded', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId);

    const outcome = await service.reverseForOrder(orderId, 'refunded in person');

    expect(outcome).toBe('POOL_REDUCED');
    expect((await pool())?.currentAmount).toBe(0);
    expect((await snapshot())?.totalAmount).toBe(0);
    expect(await netPledged(orderId)).toBe(0);
  });

  it('lets TFTW absorb a refunded pledge when the goal was already funded', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId);
    await poolModel.updateOne({ _id: poolId }, { $set: { status: DonationPoolStatus.FUNDED } });

    const outcome = await service.reverseForOrder(orderId, 'refunded');

    expect(outcome).toBe('ABSORBED_BY_PLATFORM');
    // A funded goal is never un-funded; the charity keeps the money.
    expect((await pool())?.currentAmount).toBe(0.095);
    expect(await netPledged(orderId)).toBe(0.095);
  });

  it('re-books an absorbed pledge a legacy refund had already reversed', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId);
    // The old payment-time refund path negated the pledge on its own.
    await platformTxModel.create({
      orderId,
      type: 'DONATION',
      amount: -0.095,
      reference: 'REFUND-DONATION-ORD-LEGACY',
    });
    await poolModel.updateOne({ _id: poolId }, { $set: { status: DonationPoolStatus.FUNDED } });

    await service.reverseForOrder(orderId, 'refunded');

    // The charity still holds it, so the ledger must say TFTW paid it.
    expect(await netPledged(orderId)).toBe(0.095);
  });

  it('reverses once, however often the refund event arrives', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId);

    expect(await service.reverseForOrder(orderId, 'refunded')).toBe('POOL_REDUCED');
    expect(await service.reverseForOrder(orderId, 'refunded')).toBe('NONE');
    expect((await pool())?.currentAmount).toBe(0);
    expect(await netPledged(orderId)).toBe(0);
  });

  it('does nothing for an order that never pledged', async () => {
    expect(await service.reverseForOrder(new Types.ObjectId(), 'refunded')).toBe('NONE');
    expect(await platformTxModel.countDocuments({})).toBe(0);
  });

  it('never re-pledges a refunded order when its completion is replayed', async () => {
    const orderId = new Types.ObjectId();
    await donate(orderId);
    await service.reverseForOrder(orderId, 'refunded');

    await donate(orderId);

    expect((await pool())?.currentAmount).toBe(0);
    expect(await netPledged(orderId)).toBe(0);
  });

  it("stops counting a reversed contribution as the customer's", async () => {
    const kept = new Types.ObjectId();
    const refunded = new Types.ObjectId();
    await donate(kept, 0.1);
    await donate(refunded, 0.2);

    await service.reverseForOrder(refunded, 'refunded');

    const stats = await service.getUserStats(USER_ID);
    expect(stats.contributionCount).toBe(1);
    expect(stats.totalDonated).toBe(0.1);
    // Still there for audit, one query option away.
    const all = await donationModel.find({ userId: USER_ID }).setOptions({ includeDeleted: true });
    expect(all).toHaveLength(2);
  });
});
