/**
 * Proves the boundary `resolveSalesPeriod` computes for `period=7d` actually
 * narrows `SustainabilityService.getCarbonMetrics`/`getSocialImpact`'s
 * aggregation against a real MongoDB: a record dated just before the resolved
 * `from` is excluded, one dated just after (or at) it is included. `$gte` is
 * inclusive, matching `resolveSalesPeriod`'s own "Inclusive start" contract.
 *
 * The controller resolves `period` into this same `from` and passes it as
 * `startDate` (see sustainability-metrics-period.controller.spec.ts) - this
 * test exercises exactly what the service does with that value once
 * resolved, exactly as order-stats-period.integration.spec.ts does for
 * `OrdersService.getOrderStats`.
 *
 * Requires the local stack:
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { resolveSalesPeriod } from '../../merchant-sales/merchant-sales.period';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import { SustainabilityService } from '../services/sustainability.service';

const MONGO_URI = requireMongoTestUri();

describe("SustainabilityService — period='7d' boundary against a real MongoDB", () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: SustainabilityService;

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
      dbName: `sustainability_metrics_period_${Date.now()}`,
      serverSelectionTimeoutMS: 8000,
    });
    await connection.asPromise();
    orderModel = connection.model('Order', OrderSchema) as unknown as Model<OrderDocument>;

    service = Object.create(SustainabilityService.prototype) as SustainabilityService;
    Object.assign(service, { orderModel });

    const baseOrder = {
      merchantId,
      establishmentId,
      customerId,
      status: OrderStatus.COMPLETED,
      deliveryMode: 'pickup',
      isDeleted: false,
      items: [{ offerId: new Types.ObjectId(), quantity: 2, originalPrice: 10 }],
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

  describe('getCarbonMetrics', () => {
    it('excludes the record just before `from` and includes the one just inside it', async () => {
      const result = await service.getCarbonMetrics(merchantId.toString(), from);
      // 2 quantity, one order counted -> 2 bags.
      expect(result.bagsSaved).toBe(2);
    });

    it('the no-`startDate` call (old, unresolved-period behaviour) still sees both records', async () => {
      const result = await service.getCarbonMetrics(merchantId.toString());
      expect(result.bagsSaved).toBe(4);
    });
  });

  describe('getSocialImpact', () => {
    it('excludes the record just before `from` and includes the one just inside it', async () => {
      const result = await service.getSocialImpact(merchantId.toString(), from);
      expect(result.bagsSaved).toBe(2);
    });

    it('the no-`startDate` call (old, unresolved-period behaviour) still sees both records', async () => {
      const result = await service.getSocialImpact(merchantId.toString());
      expect(result.bagsSaved).toBe(4);
    });
  });
});
