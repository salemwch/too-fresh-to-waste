/**
 * Admin-authored content that can carry per-language variants.
 *
 * ## Why this is not the same as the i18n message files
 *
 * `messages/{locale}.json` holds *chrome* - labels the product ships, written
 * once by us. This is *content*: a prize name an admin types, stored in the
 * database, and shown to every customer whatever language they read.
 *
 * Prize names were a single string, so an admin typing "Latest Smartphone"
 * sent that English string to French and Arabic customers alike. The fix is not
 * to translate it in the message files - we do not know in advance what an
 * admin will type - but to let them supply the variants they care about.
 *
 * ## The default is required; the variants are not
 *
 * Every record keeps its original single field as the required default. The
 * variants are optional, so nothing needs migrating and an admin who does not
 * want to write three versions is not forced to. A customer sees their own
 * language when it exists and the default when it does not - never a blank.
 */

/** Locales an admin can supply a variant for. The default field covers `en`. */
export type ContentLocale = 'fr' | 'ar';

/** Optional per-language variants of one admin-authored string. */
export interface LocalisedText {
  fr?: string;
  ar?: string;
}

/**
 * The variant for `locale`, or the default when there is none.
 *
 * Blank and whitespace-only variants are treated as absent. An admin who opens
 * the Arabic field, types nothing, and saves has not authored an Arabic name -
 * and rendering an empty string there would leave a customer looking at a gap
 * where the prize should be.
 *
 * @param fallback the required default (English) - always rendered if nothing better exists
 * @param variants the optional per-language variants, if the record has any
 * @param locale   the reader's locale; anything outside `ContentLocale` takes the fallback
 */
export function resolveLocalisedText(
  fallback: string,
  variants: LocalisedText | null | undefined,
  locale: string,
): string {
  if (!variants) return fallback;

  // Tolerates 'fr-TN' and 'ar-TN' as well as bare codes: next-intl is
  // configured with bare codes, but a stored or forwarded locale may carry a
  // region and should not silently fall back to English.
  const base = locale.split('-')[0] as ContentLocale;
  const variant = base === 'fr' || base === 'ar' ? variants[base] : undefined;

  return typeof variant === 'string' && variant.trim().length > 0 ? variant : fallback;
}
