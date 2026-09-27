export type SalesPeriod = 'today' | '7d' | '30d' | 'month' | 'all';

export type EarningsTab = 'earnings' | 'refunded' | 'verifying';

/** The three Payments tabs, in display order. */
export const EARNINGS_TABS: readonly EarningsTab[] = Object.freeze([
  'earnings',
  'refunded',
  'verifying',
]);

/** Merchants never see delivery money - these are the only three lines shown. */
export type PaymentLine = 'cashStore' | 'cashDelivery' | 'online';

export interface LineTotals {
  orders: number;
  earned: number;
}

/**
 * Mirrors `MerchantSalesSummary` in
 * `apps/food-waste-backend/src/merchant-sales/merchant-sales.types.ts` field
 * for field - hand-kept, no automated proof (registration-chains.md).
 */
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

/** Mirrors `EarningsRow` in the same backend file. Food only - never `deliveryFee`/`total`. */
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

export interface EarningsRowsPage {
  rows: EarningsRow[];
  hasMore: boolean;
  nextCursor?: string;
}
