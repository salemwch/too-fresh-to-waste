import mongoose, { Connection, Model, Types } from 'mongoose';

import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { salesBaseStages } from '../merchant-sales.expressions';

const CUTOFF = new Date('2026-09-01T00:00:00+01:00');
const T = (iso: string) => new Date(iso);

describe('merchant-sales expressions (real MongoDB)', () => {
  let connection: Connection;
  let orders: Model<OrderDocument>;
  const merchantId = new Types.ObjectId();

  const seed = async (doc: Record<string, unknown>) => {
    const _id = new Types.ObjectId();
    await orders.collection.insertOne({
      _id,
      // orderNumber has a real unique (non-sparse) index on the schema, so
      // every seeded order needs one - two docs both missing it collide as
      // `orderNumber: null`, unrelated to the pipeline under test. Pattern
      // from admin/__tests__/offline-refund.integration.spec.ts.
      orderNumber: `ORD-${_id.toString().slice(-8)}`,
      merchantId,
      status: OrderStatus.PICKED_UP,
      deliveryMode: 'pickup',
      pricing: { subtotal: 10, deliveryFee: 0, total: 10 },
      // pickupDetails.qrCode has the same real unique (non-sparse) index
      // problem as orderNumber above; give every seeded order one unless the
      // test itself overrides pickupDetails.
      pickupDetails: { pickupCode: _id.toString().slice(-6), qrCode: `QR-${_id.toString()}` },
      ...doc,
    } as never);
    return _id;
  };

  const run = async (cutoff: Date | null = CUTOFF) => {
    const rows = await orders.aggregate<{
      _id: Types.ObjectId;
      _case: string;
      _line: string;
      _population: string;
      _earnedMillimes: number;
    }>([
      ...salesBaseStages({
        scope: { merchantId },
        from: null,
        to: T('2027-01-01T00:00:00Z'),
        cutoff,
      }),
    ]);
    return new Map(rows.map(r => [r._id.toString(), r]));
  };

  beforeAll(async () => {
    connection = mongoose.createConnection(requireMongoTestUri(), {
      dbName: `merchant_sales_expr_${Date.now()}`,
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

  it('case 1: a frozen decision is the earned amount, NORMAL and SETTLEMENT', async () => {
    const normal = await seed({
      pickedUpAt: T('2026-09-10T10:00:00Z'),
      commission: { kind: 'NORMAL', merchantAmount: 10, accrued: 1.9, settled: 0 },
    });
    const settlement = await seed({
      pickedUpAt: T('2026-09-10T10:00:00Z'),
      commission: { kind: 'SETTLEMENT', merchantAmount: 4, accrued: 0, settled: 6 },
    });
    const out = await run();
    expect(out.get(normal.toString())).toMatchObject({
      _case: 'CURRENT',
      _population: 'earnings',
      _earnedMillimes: 10_000,
    });
    expect(out.get(settlement.toString())).toMatchObject({
      _case: 'CURRENT',
      _earnedMillimes: 4_000,
    });
  });

  it('case 2: pre-cutoff with no decision is the isolated 81% legacy share', async () => {
    const persisted = await seed({
      pickedUpAt: T('2026-08-10T10:00:00Z'),
      pricing: { subtotal: 10, merchantAmount: 8.1 },
    });
    const computed = await seed({
      pickedUpAt: T('2026-08-10T10:00:00Z'),
      pricing: { subtotal: 15.241 },
    });
    const out = await run();
    expect(out.get(persisted.toString())).toMatchObject({
      _case: 'LEGACY',
      _earnedMillimes: 8_100,
    });
    expect(out.get(computed.toString())).toMatchObject({
      _case: 'LEGACY',
      _earnedMillimes: 12_345,
    }); // round3(15.241 * 0.81)
  });

  it('case 3: post-cutoff with no decision is never an earning - above all never 81%', async () => {
    const id = await seed({ pickedUpAt: T('2026-09-10T10:00:00Z'), pricing: { subtotal: 15.241 } });
    const row = (await run()).get(id.toString());
    expect(row).toMatchObject({
      _case: 'UNVERIFIED',
      _population: 'verifying',
      _earnedMillimes: 0,
    });
    expect(row?._earnedMillimes).not.toBe(12_345);
  });

  it('the cutoff boundary is exact: == cutoff is post-cutoff, 1 ms before is legacy', async () => {
    const at = await seed({ pickedUpAt: CUTOFF, pricing: { subtotal: 10 } });
    const before = await seed({
      pickedUpAt: new Date(CUTOFF.getTime() - 1),
      pricing: { subtotal: 10 },
    });
    const out = await run();
    expect(out.get(at.toString())?._case).toBe('UNVERIFIED');
    expect(out.get(before.toString())?._case).toBe('LEGACY');
  });

  it('with the cutoff unset (development) no order is case 3', async () => {
    const id = await seed({ pickedUpAt: T('2026-09-10T10:00:00Z'), pricing: { subtotal: 10 } });
    expect((await run(null)).get(id.toString())?._case).toBe('LEGACY');
  });

  it('the moment is driverPickedUpAt for a delivery, never deliveredAt', async () => {
    const id = await seed({
      deliveryMode: 'delivery',
      status: OrderStatus.DELIVERED,
      driverPickedUpAt: T('2026-08-31T20:00:00Z'), // before the cutoff
      deliveredAt: T('2026-09-01T02:00:00Z'), // after it
      pricing: { subtotal: 10 },
    });
    expect((await run()).get(id.toString())?._case).toBe('LEGACY');
  });

  it('a legacy pickup falls back to pickupDetails.actualPickupTime', async () => {
    const id = await seed({
      pickupDetails: { actualPickupTime: T('2026-08-10T10:00:00Z') },
      pricing: { subtotal: 10 },
    });
    expect((await run()).has(id.toString())).toBe(true);
  });

  it.each([
    ['konnect', 'pickup', 'online'],
    ['konnect', 'delivery', 'online'],
    [undefined, 'pickup', 'cashStore'],
    [undefined, 'delivery', 'cashDelivery'],
  ])('provider %s with %s lands on exactly one line: %s', async (provider, mode, line) => {
    const id = await seed({
      ...(provider ? { paymentProvider: provider } : {}),
      deliveryMode: mode,
      ...(mode === 'delivery'
        ? { driverPickedUpAt: T('2026-09-10T10:00:00Z') }
        : { pickedUpAt: T('2026-09-10T10:00:00Z') }),
      commission: { kind: 'NORMAL', merchantAmount: 10, accrued: 1.9, settled: 0 },
    });
    expect((await run()).get(id.toString())?._line).toBe(line);
  });

  it('a refunded sale is in the refunded population; a refund before completion is nowhere', async () => {
    const after = await seed({
      status: OrderStatus.REFUNDED,
      pickedUpAt: T('2026-09-10T10:00:00Z'),
      commission: { kind: 'NORMAL', merchantAmount: 10, accrued: 1.9, settled: 0 },
    });
    const before = await seed({ status: OrderStatus.REFUNDED });
    const out = await run();
    expect(out.get(after.toString())?._population).toBe('refunded');
    expect(out.has(before.toString())).toBe(false);
  });

  it.each([OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.EXPIRED, OrderStatus.RESERVED])(
    '%s is in no population',
    async status => {
      const id = await seed({ status, pickedUpAt: T('2026-09-10T10:00:00Z') });
      expect((await run()).has(id.toString())).toBe(false);
    },
  );

  it('never reads the delivery fee', async () => {
    const id = await seed({
      deliveryMode: 'delivery',
      driverPickedUpAt: T('2026-09-10T10:00:00Z'),
      pricing: { subtotal: 10, deliveryFee: 7, total: 17 },
      commission: { kind: 'NORMAL', merchantAmount: 10, accrued: 1.9, settled: 0 },
    });
    expect((await run()).get(id.toString())?._earnedMillimes).toBe(10_000);
  });
});
