/**
 * The merchant-sales / earnings / Payments contract, shared between the
 * backend (`apps/food-waste-backend/src/merchant-sales`) and the web app
 * (`apps/web/src/types/payments.ts` used to hand-copy these - see
 * `.claude/rules/registration-chains.md`, "Backend type <-> frontend type").
 * Source of truth lives here; both sides import from `@foodwaste/shared`.
 */

/**
 * The merchant-facing periods, resolved on the server in Tunisian time so a
 * merchant whose computer clock or timezone is wrong still sees correct
 * figures.
 */
export const SALES_PERIODS = ['today', '7d', '30d', 'month', 'all'] as const;
export type SalesPeriod = (typeof SALES_PERIODS)[number];

/** The chart's x-axis bucket size, driven by the selected period. */
export type SalesGranularity = 'hour' | 'day' | 'month';

/** Merchants never see delivery money - these are the only three lines shown. */
export type PaymentLine = 'cashStore' | 'cashDelivery' | 'online';

export interface LineTotals {
  orders: number;
  earned: number;
}

export interface MerchantSalesSummary {
  period: SalesPeriod | 'custom';
  from: string | null;
  to: string;
  currency: 'TND';
  total: LineTotals & { foodValue: number; originalValue: number };
  channels: Record<PaymentLine, LineTotals>;
  commission: { rate: number; accrued: number; settled: number };
  unverifiedOrders: number;
}

export interface MerchantSalesChart {
  period: SalesPeriod;
  granularity: SalesGranularity;
  slots: Array<{ start: string; orders: number; bags: number; earned: number }>;
}

/** The three Payments tabs, in display order. */
export const EARNINGS_TABS = ['earnings', 'refunded', 'verifying'] as const;
export type EarningsTab = (typeof EARNINGS_TABS)[number];

/** One order behind a Payments row. Food only - never `deliveryFee`/`total`. */
export interface EarningsRow {
  orderId: string;
  orderNumber: string;
  customerName: string | null;
  establishmentName: string | null;
  line: PaymentLine;
  subtotal: number;
  /** 0 on the verifying tab. */
  earned: number;
  kind: 'NORMAL' | 'SETTLEMENT' | 'LEGACY' | 'UNVERIFIED';
  commissionMoment: string;
  status: string;
  refundReason: string | null;
}

/** A cursor-paged slice of `EarningsRow`s, as returned by the Payments rows endpoint. */
export interface EarningsRowsPage {
  rows: EarningsRow[];
  hasMore: boolean;
  nextCursor?: string;
}
