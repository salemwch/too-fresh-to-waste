import type { SessionDeviceInfo } from '@/types/settings';

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
 */
export function formatSessionDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString();
}
