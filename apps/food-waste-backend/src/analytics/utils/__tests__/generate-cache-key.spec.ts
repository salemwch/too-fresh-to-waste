/**
 * `generateCacheKey` used `JSON.stringify(keyObject, Object.keys(keyObject).sort(...))`
 * to get a deterministic key ordering for hashing. An array replacer filters
 * keys RECURSIVELY at every nesting level, not just the top — so the whitelist
 * of top-level names (`endpoint`, `filters`, `aggregation`, `version`) also got
 * applied inside `filters` itself, and none of `filters`' actual keys
 * (`dateRange`, `establishmentIds`, ...) matched. The entire filter payload was
 * silently stripped before hashing: every business-metrics/user-analytics/
 * sustainability call produced the same cache key regardless of the date range
 * or establishment requested, so the merchant Analytics page showed identical
 * numbers no matter which period or location was selected.
 */

import { AnalyticsUtil } from '../analytics.util';

describe('AnalyticsUtil.generateCacheKey', () => {
  it('produces different keys for different date ranges', () => {
    const keyA = AnalyticsUtil.generateCacheKey('business_metrics', {
      dateRange: { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z' },
    });
    const keyB = AnalyticsUtil.generateCacheKey('business_metrics', {
      dateRange: { startDate: '2026-02-01T00:00:00.000Z', endDate: '2026-02-28T00:00:00.000Z' },
    });

    expect(keyA).not.toBe(keyB);
  });

  it('produces different keys for different establishmentIds', () => {
    const keyA = AnalyticsUtil.generateCacheKey('business_metrics', {
      establishmentIds: ['establishment-a'],
    });
    const keyB = AnalyticsUtil.generateCacheKey('business_metrics', {
      establishmentIds: ['establishment-b'],
    });

    expect(keyA).not.toBe(keyB);
  });

  it('produces the same key for the same filters (deterministic)', () => {
    const filters = {
      dateRange: { startDate: '2026-01-01T00:00:00.000Z', endDate: '2026-01-31T00:00:00.000Z' },
      establishmentIds: ['establishment-a'],
    };

    const keyA = AnalyticsUtil.generateCacheKey('business_metrics', filters);
    const keyB = AnalyticsUtil.generateCacheKey('business_metrics', { ...filters });

    expect(keyA).toBe(keyB);
  });

  it('produces different keys for different endpoints given the same filters', () => {
    const filters = { dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' } };

    const keyA = AnalyticsUtil.generateCacheKey('business_metrics', filters);
    const keyB = AnalyticsUtil.generateCacheKey('user_analytics', filters);

    expect(keyA).not.toBe(keyB);
  });

  it('is insensitive to key insertion order within nested objects (true canonicalization)', () => {
    const keyA = AnalyticsUtil.generateCacheKey('business_metrics', {
      dateRange: { startDate: '2026-01-01', endDate: '2026-01-31' },
    });
    const keyB = AnalyticsUtil.generateCacheKey('business_metrics', {
      dateRange: { endDate: '2026-01-31', startDate: '2026-01-01' },
    });

    expect(keyA).toBe(keyB);
  });
});
