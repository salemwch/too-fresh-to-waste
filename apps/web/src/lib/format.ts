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

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

/** Short absolute date — `12 Mar 2026`. */
export function formatDate(locale: string, iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

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
export function formatDateTime(locale: string, iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

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
export function formatRelative(locale: string, iso: string | null): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;

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
