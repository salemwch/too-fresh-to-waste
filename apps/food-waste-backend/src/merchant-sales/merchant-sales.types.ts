import type { PaymentLine } from './merchant-sales.expressions';
import type { SalesGranularity, SalesPeriod } from './merchant-sales.period';

export const MERCHANT_EARNINGS_UNVERIFIED_ORDERS = 'MERCHANT_EARNINGS_UNVERIFIED_ORDERS';

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

export interface SalesGroupRow {
  _id: { population: 'earnings' | 'refunded' | 'verifying'; line: PaymentLine };
  orders: number;
  earnedMillimes: number;
  accruedMillimes: number;
  settledMillimes: number;
  foodMillimes: number;
  originalMillimes: number;
  unverifiedIds: unknown[];
}

/**
 * The three Payments tabs. Declared once here; the request DTO (Task 9)
 * imports both rather than redeclaring them.
 */
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
