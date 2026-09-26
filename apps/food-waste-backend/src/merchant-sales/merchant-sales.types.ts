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
