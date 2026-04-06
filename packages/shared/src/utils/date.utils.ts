/**
 * Date Utilities — platform-agnostic, pure functions.
 *
 * All functions accept Date | ISO string | timestamp (ms) so callers never
 * need to parse dates before passing them in.
 *
 * Locale support: 'en' | 'fr' | 'ar' (matches the three app locales).
 * Uses Intl APIs available in Node ≥18, React Native (JSC/Hermes), and all browsers.
 *
 * Tunisia context:
 *  - No DST — UTC+1 year-round (CET)
 *  - Currency: TND (handled by format.utils.ts)
 *  - Date format: DD/MM/YYYY (fr), MM/DD/YYYY (en), Arabic calendar (ar optional)
 */

// ─── Internal helper ──────────────────────────────────────────────────────────

function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

// ─── Format helpers ───────────────────────────────────────────────────────────

/**
 * Format a date to a localized readable string.
 * Default: "April 4, 2026" (en) / "4 avril 2026" (fr) / "٤ أبريل ٢٠٢٦" (ar)
 */
export function formatDate(
  date: Date | string | number,
  locale = 'en',
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  },
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(toDate(date));
  } catch {
    return '';
  }
}

/**
 * Format time only.
 * Default: "14:30" (24h for fr/ar), "2:30 PM" (en)
 */
export function formatTime(date: Date | string | number, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(
      toDate(date),
    );
  } catch {
    return '';
  }
}

/**
 * Format a full date+time.
 * e.g. "April 4, 2026 at 2:30 PM"
 */
export function formatDateTime(date: Date | string | number, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(toDate(date));
  } catch {
    return '';
  }
}

/**
 * Format a short date: "04/04/2026" (locale-appropriate separator/order).
 */
export function formatShortDate(date: Date | string | number, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(toDate(date));
  } catch {
    return '';
  }
}

// ─── Relative time ────────────────────────────────────────────────────────────

/**
 * Format relative time: "2 hours ago", "in 30 minutes", "just now".
 * Falls back to a formatted date for differences > 7 days.
 *
 * Uses Intl.RelativeTimeFormat where available (all target runtimes).
 */
export function formatRelativeTime(
  date: Date | string | number,
  locale = 'en',
  now: Date | string | number = new Date(),
): string {
  try {
    const diffMs = toDate(date).getTime() - toDate(now).getTime();
    const absMs = Math.abs(diffMs);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    if (absMs < 60_000) return rtf.format(Math.round(diffMs / 1_000), 'second');
    if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), 'minute');
    if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), 'hour');
    if (absMs < 604_800_000) return rtf.format(Math.round(diffMs / 86_400_000), 'day');

    // Fallback to absolute date for > 7 days
    return formatDate(date, locale);
  } catch {
    return '';
  }
}

// ─── Predicates ───────────────────────────────────────────────────────────────

/** Returns true if the date is in the past. */
export function isExpired(date: Date | string | number): boolean {
  return toDate(date).getTime() < Date.now();
}

/** Returns true if the date falls on today (local time). */
export function isToday(date: Date | string | number): boolean {
  const d = toDate(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Returns true if the date falls on tomorrow (local time). */
export function isTomorrow(date: Date | string | number): boolean {
  const d = toDate(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

// ─── Duration helpers ─────────────────────────────────────────────────────────

/** Milliseconds until `date`. Negative if already expired. */
export function msUntil(date: Date | string | number): number {
  return toDate(date).getTime() - Date.now();
}

/**
 * Human-readable countdown: "2h 15m", "45m", "< 1m".
 * Returns empty string if the date is in the past.
 */
export function formatCountdown(date: Date | string | number): string {
  const ms = msUntil(date);
  if (ms <= 0) return '';

  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes < 1) return '< 1m';

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
