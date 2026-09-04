/**
 * Runs calculateCurrentBusinessMetrics against a real MongoDB. Also proves
 * the pre-existing cash-order undercount is fixed by the same change: a
 * cash order (no Payment document) must now be counted, where the old
 * Payment-based aggregation silently dropped it.
 *
 * Requires the local stack:
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { AnalyticsService } from '../services/analytics.service';
import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';

const MONGO_URI =
  process.env['MONGO_TEST_URI'] ??
  'mongodb://admin:password123@localhost:27017/admin?replicaSet=rs0&directConnection=true';

const FOOD = 20;
const DELIVERY_FEE = 4;
const EXPECTED_EARNINGS = 16.2;

describe('AnalyticsService.calculateCurrentBusinessMetrics — earnings against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: AnalyticsService;

  const establishmentId = new Types.ObjectId();
  const merchantId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `business_metrics_earnings_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    service = Object.create(AnalyticsService.prototype) as AnalyticsService;
    Object.assign(service, { orderModel });

    // Cash order: no Payment document exists for it anywhere. Must still count.
    await orderModel.collection.insertOne({
      merchantId,
      establishmentId,
      customerId,
      status: OrderStatus.COMPLETED,
      deliveryMode: 'delivery',
      paymentDetails: { method: 'cash_on_pickup' },
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

  it('counts a cash order (no Payment document) and reports 81% of its subtotal', async () => {
    const calculate = (
      service as unknown as {
        calculateCurrentBusinessMetrics: (filters: {
          dateRange: { startDate: string; endDate: string };
          establishmentIds?: string[];
          granularity: { period: string };
        }) => Promise<{ totalEarnings: number }>;
      }
    ).calculateCurrentBusinessMetrics.bind(service);

    const result = await calculate({
      dateRange: {
        startDate: new Date(Date.now() - 86_400_000).toISOString(),
        endDate: new Date(Date.now() + 86_400_000).toISOString(),
      },
      establishmentIds: [establishmentId.toString()],
      granularity: { period: 'day' },
    });

    expect(result.totalEarnings).toBe(EXPECTED_EARNINGS);
  });
});
