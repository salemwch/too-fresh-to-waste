/**
 * Runs calculateCurrentBusinessMetrics against a real MongoDB. Also proves
 * the pre-existing cash-order undercount is fixed by the same change: a
 * cash order (no Payment document) must now be counted, where the old
 * Payment-based aggregation silently dropped it.
 *
 * Task 14: `totalEarnings` is no longer computed inline here - it is the
 * shared `MerchantSalesService.summaryForRange` calculation (food only, the
 * same three amount cases as the Dashboard and Payments). This file now also
 * proves that parity, and that `totalRevenue`/`averageOrderValue` (built from
 * `pricing.total`, food plus delivery) are gone from the response - a
 * merchant never sees delivery money.
 *
 *   docker compose up -d mongodb
 *   pnpm --filter @foodwaste/backend test:db
 */

import mongoose, { Connection, Model, Types } from 'mongoose';

import { AnalyticsService } from '../services/analytics.service';
import { MerchantSalesService } from '../../merchant-sales/merchant-sales.service';
import { OrderSchema, OrderStatus, type OrderDocument } from '../../orders/schemas/order.schema';
import { requireMongoTestUri } from '../../../test/helpers/mongo-test-uri';
import type { BusinessMetricsRequestDto } from '../dto/analytics.dto';

const MONGO_URI = requireMongoTestUri();
const CUTOFF = '2026-09-01T00:00:00+01:00';

const FOOD = 20;
const DELIVERY_FEE = 4;
const EXPECTED_EARNINGS = 16.2;

describe('AnalyticsService.calculateCurrentBusinessMetrics — earnings against a real MongoDB', () => {
  let connection: Connection;
  let orderModel: Model<OrderDocument>;
  let service: AnalyticsService;
  let merchantSalesService: MerchantSalesService;

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

    // Built exactly as Task 6's merchant-sales.integration.spec.ts: a real
    // instance with a fixed cutoff, no mocked earnings logic.
    merchantSalesService = Object.create(MerchantSalesService.prototype) as MerchantSalesService;
    Object.assign(merchantSalesService, {
      orderModel,
      configService: {
        get: (k: string) => (k === 'COMMISSION_MODEL_EFFECTIVE_AT' ? CUTOFF : undefined),
      },
      sentry: { captureMessage: jest.fn() },
      logger: { error: jest.fn() },
    });

    service = Object.create(AnalyticsService.prototype) as AnalyticsService;
    Object.assign(service, {
      orderModel,
      merchantSalesService,
      cacheEnabled: false,
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      eventEmitter: { emit: jest.fn() },
    });

    // Cash order: no Payment document exists for it anywhere. Must still
    // count - a delivery order's commission moment is `driverPickedUpAt`.
    await orderModel.collection.insertOne({
      orderNumber: 'ORD-CASH-DELIVERY',
      merchantId,
      establishmentId,
      customerId,
      status: OrderStatus.COMPLETED,
      deliveryMode: 'delivery',
      paymentDetails: { method: 'cash_on_pickup' },
      // Fixed, well before CUTOFF (2026-09-01) - no commission decision and a
      // moment before the cutoff is LEGACY (81%), never UNVERIFIED. A moment
      // pinned to `new Date()` would drift past the cutoff and silently
      // become case 3 (0 earned) instead.
      driverPickedUpAt: new Date('2026-08-20T10:00:00Z'),
      isDeleted: false,
      items: [{ offerId: new Types.ObjectId(), quantity: 1, originalPrice: FOOD }],
      pricing: {
        subtotal: FOOD,
        discountAmount: 0,
        taxAmount: 0,
        deliveryFee: DELIVERY_FEE,
        total: FOOD + DELIVERY_FEE,
      },
      // orderNumber and pickupDetails.qrCode both carry a real unique
      // (non-sparse) index - every seeded order needs its own value or two
      // docs missing it collide as `null`. See merchant-sales.integration.spec.ts.
      pickupDetails: { pickupCode: '000001', qrCode: 'QR-ORD-CASH-DELIVERY' },
      createdAt: new Date('2026-08-20T10:00:00Z'),
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
          dateRange: { startDate: Date; endDate: Date };
          establishmentIds?: string[];
          granularity: { period: string };
        }) => Promise<{ totalEarnings: number }>;
      }
    ).calculateCurrentBusinessMetrics.bind(service);

    const result = await calculate({
      dateRange: {
        startDate: new Date('2026-08-01T00:00:00Z'),
        endDate: new Date('2026-08-31T23:59:59Z'),
      },
      establishmentIds: [establishmentId.toString()],
      granularity: { period: 'day' },
    });

    expect(result.totalEarnings).toBe(EXPECTED_EARNINGS);
  });

  describe('parity with MerchantSalesService.summaryForRange (Task 14)', () => {
    const E = new Types.ObjectId();
    const otherMerchantId = new Types.ObjectId();

    beforeAll(async () => {
      // NORMAL online delivery: merchant earns exactly `commission.merchantAmount`
      // (10); the 6 TND delivery fee must never enter earnings.
      await orderModel.collection.insertOne({
        orderNumber: 'ORD-TASK14-NORMAL',
        merchantId: otherMerchantId,
        establishmentId: E,
        status: OrderStatus.DELIVERED,
        deliveryMode: 'delivery',
        paymentProvider: 'konnect',
        isDeleted: false,
        pricing: { subtotal: 10, discountAmount: 0, deliveryFee: 6, total: 16 },
        driverPickedUpAt: new Date('2026-09-05T10:00:00Z'),
        createdAt: new Date('2026-09-05T10:00:00Z'),
        pickupDetails: { pickupCode: '141401', qrCode: 'QR-ORD-TASK14-NORMAL' },
        commission: {
          model: 'V2',
          kind: 'NORMAL',
          accrued: 1.9,
          settled: 0,
          merchantAmount: 10,
          dueBefore: 0,
          dueAfter: 0,
          appliedAt: new Date('2026-09-05T10:00:00Z'),
        },
      } as never);

      // Case 3: no commission decision, moment (2026-09-05, pickup) is at/after
      // the 2026-09-01 cutoff — an integrity failure, never counted at 81%,
      // never earned at all.
      await orderModel.collection.insertOne({
        orderNumber: 'ORD-TASK14-CASE3',
        merchantId: otherMerchantId,
        establishmentId: E,
        status: OrderStatus.PICKED_UP,
        deliveryMode: 'pickup',
        isDeleted: false,
        pricing: { subtotal: 15.241, discountAmount: 0, deliveryFee: 0, total: 15.241 },
        pickedUpAt: new Date('2026-09-05T11:00:00Z'),
        createdAt: new Date('2026-09-05T11:00:00Z'),
        pickupDetails: { pickupCode: '141400', qrCode: 'QR-ORD-TASK14-CASE3' },
      } as never);
    });

    it('totalEarnings is the shared calculation: food only, case 3 excluded', async () => {
      const from = new Date('2026-09-02T00:00:00Z');
      const to = new Date('2026-09-20T00:00:00Z');

      const metrics = await service.getBusinessMetrics({
        filters: {
          dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
          establishmentIds: [E.toString()],
          granularity: { period: 'day' },
        },
      } as unknown as BusinessMetricsRequestDto);
      const shared = await merchantSalesService.summaryForRange(
        { kind: 'establishments', establishmentIds: [E.toString()] },
        { from, to },
      );

      expect(metrics.totalEarnings.value).toBe(shared.total.earned);
      expect(metrics.totalEarnings.value).toBe(10); // no fee, no case 3, never 12.345
    });

    it('averageFoodValue is foodValue/orders over the same Earnings population, and totalRevenue is gone', async () => {
      const from = new Date('2026-09-02T00:00:00Z');
      const to = new Date('2026-09-20T00:00:00Z');

      const metrics = await service.getBusinessMetrics({
        filters: {
          dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
          establishmentIds: [E.toString()],
          granularity: { period: 'day' },
        },
      } as unknown as BusinessMetricsRequestDto);
      const shared = await merchantSalesService.summaryForRange(
        { kind: 'establishments', establishmentIds: [E.toString()] },
        { from, to },
      );

      expect(metrics.averageFoodValue.value).toBe(shared.total.foodValue / shared.total.orders);
      expect(metrics.averageFoodValue.value).toBe(10);
      expect(metrics).not.toHaveProperty('totalRevenue');
      expect(metrics).not.toHaveProperty('averageOrderValue');
    });
  });
});
