/**
 * Database-level invariant checks for the concurrency suite.
 *
 *   pnpm --filter @foodwaste/backend verify:loadtest-invariants
 *
 * Run immediately after `k6 run tests/k6/suites/concurrency.js`. k6 asserts what
 * HTTP shows — how many 201s came back. It cannot see whether the ledger was
 * credited twice, and double-crediting is invisible from the outside: every
 * response is a 200. That is what this checks.
 *
 * Exits non-zero on any violation. A violation is a correctness bug in the
 * application; it is never a reason to loosen the assertion.
 */
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AppModule } from '../src/app.module';
import { DonationPool, DonationPoolStatus } from '../src/donations/schemas/donation-pool.schema';
import { UserDonation } from '../src/donations/schemas/user-donation.schema';
import { Establishment } from '../src/establishments/schemas/establishment.schema';
import { LoyaltyAccount } from '../src/loyalty/schemas/loyalty-account.schema';
import { Notification } from '../src/notifications/schemas/notification.schema';
import { NotificationStatus } from '../src/notifications/types/notification.types';
import { Offer } from '../src/offers/schemas/offer.schema';
import { Order } from '../src/orders/schemas/order.schema';
import { PaymentAttempt } from '../src/payments/schemas/payment-attempt.schema';

interface Invariant {
  name: string;
  detail: string;
  /** undefined = informational only; never counts toward pass or fail. */
  passed: boolean | undefined;
}

const results: Invariant[] = [];

function assert(name: string, passed: boolean, detail: string): void {
  results.push({ name, detail, passed });
}

/**
 * Records a measurement that is useful to read but has no correct value to
 * check against. Kept separate from assert() so nothing can masquerade as a
 * passing invariant.
 */
function reportOnly(name: string, detail: string): void {
  results.push({ name, detail, passed: undefined });
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });

  const offerModel = app.get<Model<Offer>>(getModelToken(Offer.name));
  const orderModel = app.get<Model<Order>>(getModelToken(Order.name));
  const attemptModel = app.get<Model<PaymentAttempt>>(getModelToken(PaymentAttempt.name));
  const loyaltyModel = app.get<Model<LoyaltyAccount>>(getModelToken(LoyaltyAccount.name));
  const poolModel = app.get<Model<DonationPool>>(getModelToken(DonationPool.name));
  const donationModel = app.get<Model<UserDonation>>(getModelToken(UserDonation.name));
  const notificationModel = app.get<Model<Notification>>(getModelToken(Notification.name));
  const establishmentModel = app.get<Model<Establishment>>(getModelToken(Establishment.name));

  try {
    // ---------------------------------------------------------------------
    // 1. Stock was never oversold.
    // ---------------------------------------------------------------------
    // The strongest form of the check: not "the scarce offer is fine" but "no
    // offer anywhere is over-committed". A reservation bug would show up on
    // whichever offer the load happened to hit, not only the seeded one.
    const oversold = await offerModel
      .find({
        $expr: { $gt: [{ $add: ['$reservedQuantity', '$soldQuantity'] }, '$totalQuantity'] },
      })
      .select('_id title totalQuantity reservedQuantity soldQuantity')
      .lean();

    assert(
      'no offer is oversold (reserved + sold <= total)',
      oversold.length === 0,
      oversold.length === 0
        ? 'all offers within stock'
        : `${oversold.length} oversold: ${oversold
            .map(o => `${String(o._id)} ${o.reservedQuantity}+${o.soldQuantity}>${o.totalQuantity}`)
            .join(', ')}`,
    );

    // Exactly one order against each single-unit scarce offer.
    const scarceOffers = await offerModel
      .find({ title: /^K6 Scarce Offer/, totalQuantity: 1 })
      .select('_id')
      .lean();

    const scarceIds = scarceOffers.map(o => o._id);
    const ordersPerScarceOffer = await orderModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { 'items.offerId': { $in: scarceIds } } },
      { $unwind: '$items' },
      { $match: { 'items.offerId': { $in: scarceIds } } },
      { $group: { _id: '$items.offerId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'each single-unit offer has at most one order',
      ordersPerScarceOffer.length === 0,
      ordersPerScarceOffer.length === 0
        ? 'no duplicate orders'
        : `${ordersPerScarceOffer.length} offers with multiple orders`,
    );

    // ---------------------------------------------------------------------
    // 2. Each payment settled exactly once.
    // ---------------------------------------------------------------------
    // A duplicated webhook must not produce a second settlement. `processing`
    // left behind is a liveness problem rather than a double-spend, but it
    // means a customer paid and the order never confirmed, so it is reported.
    const stuckProcessing = await attemptModel
      .countDocuments({ status: 'processing', claimedAt: { $lt: new Date(Date.now() - 60_000) } })
      .exec();

    assert(
      'no payment attempt is stuck in processing',
      stuckProcessing === 0,
      `${stuckProcessing} attempts claimed over a minute ago and never settled`,
    );

    const duplicatePaidRefs = await attemptModel.aggregate<{ _id: string; count: number }>([
      { $match: { status: 'paid' } },
      { $group: { _id: '$reference', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'no payment reference settled more than once',
      duplicatePaidRefs.length === 0,
      duplicatePaidRefs.length === 0
        ? 'all references unique among paid attempts'
        : `${duplicatePaidRefs.length} references paid more than once`,
    );

    // ---------------------------------------------------------------------
    // 3. Points credited once per order.
    // ---------------------------------------------------------------------
    // addPoints filters on `pointsHistory.orderId $ne` inside a single
    // findOneAndUpdate, so a repeated pickup confirmation must not compound.
    const duplicatePointAwards = await loyaltyModel.aggregate<{ _id: unknown; count: number }>([
      { $unwind: '$pointsHistory' },
      { $match: { 'pointsHistory.orderId': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { account: '$_id', order: '$pointsHistory.orderId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'no order awarded loyalty points twice',
      duplicatePointAwards.length === 0,
      duplicatePointAwards.length === 0
        ? 'one award per order'
        : `${duplicatePointAwards.length} orders awarded more than once`,
    );

    // ---------------------------------------------------------------------
    // 4. Referrals are single-instance and paid once. (BUG-1, BUG-2)
    // ---------------------------------------------------------------------
    const duplicateReferrals = await loyaltyModel.aggregate<{ _id: unknown; count: number }>([
      { $unwind: '$friendReferrals' },
      {
        $group: {
          _id: { account: '$_id', friend: '$friendReferrals.friendUserId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'no friend appears twice in one account’s referrals',
      duplicateReferrals.length === 0,
      duplicateReferrals.length === 0
        ? 'referral entries unique per friend'
        : `${duplicateReferrals.length} duplicated referral entries`,
    );

    // friendReferralsCompleted is derived; it must equal the number of
    // COMPLETED entries. The old read-modify-save form under-counted it.
    const counterDrift = await loyaltyModel.aggregate<{ _id: unknown }>([
      {
        $project: {
          recorded: { $ifNull: ['$friendReferralsCompleted', 0] },
          actual: {
            $size: {
              $filter: {
                input: { $ifNull: ['$friendReferrals', []] },
                cond: { $eq: ['$$this.status', 'completed'] },
              },
            },
          },
        },
      },
      { $match: { $expr: { $ne: ['$recorded', '$actual'] } } },
    ]);

    assert(
      'friendReferralsCompleted matches the completed entries',
      counterDrift.length === 0,
      counterDrift.length === 0
        ? 'counter consistent'
        : `${counterDrift.length} accounts with a drifted counter`,
    );

    // ---------------------------------------------------------------------
    // 5. Donation pool rotation. (BUG-3)
    // ---------------------------------------------------------------------
    // The invariant the double-rotation broke: exactly one pool may be ACTIVE.
    const activePools = await poolModel
      .countDocuments({ status: DonationPoolStatus.ACTIVE, isArchived: false })
      .exec();

    assert(
      'exactly one donation pool is ACTIVE',
      activePools === 1,
      `${activePools} active pools (expected 1)`,
    );

    // A funded pool is capped at its target — never above it.
    const overfundedPools = await poolModel
      .find({
        status: { $in: [DonationPoolStatus.FUNDED, DonationPoolStatus.SEASON_COMPLETE] },
        $expr: { $gt: ['$currentAmount', '$targetAmount'] },
      })
      .select('_id currentAmount targetAmount')
      .lean();

    assert(
      'no funded pool holds more than its target',
      overfundedPools.length === 0,
      overfundedPools.length === 0
        ? 'all funded pools capped'
        : `${overfundedPools.length} over cap`,
    );

    // No category may be completed twice within one season.
    //
    // `completedGoals` is a *cumulative* list: each rotation seeds the new pool
    // with `[...previous.completedGoals, previous.activeGoalCategory]`, so
    // TSHIRTS legitimately appears in both the funded TSHIRTS pool and the
    // active PANTS pool that succeeded it. Counting occurrences across pools
    // therefore flags every successful rotation as a violation — which it did,
    // on a run where the data was provably correct.
    //
    // The real invariant has two halves: no single pool repeats a goal in its
    // own list, and within a season no two pools work the same goal.
    const poolsWithRepeatedGoal = await poolModel.aggregate<{ _id: unknown }>([
      {
        $project: {
          season: 1,
          total: { $size: { $ifNull: ['$completedGoals', []] } },
          distinct: { $size: { $setUnion: [{ $ifNull: ['$completedGoals', []] }, []] } },
        },
      },
      { $match: { $expr: { $ne: ['$total', '$distinct'] } } },
    ]);

    assert(
      'no pool lists the same completed goal twice',
      poolsWithRepeatedGoal.length === 0,
      poolsWithRepeatedGoal.length === 0
        ? 'completedGoals internally unique in every pool'
        : `${poolsWithRepeatedGoal.length} pools repeat a goal`,
    );

    const duplicateGoalPools = await poolModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { isArchived: false } },
      {
        $group: {
          _id: { season: '$season', goal: '$activeGoalCategory' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'each goal has at most one pool per season',
      duplicateGoalPools.length === 0,
      duplicateGoalPools.length === 0
        ? 'one pool per goal per season'
        : `${duplicateGoalPools.length} goals have multiple pools — a double rotation`,
    );

    // One donation per order — backed by a unique index, checked here because
    // an index missing in production is exactly the failure worth catching.
    const duplicateDonations = await donationModel.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: '$orderId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'no order produced two donations',
      duplicateDonations.length === 0,
      duplicateDonations.length === 0
        ? 'one donation per order'
        : `${duplicateDonations.length} orders with multiple donations`,
    );

    // The rotation bug did not lose money, it *invented* it: each racing caller
    // seeded the successor pool with its own view of the overflow. So the
    // ledger must reconcile — what the pools hold cannot exceed what was
    // actually donated, allowing for pools funded before this run.
    const [donatedTotal] = await donationModel.aggregate<{ total: number }>([
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);

    const [poolTotal] = await poolModel.aggregate<{ total: number }>([
      { $match: { isArchived: false } },
      { $group: { _id: null, total: { $sum: '$currentAmount' } } },
    ]);

    const donated = donatedTotal?.total ?? 0;
    const held = poolTotal?.total ?? 0;
    const unbacked = held - donated;

    // This is reported, not asserted, and the distinction is deliberate.
    //
    // The seed parks the active pool near its target, which puts money in a
    // pool with no UserDonation rows behind it — so `held > donated` is the
    // normal state here and any threshold would be a number picked to match
    // whatever the fixtures happen to do. An assertion that cannot fail is
    // worse than no assertion: it reports PASS forever and reads as coverage.
    //
    // The invariants that actually catch a double rotation are the ones above
    // (exactly one ACTIVE pool, no goal completed twice, goalIndex not ahead of
    // completedGoals). This figure is here for a human reading the output: a
    // jump in it across a run is the signature of overflow being counted twice.
    reportOnly(
      'donation ledger reconciliation',
      `donated=${donated.toFixed(3)} TND, pools hold=${held.toFixed(3)} TND, ` +
        `unbacked=${unbacked.toFixed(3)} TND (expected > 0 with seeded fixtures)`,
    );

    // The invariant that actually regressed. A season may complete at most one
    // goal per rotation, so goalIndex must never outrun completedGoals.
    const indexDrift = await poolModel.aggregate<{ _id: unknown }>([
      { $match: { isArchived: false } },
      {
        $project: {
          goalIndex: { $ifNull: ['$goalIndex', 0] },
          completed: { $size: { $ifNull: ['$completedGoals', []] } },
        },
      },
      { $match: { $expr: { $gt: ['$goalIndex', '$completed'] } } },
    ]);

    assert(
      'goalIndex never exceeds the number of completed goals',
      indexDrift.length === 0,
      indexDrift.length === 0
        ? 'goal index consistent'
        : `${indexDrift.length} pools advanced further than their completed list`,
    );

    // ---------------------------------------------------------------------
    // 7. Notification delivery.
    // ---------------------------------------------------------------------
    // No logical duplicates: (orderId, trigger, userId) should be unique.
    const notifDuplicates = await notificationModel.aggregate<{ _id: unknown; count: number }>([
      { $match: { orderId: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: { orderId: '$orderId', trigger: '$trigger', userId: '$userId' },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ]);

    assert(
      'no logical notification duplicates (orderId + trigger + userId)',
      notifDuplicates.length === 0,
      notifDuplicates.length === 0
        ? 'all notification tuples unique'
        : `${notifDuplicates.length} duplicated notification tuples`,
    );

    // No notification stuck in a non-terminal state. Schema values are
    // lower-case ('pending', 'sent', ...) — NotificationStatus is the single
    // source of truth rather than re-typing the strings here.
    const stuckNotifications = await notificationModel
      .countDocuments({
        status: { $in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
        createdAt: { $lt: new Date(Date.now() - 120_000) },
      })
      .exec();

    assert(
      'no notification stuck in PENDING or SENT after 2 minutes',
      stuckNotifications === 0,
      `${stuckNotifications} notifications still in non-terminal state`,
    );

    // Failed notifications < 1%.
    const totalNotifs = await notificationModel.countDocuments().exec();
    const failedNotifs = await notificationModel
      .countDocuments({ status: NotificationStatus.FAILED })
      .exec();
    const failRate = totalNotifs > 0 ? failedNotifs / totalNotifs : 0;

    assert(
      'failed notifications < 1% of total',
      failRate < 0.01,
      `${failedNotifs}/${totalNotifs} failed (${(failRate * 100).toFixed(2)}%)`,
    );

    // Cross-user contamination: no user received another user's notification.
    // A notification tied to an order is legitimately addressed to either the
    // customer (Order.customerId) or the establishment's owner
    // (Establishment.ownerId) — merchants get order notifications too. Order
    // has no `userId` field (it is `customerId`); comparing against a
    // non-existent field would make every notification with an orderId look
    // like contamination.
    const crossUser = await notificationModel.aggregate<{ _id: unknown }>([
      { $match: { orderId: { $exists: true, $ne: null } } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $lookup: {
          from: 'establishments',
          localField: 'order.establishmentId',
          foreignField: '_id',
          as: 'establishment',
        },
      },
      { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $expr: {
            $and: [
              { $ne: ['$userId', '$order.customerId'] },
              { $ne: ['$userId', '$establishment.ownerId'] },
            ],
          },
        },
      },
    ]);

    assert(
      'no cross-user notification contamination',
      crossUser.length === 0,
      crossUser.length === 0
        ? 'all notifications delivered to correct users'
        : `${crossUser.length} notifications sent to wrong user`,
    );

    // Delivery latency stats (Rule 6: deliveredAt - createdAt).
    const latencyStats = await notificationModel.aggregate<{
      p50: number;
      p95: number;
      p99: number;
      max: number;
      count: number;
    }>([
      { $match: { deliveredAt: { $exists: true, $ne: null }, createdAt: { $exists: true } } },
      {
        $project: {
          latencyMs: { $subtract: ['$deliveredAt', '$createdAt'] },
        },
      },
      { $sort: { latencyMs: 1 } },
      {
        $group: {
          _id: null,
          latencies: { $push: '$latencyMs' },
          count: { $sum: 1 },
          max: { $max: '$latencyMs' },
        },
      },
      {
        $project: {
          count: 1,
          max: 1,
          p50: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.5, '$count'] } }] },
          p95: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.95, '$count'] } }] },
          p99: { $arrayElemAt: ['$latencies', { $floor: { $multiply: [0.99, '$count'] } }] },
        },
      },
    ]);

    const [stats] = latencyStats;
    if (stats) {
      reportOnly(
        'notification delivery latency (deliveredAt - createdAt)',
        `p50=${stats.p50}ms p95=${stats.p95}ms p99=${stats.p99}ms max=${stats.max}ms (n=${stats.count})`,
      );
    } else {
      reportOnly(
        'notification delivery latency',
        'no delivered notifications found — SLA measurement skipped',
      );
    }

    // ---------------------------------------------------------------------
    // 8. Subscription state-machine validity.
    // ---------------------------------------------------------------------
    // Every paid establishment must have a valid state combination. This is
    // exactly what the subscription-race k6 suite's double-initiate and
    // wrong-tier-proof scenarios can break: initiatePayment writes
    // pendingTier/pendingCycle and lastPaymentRef as two separate updates,
    // so a second initiate racing the first can leave the webhook settling
    // with a tier/cycle pair that was never fully written together.
    const invalidSubStates = await establishmentModel
      .find({
        subscriptionStatus: 'paid',
        $or: [
          { subscriptionTier: null },
          { subscriptionTier: { $exists: false } },
          { subscriptionCycle: null },
          { subscriptionCycle: { $exists: false } },
        ],
      })
      .select('_id subscriptionStatus subscriptionTier subscriptionCycle')
      .lean();

    assert(
      'no paid establishment has null tier or cycle',
      invalidSubStates.length === 0,
      invalidSubStates.length === 0
        ? 'all paid establishments have valid state'
        : `${invalidSubStates.length} establishments with invalid subscription state`,
    );

    // A "paid" establishment whose subscriptionExpiresAt has already passed
    // is what the duplicate-webhook race would produce if handleWebhook's
    // TOCTOU guard (subscriptionStatus === 'paid' && daysRemaining > 7) loses
    // a race — the seed fixtures never set subscription fields at all
    // (every establishment starts 'trial' with no subscriptionExpiresAt), so
    // any match here was written during this run, not inherited from seed
    // data.
    const expiredButPaid = await establishmentModel
      .find({
        subscriptionStatus: 'paid',
        subscriptionExpiresAt: { $exists: true, $lt: new Date() },
      })
      .select('_id subscriptionExpiresAt')
      .lean();

    assert(
      'no paid establishment has an already-expired subscriptionExpiresAt',
      expiredButPaid.length === 0,
      expiredButPaid.length === 0
        ? 'all paid establishments have a future expiry'
        : `${expiredButPaid.length} paid establishments already past subscriptionExpiresAt`,
    );
  } finally {
    await app.close();
  }

  report();
}

function report(): void {
  const failed = results.filter(r => r.passed === false);
  const checked = results.filter(r => r.passed !== undefined);

  process.stdout.write('\nDatabase-level concurrency invariants\n');
  for (const r of results) {
    const label = r.passed === undefined ? 'INFO' : r.passed ? 'PASS' : 'FAIL';
    process.stdout.write(`  ${label}  ${r.name}\n        ${r.detail}\n`);
  }
  process.stdout.write(
    `\n${checked.length} invariant(s) checked, ${results.length - checked.length} informational.\n`,
  );

  if (failed.length === 0) {
    process.stdout.write('\nAll invariants held.\n');
    // Explicit exit for the same reason as the seed and migration scripts: Bull
    // queues and the Redis client hold handles that app.close() does not drain,
    // so returning here leaves the process alive and CI waits on it forever.
    process.exit(0);
  }

  process.stdout.write(
    `\n${failed.length} INVARIANT VIOLATED.\n` +
      'Each of these is a correctness bug. Fix the application code — ' +
      'do not adjust the assertion to make the run pass.\n',
  );
  process.exit(1);
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`Invariant verification failed to run: ${(error as Error).message}\n`);
  process.exit(1);
});
