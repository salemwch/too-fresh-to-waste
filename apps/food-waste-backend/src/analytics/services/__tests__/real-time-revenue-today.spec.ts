/**
 * `fetchRealTimeMetrics` filtered Payment by `status: 'paid'`, a value that
 * has never existed in `PaymentStatus` — the query matched zero documents,
 * so the admin dashboard's "revenue today" figure was permanently 0. Pins
 * the fix: the filter now matches the same EARNED/COMPLETED pair used by
 * `getAdminPaymentStats` (admin/services/payment-management.service.ts) for
 * "money actually landed."
 */

import { PaymentStatus } from '../../../payments/schemas/payment.schema';
import { AnalyticsService } from '../analytics.service';

const buildService = (revenueTodayTotal: number) => {
  const paymentAggregate = jest.fn().mockResolvedValue([{ total: revenueTodayTotal }]);

  const userModel = { countDocuments: jest.fn().mockResolvedValue(0) };
  const orderModel = { countDocuments: jest.fn().mockResolvedValue(0) };
  const offerModel = { countDocuments: jest.fn().mockResolvedValue(0) };
  const paymentModel = { aggregate: paymentAggregate };
  const redisCache = {
    getOrSet: async (_key: string, factory: () => Promise<unknown>) => {
      const result = await factory();
      return result;
    },
  };

  const service = Object.create(AnalyticsService.prototype) as AnalyticsService;
  Object.assign(service, { userModel, orderModel, offerModel, paymentModel, redisCache });

  return { service, paymentAggregate };
};

describe('AnalyticsService.getRealTimeMetrics — revenue today', () => {
  it('filters Payment by EARNED/COMPLETED, not the non-existent "paid" status', async () => {
    const { service, paymentAggregate } = buildService(250);

    await service.getRealTimeMetrics();

    const pipeline = paymentAggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
    const matchStage = pipeline.find(stage => '$match' in stage)?.['$match'] as
      | { status?: unknown }
      | undefined;

    expect(matchStage?.status).toEqual({
      $in: [PaymentStatus.EARNED, PaymentStatus.COMPLETED],
    });
  });

  it('reports the aggregated total as revenueToday, not a permanent 0', async () => {
    const { service } = buildService(250);

    const result = await service.getRealTimeMetrics();

    expect(result.revenueToday).toBe(250);
  });

  it('reports 0 (not an error) when there is genuinely no revenue yet today', async () => {
    const { service, paymentAggregate } = buildService(0);
    paymentAggregate.mockResolvedValue([]);

    const result = await service.getRealTimeMetrics();

    expect(result.revenueToday).toBe(0);
  });
});
