import {
  MISSING_COUNT,
  formatCompact,
  formatCount,
  formatDate,
  formatDateShort,
  formatDateShortTime,
  formatDateTime,
  formatDecimal,
  formatMoney,
  formatMonthYear,
  formatRelative,
  formatTime,
} from '../format';

/**
 * The locale-aware formatters.
 *
 * ## What this suite is actually defending
 *
 * 107 call sites across the app formatted dates and numbers with
 * `value.toLocaleString()` - no locale argument - which renders in the
 * *browser's* locale rather than the app's. A French admin on an en-US machine
 * read "1,234" and "3/12/2026" on an otherwise French page. Nothing caught it
 * because every one of those lines is correct-looking in isolation and renders
 * perfectly for an English reviewer.
 *
 * So the load-bearing assertions here are the cross-locale ones: the same input
 * must produce *different* output in en and fr. A regression to a hardcoded or
 * implicit locale fails those and only those - equality-against-a-fixture tests
 * would happily pass.
 *
 * ## On comparing against Intl directly
 *
 * Several cases assert against a freshly-constructed `Intl` formatter. That is
 * not circular: what it pins is that the helper passes the right *options* and
 * the right *locale* through, which is exactly its job. It is paired with
 * cross-locale inequality checks, which no wiring bug can satisfy by accident.
 */

const EN = 'en';
const FR = 'fr';
const AR = 'ar';
const LOCALES = [EN, FR, AR] as const;

/** 12 March 2026, 14:05:09 UTC. */
const ISO = '2026-03-12T14:05:09.000Z';
const AS_DATE = new Date(ISO);
const AS_EPOCH = AS_DATE.getTime();

/** Every input a caller can hand a date helper that must yield null. */
const UNUSABLE = [
  ['null', null],
  ['undefined', undefined],
  ['empty string', ''],
  ['not a date', 'not a date'],
  ['impossible month', '2026-13-45'],
  ['all zeroes', '0000-00-00'],
  ['an invalid Date object', new Date('nonsense')],
  ['NaN', Number.NaN],
] as const;

const DATE_HELPERS = [
  ['formatDate', formatDate],
  ['formatDateTime', formatDateTime],
  ['formatDateShort', formatDateShort],
  ['formatDateShortTime', formatDateShortTime],
  ['formatMonthYear', formatMonthYear],
  ['formatRelative', formatRelative],
  ['formatTime', formatTime],
] as const;

describe('date helpers: unusable input', () => {
  describe.each(DATE_HELPERS)('%s', (_name, fn) => {
    it.each(UNUSABLE)('returns null for %s', (_label, value) => {
      expect(fn(EN, value as never)).toBeNull();
    });

    it.each(UNUSABLE)('does not throw on %s', (_label, value) => {
      // The merchant Settings page crashed outright on an absent field. These
      // are total by construction; assert that rather than assuming it.
      expect(() => fn(EN, value as never)).not.toThrow();
    });
  });

  it('never renders the string "Invalid Date"', () => {
    for (const [, fn] of DATE_HELPERS) {
      for (const [, value] of UNUSABLE) {
        const result = fn(EN, value as never);
        expect(result === null || !result.includes('Invalid')).toBe(true);
      }
    }
  });
});

describe('date helpers: input shapes are interchangeable', () => {
  // Call sites hold all three: API rows carry ISO strings, some client models
  // hold Date objects, and TanStack's `dataUpdatedAt` is epoch milliseconds.
  it.each(DATE_HELPERS)('%s treats string, Date and epoch alike', (_name, fn) => {
    const fromString = fn(EN, ISO);
    const fromDate = fn(EN, AS_DATE);
    const fromEpoch = fn(EN, AS_EPOCH);

    expect(fromString).not.toBeNull();
    expect(fromDate).toBe(fromString);
    expect(fromEpoch).toBe(fromString);
  });
});

describe('the locale is actually honoured', () => {
  // The regression guard. A hardcoded or implicit locale collapses these.
  it.each([
    ['formatDate', formatDate],
    ['formatDateTime', formatDateTime],
    ['formatDateShort', formatDateShort],
    ['formatDateShortTime', formatDateShortTime],
    ['formatMonthYear', formatMonthYear],
  ] as const)('%s differs between en and fr', (_name, fn) => {
    expect(fn(EN, ISO)).not.toBe(fn(FR, ISO));
  });

  it('formatDate renders the month name in each language', () => {
    expect(formatDate(EN, ISO)).toContain('Mar');
    expect(formatDate(FR, ISO)).toContain('mars');
    // Arabic renders its own month name and numerals-with-Arabic-script.
    expect(formatDate(AR, ISO)).not.toBe(formatDate(EN, ISO));
  });

  it('formatCount groups digits per locale', () => {
    // en uses a comma, fr a narrow no-break space. Arabic shares en's
    // grouping, so it is deliberately not asserted to differ - claiming it did
    // would be a test that fails for being right about the wrong thing.
    expect(formatCount(EN, 1234567)).not.toBe(formatCount(FR, 1234567));
  });

  it('formatCompact localises the abbreviation, not just the separator', () => {
    // This is what the hand-rolled `(n/1000).toFixed(1) + 'K'` could not do.
    expect(formatCompact(EN, 1234567)).not.toBe(formatCompact(FR, 1234567));
    expect(formatCompact(AR, 1234567)).not.toBe(formatCompact(EN, 1234567));
  });

  it('formatTime uses each locale clock convention', () => {
    expect(formatTime(EN, ISO)).not.toBe(formatTime(FR, ISO));
  });

  it.each(LOCALES)('matches a directly-constructed Intl formatter in %s', locale => {
    const expected = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(AS_DATE);

    expect(formatDate(locale, ISO)).toBe(expected);
  });
});

describe('formatCount', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('renders the missing marker for %s', (_label, value) => {
    // An em dash, not "0": zero claims a real count of nothing, which is a
    // different statement from "we do not know".
    expect(formatCount(EN, value as number)).toBe(MISSING_COUNT);
  });

  it('renders zero as zero, not as missing', () => {
    expect(formatCount(EN, 0)).toBe('0');
    expect(formatCount(EN, 0)).not.toBe(MISSING_COUNT);
  });

  it('handles negatives', () => {
    expect(formatCount(EN, -42)).toContain('42');
    expect(formatCount(EN, -42)).not.toBe(MISSING_COUNT);
  });
});

describe('formatCompact', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
  ])('renders the missing marker for %s', (_label, value) => {
    expect(formatCompact(EN, value as number)).toBe(MISSING_COUNT);
  });

  it('abbreviates at thousands and millions', () => {
    expect(formatCompact(EN, 1_234)).toBe('1.2K');
    expect(formatCompact(EN, 1_234_567)).toBe('1.2M');
  });

  it('leaves small numbers unabbreviated', () => {
    expect(formatCompact(EN, 42)).toBe('42');
  });

  it('renders zero', () => {
    expect(formatCompact(EN, 0)).toBe('0');
  });
});

describe('formatDecimal', () => {
  it('respects the requested precision', () => {
    expect(formatDecimal(EN, 1234.567, 0)).toBe('1,235');
    expect(formatDecimal(EN, 1234.567, 1)).toBe('1,234.6');
    expect(formatDecimal(EN, 1234.567, 2)).toBe('1,234.57');
  });

  it('defaults to one decimal place', () => {
    expect(formatDecimal(EN, 1.25)).toBe(formatDecimal(EN, 1.25, 1));
  });

  it('does not pad a whole number up to the cap', () => {
    // `maximumFractionDigits`, not `minimum` - 5 must not render as "5.0".
    expect(formatDecimal(EN, 5, 2)).toBe('5');
  });

  it('caches per (locale, digits), not per locale alone', () => {
    // The cache key includes the precision. Keyed on locale only, the second
    // call would return the first call's formatter and silently use the wrong
    // number of decimals - a bug that only shows on a page mixing precisions.
    const zero = formatDecimal(EN, 1.55, 0);
    const two = formatDecimal(EN, 1.55, 2);

    expect(zero).toBe('2');
    expect(two).toBe('1.55');
  });
});

describe('formatTime', () => {
  it('omits seconds by default', () => {
    const expected = new Intl.DateTimeFormat(EN, {
      hour: '2-digit',
      minute: '2-digit',
    }).format(AS_DATE);

    expect(formatTime(EN, ISO)).toBe(expected);
  });

  it('includes seconds when asked', () => {
    const expected = new Intl.DateTimeFormat(EN, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(AS_DATE);

    expect(formatTime(EN, ISO, { seconds: true })).toBe(expected);
  });

  it('caches the two variants separately', () => {
    // Same collision risk as formatDecimal: a locale-only key would make
    // whichever variant ran first win for the rest of the session.
    const withSeconds = formatTime(EN, ISO, { seconds: true });
    const withoutSeconds = formatTime(EN, ISO);

    // Asserted rather than cast away: both are `string | null`, and a null
    // here would mean the parse failed, which is a different bug than the one
    // under test.
    expect(withSeconds).not.toBeNull();
    expect(withoutSeconds).not.toBeNull();
    expect(withSeconds).not.toBe(withoutSeconds);
    expect((withSeconds as string).length).toBeGreaterThan((withoutSeconds as string).length);
  });

  it('treats an absent options object as "no seconds"', () => {
    expect(formatTime(EN, ISO, {})).toBe(formatTime(EN, ISO));
    expect(formatTime(EN, ISO, { seconds: false })).toBe(formatTime(EN, ISO));
  });
});

describe('formatMoney', () => {
  it('renders TND with three decimals, the precision millimes have', () => {
    expect(formatMoney(EN, 12.5)).toContain('12.500');
  });

  it('places the currency per locale convention', () => {
    expect(formatMoney(EN, 12.5)).not.toBe(formatMoney(FR, 12.5));
  });

  it('caches per (locale, currency), not per locale alone', () => {
    const tnd = formatMoney(EN, 10);
    const eur = formatMoney(EN, 10, 'EUR');

    expect(tnd).not.toBe(eur);
    expect(eur).toContain('€');
  });

  it('handles zero and negative amounts', () => {
    expect(formatMoney(EN, 0)).toContain('0');
    expect(formatMoney(EN, -5)).toContain('5');
  });
});

describe('formatRelative', () => {
  it('describes the recent past', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    expect(formatRelative(EN, threeHoursAgo)).toBe('3 hours ago');
  });

  it('describes the future', () => {
    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    expect(formatRelative(EN, inTwoDays)).toContain('2 days');
  });

  it('falls back to seconds for a very recent timestamp', () => {
    const justNow = new Date(Date.now() - 2000);

    expect(formatRelative(EN, justNow)).toContain('second');
  });

  it('never renders "NaN"', () => {
    // The documented failure it was written to avoid.
    for (const [, value] of UNUSABLE) {
      const result = formatRelative(EN, value as never);
      expect(result === null || !result.includes('NaN')).toBe(true);
    }
  });

  it('translates the phrasing', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    expect(formatRelative(FR, threeHoursAgo)).not.toBe(formatRelative(EN, threeHoursAgo));
  });
});

describe('the locale caches do not leak between locales', () => {
  // Every helper memoises its Intl instance in a Map. A key that omitted the
  // locale would serve the first caller's language to everyone afterwards -
  // which is the original bug wearing a different hat, and invisible to a
  // suite that only ever tests one locale.
  it('keeps each locale distinct no matter the call order', () => {
    const firstFr = formatDate(FR, ISO);
    const firstEn = formatDate(EN, ISO);
    const secondFr = formatDate(FR, ISO);
    const secondEn = formatDate(EN, ISO);

    expect(firstFr).toBe(secondFr);
    expect(firstEn).toBe(secondEn);
    expect(firstFr).not.toBe(firstEn);
  });

  it.each(LOCALES)('%s is stable across repeated calls', locale => {
    const results = new Set([
      formatCount(locale, 1234),
      formatCount(locale, 1234),
      formatCount(locale, 1234),
    ]);

    expect(results.size).toBe(1);
  });
});
