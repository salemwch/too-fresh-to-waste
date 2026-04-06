/**
 * Formatting utilities — shared across mobile and web.
 * Pure functions, no platform-specific dependencies.
 */

/**
 * Format a numeric amount as a currency string using the runtime locale.
 * Defaults to TND (Tunisian Dinar). Pass a locale to override.
 *
 * @example formatCurrency(12.5)               // "TND 12.500" (browser default locale)
 * @example formatCurrency(12.5, 'EUR', 'fr-FR') // "12,50 €"
 * @example formatCurrency(12.5, 'TND', 'ar-TN') // "١٢٫٥٠٠ د.ت."
 */
export function formatCurrency(amount: number, currency = 'TND', locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}
