/**
 * Proves the boundary `resolveSalesPeriod` computes for `period=7d` actually
 * narrows `OrdersService.getOrderStats`'s aggregation against a real MongoDB:
 * a record dated just before the resolved `from` is excluded, one dated just
 * after (or at) it is included. `$gte` is inclusive, matching
 * `resolveSalesPeriod`'s own "Inclusive start" contract.
 *
 * The controller resolves `period` into this same `from` and passes it as
 * `startDate` (see order-stats-period.spec.ts) - this test exercises exactly
 * what the service does with that value once resolved, exactly as
 * order-stats-earnings.integration.spec.ts does for the aggregation itself.
 *
 * Requires the local stack:
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { UserRole } from '@foodwaste/shared';

import { OrdersService } from '../order.service';
import { OrderSchema, OrderStatus, type OrderDocument } from '../schemas/order.schema';
import { resolveSalesPeriod } from '../../merchant-sales/merchant-sales.period';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';

const MONGO_URI = requireMongoTestUri();

describe("OrdersService.getOrderStats — period='7d' boundary against a real MongoDB", () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: OrdersService;

  const merchantId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  const now = new Date('2026-09-20T12:00:00.000Z');
  const { from } = resolveSalesPeriod('7d', now);
  if (!from) {
    throw new Error('period=7d must resolve a `from` boundary');
  }

  const justBefore = new Date(from.getTime() - 1000);
  const justInside = new Date(from.getTime() + 1000);

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `order_stats_period_${Date.now()}`,
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

    const baseOrder = {
      merchantId,
      establishmentId,
      customerId,
      status: OrderStatus.COMPLETED,
      deliveryMode: 'pickup',
      items: [{ offerId: new Types.ObjectId(), quantity: 1, originalPrice: 10 }],
      pricing: { subtotal: 10, discountAmount: 0, taxAmount: 0, deliveryFee: 0, total: 10 },
    };

    await orderModel.collection.insertMany([
      { ...baseOrder, createdAt: justBefore },
      { ...baseOrder, createdAt: justInside },
    ]);
  });

  afterAll(async () => {
    await orderModel.collection.drop();
    await connection.close();
  });

  it('excludes the record just before `from` and includes the one just inside it', async () => {
    const stats = await service.getOrderStats(merchantId.toString(), UserRole.MERCHANT, from);

    expect(stats.totalOrders).toBe(1);
  });

  it('the no-`startDate` call (old, unresolved-period behaviour) still sees both records', async () => {
    const stats = await service.getOrderStats(merchantId.toString(), UserRole.MERCHANT);

    expect(stats.totalOrders).toBe(2);
  });
});
