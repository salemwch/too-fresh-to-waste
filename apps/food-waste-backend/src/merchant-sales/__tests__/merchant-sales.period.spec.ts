import { resolveSalesPeriod, salesSlots, isSalesPeriod } from '../merchant-sales.period';

// Tunisia is UTC+1 all year (no DST since 2009). 2026-09-26 00:30 local is
// 2026-09-25T23:30Z - the case a UTC-based "today" gets wrong.
const at = (iso: string) => new Date(iso);

describe('resolveSalesPeriod', () => {
  it('today starts at 00:00 Tunis, even just after local midnight', () => {
    const r = resolveSalesPeriod('today', at('2026-09-25T23:30:00Z'));
    expect(r.from?.toISOString()).toBe('2026-09-25T23:00:00.000Z');
    expect(r.granularity).toBe('hour');
  });

  it('today just before local midnight is still the same local day', () => {
    const r = resolveSalesPeriod('today', at('2026-09-26T22:59:00Z'));
    expect(r.from?.toISOString()).toBe('2026-09-25T23:00:00.000Z');
  });

  it('7d is today plus the six days before it', () => {
    const r = resolveSalesPeriod('7d', at('2026-09-26T10:00:00Z'));
    expect(r.from?.toISOString()).toBe('2026-09-19T23:00:00.000Z');
    expect(r.granularity).toBe('day');
  });

  it('30d is today plus the twenty-nine days before it', () => {
    const r = resolveSalesPeriod('30d', at('2026-09-26T10:00:00Z'));
    expect(r.from?.toISOString()).toBe('2026-08-27T23:00:00.000Z');
  });

  it('month starts on the 1st at 00:00 Tunis', () => {
    const r = resolveSalesPeriod('month', at('2026-09-26T10:00:00Z'));
    expect(r.from?.toISOString()).toBe('2026-08-31T23:00:00.000Z');
  });

  it('month on the 1st just after local midnight is the new month', () => {
    const r = resolveSalesPeriod('month', at('2026-09-30T23:10:00Z')); // Oct 1st 00:10 local
    expect(r.from?.toISOString()).toBe('2026-09-30T23:00:00.000Z');
  });

  it('all has no start and monthly slots', () => {
    const r = resolveSalesPeriod('all', at('2026-09-26T10:00:00Z'));
    expect(r.from).toBeNull();
    expect(r.granularity).toBe('month');
  });

  it('to is always now', () => {
    const now = at('2026-09-26T10:00:00Z');
    expect(resolveSalesPeriod('7d', now).to).toEqual(now);
  });
});

describe('isSalesPeriod', () => {
  it.each(['today', '7d', '30d', 'month', 'all'])('accepts %s', p => {
    expect(isSalesPeriod(p)).toBe(true);
  });
  it.each(['90d', 'week', '', undefined, 7])('rejects %p', p => {
    expect(isSalesPeriod(p)).toBe(false);
  });
});

describe('salesSlots', () => {
  const now = at('2026-09-26T13:30:00Z'); // 14:30 local

  it('today is always 24 hourly slots, 00:00 to 23:00 local', () => {
    const slots = salesSlots(resolveSalesPeriod('today', now), null, now);
    expect(slots).toHaveLength(24);
    expect(slots[0]?.toISOString()).toBe('2026-09-25T23:00:00.000Z');
    expect(slots[23]?.toISOString()).toBe('2026-09-26T22:00:00.000Z');
  });

  it('7d is seven daily slots ending today', () => {
    const slots = salesSlots(resolveSalesPeriod('7d', now), null, now);
    expect(slots).toHaveLength(7);
    expect(slots[6]?.toISOString()).toBe('2026-09-25T23:00:00.000Z');
  });

  it('month is one slot per day from the 1st to today', () => {
    expect(salesSlots(resolveSalesPeriod('month', now), null, now)).toHaveLength(26);
  });

  it('all runs monthly from the first sale month to this month', () => {
    const slots = salesSlots(resolveSalesPeriod('all', now), at('2026-06-15T09:00:00Z'), now);
    expect(slots.map(s => s.toISOString())).toEqual([
      '2026-05-31T23:00:00.000Z',
      '2026-06-30T23:00:00.000Z',
      '2026-07-31T23:00:00.000Z',
      '2026-08-31T23:00:00.000Z',
    ]);
  });

  it('all with no sale yet is the current month only', () => {
    expect(salesSlots(resolveSalesPeriod('all', now), null, now)).toHaveLength(1);
  });
});
