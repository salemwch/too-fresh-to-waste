import type { SalesPeriod } from '@/types/payments';

export const SALES_PERIODS: readonly SalesPeriod[] = Object.freeze([
  'today',
  '7d',
  '30d',
  'month',
  'all',
]);
export const DEFAULT_SALES_PERIOD: SalesPeriod = 'month';

/** An unknown or missing value is the default, never an error: it comes from the URL. */
export function parseSalesPeriod(raw: string | null): SalesPeriod {
  return (SALES_PERIODS as readonly string[]).includes(raw ?? '')
    ? (raw as SalesPeriod)
    : DEFAULT_SALES_PERIOD;
}
