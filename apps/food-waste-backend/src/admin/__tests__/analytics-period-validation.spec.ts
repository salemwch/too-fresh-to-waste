/**
 * Every `AnalyticsPeriodType` member is accepted by the controller.
 *
 * ## The bug this pins down
 *
 * `validateAnalyticsQuery` hand-listed the valid periods:
 *
 *     !['day', 'week', 'month', 'quarter', 'year', 'custom'].includes(period)
 *
 * `all` was missing. So every "All time" request on the admin dashboard 400'd
 * before it reached the service - even though the enum had ALL_TIME, the DTO's
 * own `@IsEnum` accepted it, `calculateAnalyticsPeriod` handled it, and the TTL
 * map had an entry for it. Four places agreed; one disagreed, and that one ran
 * first.
 *
 * The error message restated the same stale list, so the 400 read as
 * authoritative rather than as a bug.
 *
 * This is the registration-chain problem from `.claude/rules/registration-chains.md`:
 * a value declared in one place and re-listed in another, with nothing checking
 * the two against each other. The fix derives the list from the enum; this test
 * is what stops someone re-introducing a literal.
 */

import { BadRequestException } from '@nestjs/common';

import { AnalyticsPeriodType, type GetAnalyticsQueryDto } from '../dto/admin-analytics.dto';
import { AdminAnalyticsController } from '../controllers/admin-analytics.controller';

/** `validateAnalyticsQuery` is private and pure; reached without constructing the module. */
const validate = (query: Partial<GetAnalyticsQueryDto>): void => {
  const controller = Object.create(AdminAnalyticsController.prototype) as AdminAnalyticsController;
  (
    controller as unknown as { validateAnalyticsQuery: (q: Partial<GetAnalyticsQueryDto>) => void }
  ).validateAnalyticsQuery(query);
};

describe('AdminAnalyticsController period validation', () => {
  const ALL_PERIODS = Object.values(AnalyticsPeriodType);

  it('knows about every period, so this suite cannot silently shrink', () => {
    // If a member is added later it lands in the `it.each` below automatically.
    expect(ALL_PERIODS).toContain(AnalyticsPeriodType.ALL_TIME);
    expect(ALL_PERIODS.length).toBeGreaterThanOrEqual(7);
  });

  it.each(ALL_PERIODS)('accepts %s', period => {
    /*
     * `custom` additionally requires a range, which is correct and checked
     * separately below - supplying one here keeps this case about the period
     * list rather than about the date rule.
     */
    const dates =
      period === AnalyticsPeriodType.CUSTOM
        ? { startDate: '2026-01-01', endDate: '2026-01-31' }
        : {};

    expect(() => validate({ period, ...dates })).not.toThrow();
  });

  it('still requires a range for custom', () => {
    expect(() => validate({ period: AnalyticsPeriodType.CUSTOM })).toThrow(BadRequestException);
  });

  it('accepts an absent period', () => {
    expect(() => validate({})).not.toThrow();
  });

  it('still rejects a period that is not in the enum', () => {
    // The guard must keep guarding - widening it to accept anything would be a
    // different bug with the same symptom disappearing.
    expect(() => validate({ period: 'fortnight' as AnalyticsPeriodType })).toThrow(
      BadRequestException,
    );
  });

  it('names the real accepted set in the error', () => {
    // The old message listed a set that excluded `all` while the enum included
    // it, which is how the 400 looked authoritative.
    try {
      validate({ period: 'fortnight' as AnalyticsPeriodType });
      throw new Error('expected validate to throw');
    } catch (error) {
      const message = (error as BadRequestException).message;
      for (const period of ALL_PERIODS) {
        expect(message).toContain(period);
      }
    }
  });
});
