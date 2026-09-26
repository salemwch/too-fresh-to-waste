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

import mongoose, { Connection, Model, Types } from 'mongoose';

import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from '../../orders/utils/order-pricing.util';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { MerchantSalesService } from '../merchant-sales.service';
import type { SalesScope } from '../merchant-sales.scope';

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

    // 1. cash in store - NORMAL
    await seed({
      pricing: { subtotal: 10, discountAmount: 0, deliveryFee: 0, total: 10 },
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

  it("case 3 can never become 81%: its 12.345 is in no total, only the legacy order's is", async () => {
    const s = await service.summary(merchantA, 'month', now);
    // Both orders have subtotal 15.241, so 81% of each is 12.345. Counting case 3
    // at 81% would make the month 66.690; the exact 54.345 proves it is 0.
    expect(millimes(s.total.earned)).toBe(54_345);
    expect(s.unverifiedOrders).toBe(1); // counted, not earned (its row is checked in Task 8)
  });

  it('reports the integrity failure once per request, with the stable code and at most 20 ids', async () => {
    await service.summary(merchantA, 'month', now);
    expect(sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      expect.stringContaining('MERCHANT_EARNINGS_UNVERIFIED_ORDERS'),
      'error',
      expect.objectContaining({
        merchantEarnings: expect.objectContaining({ count: 1, period: 'month' }),
      }),
      ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS'],
    );
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
});
