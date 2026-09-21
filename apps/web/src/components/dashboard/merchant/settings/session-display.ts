import type { SessionDeviceInfo } from '@/types/settings';
import { formatDate } from '@/lib/format';

/**
 * Presentation helpers for an active session row.
 *
 * Extracted from settings-page.tsx because they are pure: testing them there
 * would drag framer-motion, next-intl, sonner and the whole settings screen into
 * a unit test that only needs two functions.
 *
 * Both are deliberately total — the merchant Settings page crashed outright when
 * one absent field reached `new Date(undefined).toLocaleDateString()`, which
 * throws rather than degrading. Nothing here throws, and nothing renders
 * "Invalid Date" or "undefined" at a merchant.
 *
 * `formatSessionDate` takes `locale` rather than reaching for the `useFormat`
 * hook: this module is deliberately not a component, and a hook here would put
 * it back inside React and undo the extraction that makes it testable.
 */

/** Platform, browser and device name, deduplicated — e.g. "Windows · Chrome". */
export function describeDevice(device: SessionDeviceInfo | undefined): string | null {
  const parts = [device?.deviceName, device?.platform, device?.browser].filter(
    (part): part is string => typeof part === 'string' && part.trim().length > 0,
  );

  // Some clients report the same string as both name and platform; "Android ·
  // Android" reads as a bug to whoever sees it.
  const unique = [...new Set(parts.map(part => part.trim()))];
  return unique.length > 0 ? unique.join(' · ') : null;
}

/**
 * Localised date, or `null` when there is nothing usable.
 *
 * `null` rather than a placeholder string so the caller picks its own translated
 * fallback instead of this module inventing English copy.
 *
 * This used to call `date.toLocaleDateString()` with no locale, which formats
 * in the *browser's* locale - so a French merchant on an en-US machine read US
 * dates on an otherwise French settings page.
 */
export function formatSessionDate(locale: string, iso: string | undefined): string | null {
  return formatDate(locale, iso);
}
