/**
 * Locale-aware formatters with cached `Intl` instances.
 *
 * Constructing an `Intl.NumberFormat` is expensive relative to formatting with
 * one, and these run per row in admin tables — so instances are created once
 * per (locale, currency) pair and reused.
 */
const moneyFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Formats an amount in its own currency. TND renders with three decimals
 * (millimes) because that is what the currency actually has — the backend
 * rounds to the same precision.
 */
export function formatMoney(locale: string, value: number, currency = 'TND'): string {
  const key = `${locale}:${currency}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

const countFormatters = new Map<string, Intl.NumberFormat>();

/** What a count renders as when the API did not send one. */
export const MISSING_COUNT = '—';

/**
 * Group-separated integer for counts — bags, points, votes.
 *
 * Tolerates a missing value on purpose. Admin tables read fields that older
 * documents predate: `seasonBagTarget`, for one, is `required` on the schema
 * with no default, so every voting cycle written before it was introduced comes
 * back without it. Calling `.toLocaleString()` on that threw
 * "Cannot read properties of undefined" and took down the whole admin voting
 * page — one legacy row, and nobody could reach the screen.
 *
 * Renders an em dash rather than `0`, because they say different things: `0` is
 * a claim that nothing was counted, the dash admits the number is unknown. An
 * admin deciding whether a season met its target must be able to tell those
 * apart.
 */
export function formatCount(locale: string, value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING_COUNT;

  let formatter = countFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale);
    countFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}

/**
 * How far a season has come, as a percentage, or `null` when it cannot be said.
 *
 * `null` rather than `0` when the target is missing or zero: an empty progress
 * bar reading "0%" asserts no progress, which is a different claim from "we do
 * not know the goal". Callers render the bar at zero width either way, but the
 * label can tell the truth.
 */
export function seasonProgressPercent(
  progress: number | null | undefined,
  target: number | null | undefined,
): number | null {
  if (typeof target !== 'number' || !Number.isFinite(target) || target <= 0) return null;
  const done = typeof progress === 'number' && Number.isFinite(progress) ? progress : 0;
  return Math.min(Math.round((done / target) * 100), 100);
}

/**
 * What the date helpers accept.
 *
 * Both shapes occur in this codebase: API rows carry ISO strings, while a few
 * client models hold real `Date` objects. Accepting either keeps the call
 * sites free of `.toISOString()` noise.
 */
export type DateInput = Date | string | number | null | undefined;

/** Parses either shape, returning null for anything unusable. */
function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;
  // Epoch milliseconds: TanStack Query's `dataUpdatedAt` and similar report a
  // number, and `new Date(ms)` is the correct reading of it.
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Short absolute date — `12 Mar 2026`. */
export function formatDate(locale: string, iso: DateInput): string | null {
  const date = toDate(iso);
  if (!date) return null;

  let formatter = dateFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    dateFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const dateTimeFormatters = new Map<string, Intl.DateTimeFormat>();

/** Absolute date and time — `12 Mar 2026, 14:05`. */
export function formatDateTime(locale: string, iso: DateInput): string | null {
  const date = toDate(iso);
  if (!date) return null;

  let formatter = dateTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    dateTimeFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const monthYearFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Month and year only - `March 2026`. For "contributing since" style copy,
 * where day-level precision reads as false precision.
 */
export function formatMonthYear(locale: string, iso: DateInput): string | null {
  const date = toDate(iso);
  if (!date) return null;

  let formatter = monthYearFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    monthYearFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const relativeFormatters = new Map<string, Intl.RelativeTimeFormat>();

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 3_600_000],
  ['month', 30 * 24 * 3_600_000],
  ['day', 24 * 3_600_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/**
 * Locale-correct "3 hours ago". Returns null for a missing or unparseable
 * date so callers render their own empty state rather than "NaN ago".
 */
export function formatRelative(locale: string, iso: DateInput): string | null {
  const parsed = toDate(iso);
  if (!parsed) return null;
  const time = parsed.getTime();

  let formatter = relativeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    relativeFormatters.set(locale, formatter);
  }

  const diff = time - Date.now();
  const abs = Math.abs(diff);
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return formatter.format(Math.round(diff / 1000), 'second');
}

// ── Additional shapes the admin screens actually use ─────────────────────────
//
// Each of these replaces a hand-rolled `toLocale*(locale, { ... })` that was
// repeated across several files with slightly different options. Collecting
// them here means the shapes are finite and named, rather than every screen
// inventing its own.

const timeFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Clock time only - `14:05`, or `14:05:09` with seconds.
 *
 * For "last updated" readouts where the date is already implied by context.
 * Health checks use the seconds variant because a liveness probe that ran 40
 * seconds ago and one that ran 4 seconds ago are different situations.
 */
export function formatTime(
  locale: string,
  iso: DateInput,
  options: { seconds?: boolean } = {},
): string | null {
  const date = toDate(iso);
  if (!date) return null;

  const withSeconds = options.seconds === true;
  const key = `${locale}:${withSeconds ? 's' : 'm'}`;
  let formatter = timeFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      ...(withSeconds ? { second: '2-digit' } : {}),
    });
    timeFormatters.set(key, formatter);
  }
  return formatter.format(date);
}

const dateShortFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Day and month, no year - `12 Mar`.
 *
 * For chart axes and dense rows inside a period the reader already knows. Use
 * `formatDate` anywhere the year could be ambiguous; a date with no year in a
 * list spanning a year boundary is a genuine misreading, not just terse.
 */
export function formatDateShort(locale: string, iso: DateInput): string | null {
  const date = toDate(iso);
  if (!date) return null;

  let formatter = dateShortFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
    dateShortFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const dateShortTimeFormatters = new Map<string, Intl.DateTimeFormat>();

/** Day, month and clock time, no year - `12 Mar, 14:05`. */
export function formatDateShortTime(locale: string, iso: DateInput): string | null {
  const date = toDate(iso);
  if (!date) return null;

  let formatter = dateShortTimeFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
    dateShortTimeFormatters.set(locale, formatter);
  }
  return formatter.format(date);
}

const decimalFormatters = new Map<string, Intl.NumberFormat>();

/**
 * A number with a decimal cap - `1 234,5`.
 *
 * Distinct from `formatCount`, which is for whole counts and renders
 * `MISSING_COUNT` when the value is absent. This one is for measured
 * quantities (kg saved, CO2, percentages) where a fractional part is
 * meaningful, and it takes a non-nullable number because a measurement with no
 * value should not reach a formatter at all.
 */
export function formatDecimal(locale: string, value: number, maximumFractionDigits = 1): string {
  const key = `${locale}:${maximumFractionDigits}`;
  let formatter = decimalFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { maximumFractionDigits });
    decimalFormatters.set(key, formatter);
  }
  return formatter.format(value);
}

const compactFormatters = new Map<string, Intl.NumberFormat>();

/**
 * Abbreviated number - `1.2M`, `3.4K`.
 *
 * Four screens hand-rolled this as `n >= 1_000 ? (n/1_000).toFixed(1) + 'K'`,
 * which hardcodes the English abbreviations. `Intl` knows the local ones: the
 * same value is `1,2 M` in French and `١٫٢ مليون` in Arabic, and the decimal
 * separator moves too.
 *
 * Returns `MISSING_COUNT` for an absent value, matching `formatCount` - a
 * dashboard tile with no number should say so rather than claim zero.
 */
export function formatCompact(locale: string, value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return MISSING_COUNT;

  let formatter = compactFormatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    compactFormatters.set(locale, formatter);
  }
  return formatter.format(value);
}
