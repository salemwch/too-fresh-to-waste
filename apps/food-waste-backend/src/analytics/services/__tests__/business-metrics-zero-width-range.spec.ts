/**
 * AnalyticsService.getBusinessMetrics - A server-resolved `period=today`
 * range at exactly Tunis midnight has `startDate === endDate`
 * (`resolveSalesPeriod('today', now)` returns `from = to = now` when `now`
 * itself is the start of the Tunis day). `AnalyticsUtil.validateAnalyticsFilters`
 * rejected any `start >= end` with 400 INVALID_FILTERS, so this one
 * server-produced instant failed its own validation - the `resolvedFromPeriod`
 * flag only ever skipped the 2-year cap, never this check (Task 17, L1 #11).
 *
 * Same harness as `business-metrics-period-cap.spec.ts`: no DB is touched, so
 * a service instance missing `orderModel`/`merchantSalesService` is enough -
 * getting InternalServerErrorException (not BadRequestException) proves
 * validation passed and the code moved on to read those.
 */
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';

import type { BusinessMetricsRequestDto } from '../../dto/analytics.dto';
import type { ResolvedPeriodFlag } from '../../interfaces/analytics.interface';
import { AnalyticsService } from '../analytics.service';

describe('AnalyticsService.getBusinessMetrics - zero-width range at the period boundary', () => {
  const buildService = () => {
    const service = Object.create(AnalyticsService.prototype) as AnalyticsService;
    Object.assign(service, {
      cacheEnabled: false,
      logger: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    });
    return service;
  };

  const instant = '2026-09-26T00:00:00.000Z'; // the Tunis-midnight boundary instant

  const zeroWidthRange: BusinessMetricsRequestDto = {
    filters: {
      dateRange: { startDate: instant, endDate: instant },
      granularity: { period: 'day' },
      establishmentIds: ['owned-a'],
    },
  } as unknown as BusinessMetricsRequestDto;

  it('a genuine client-supplied zero-width custom range is still rejected (400)', async () => {
    const service = buildService();

    await expect(service.getBusinessMetrics(zeroWidthRange)).rejects.toThrow(BadRequestException);
  });

  it('the identical zero-width range is accepted once resolvedFromPeriod marks it as server-resolved', async () => {
    const service = buildService();
    const resolved: BusinessMetricsRequestDto & ResolvedPeriodFlag = {
      ...zeroWidthRange,
      resolvedFromPeriod: true,
    };

    await expect(service.getBusinessMetrics(resolved)).rejects.toThrow(
      InternalServerErrorException,
    );
  });

  it('a server-resolved but genuinely reversed range (start after end) is still rejected (defensive)', async () => {
    const service = buildService();
    const reversed: BusinessMetricsRequestDto & ResolvedPeriodFlag = {
      filters: {
        dateRange: { startDate: '2026-09-26T01:00:00.000Z', endDate: instant },
        granularity: { period: 'day' },
        establishmentIds: ['owned-a'],
      },
      resolvedFromPeriod: true,
    } as unknown as BusinessMetricsRequestDto & ResolvedPeriodFlag;

    await expect(service.getBusinessMetrics(reversed)).rejects.toThrow(BadRequestException);
  });
});
