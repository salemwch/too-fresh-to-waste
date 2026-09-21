'use client';

import type { DateInput } from './format';
import { useMemo } from 'react';
import { useLocale } from 'next-intl';

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
  formatRelative,
  formatTime,
} from './format';

/**
 * The `format*` helpers with the current locale already bound.
 *
 * ## Why this exists
 *
 * Every helper in `@/lib/format` takes `locale` as its first argument, which is
 * correct but means each call site has to remember `useLocale()` and thread it
 * through. Across the admin area 69 call sites did not, and reached for
 * `value.toLocaleString()` instead - which formats in the *browser's* locale,
 * so a French admin on an en-US machine read "1,234" and "3/12/2026" on an
 * otherwise French page.
 *
 * Nothing caught it because each of those lines looks right in isolation and
 * renders perfectly for an English reviewer. The lint rule in
 * `eslint.config.mjs` now rejects the raw calls; this hook is what makes the
 * correct thing shorter than the wrong one, which is the part that makes a rule
 * stick.
 *
 * ## Null handling is the caller's decision
 *
 * `date`, `dateTime` and `relative` return `null` for absent or unparseable
 * input rather than "Invalid Date" or "NaN ago". A caller that has a translated
 * empty state should use it; `?? MISSING_COUNT` is the fallback when it does
 * not. `count` already resolves its own missing value to `MISSING_COUNT`,
 * because a count is either known or it is not - there is no third rendering.
 *
 * ```tsx
 * const fmt = useFormat();
 * fmt.count(stats?.totalUsers);            // "1 234" / "—"
 * fmt.date(user.createdAt) ?? t('never');  // "12 mars 2026"
 * ```
 */
export function useFormat() {
  const locale = useLocale();

  // Memoised on `locale` alone, so the object identity is stable for the life
  // of the page. Without it every consumer that lists `fmt` in a `useMemo` or
  // `useCallback` dependency array recomputes on each render -
  // .claude/rules/performance.md rule 1.
  return useMemo(
    () => ({
      /** A number, or `—` when it is absent. Never "undefined". */
      count: (value: number | null | undefined): string => formatCount(locale, value),
      /** `12 Mar 2026`, or `null` when absent or unparseable. */
      date: (iso: DateInput): string | null => formatDate(locale, iso),
      /** `12 Mar 2026, 14:05`, or `null`. */
      dateTime: (iso: DateInput): string | null => formatDateTime(locale, iso),
      /** `12 Mar` - no year. Only where the period is already established. */
      dateShort: (iso: DateInput): string | null => formatDateShort(locale, iso),
      /** `12 Mar, 14:05` - no year. */
      dateShortTime: (iso: DateInput): string | null => formatDateShortTime(locale, iso),
      /** `14:05`, or `14:05:09` with `{ seconds: true }`. */
      time: (iso: DateInput, options?: { seconds?: boolean }): string | null =>
        formatTime(locale, iso, options),
      /** `3 hours ago`, or `null`. */
      relative: (iso: DateInput): string | null => formatRelative(locale, iso),
      /** Abbreviated - `1.2M`, localised (`1,2 M` in French). */
      compact: (value: number | null | undefined): string => formatCompact(locale, value),
      /** A measured quantity with a decimal cap - `1 234,5`. */
      decimal: (value: number, maximumFractionDigits?: number): string =>
        formatDecimal(locale, value, maximumFractionDigits),
      /** Currency, TND by default - 3 decimals, as millimes require. */
      money: (value: number, currency?: string): string => formatMoney(locale, value, currency),
    }),
    [locale],
  );
}

export { MISSING_COUNT };
