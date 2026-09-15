/**
 * Runs getOrderStats' aggregation against a real MongoDB — a mocked
 * `.aggregate()` would only prove the pipeline object was built, not that
 * MongoDB evaluates `$multiply`/`$cond` the way we think it does.
 *
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

/** 20 TND food + 4 TND delivery = 24 TND charged. Earnings = 81% of the 20, not the 24. */
const FOOD = 20;
const DELIVERY_FEE = 4;
const EXPECTED_EARNINGS = 16.2;

describe('OrdersService.getOrderStats — totalEarnings against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: OrdersService;

  const merchantId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `order_stats_earnings_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    // Real prototype method, minimal collaborators — see cache-invalidation.spec.ts
    // for why constructing OrdersService outright is avoided here.
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

    await orderModel.collection.insertMany([
      {
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
      },
      // A cancelled order must not contribute — proves the $cond status guard.
      {
        merchantId,
        establishmentId,
        customerId,
        status: OrderStatus.CANCELLED,
        deliveryMode: 'pickup',
        items: [{ offerId: new Types.ObjectId(), quantity: 1, originalPrice: 100 }],
        pricing: { subtotal: 100, discountAmount: 0, taxAmount: 0, deliveryFee: 0, total: 100 },
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await orderModel.collection.drop();
    await connection.close();
  });

  it('reports 81% of the food subtotal, not 81% of the order total, and ignores non-completed orders', async () => {
    const stats = await service.getOrderStats(merchantId.toString(), UserRole.MERCHANT);

    expect(stats.totalEarnings).toBe(EXPECTED_EARNINGS);
  });
});
