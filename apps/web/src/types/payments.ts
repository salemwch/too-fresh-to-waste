/**
 * Re-exports the merchant-sales / Payments contract from `@foodwaste/shared`
 * (Task 17 A13). These types used to be hand-copied here from the backend's
 * `merchant-sales.types.ts`/`merchant-sales.period.ts` - see
 * `.claude/rules/registration-chains.md`, "Backend type <-> frontend type".
 * Kept as a re-export file (rather than deleted) so every existing
 * `@/types/payments` import site keeps working unchanged.
 */
export {
  EARNINGS_TABS,
  type EarningsRow,
  type EarningsRowsPage,
  type EarningsTab,
  type LineTotals,
  type MerchantSalesChart,
  type MerchantSalesSummary,
  type PaymentLine,
  type SalesPeriod,
} from '@foodwaste/shared';
