/**
 * Task 16 removed `totalRevenue`, `totalEarnings` and `totalOriginalValue`
 * from `OrdersService.getOrderStats` - `totalRevenue` summed `pricing.total`
 * (food plus delivery, which a merchant never receives), `totalEarnings`
 * duplicated the shared earnings calculation now owned by
 * `merchant-sales.expressions.ts`, and `totalOriginalValue` had no reader left
 * in web or mobile (grepped in the Task 16 report).
 *
 * This proves the real aggregation - not a mock - never emits any of the
 * three fields again, for every role that can reach `GET /orders/stats`
 * (MERCHANT, LOCATION_MANAGER, ADMIN - see `OrdersController.getOrderStats`'s
 * `@Roles`). No role keeps them, so there is no privileged-role contrast case
 * here the way `merchant-order-money.spec.ts` has one for delivery money.
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

const REMOVED_FIELDS = ['totalRevenue', 'totalEarnings', 'totalOriginalValue'];

describe('OrdersService.getOrderStats - removed money fields stay gone (real MongoDB)', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: OrdersService;

  const merchantId = new Types.ObjectId();
  const establishmentId = new Types.ObjectId();
  const customerId = new Types.ObjectId();

  beforeAll(async () => {
    connection = mongoose.createConnection(MONGO_URI, {
      dbName: `order_stats_fields_${Date.now()}`,
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

    await orderModel.collection.insertMany([
      {
        merchantId,
        establishmentId,
        customerId,
        status: OrderStatus.COMPLETED,
        deliveryMode: 'pickup',
        items: [{ offerId: new Types.ObjectId(), quantity: 2, originalPrice: 20 }],
        pricing: { subtotal: 20, discountAmount: 0, taxAmount: 0, deliveryFee: 0, total: 20 },
        createdAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await orderModel.collection.drop();
    await connection.close();
  });

  it.each([
    [UserRole.MERCHANT, merchantId.toString(), undefined, 1],
    [UserRole.LOCATION_MANAGER, 'unused', establishmentId.toString(), 1],
    // ADMIN falls to the `else` (customerId) branch, which the seeded order
    // does not match on `merchantId` - 0 is the real aggregation result, not
    // an empty/mocked object, so the field-absence assertion below still
    // proves something.
    [UserRole.ADMIN, merchantId.toString(), undefined, 0],
  ] as const)(
    'contains none of totalRevenue, totalEarnings, totalOriginalValue for %s',
    async (role, userId, establishmentIdArg, expectedTotalOrders) => {
      const stats = await service.getOrderStats(userId, role, undefined, establishmentIdArg);
      const json = JSON.stringify(stats);

      for (const field of REMOVED_FIELDS) {
        expect(json).not.toContain(field);
      }
      expect(stats.totalOrders).toBe(expectedTotalOrders);
    },
  );
});
