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
  // Named so tests can assert on it directly (fix round 1, item 5) - it is
  // shared across every test in this file, so any assertion on it clears it
  // first rather than assuming call count 0 at the start.
  const salesSentry = { captureMessage: jest.fn() };

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
      sentry: salesSentry,
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
    // A different establishment, seeded INSIDE the same Sept 2-20 window as
    // E's data below. Fix round 1, item 6: the original version of this
    // describe block only ever seeded E, so a dropped establishment scope in
    // `calculateCurrentBusinessMetrics` would have gone unnoticed - both the
    // system-under-test and the "shared" comparison would silently agree on
    // whatever the (wrong) unscoped total was. With F's 50 TND sale in the
    // window, a dropped scope inflates `metrics.totalEarnings` to 60 while
    // `shared` (deliberately scoped to E only, right here in the test) stays
    // at 10, so the two diverge and the assertion fails.
    const F = new Types.ObjectId();

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

      // Foreign establishment F: a NORMAL sale of 50, inside the same window,
      // that must never leak into E's totals (item 6, see comment above).
      await orderModel.collection.insertOne({
        orderNumber: 'ORD-TASK14-FOREIGN',
        merchantId: new Types.ObjectId(),
        establishmentId: F,
        status: OrderStatus.PICKED_UP,
        deliveryMode: 'pickup',
        isDeleted: false,
        pricing: { subtotal: 50, discountAmount: 0, deliveryFee: 0, total: 50 },
        pickedUpAt: new Date('2026-09-10T09:00:00Z'),
        createdAt: new Date('2026-09-10T09:00:00Z'),
        pickupDetails: { pickupCode: '141403', qrCode: 'QR-ORD-TASK14-FOREIGN' },
        commission: {
          model: 'V2',
          kind: 'NORMAL',
          accrued: 9.5,
          settled: 0,
          merchantAmount: 50,
          dueBefore: 0,
          dueAfter: 0,
          appliedAt: new Date('2026-09-10T09:00:00Z'),
        },
      } as never);
    });

    it('totalEarnings is the shared calculation: food only, case 3 excluded, foreign establishment F excluded', async () => {
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
      // 10, never 60 (which would include F's 50) and never 12.345 (case 3).
      expect(metrics.totalEarnings.value).toBe(10);
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

    // --- Fix round 1, item 5: the integrity report carries the real preset ---

    it("labels the integrity report with the real preset ('month'), not always 'custom'", async () => {
      salesSentry.captureMessage.mockClear();
      const from = new Date('2026-09-02T00:00:00Z');
      const to = new Date('2026-09-20T00:00:00Z');

      await service.getBusinessMetrics({
        filters: {
          dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
          establishmentIds: [E.toString()],
          granularity: { period: 'day' },
        },
        period: 'month',
      } as unknown as BusinessMetricsRequestDto);

      expect(salesSentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('MERCHANT_EARNINGS_UNVERIFIED_ORDERS'),
        'error',
        expect.objectContaining({
          merchantEarnings: expect.objectContaining({ period: 'month' }),
        }),
        ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS'],
      );
    });

    it("a synthetic comparison window is never labelled with the current period's name - it stays 'custom'", async () => {
      salesSentry.captureMessage.mockClear();
      const from = new Date('2026-09-02T00:00:00Z');
      const to = new Date('2026-09-20T00:00:00Z');

      await service.getBusinessMetrics({
        filters: {
          dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
          establishmentIds: [E.toString()],
          granularity: { period: 'day' },
        },
        period: 'month',
        options: { includeComparisons: true },
      } as unknown as BusinessMetricsRequestDto);

      // The comparison window (2026-08-15..2026-09-02, no decisions in it)
      // reports nothing here; only the current-period call's report (period
      // 'month') fires. Asserting there is exactly one call, still labelled
      // 'month', proves the comparison call was never mislabelled 'month' by
      // accident - if it had reported at all, `toHaveBeenCalledTimes(1)`
      // would fail, not silently pass with two differently-labelled calls.
      expect(salesSentry.captureMessage).toHaveBeenCalledTimes(1);
      expect(salesSentry.captureMessage).toHaveBeenCalledWith(
        expect.anything(),
        'error',
        expect.objectContaining({ merchantEarnings: expect.objectContaining({ period: 'month' }) }),
        expect.anything(),
      );
    });

    // --- Fix round 1, item 2(c): `all` must succeed through real validation ---

    it("period 'all' succeeds through the real validateAnalyticsFilters (no mock) and matches the all-time totalEarnings", async () => {
      const to = new Date();

      const metrics = await service.getBusinessMetrics({
        filters: {
          // Exactly what AnalyticsController.resolvePeriod would send for
          // 'all': epoch to now - a ~56-year span that the 2-year cap would
          // reject with 400 INVALID_FILTERS if `resolvedFromPeriod` did not
          // suppress it (the bug this fix round closes).
          dateRange: { startDate: new Date(0).toISOString(), endDate: to.toISOString() },
          establishmentIds: [E.toString()],
          granularity: { period: 'day' },
        },
        period: 'all',
        resolvedFromPeriod: true,
        options: { includeComparisons: false },
      } as unknown as BusinessMetricsRequestDto);

      const shared = await merchantSalesService.summaryForRange(
        { kind: 'establishments', establishmentIds: [E.toString()] },
        { from: null, to },
      );

      expect(metrics.totalEarnings.value).toBe(shared.total.earned);
      expect(metrics.totalEarnings.value).toBe(10);
    });
  });

  // --- Fix round 1, item 4: the comparison window is half-open ---

  describe('comparison window does not double-count a sale at the boundary instant', () => {
    const B = new Types.ObjectId();
    const boundaryMerchantId = new Types.ObjectId();
    const boundary = new Date('2026-09-10T00:00:00Z');

    beforeAll(async () => {
      await orderModel.collection.insertOne({
        orderNumber: 'ORD-TASK14-BOUNDARY',
        merchantId: boundaryMerchantId,
        establishmentId: B,
        status: OrderStatus.PICKED_UP,
        deliveryMode: 'pickup',
        isDeleted: false,
        pricing: { subtotal: 8, discountAmount: 0, deliveryFee: 0, total: 8 },
        pickedUpAt: boundary,
        createdAt: boundary,
        pickupDetails: { pickupCode: '141404', qrCode: 'QR-ORD-TASK14-BOUNDARY' },
        commission: {
          model: 'V2',
          kind: 'NORMAL',
          accrued: 1.52,
          settled: 0,
          merchantAmount: 8,
          dueBefore: 0,
          dueAfter: 0,
          appliedAt: boundary,
        },
      } as never);
    });

    it("a sale exactly at the current period's startDate counts once - in the current period, never also in the comparison period", async () => {
      const from = boundary;
      const to = new Date('2026-09-20T00:00:00Z');

      const metrics = await service.getBusinessMetrics({
        filters: {
          dateRange: { startDate: from.toISOString(), endDate: to.toISOString() },
          establishmentIds: [B.toString()],
          granularity: { period: 'day' },
        },
        options: { includeComparisons: true },
      } as unknown as BusinessMetricsRequestDto);

      // Current period: the boundary sale is `_moment >= from`, included.
      expect(metrics.totalEarnings.value).toBe(8);
      // Comparison period (same duration, ending 1ms before `from`): the old
      // inclusive-inclusive window ended exactly at `from` and double-counted
      // this same sale here too - it must now be 0.
      expect(metrics.totalEarnings.previousValue).toBe(0);
    });
  });
});
