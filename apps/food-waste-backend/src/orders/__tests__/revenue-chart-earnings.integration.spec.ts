/**
 * Runs getRevenueChart's aggregation and gap-fill against a real MongoDB.
 * Requires the local stack:
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { UserRole } from '@foodwaste/shared';

import { OrdersService } from '../order.service';
import { OrderSchema, OrderStatus, type OrderDocument } from '../schemas/order.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';

const MONGO_URI = requireMongoTestUri();

const FOOD = 20;
const DELIVERY_FEE = 4;
const EXPECTED_EARNINGS = 16.2;

describe('OrdersService.getRevenueChart — earnings against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: OrdersService;

  const merchantId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `revenue_chart_earnings_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service, {
      orderModel,
      cacheService: {
        getOrSet: async (_key: string, factory: () => Promise<unknown>) => {
          const result = await factory();
          return result;
        },
      },
    });

    await orderModel.collection.insertOne({
      merchantId,
      establishmentId,
      customerId,
      status: OrderStatus.COMPLETED,
      deliveryMode: 'delivery',
      items: [{ offerId: new Types.ObjectId(), quantity: 1, originalPrice: FOOD }],
      pricing: {
        subtotal: FOOD,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: DELIVERY_FEE,
        total: FOOD + DELIVERY_FEE,
      },
      createdAt: new Date(),
    });
  });

  afterAll(async () => {
    await orderModel.collection.drop();
    await connection.close();
  });

  it("today's bucket reports 81% of the food subtotal as earnings", async () => {
    const chart = await service.getRevenueChart(merchantId.toString(), UserRole.MERCHANT, 'day', 1);

    expect(chart).toHaveLength(1);
    expect(chart[0]?.earnings).toBe(EXPECTED_EARNINGS);
  });

  it('gap-filled buckets (no orders) zero-fill earnings too', async () => {
    const chart = await service.getRevenueChart(merchantId.toString(), UserRole.MERCHANT, 'day', 3);

    expect(chart).toHaveLength(3);
    const emptyBuckets = chart.filter(b => b.orderCount === 0);
    expect(emptyBuckets.length).toBeGreaterThan(0);
    emptyBuckets.forEach(b => expect(b.earnings).toBe(0));
  });
});
