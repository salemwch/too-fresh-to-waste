import { DateTime } from 'luxon';

/**
 * The merchant-facing periods, resolved on the server in Tunisian time so a
 * merchant whose computer clock or timezone is wrong still sees correct
 * figures. Tunisia has no DST; Luxon handles it anyway.
 */
export const SALES_PERIODS = ['today', '7d', '30d', 'month', 'all'] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];
export type SalesGranularity = 'hour' | 'day' | 'month';
export const SALES_TIMEZONE = 'Africa/Tunis';

export interface SalesRange {
  /** Inclusive start; null for `all`. */
  from: Date | null;
  /** Inclusive end: the request instant. */
  to: Date;
  granularity: SalesGranularity;
}

export function isSalesPeriod(value: unknown): value is SalesPeriod {
  return typeof value === 'string' && (SALES_PERIODS as readonly string[]).includes(value);
}

const local = (date: Date): DateTime => DateTime.fromJSDate(date).setZone(SALES_TIMEZONE);

export function resolveSalesPeriod(period: SalesPeriod, now: Date): SalesRange {
  const today = local(now).startOf('day');
  switch (period) {
    case 'today':
      return { from: today.toJSDate(), to: now, granularity: 'hour' };
    case '7d':
      return { from: today.minus({ days: 6 }).toJSDate(), to: now, granularity: 'day' };
    case '30d':
      return { from: today.minus({ days: 29 }).toJSDate(), to: now, granularity: 'day' };
    case 'month':
      return { from: local(now).startOf('month').toJSDate(), to: now, granularity: 'day' };
    case 'all':
      return { from: null, to: now, granularity: 'month' };
  }
}

/**
 * Every slot start the chart shows, so an empty hour, day or month is a 0 bar
 * instead of a missing one. `today` always spans the whole day (24 slots);
 * `all` starts at the first sale's month, or this month when there is none.
 */
export function salesSlots(range: SalesRange, firstSale: Date | null, now: Date): Date[] {
  const unit = range.granularity;
  const start = range.from ?? firstSale ?? now;
  const end = unit === 'hour' ? local(now).endOf('day') : local(now);
  const slots: Date[] = [];
  for (
    let cursor = local(start).startOf(unit);
    cursor <= end;
    cursor = cursor.plus({ [unit]: 1 })
  ) {
    slots.push(cursor.toJSDate());
  }
  return slots;
}
