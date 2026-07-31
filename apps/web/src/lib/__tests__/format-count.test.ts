import { formatCount, MISSING_COUNT, seasonProgressPercent } from '../format';

/**
 * `cycle.seasonBagTarget.toLocaleString()` threw "Cannot read properties of
 * undefined" and blanked the entire admin voting page. The field is `required`
 * on the Mongoose schema with no default, and the list endpoint returns whole
 * documents with no projection — so one cycle written before the field existed
 * comes back without it, and the page every admin uses to manage seasons stops
 * loading. Seven events before anyone could open it.
 *
 * These two functions are what the UI now goes through. Their job is to render
 * something truthful for data that is not there, rather than crash or invent a
 * zero.
 */

const LOCALE = 'en';

describe('formatCount', () => {
  it('groups digits for a real count', () => {
    expect(formatCount(LOCALE, 30000)).toBe('30,000');
    expect(formatCount(LOCALE, 7)).toBe('7');
  });

  it('renders zero as zero, not as missing', () => {
    // A season that has genuinely saved nothing is not the same as a season
    // whose progress we failed to read.
    expect(formatCount(LOCALE, 0)).toBe('0');
    expect(formatCount(LOCALE, 0)).not.toBe(MISSING_COUNT);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
  ])('renders a dash for %s rather than throwing', (_label, value) => {
    expect(formatCount(LOCALE, value)).toBe(MISSING_COUNT);
  });

  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('renders a dash for %s', (_label, value) => {
    // Intl renders these as "NaN" and "∞", which mean nothing to an admin.
    expect(formatCount(LOCALE, value)).toBe(MISSING_COUNT);
  });

  it('follows the locale', () => {
    expect(formatCount('fr', 30000)).not.toBe(formatCount('en', 30000));
    expect(formatCount('fr', 30000)).toMatch(/30.000/);
  });

  it('handles negatives and decimals without special-casing them', () => {
    expect(formatCount(LOCALE, -5)).toBe('-5');
    expect(formatCount(LOCALE, 1234.5)).toBe('1,234.5');
  });

  it('reuses one formatter per locale', () => {
    // Constructing Intl.NumberFormat is expensive and this runs per table row.
    const spy = jest.spyOn(Intl, 'NumberFormat');
    formatCount('de', 1);
    formatCount('de', 2);
    formatCount('de', 3);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('seasonProgressPercent', () => {
  it('reports how far a season has come', () => {
    expect(seasonProgressPercent(150, 300)).toBe(50);
    expect(seasonProgressPercent(1, 3)).toBe(33);
  });

  it('caps at 100 when a season overshoots its goal', () => {
    // Communities do beat the target; the bar must not run past its track.
    expect(seasonProgressPercent(900, 300)).toBe(100);
  });

  it('treats missing progress against a real target as no progress', () => {
    // The denominator is known, so 0% is an honest answer here.
    expect(seasonProgressPercent(undefined, 300)).toBe(0);
    expect(seasonProgressPercent(null, 300)).toBe(0);
    expect(seasonProgressPercent(NaN, 300)).toBe(0);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['zero', 0],
    ['negative', -10],
    ['NaN', NaN],
  ])('gives no percentage when the target is %s', (_label, target) => {
    // Without a denominator there is no percentage. null, not 0 — the caller
    // renders an empty bar either way, but the label must not claim the season
    // has made no progress when we simply do not know the goal.
    expect(seasonProgressPercent(150, target)).toBeNull();
  });

  it('returns whole numbers, since the label prints them raw', () => {
    const pct = seasonProgressPercent(1, 7);
    expect(pct).toBe(Math.round(pct as number));
  });

  it('survives the row that broke the page', () => {
    // A cycle with neither counter: the exact shape behind the Sentry report.
    expect(() => seasonProgressPercent(undefined, undefined)).not.toThrow();
    expect(seasonProgressPercent(undefined, undefined)).toBeNull();
    expect(formatCount(LOCALE, undefined)).toBe(MISSING_COUNT);
  });
});
