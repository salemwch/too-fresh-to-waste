/**
 * Today's sales, against a real MongoDB.
 *
 * ## Why this exists
 *
 * The dashboard's only money card was the wallet, which holds online payments
 * alone - cash goes straight into the merchant's till. A merchant who sold
 * everything for cash saw 0.00 and concluded nothing had sold.
 *
 * What a mocked aggregate could not prove, and this does:
 * - cash orders are recognised by the ABSENCE of `paymentProvider` (checkout
 *   never writes 'cash'), so a `=== 'cash'` test would silently count none;
 * - "today" is the Tunis calendar day, and yesterday's orders stay out;
 * - another merchant's orders, deleted orders and cancelled ones stay out;
 * - one establishment can be isolated, and a location manager with no
 *   assignment sees nothing rather than everything.
 *
 *   docker compose up -d mongodb mongo-init
 *   MONGO_TEST_URI="..." pnpm --filter @foodwaste/backend test:db
 */

import { UserRole } from '@foodwaste/shared';
import mongoose, { Connection, Model, Types } from 'mongoose';

import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { OrdersService } from '../order.service';
import { OrderSchema, OrderStatus, type OrderDocument } from '../schemas/order.schema';

const MONGO_URI = requireMongoTestUri();

describe('OrdersService.getTodaySales — against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: OrdersService;

  // Tunis noon on a fixed day, so "today" does not depend on when CI runs.
  const NOW = new Date('2026-09-24T11:00:00.000Z');
  const EARLIER_TODAY = new Date('2026-09-24T07:00:00.000Z');
  const YESTERDAY = new Date('2026-09-23T20:00:00.000Z');

  const merchantId = new Types.ObjectId();
  const lac = new Types.ObjectId();
  const marsa = new Types.ObjectId();

  const order = (over: Record<string, unknown>) => ({
    _id: new Types.ObjectId(),
    orderNumber: `ORD-${Math.random().toString(36).slice(2, 10)}`,
    customerId: new Types.ObjectId(),
    merchantId,
    establishmentId: lac,
    status: OrderStatus.PICKED_UP,
    deliveryMode: 'pickup',
    pricing: { subtotal: 10, discountAmount: 5, taxAmount: 0, deliveryFee: 0, total: 10 },
    createdAt: EARLIER_TODAY,
    ...over,
  });

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `today_sales_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    // Real prototype method, minimal collaborators - same approach as
    // order-stats-earnings.integration.spec.ts.
    service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, { orderModel });

    const normal = (subtotal: number) => ({
      model: 'V2',
      kind: 'NORMAL',
      accrued: parseFloat((subtotal * 0.19).toFixed(3)),
      settled: 0,
      merchantAmount: subtotal,
      dueBefore: 0,
      dueAfter: 0,
      appliedAt: EARLIER_TODAY,
    });

    await orderModel.collection.insertMany([
      // Sold today, cash: no paymentProvider at all, exactly as checkout writes it.
      order({ commission: normal(10) }),
      order({
        pricing: { subtotal: 20, discountAmount: 0, taxAmount: 0, deliveryFee: 0, total: 20 },
        commission: normal(20),
      }),
      // Sold today, online, delivery - the delivery fee is not the merchant's.
      order({
        paymentProvider: 'konnect',
        status: OrderStatus.DELIVERED,
        deliveryMode: 'delivery',
        establishmentId: marsa,
        pricing: { subtotal: 15, discountAmount: 0, taxAmount: 0, deliveryFee: 4, total: 19 },
        commission: {
          model: 'V2',
          kind: 'SETTLEMENT',
          accrued: 0,
          settled: 5,
          merchantAmount: 10,
          dueBefore: 5,
          dueAfter: 0,
          appliedAt: EARLIER_TODAY,
        },
      }),
      // Still to collect today.
      order({ status: OrderStatus.READY_FOR_PICKUP, paymentProvider: 'konnect' }),
      order({ status: OrderStatus.CONFIRMED }),
      // Never counted.
      order({ status: OrderStatus.PENDING_PAYMENT, paymentProvider: 'konnect' }),
      order({ status: OrderStatus.CANCELLED }),
      order({ isDeleted: true }),
      order({ createdAt: YESTERDAY }),
      order({ merchantId: new Types.ObjectId() }),
    ]);
  }, 60_000);

  afterAll(async () => {
    await connection.dropDatabase();
    await connection.close();
  });

  it('adds cash and online sales from today into one total', async () => {
    const s = await service.getTodaySales(merchantId.toString(), UserRole.MERCHANT, undefined, NOW);

    expect(s.date).toBe('2026-09-24');
    expect(s.cash).toEqual({ orders: 2, sales: 30 });
    expect(s.online).toEqual({ orders: 1, sales: 15 });
    expect(s.total.orders).toBe(3);
    expect(s.total.sales).toBe(45);
  });

  it('reads each frozen decision: 19% on NORMAL, settlement on SETTLEMENT', async () => {
    const s = await service.getTodaySales(merchantId.toString(), UserRole.MERCHANT, undefined, NOW);

    // NORMAL 10 + 20: accrued 1.90 + 3.80. SETTLEMENT 15: no accrual, 5 settled, paid 10.
    expect(s.total.commission).toBe(5.7);
    expect(s.total.settled).toBe(5);
    expect(s.total.received).toBe(40);
    // Received 40, minus the 5.70 recorded today. The 5 settled paid older debt.
    expect(s.total.kept).toBe(34.3);
  });

  it("never counts the delivery fee as the merchant's sales", async () => {
    const s = await service.getTodaySales(merchantId.toString(), UserRole.MERCHANT, undefined, NOW);

    expect(s.total.sales).toBe(45); // 10 + 20 + 15, not 49
  });

  it('reports orders still to collect separately from sales', async () => {
    const s = await service.getTodaySales(merchantId.toString(), UserRole.MERCHANT, undefined, NOW);

    expect(s.toCollect).toEqual({ orders: 2, sales: 20 });
  });

  it('narrows to one establishment when asked', async () => {
    const s = await service.getTodaySales(
      merchantId.toString(),
      UserRole.MERCHANT,
      marsa.toString(),
      NOW,
    );

    expect(s.cash).toEqual({ orders: 0, sales: 0 });
    expect(s.online).toEqual({ orders: 1, sales: 15 });
    expect(s.toCollect.orders).toBe(0);
  });

  it('shows a location manager only their assigned establishment', async () => {
    const s = await service.getTodaySales(
      new Types.ObjectId().toString(),
      UserRole.LOCATION_MANAGER,
      marsa.toString(),
      NOW,
    );

    expect(s.total.sales).toBe(15);
  });

  it('shows a location manager with no assignment nothing, not everything', async () => {
    const s = await service.getTodaySales(
      new Types.ObjectId().toString(),
      UserRole.LOCATION_MANAGER,
      undefined,
      NOW,
    );

    expect(s.total.orders).toBe(0);
    expect(s.toCollect.orders).toBe(0);
  });

  it('rejects a malformed establishment id instead of ignoring the filter', async () => {
    await expect(
      service.getTodaySales(merchantId.toString(), UserRole.MERCHANT, 'not-an-id', NOW),
    ).rejects.toMatchObject({ response: { code: 'INVALID_ID' } });
  });
});
