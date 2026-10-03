/**
 * AnalyticsService.getBusinessMetrics — the 2-year cap (Task 14, fix round 1,
 * item 1 / item 2d). `AnalyticsUtil.validateAnalyticsFilters` rejects a
 * caller-supplied range over 2 years; that check must still apply to a
 * genuine custom `dateRange`, and must be skippable only via the internal
 * `resolvedFromPeriod` flag the controller sets on a server-resolved range
 * (never a DTO field, so a client can never set it itself).
 *
 * No DB is touched: validation runs and throws before `orderModel` or
 * `merchantSalesService` are ever read, so a service instance built with
 * neither is enough - see the second test's comment for why that also proves
 * the flag actually skipped the cap, not merely swallowed the error.
 */
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

import type { BusinessMetricsRequestDto } from '../../dto/analytics.dto';
import type { ResolvedPeriodFlag } from '../../interfaces/analytics.interface';
import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService.getBusinessMetrics — 2-year range cap', () => {
  const buildService = () => {
    const service = Object.create(AnalyticsService.prototype) as AnalyticsService;
    Object.assign(service, {
      cacheEnabled: false,
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
    return service;
  };

  // Over 3 years - well past the 2-year cap.
  const longCustomRange: BusinessMetricsRequestDto = {
    filters: {
      dateRange: { startDate: '2020-01-01T00:00:00.000Z', endDate: '2023-06-01T00:00:00.000Z' },
      granularity: { period: 'day' },
      establishmentIds: ['owned-a'],
    },
  } as unknown as BusinessMetricsRequestDto;

  it('item 2(d): a custom dateRange longer than 2 years still returns 400 (BadRequestException)', async () => {
    const service = buildService();

    await expect(service.getBusinessMetrics(longCustomRange)).rejects.toThrow(BadRequestException);
  });

  it('the identical long range is accepted once resolvedFromPeriod marks it as server-resolved', async () => {
    const service = buildService();
    const resolved: BusinessMetricsRequestDto & ResolvedPeriodFlag = {
      ...longCustomRange,
      resolvedFromPeriod: true,
    };

    // orderModel/merchantSalesService are deliberately left undefined: once
    // validation passes, `calculateCurrentBusinessMetrics` reads
    // `this.orderModel.aggregate(...)` and throws a TypeError, which the
    // outer catch turns into InternalServerErrorException (never
    // BadRequestException). Getting a *different* exception than the first
    // test - not just "no exception" - is what proves the cap itself was
    // skipped, rather than some unrelated change swallowing it.
    await expect(service.getBusinessMetrics(resolved)).rejects.toThrow(
      InternalServerErrorException,
    );
  });
});
