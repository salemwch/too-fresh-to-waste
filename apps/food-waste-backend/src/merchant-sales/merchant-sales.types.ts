import {
  EARNINGS_TABS,
  type EarningsRow,
  type EarningsTab,
  type LineTotals,
  type MerchantSalesChart,
  type MerchantSalesSummary,
  type PaymentLine,
} from '@foodwaste/shared';

/**
 * `LineTotals`/`MerchantSalesSummary`/`MerchantSalesChart`/`EarningsRow`/
 * `EarningsTab`/`EARNINGS_TABS`/`PaymentLine` moved to `@foodwaste/shared`
 * (Task 17 A13) so the web app imports the same contract instead of
 * hand-copying it. Re-exported here so every existing backend import site
 * (`./merchant-sales.types`) keeps working unchanged.
 */
export { EARNINGS_TABS, type EarningsRow, type EarningsTab };
export type { LineTotals, MerchantSalesChart, MerchantSalesSummary, PaymentLine };

export const MERCHANT_EARNINGS_UNVERIFIED_ORDERS = 'MERCHANT_EARNINGS_UNVERIFIED_ORDERS';

export interface SalesGroupRow {
  _id: { population: 'earnings' | 'refunded' | 'verifying'; line: PaymentLine };
  orders: number;
  earnedMillimes: number;
  accruedMillimes: number;
  settledMillimes: number;
  foodMillimes: number;
  originalMillimes: number;
}
