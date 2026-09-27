/**
 * AnalyticsController.getBusinessMetrics — period resolution (Task 14, fix
 * round 1, item 2a/2b). The review found `period=all` returned 400 with
 * nothing testing the controller's period logic at all; this file is that
 * coverage.
 *
 * Plain instantiation, not a NestJS testing module - guards attached via
 * @UseGuards are request-pipeline concerns that never execute on a direct
 * method call (see the sibling business-metrics-scoping.spec.ts).
 */
import { UserRole } from '@foodwaste/shared';

import type { AuthenticatedRequest } from '../../../common/decorators/get-user.decorator';
import {
  SALES_PERIODS,
  resolveSalesPeriod,
  type SalesPeriod,
} from '../../../merchant-sales/merchant-sales.period';
import type { BusinessMetricsRequestDto } from '../../dto/analytics.dto';
import { AnalyticsController } from '../analytics.controller';
import { AnalyticsService } from '../../services/analytics.service';

describe('AnalyticsController.getBusinessMetrics — period resolution', () => {
  let controller: AnalyticsController;
  let analyticsService: {
    resolveEffectiveEstablishmentIds: jest.Mock;
    emptyBusinessMetrics: jest.Mock;
    getBusinessMetrics: jest.Mock;
  };

  // Fixed instant for every test - `resolvePeriod` reads `new Date()`
  // internally, so the wall clock is frozen rather than passed in (the
  // controller offers no injected-clock seam to use instead).
  const NOW = new Date('2026-09-27T12:00:00Z');

  const authedReq = () =>
    ({
      user: { userId: 'merchant-1', email: 'm@example.com', role: UserRole.MERCHANT },
    }) as unknown as AuthenticatedRequest;

  // Deliberately stale/wrong dates in the body - `period` must override them
  // entirely, or a bug that merges instead of replacing would go unnoticed.
  const requestWithPeriod = (
    period: SalesPeriod,
    optionsOverride: Record<string, unknown> = { includeComparisons: true },
  ): BusinessMetricsRequestDto =>
    ({
      filters: {
        dateRange: { startDate: '2000-01-01T00:00:00.000Z', endDate: '2000-01-02T00:00:00.000Z' },
        granularity: { period: 'day' },
      },
      period,
      options: optionsOverride,
    }) as unknown as BusinessMetricsRequestDto;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    analyticsService = {
      resolveEffectiveEstablishmentIds: jest.fn().mockResolvedValue(['owned-a']),
      emptyBusinessMetrics: jest.fn(),
      getBusinessMetrics: jest.fn().mockResolvedValue({}),
    };
    controller = new AnalyticsController(analyticsService as unknown as AnalyticsService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- item 2(a): period overrides dateRange, resolved exactly like resolveSalesPeriod ---

  it.each(SALES_PERIODS)(
    '%s: period overrides any dateRange in the body with resolveSalesPeriod(period, now)',
    async period => {
      await controller.getBusinessMetrics(requestWithPeriod(period), authedReq());

      const range = resolveSalesPeriod(period, NOW);
      const sent = analyticsService.getBusinessMetrics.mock.calls[0]?.[0];
      expect(sent.filters.dateRange).toEqual({
        startDate: (range.from ?? new Date(0)).toISOString(),
        endDate: range.to.toISOString(),
      });
      // Never the stale body dates.
      expect(sent.filters.dateRange.startDate).not.toBe('2000-01-01T00:00:00.000Z');
    },
  );

  it.each(SALES_PERIODS)(
    '%s: marks the request resolvedFromPeriod (never a DTO field)',
    async period => {
      await controller.getBusinessMetrics(requestWithPeriod(period), authedReq());

      const sent = analyticsService.getBusinessMetrics.mock.calls[0]?.[0];
      expect(sent.resolvedFromPeriod).toBe(true);
    },
  );

  it('no period sent: filters.dateRange passes through unchanged (custom), resolvedFromPeriod is never set', async () => {
    const custom = {
      filters: {
        dateRange: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-06-01T00:00:00.000Z' },
        granularity: { period: 'day' as const },
      },
    } as unknown as BusinessMetricsRequestDto;

    await controller.getBusinessMetrics(custom, authedReq());

    const sent = analyticsService.getBusinessMetrics.mock.calls[0]?.[0];
    expect(sent.filters.dateRange).toEqual(custom.filters.dateRange);
    expect(sent.resolvedFromPeriod).toBeUndefined();
  });

  // --- item 2(b): `all` forces includeComparisons=false; every other period passes the body through ---

  it("'all' forces includeComparisons=false even though the body asked for true", async () => {
    await controller.getBusinessMetrics(requestWithPeriod('all'), authedReq());

    const sent = analyticsService.getBusinessMetrics.mock.calls[0]?.[0];
    expect(sent.options.includeComparisons).toBe(false);
  });

  it.each(['today', '7d', '30d', 'month'] as const)(
    '%s does not force includeComparisons - the body value passes through unchanged',
    async period => {
      await controller.getBusinessMetrics(requestWithPeriod(period), authedReq());

      const sent = analyticsService.getBusinessMetrics.mock.calls[0]?.[0];
      expect(sent.options.includeComparisons).toBe(true);
    },
  );
});
