/**
 * MerchantSalesService.summary against a real MongoDB replica set.
 *
 * One request drives the Dashboard, the Payments tab and Analytics, so this
 * suite is the invariant that keeps them agreeing: the three payment-method
 * lines always sum to the total, in integer millimes, for every period. It
 * also pins the three amount cases (current decision, legacy 81%, and the
 * post-cutoff integrity failure) and the one-report-per-request rule for
 * unverified orders.
 *
 *   docker compose up -d mongodb mongo-init
 *   bash .superpowers/sdd/2026-09-26-merchant-earnings/testdb.sh merchant-sales
 */

import { UserRole } from '@foodwaste/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { hasErrorCode } from '../../common/errors';
import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import { PaymentController } from '../../payments/payments.controller';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { MerchantSalesService } from '../merchant-sales.service';
import type { SalesScope } from '../merchant-sales.scope';
import type { EarningsRow, EarningsTab } from '../merchant-sales.types';
import type { SalesPeriod } from '../merchant-sales.period';

const T = (iso: string) => new Date(iso);
const round3 = (n: number) => Math.round(n * 1000) / 1000;
/** Compares TND amounts as integer millimes, so the invariants are exact. */
const millimes = (v: number) => Math.round(v * 1000);

const normalCommission = (subtotal: number, appliedAt: Date) => ({
  model: 'V2',
  kind: 'NORMAL',
  accrued: round3(subtotal * PLATFORM_FOOD_SHARE),
  settled: 0,
  merchantAmount: subtotal,
  dueBefore: 0,
  dueAfter: 0,
  appliedAt,
});

const settlementCommission = (merchantAmount: number, settled: number, appliedAt: Date) => ({
  model: 'V2',
  kind: 'SETTLEMENT',
  accrued: 0,
  settled,
  merchantAmount,
  dueBefore: 0,
  dueAfter: 0,
  appliedAt,
});

describe('MerchantSalesService.summary (real MongoDB)', () => {
  let connection: Connection;
  let orders: Model<OrderDocument>;
  let service: MerchantSalesService;
  const sentry = { captureMessage: jest.fn() };
  const logger = { error: jest.fn() };

  const merchantAId = new Types.ObjectId();
  const merchantBId = new Types.ObjectId();
  const merchantA: SalesScope = { kind: 'merchant', merchantId: merchantAId.toString() };
  const merchantB: SalesScope = { kind: 'merchant', merchantId: merchantBId.toString() };

  // One instant for the whole suite, passed to every call in a given test -
  // never `new Date()` inside a test (Task 3 review note).
  const now = new Date('2026-09-26T12:00:00Z');
  // Non-refunded August earnings seeded below (the "August sale" row, 20).
  // Used by the cross-period refund test; kept in one place so the assertion
  // is never vacuous.
  const augustEarnings = 20;

  let case3Id: Types.ObjectId;

  const seed = async (doc: Record<string, unknown>) => {
    const _id = new Types.ObjectId();
    await orders.collection.insertOne({
      _id,
      // orderNumber and pickupDetails.qrCode both carry a real unique
      // (non-sparse) index; every seeded order needs its own value or two
      // docs missing it collide as `orderNumber: null`. Pattern from
      // admin/__tests__/offline-refund.integration.spec.ts and
      // merchant-sales.expressions.integration.spec.ts.
      orderNumber: `ORD-${_id.toString().slice(-8)}`,
      merchantId: merchantAId,
      status: OrderStatus.PICKED_UP,
      deliveryMode: 'pickup',
      isDeleted: false,
      pricing: { subtotal: 10, discountAmount: 0, deliveryFee: 0, total: 10 },
      // Giving every row a qrCode (the same unique-index reason) must not add
      // pickupDetails.actualPickupTime - that field is only set below on rows
      // that intend the legacy pickupDetails-fallback moment, and none here
      // do (they all set pickedUpAt/driverPickedUpAt explicitly).
      pickupDetails: { pickupCode: _id.toString().slice(-6), qrCode: `QR-${_id.toString()}` },
      ...doc,
    } as never);
    return _id;
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(requireMongoTestUri(), {
      dbName: `merchant_sales_summary_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orders = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    service = Object.create(MerchantSalesService.prototype) as MerchantSalesService;
    Object.assign(service, {
      orderModel: orders,
      configService: {
        get: (k: string) =>
          k === 'COMMISSION_MODEL_EFFECTIVE_AT' ? '2026-09-10T00:00:00+01:00' : undefined,
      },
      sentry,
      logger,
    });
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    sentry.captureMessage.mockClear();
    logger.error.mockClear();
    await orders.collection.deleteMany({});

    // 1. cash in store - NORMAL. discountAmount 5 lives only here (the offer
    // discount already applied to `subtotal`); `total` stays subtotal +
    // deliveryFee, since `subtotal` is already the discounted price.
    await seed({
      pricing: { subtotal: 10, discountAmount: 5, deliveryFee: 0, total: 10 },
      pickedUpAt: T('2026-09-12T10:00:00+01:00'),
      commission: normalCommission(10, T('2026-09-12T10:00:00+01:00')),
    });
    // 2. cash via delivery - NORMAL, delivery fee must never enter earnings
    await seed({
      deliveryMode: 'delivery',
      status: OrderStatus.DELIVERED,
      pricing: { subtotal: 7, discountAmount: 0, deliveryFee: 5, total: 12 },
      driverPickedUpAt: T('2026-09-12T11:00:00+01:00'),
      commission: normalCommission(7, T('2026-09-12T11:00:00+01:00')),
    });
    // 3. online pickup - a Konnect pickup really terminates at COMPLETED, not
    // PICKED_UP; this row exercises that status.
    await seed({
      status: OrderStatus.COMPLETED,
      paymentProvider: 'konnect',
      pricing: { subtotal: 12, discountAmount: 0, deliveryFee: 0, total: 12 },
      pickedUpAt: T('2026-09-13T10:00:00+01:00'),
      commission: normalCommission(12, T('2026-09-13T10:00:00+01:00')),
    });
    // 4. online delivery - NORMAL
    await seed({
      deliveryMode: 'delivery',
      status: OrderStatus.DELIVERED,
      paymentProvider: 'konnect',
      pricing: { subtotal: 9, discountAmount: 0, deliveryFee: 4, total: 13 },
      driverPickedUpAt: T('2026-09-13T11:00:00+01:00'),
      commission: normalCommission(9, T('2026-09-13T11:00:00+01:00')),
    });
    // 5. settlement - merchant earned 4, 6 settled against the balance
    await seed({
      pricing: { subtotal: 10, discountAmount: 0, deliveryFee: 0, total: 10 },
      pickedUpAt: T('2026-09-14T10:00:00+01:00'),
      commission: settlementCommission(4, 6, T('2026-09-14T10:00:00+01:00')),
    });
    // 6. legacy (case 2) - no decision, moment before the cutoff -> 81% of subtotal
    await seed({
      pricing: { subtotal: 15.241, discountAmount: 0, deliveryFee: 0, total: 15.241 },
      pickedUpAt: T('2026-09-05T10:00:00+01:00'),
    });
    // 7. case 3 - no decision, moment at/after the cutoff -> integrity failure
    case3Id = await seed({
      pricing: { subtotal: 15.241, discountAmount: 0, deliveryFee: 0, total: 15.241 },
      pickedUpAt: T('2026-09-15T10:00:00+01:00'),
    });
    // 8. refunded after completion - has a moment, excluded from Earnings
    await seed({
      status: OrderStatus.REFUNDED,
      paymentProvider: 'konnect',
      pricing: { subtotal: 11, discountAmount: 0, deliveryFee: 0, total: 11 },
      pickedUpAt: T('2026-09-16T10:00:00+01:00'),
      commission: normalCommission(11, T('2026-09-16T10:00:00+01:00')),
    });
    // 9. refunded before completion - never a sale, has no moment, no tab
    await seed({
      status: OrderStatus.REFUNDED,
      paymentProvider: 'konnect',
      pricing: { subtotal: 8, discountAmount: 0, deliveryFee: 0, total: 8 },
    });
    // 10. pending / cancelled - appear in no tab
    await seed({
      status: OrderStatus.PENDING,
      pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 0, total: 6 },
    });
    await seed({
      status: OrderStatus.CANCELLED,
      pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 0, total: 6 },
    });
    // 11. August sale - excluded from `month`, included in `30d` and `all`
    await seed({
      pricing: { subtotal: 20, discountAmount: 0, deliveryFee: 0, total: 20 },
      pickedUpAt: T('2026-08-30T10:00:00+01:00'),
      commission: normalCommission(20, T('2026-08-30T10:00:00+01:00')),
    });
    // 12. August sale, refunded - completed in August, refunded in September;
    // stays out of every Earnings total, by its original (August) moment.
    await seed({
      status: OrderStatus.REFUNDED,
      pricing: { subtotal: 13, discountAmount: 0, deliveryFee: 0, total: 13 },
      pickedUpAt: T('2026-08-30T11:00:00+01:00'),
      commission: normalCommission(13, T('2026-08-30T11:00:00+01:00')),
    });
    // 13. isDeleted NORMAL sale - must not appear in any total, at all.
    await seed({
      isDeleted: true,
      pricing: { subtotal: 50, discountAmount: 0, deliveryFee: 0, total: 50 },
      pickedUpAt: T('2026-09-12T12:00:00+01:00'),
      commission: normalCommission(50, T('2026-09-12T12:00:00+01:00')),
    });
    // Merchant B - a single NORMAL cash-in-store sale, entirely separate.
    await seed({
      merchantId: merchantBId,
      pricing: { subtotal: 99, discountAmount: 0, deliveryFee: 0, total: 99 },
      pickedUpAt: T('2026-09-12T10:00:00+01:00'),
      commission: normalCommission(99, T('2026-09-12T10:00:00+01:00')),
    });
  });

  it.each(['today', '7d', '30d', 'month', 'all'] as const)(
    '%s: the three lines sum to the total, in millimes',
    async period => {
      const s = await service.summary(merchantA, period, now);
      const lines =
        s.channels.cashStore.earned + s.channels.cashDelivery.earned + s.channels.online.earned;
      expect(millimes(lines)).toBe(millimes(s.total.earned));
    },
  );

  it('month: food only, refunded out, case 2 at 81%, case 3 out and counted', async () => {
    const s = await service.summary(merchantA, 'month', now);
    // 10 + 7 + 12 + 9 + 4 (settlement) + 12.345 (legacy) = 54.345; never the fees, the 99, or case 3
    expect(millimes(s.total.earned)).toBe(54_345);
    expect(s.unverifiedOrders).toBe(1);
    expect(s.channels.cashDelivery.earned).toBe(7);
    // Food price after discount over the same orders: 10 + 7 + 12 + 9 + 10 (the
    // settlement's subtotal, of which the merchant earned 4) + 15.241 (legacy).
    // Delivery fees (5 and 4) are in neither figure.
    expect(millimes(s.total.foodValue)).toBe(63_241);
  });

  it('originalValue adds back the one seeded discount; commission sums the NORMAL rows only', async () => {
    const s = await service.summary(merchantA, 'month', now);
    // discountAmount 5 lives only on the cash-in-store row (subtotal 10);
    // foodValue reads `pricing.subtotal` only, so it is unaffected (63.241,
    // asserted above) - originalValue is exactly foodValue + 5.
    expect(millimes(s.total.originalValue)).toBe(millimes(s.total.foodValue) + millimes(5));
    expect(millimes(s.total.originalValue)).toBe(68_241);
    // accrued sums the four NORMAL rows' 19%: 10*0.19 + 7*0.19 + 12*0.19 + 9*0.19
    // = 1.9 + 1.33 + 2.28 + 1.71 = 7.22. The settlement row is 0 accrued / 6
    // settled; the legacy row has no decision, so 0 accrued and 0 settled.
    expect(s.commission).toEqual({ rate: PLATFORM_FOOD_SHARE, accrued: 7.22, settled: 6 });
  });

  it("case 3 can never become 81%: its 12.345 is in no total, only the legacy order's is", async () => {
    const s = await service.summary(merchantA, 'month', now);
    // Both orders have subtotal 15.241, so 81% of each is 12.345. Counting case 3
    // at 81% would make the month 66.690; the exact 54.345 proves it is 0.
    expect(millimes(s.total.earned)).toBe(54_345);
    expect(s.unverifiedOrders).toBe(1); // counted, not earned (its row is checked in Task 8)
  });

  it('reports the integrity failure once per request - never once per verifying group - with both ids and one log line', async () => {
    // A second post-cutoff order with no decision, on a different line
    // (online, not case 3's cashStore), so there are two verifying *groups*.
    // A per-group report would call captureMessage/logger.error twice; the
    // binding rule is once per request regardless of how many groups exist.
    const secondUnverifiedId = await seed({
      paymentProvider: 'konnect',
      pricing: { subtotal: 5, discountAmount: 0, deliveryFee: 0, total: 5 },
      pickedUpAt: T('2026-09-15T11:00:00+01:00'), // after the cutoff, no decision
    });

    const s = await service.summary(merchantA, 'month', now);
    expect(s.unverifiedOrders).toBe(2);

    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('MERCHANT_EARNINGS_UNVERIFIED_ORDERS'),
      'error',
      expect.objectContaining({
        merchantEarnings: expect.objectContaining({ count: 2, period: 'month' }),
      }),
      ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS'],
    );
    const sentryOrderIds: string[] =
      sentry.captureMessage.mock.calls[0][2].merchantEarnings.orderIds;
    // Exactly the two verifying ids, as strings - no earnings order id, no
    // duplicate, nothing dropped.
    expect([...sentryOrderIds].sort()).toEqual(
      [case3Id.toString(), secondUnverifiedId.toString()].sort(),
    );

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('MERCHANT_EARNINGS_UNVERIFIED_ORDERS'),
      expect.objectContaining({
        code: 'MERCHANT_EARNINGS_UNVERIFIED_ORDERS',
        count: 2,
        period: 'month',
      }),
    );
  });

  it('caps orderIds at 20 when more than 20 orders are unverified', async () => {
    // case3Id (1) plus 21 more post-cutoff orders with no decision = 22
    // unverified orders; the report must still cap the id list at 20.
    const extraMoments = Array.from({ length: 21 }, (_, i) =>
      T(`2026-09-2${(i % 5) + 1}T10:00:00+01:00`),
    );
    for (const moment of extraMoments) {
      await seed({
        pricing: { subtotal: 1, discountAmount: 0, deliveryFee: 0, total: 1 },
        pickedUpAt: moment,
      });
    }

    const s = await service.summary(merchantA, 'month', now);
    expect(s.unverifiedOrders).toBe(22);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    const sentryOrderIds: string[] =
      sentry.captureMessage.mock.calls[0][2].merchantEarnings.orderIds;
    expect(sentryOrderIds.length).toBeLessThanOrEqual(20);
  });

  it('restoring the decision brings the order back with its persisted amount', async () => {
    await orders.collection.updateOne(
      { _id: case3Id },
      {
        $set: {
          commission: {
            model: 'V2',
            kind: 'NORMAL',
            merchantAmount: 15.241,
            accrued: 2.896,
            settled: 0,
            dueBefore: 0,
            dueAfter: 0,
            appliedAt: T('2026-09-15T10:00:00+01:00'),
          },
        },
      },
    );
    const s = await service.summary(merchantA, 'month', now);
    expect(s.unverifiedOrders).toBe(0);
    expect(millimes(s.total.earned)).toBe(54_345 + 15_241);
  });

  it("merchant B's 99 is B's alone", async () => {
    const b = await service.summary(merchantB, 'all', now);
    expect(millimes(b.total.earned)).toBe(99_000);
    // and A's exact month total above (54.345) already excludes it
  });

  it('a location manager with no assignment sees zero, not the platform', async () => {
    const s = await service.summary({ kind: 'none' }, 'all', now);
    expect(s.total).toEqual({ orders: 0, earned: 0, foodValue: 0, originalValue: 0 });
  });

  it('a sale completed in one period and refunded in the next stays out of both periods', async () => {
    // seeded: completed 2026-08-30, refunded 2026-09-02 -> status REFUNDED, moment in August
    const sep = await service.summary(merchantA, 'month', now);
    const all = await service.summary(merchantA, 'all', now);
    expect(millimes(all.total.earned) - millimes(sep.total.earned)).toBe(millimes(augustEarnings));
  });

  // --- Gaps carried over from Task 4's review (task-6-brief "things it cannot know") ---

  it('an isDeleted NORMAL cash-in-store sale (subtotal 50) does not appear in any total', async () => {
    const s = await service.summary(merchantA, 'month', now);
    // Would be 104.345 (54.345 + 50) if the isDeleted row leaked in; the exact
    // 54.345 from the "month" test above already proves it did not - asserted
    // again here, explicitly, for this row.
    expect(millimes(s.total.earned)).toBe(54_345);
  });

  it('the online channel includes a COMPLETED order - the real terminal status for a Konnect pickup', async () => {
    const s = await service.summary(merchantA, 'month', now);
    // online pickup (12, COMPLETED) + online delivery (9, DELIVERED) = 2 orders, 21 earned
    expect(s.channels.online).toEqual({ orders: 2, earned: 21 });
  });

  it('an August order (2026-08-30) is excluded from month but included in 30d and all, by exactly its earned amount', async () => {
    const month = await service.summary(merchantA, 'month', now);
    const thirty = await service.summary(merchantA, '30d', now);
    const all = await service.summary(merchantA, 'all', now);
    expect(millimes(thirty.total.earned) - millimes(month.total.earned)).toBe(
      millimes(augustEarnings),
    );
    expect(millimes(all.total.earned) - millimes(month.total.earned)).toBe(
      millimes(augustEarnings),
    );
  });

  // --- Task 7: the chart, built from the same population as the summary ---

  it.each(['today', '7d', '30d', 'month', 'all'] as const)(
    '%s: chart slots sum to the summary total, in millimes',
    async period => {
      const [summary, chart] = await Promise.all([
        service.summary(merchantA, period, now),
        service.chart(merchantA, period, now),
      ]);
      const slots = chart.slots.reduce((sum, s) => sum + Math.round(s.earned * 1000), 0);
      expect(slots).toBe(Math.round(summary.total.earned * 1000));
      expect(chart.slots.reduce((sum, s) => sum + s.orders, 0)).toBe(summary.total.orders);
    },
  );

  it('today has 24 hourly slots, and a sale at 00:10 Tunis is in the 00:00 slot', async () => {
    // Seeded here, not in the shared table, so the fixed totals of Task 6 stay
    // valid: a NORMAL cash-in-store sale, subtotal 5, pickedUpAt
    // 2026-09-25T23:10:00Z (00:10 local on the 26th).
    await seed({
      pricing: { subtotal: 5, discountAmount: 0, deliveryFee: 0, total: 5 },
      pickedUpAt: T('2026-09-25T23:10:00Z'),
      commission: normalCommission(5, T('2026-09-25T23:10:00Z')),
    });

    const chart = await service.chart(merchantA, 'today', now);
    expect(chart.slots).toHaveLength(24);
    expect(chart.slots[0]?.start).toBe('2026-09-25T23:00:00.000Z');
    expect(chart.slots[0]?.orders).toBe(1);
  });

  it('empty days are 0 slots, not missing ones', async () => {
    const chart = await service.chart(merchantA, '7d', now);
    expect(chart.slots).toHaveLength(7);
    expect(chart.slots.every(s => typeof s.earned === 'number')).toBe(true);
  });

  // --- Task 8: the rows behind the Payments tabs ---

  const allRows = async (tab: EarningsTab, period: SalesPeriod): Promise<EarningsRow[]> => {
    const out: EarningsRow[] = [];
    let after: string | undefined;
    do {
      const page = await service.rows(
        merchantA,
        period,
        tab,
        { ...(after ? { after } : {}), limit: 2 },
        now,
      );
      out.push(...page.rows);
      after = page.nextCursor;
    } while (after);
    return out;
  };

  it.each(['today', '7d', '30d', 'month', 'all'] as const)(
    '%s: Earnings rows over every page sum to the total',
    async period => {
      const [summary, rows] = await Promise.all([
        service.summary(merchantA, period, now),
        allRows('earnings', period),
      ]);
      expect(rows.reduce((s, r) => s + Math.round(r.earned * 1000), 0)).toBe(
        Math.round(summary.total.earned * 1000),
      );
      expect(rows).toHaveLength(summary.total.orders);
    },
  );

  it('Refunded lists the refunded-after-completion sale only; Being verified lists case 3', async () => {
    const refunded = await allRows('refunded', 'all');
    const verifying = await allRows('verifying', 'all');
    expect(refunded.every(r => r.status === 'refunded')).toBe(true);
    expect(verifying.map(r => r.orderId)).toEqual([case3Id.toString()]);
    expect(verifying[0]).toMatchObject({ kind: 'UNVERIFIED', earned: 0 });
  });

  it('pages never repeat or skip a row (ties on the same moment included)', async () => {
    // Two Earnings orders sharing the exact same commission moment, seeded
    // only in this test so Task 6/7's fixed totals over the shared table stay
    // valid - the tie-break (`_id` in the sort and the cursor `$or`) is what
    // is under test here, not the summary/chart totals. The moment is placed
    // between order 5 (2026-09-14T10:00+01:00, the newest Earnings row in the
    // shared table) and order 4 (2026-09-13T11:00+01:00) on purpose: with
    // `limit: 2`, that puts exactly one row (order 5) ahead of the tied pair,
    // so the tie itself straddles the page-1/page-2 boundary rather than
    // landing wholly inside one page - the only placement that would let a
    // missing tie-break go unnoticed.
    const tiedMoment = T('2026-09-13T15:00:00+01:00');
    await seed({
      pricing: { subtotal: 3, discountAmount: 0, deliveryFee: 0, total: 3 },
      pickedUpAt: tiedMoment,
      commission: normalCommission(3, tiedMoment),
    });
    await seed({
      pricing: { subtotal: 4, discountAmount: 0, deliveryFee: 0, total: 4 },
      pickedUpAt: tiedMoment,
      commission: normalCommission(4, tiedMoment),
    });

    const rows = await allRows('earnings', 'all');
    expect(new Set(rows.map(r => r.orderId)).size).toBe(rows.length);
    // Uniqueness alone would also pass if a tied row were silently dropped at
    // the page boundary - "never skip" is only exercised by also pinning the
    // count against the same total `summary` reconciles against.
    const summary = await service.summary(merchantA, 'all', now);
    expect(rows).toHaveLength(summary.total.orders);
  });

  it('a malformed cursor is a 400', async () => {
    await expect(
      service.rows(merchantA, 'all', 'earnings', { after: 'nope', limit: 2 }, now),
    ).rejects.toThrow();
  });

  it('a malformed cursor is a 400 even when the scope resolves to no orders', async () => {
    // baseStages() returns null for `{ kind: 'none' }`; the cursor must still
    // be validated before that early return, or a garbage `after` on a scope
    // with nothing to page through silently returns an empty 200 instead of
    // the mandated 400.
    let thrown: unknown;
    try {
      await service.rows({ kind: 'none' }, 'all', 'earnings', { after: 'nope', limit: 2 }, now);
      fail('should have thrown');
    } catch (err) {
      thrown = err;
    }
    expect(hasErrorCode(thrown, 'INVALID_CURSOR')).toBe(true);
  });

  it('a valid cursor with a none scope still returns empty rows, not a match', async () => {
    const validCursor = `${now.getTime()}.${new Types.ObjectId().toString()}`;
    const page = await service.rows(
      { kind: 'none' },
      'all',
      'earnings',
      { after: validCursor, limit: 2 },
      now,
    );
    expect(page).toEqual({ rows: [], hasMore: false });
  });

  it('joins the customer and establishment names, with the documented fallbacks', async () => {
    // Neither collection is touched by the shared seed table (no order there
    // sets customerId/establishmentId), so this is the only coverage of
    // toEarningsRow's name join and its null/first-name-only fallbacks.
    // Seeded and cleaned up entirely inside this test.
    const fullCustomerId = new Types.ObjectId();
    const firstNameOnlyId = new Types.ObjectId();
    const establishmentId = new Types.ObjectId();
    const moment = T('2026-09-17T10:00:00+01:00');

    await orders.db.collection('users').insertMany([
      { _id: fullCustomerId, firstName: 'Amel', lastName: 'Ben Salah' },
      { _id: firstNameOnlyId, firstName: 'Amel' },
    ] as never);
    await orders.db
      .collection('establishments')
      .insertOne({ _id: establishmentId, name: 'Boulangerie Test' } as never);

    const withFullCustomer = await seed({
      customerId: fullCustomerId,
      establishmentId,
      pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 0, total: 6 },
      pickedUpAt: moment,
      commission: normalCommission(6, moment),
    });
    const withFirstNameOnlyCustomer = await seed({
      customerId: firstNameOnlyId,
      pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 0, total: 6 },
      pickedUpAt: T('2026-09-17T11:00:00+01:00'),
      commission: normalCommission(6, T('2026-09-17T11:00:00+01:00')),
    });
    const withNoCustomer = await seed({
      pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 0, total: 6 },
      pickedUpAt: T('2026-09-17T12:00:00+01:00'),
      commission: normalCommission(6, T('2026-09-17T12:00:00+01:00')),
    });

    try {
      const rows = await allRows('earnings', 'all');
      const byId = new Map(rows.map(r => [r.orderId, r]));
      expect(byId.get(withFullCustomer.toString())).toMatchObject({
        customerName: 'Amel Ben Salah',
        establishmentName: 'Boulangerie Test',
      });
      expect(byId.get(withFirstNameOnlyCustomer.toString())).toMatchObject({
        customerName: 'Amel',
        establishmentName: null,
      });
      expect(byId.get(withNoCustomer.toString())).toMatchObject({
        customerName: null,
        establishmentName: null,
      });
    } finally {
      await orders.db
        .collection('users')
        .deleteMany({ _id: { $in: [fullCustomerId, firstNameOnlyId] } });
      await orders.db.collection('establishments').deleteOne({ _id: establishmentId });
    }
  });

  // --- Task 17 (A1): delivery earnings count at driver pickup, not DELIVERED ---

  describe('delivery earnings count at driver pickup', () => {
    it('OUT_FOR_DELIVERY with a decision counts in the summary, the chart and the rows', async () => {
      const id = await seed({
        deliveryMode: 'delivery',
        status: OrderStatus.OUT_FOR_DELIVERY,
        pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 3, total: 9 },
        driverPickedUpAt: T('2026-09-20T10:00:00+01:00'),
        commission: normalCommission(6, T('2026-09-20T10:00:00+01:00')),
      });
      const [summary, chart, rows] = await Promise.all([
        service.summary(merchantA, 'month', now),
        service.chart(merchantA, 'month', now),
        allRows('earnings', 'month'),
      ]);
      expect(millimes(summary.total.earned)).toBe(54_345 + 6_000);
      expect(rows.some(r => r.orderId === id.toString())).toBe(true);
      const chartSum = chart.slots.reduce((s, sl) => s + Math.round(sl.earned * 1000), 0);
      expect(chartSum).toBe(Math.round(summary.total.earned * 1000));
    });

    it('CANCELLED after driver pickup with a decision counts the same way, whatever the recovery', async () => {
      const id = await seed({
        deliveryMode: 'delivery',
        status: OrderStatus.CANCELLED,
        pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 3, total: 9 },
        driverPickedUpAt: T('2026-09-20T11:00:00+01:00'),
        commission: normalCommission(6, T('2026-09-20T11:00:00+01:00')),
      });
      const summary = await service.summary(merchantA, 'month', now);
      expect(millimes(summary.total.earned)).toBe(54_345 + 6_000);
      const rows = await allRows('earnings', 'month');
      expect(
        rows.some(r => r.orderId === id.toString() && r.status === OrderStatus.CANCELLED),
      ).toBe(true);
    });

    it('CANCELLED before driver pickup (no decision, no moment) never appears and never changes the total', async () => {
      await seed({ deliveryMode: 'delivery', status: OrderStatus.CANCELLED });
      const summary = await service.summary(merchantA, 'month', now);
      expect(millimes(summary.total.earned)).toBe(54_345);
    });

    it('a pickup at 23:50/00:10 Tunis lands in the day-26 slot both before and after delivery', async () => {
      // 2026-09-25T23:10:00Z = 2026-09-26T00:10 Tunis - the same boundary as
      // the existing "today" pickup test above, exercised here while still
      // OUT_FOR_DELIVERY (the commission is already applied at pickup) and
      // again once DELIVERED - the figure must not move once the status
      // catches up.
      const moment = T('2026-09-25T23:10:00Z');
      const id = await seed({
        deliveryMode: 'delivery',
        status: OrderStatus.OUT_FOR_DELIVERY,
        pricing: { subtotal: 8, discountAmount: 0, deliveryFee: 3, total: 11 },
        driverPickedUpAt: moment,
        commission: normalCommission(8, moment),
      });

      const whileOutForDelivery = await service.chart(merchantA, 'today', now);
      expect(whileOutForDelivery.slots[0]).toMatchObject({
        start: '2026-09-25T23:00:00.000Z',
        orders: 1,
        earned: 8,
      });

      await orders.collection.updateOne(
        { _id: id },
        { $set: { status: OrderStatus.DELIVERED, deliveredAt: T('2026-09-26T05:00:00Z') } },
      );
      const afterDelivery = await service.chart(merchantA, 'today', now);
      expect(afterDelivery.slots[0]).toMatchObject({
        start: '2026-09-25T23:00:00.000Z',
        orders: 1,
        earned: 8,
      });
      const summary = await service.summary(merchantA, 'today', now);
      expect(millimes(summary.total.earned)).toBe(8_000);
    });

    it('invariants still hold once OUT_FOR_DELIVERY and CANCELLED-after-pickup rows are mixed in', async () => {
      const outForDeliveryMoment = T('2026-09-20T10:00:00+01:00');
      const cancelledMoment = T('2026-09-21T10:00:00+01:00');
      await seed({
        deliveryMode: 'delivery',
        status: OrderStatus.OUT_FOR_DELIVERY,
        pricing: { subtotal: 6, discountAmount: 0, deliveryFee: 3, total: 9 },
        driverPickedUpAt: outForDeliveryMoment,
        commission: normalCommission(6, outForDeliveryMoment),
      });
      await seed({
        deliveryMode: 'delivery',
        status: OrderStatus.CANCELLED,
        pricing: { subtotal: 4, discountAmount: 0, deliveryFee: 2, total: 6 },
        driverPickedUpAt: cancelledMoment,
        commission: normalCommission(4, cancelledMoment),
      });

      const [summary, chart, rows] = await Promise.all([
        service.summary(merchantA, 'month', now),
        service.chart(merchantA, 'month', now),
        allRows('earnings', 'month'),
      ]);

      expect(millimes(summary.total.earned)).toBe(54_345 + 6_000 + 4_000);
      const lineSum =
        summary.channels.cashStore.earned +
        summary.channels.cashDelivery.earned +
        summary.channels.online.earned;
      expect(millimes(lineSum)).toBe(millimes(summary.total.earned));
      const chartSum = chart.slots.reduce((s, sl) => s + Math.round(sl.earned * 1000), 0);
      expect(chartSum).toBe(Math.round(summary.total.earned * 1000));
      expect(rows.reduce((s, r) => s + Math.round(r.earned * 1000), 0)).toBe(
        Math.round(summary.total.earned * 1000),
      );
      expect(rows).toHaveLength(summary.total.orders);
    });
  });

  // --- Task 11: /payments/stats for a merchant is the shared summary, byte for byte ---

  describe('PaymentController.getPaymentStats (merchant)', () => {
    it('returns exactly what MerchantSalesService.summary returns for the same instant', async () => {
      // Both calls must see the same clock: the controller reads `new Date()`
      // internally (it is never given `now`), so only `Date` is frozen here -
      // every other timer stays real, or the MongoDB driver's own socket and
      // server-selection timers would never fire against the real replica set.
      jest.useFakeTimers({
        now,
        doNotFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'nextTick',
          'hrtime',
          'performance',
          'queueMicrotask',
        ],
      });
      try {
        const controller = Object.create(PaymentController.prototype) as PaymentController;
        Object.assign(controller, { merchantSalesService: service, paymentService: {} });

        let body: { data?: unknown } = {};
        const res = {
          status: () => ({
            json: (payload: { data?: unknown }) => {
              body = payload;
              return payload;
            },
          }),
        };
        const req = { user: { userId: merchantAId.toString(), role: UserRole.MERCHANT } };

        await controller.getPaymentStats(req as never, res as never, { period: 'month' } as never);

        expect(body.data).toEqual(await service.summary(merchantA, 'month'));
      } finally {
        jest.useRealTimers();
      }
    });

    it('threads a non-default period through - a controller that ignored `query.period` would fail here', async () => {
      // The shared seed table has nothing on/after 2026-09-20, so 7d (which
      // starts 2026-09-20 for `now` = 2026-09-26) is genuinely empty - a
      // controller that always resolved 'month' regardless of the query would
      // still return month's non-zero total here and this would fail.
      jest.useFakeTimers({
        now,
        doNotFake: [
          'setTimeout',
          'clearTimeout',
          'setInterval',
          'clearInterval',
          'setImmediate',
          'clearImmediate',
          'nextTick',
          'hrtime',
          'performance',
          'queueMicrotask',
        ],
      });
      try {
        const controller = Object.create(PaymentController.prototype) as PaymentController;
        Object.assign(controller, { merchantSalesService: service, paymentService: {} });

        let body: { data?: unknown } = {};
        const res = {
          status: () => ({
            json: (payload: { data?: unknown }) => {
              body = payload;
              return payload;
            },
          }),
        };
        const req = { user: { userId: merchantAId.toString(), role: UserRole.MERCHANT } };

        await controller.getPaymentStats(req as never, res as never, { period: '7d' } as never);

        const direct = await service.summary(merchantA, '7d');
        expect(direct.total).toEqual({ orders: 0, earned: 0, foodValue: 0, originalValue: 0 });
        expect(body.data).toEqual(direct);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
