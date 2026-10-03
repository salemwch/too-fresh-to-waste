/**
 * A2: the order-detail "Your earnings" row must be built from the SAME case
 * logic as merchant-sales - never a copy of the formula. This table drives
 * both the real Mongo aggregation (`salesBaseStages`, exactly what the
 * Dashboard/Payments/chart use) and the order-detail function
 * (`orderEarningsFor`) from the same fixtures, so the two cannot silently
 * drift (testing.md rule 6).
 *
 *   docker compose up -d mongodb mongo-init
 *   bash .superpowers/sdd/2026-09-26-merchant-earnings/testdb.sh merchant-order-earnings
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { orderEarningsFor, salesBaseStages } from '../merchant-sales.expressions';

const CUTOFF = new Date('2026-09-01T00:00:00+01:00');
const T = (iso: string) => new Date(iso);

describe('order-detail earnings matches the merchant-sales amount (A2, real MongoDB)', () => {
  let connection: Connection;
  let orders: Model<OrderDocument>;
  const merchantId = new Types.ObjectId();

  const seed = async (doc: Record<string, unknown>) => {
    const _id = new Types.ObjectId();
    await orders.collection.insertOne({
      _id,
      orderNumber: `ORD-${_id.toString().slice(-8)}`,
      merchantId,
      status: OrderStatus.PICKED_UP,
      deliveryMode: 'pickup',
      pricing: { subtotal: 10, deliveryFee: 0, total: 10 },
      pickupDetails: { pickupCode: _id.toString().slice(-6), qrCode: `QR-${_id.toString()}` },
      ...doc,
    } as never);
    return _id;
  };

  /** null when the aggregation does not count this order as an earning at all. */
  const aggregatedEarned = async (id: Types.ObjectId): Promise<number | null> => {
    const [row] = await orders.aggregate<{ _earnedMillimes: number; _population: string }>([
      ...salesBaseStages({
        scope: { merchantId },
        from: null,
        to: T('2027-01-01T00:00:00Z'),
        cutoff: CUTOFF,
      }),
      { $match: { _id: id } },
    ]);
    if (!row || row._population === 'verifying') {
      return null;
    }
    return row._earnedMillimes / 1000;
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(requireMongoTestUri(), {
      dbName: `merchant_order_earnings_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orders = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  beforeEach(async () => {
    await orders.collection.deleteMany({});
  });

  it.each([
    [
      'CURRENT, NORMAL',
      { pickedUpAt: T('2026-09-10T10:00:00Z'), commission: { kind: 'NORMAL', merchantAmount: 10 } },
      10,
      false,
    ],
    [
      'CURRENT, SETTLEMENT (subtotal minus settled)',
      {
        pickedUpAt: T('2026-09-10T10:00:00Z'),
        commission: { kind: 'SETTLEMENT', merchantAmount: 4 },
      },
      4,
      false,
    ],
    [
      'LEGACY, persisted pricing.merchantAmount',
      { pickedUpAt: T('2026-08-10T10:00:00Z'), pricing: { subtotal: 10, merchantAmount: 8.1 } },
      8.1,
      false,
    ],
    [
      'LEGACY, computed round3(subtotal * 0.81)',
      { pickedUpAt: T('2026-08-10T10:00:00Z'), pricing: { subtotal: 15.241 } },
      12.345,
      false,
    ],
    [
      'UNVERIFIED, post-cutoff with no decision',
      { pickedUpAt: T('2026-09-10T10:00:00Z'), pricing: { subtotal: 15.241 } },
      null,
      true,
    ],
  ] as const)(
    '%s: order-detail and merchant-sales agree',
    async (_label, doc, expectedAmount, expectedVerifying) => {
      const id = await seed(doc as Record<string, unknown>);
      const [aggregated, order] = await Promise.all([
        aggregatedEarned(id),
        orders.findById(id).lean(),
      ]);

      const detail = orderEarningsFor(order as never, CUTOFF);

      expect(detail?.verifying).toBe(expectedVerifying);
      expect(detail?.amount).toBe(expectedAmount);
      // The parity claim itself: whatever merchant-sales would have earned this
      // exact order (null for the verifying case, which earns nothing anywhere)
      // is exactly what the order-detail function reports.
      expect(detail?.amount ?? null).toBe(aggregated);
    },
  );

  it('REFUNDED: no amount, agreeing with the Refunded tab (not Earnings)', async () => {
    const id = await seed({
      status: OrderStatus.REFUNDED,
      pickedUpAt: T('2026-09-10T10:00:00Z'),
      commission: { kind: 'NORMAL', merchantAmount: 10 },
    });
    const order = await orders.findById(id).lean();
    expect(orderEarningsFor(order as never, CUTOFF)).toEqual({ amount: null, verifying: false });
  });

  it('no commission moment yet (not picked up): no earnings line at all', async () => {
    const id = await seed({ status: OrderStatus.CONFIRMED });
    const order = await orders.findById(id).lean();
    expect(orderEarningsFor(order as never, CUTOFF)).toBeUndefined();
  });

  it('REFUNDED before completion (no moment): undefined, same as the pipeline which filters it out entirely', async () => {
    const id = await seed({
      status: OrderStatus.REFUNDED,
      paymentProvider: 'konnect',
      pricing: { subtotal: 8, discountAmount: 0, deliveryFee: 0, total: 8 },
    });
    const [aggregated, order] = await Promise.all([
      aggregatedEarned(id),
      orders.findById(id).lean(),
    ]);
    expect(aggregated).toBeNull();
    expect(orderEarningsFor(order as never, CUTOFF)).toBeUndefined();
  });

  it('a CANCELLED delivery after driver pickup still has an earnings line (A1 parity)', async () => {
    const id = await seed({
      deliveryMode: 'delivery',
      status: OrderStatus.CANCELLED,
      driverPickedUpAt: T('2026-09-10T10:00:00Z'),
      commission: { kind: 'NORMAL', merchantAmount: 6 },
    });
    const order = await orders.findById(id).lean();
    expect(orderEarningsFor(order as never, CUTOFF)).toEqual({ amount: 6, verifying: false });
  });
});
