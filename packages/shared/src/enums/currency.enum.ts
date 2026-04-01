/**
 * Supported platform currencies.
 */
export enum Currency {
  TND = 'TND',
  EUR = 'EUR',
  USD = 'USD',
}

/**
 * Platform default currency.
 * The application operates in Tunisia - all monetary values default to TND.
 */
export const DEFAULT_CURRENCY = Currency.TND;
