import { OrderStatus } from '../schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from './order-pricing.util';

/*
 * Every money figure below comes from each order's FROZEN commission decision
 * (`order.commission`, written by CommissionService) - never a recomputed 19%.
 * Under the commission-settlement model a NORMAL sale accrues 19% and pays the
 * merchant in full; a SETTLEMENT accrues nothing and pays `subtotal - settled`
 * (.claude/work/commission-settlement-model.md).
 */

/**
 * Today's sales for a merchant, across both ways a customer can pay.
 *
 * The wallet card only ever shows online money, because that is the only money
 * the platform holds - cash goes straight into the merchant's till. So a
 * merchant who sold ten bags for cash saw "0.00" on their dashboard and
 * reasonably concluded nothing had sold. This summary is the day as the
 * merchant lived it: everything sold, split by how it was paid.
 *
 * Every order status lands in exactly one bucket, so a status added later has
 * to be placed deliberately (see `today-sales.util.spec.ts`).
 */

/** The customer has the food: this is a sale. */
export const TODAY_SOLD_STATUSES: readonly OrderStatus[] = Object.freeze([
  OrderStatus.PICKED_UP,
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
]);

/** Reserved today, not collected yet. Money the merchant can still expect. */
export const TODAY_TO_COLLECT_STATUSES: readonly OrderStatus[] = Object.freeze([
  OrderStatus.PENDING,
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY,
]);

/**
 * Not counted. `PENDING_PAYMENT` is an online checkout the customer has not
 * paid for yet - counting it would promise money that usually never arrives.
 */
export const TODAY_EXCLUDED_STATUSES: readonly OrderStatus[] = Object.freeze([
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
  OrderStatus.REFUNDED,
]);

export type SalesChannel = 'cash' | 'online';

export interface ChannelTotals {
  orders: number;
  /** Food subtotal - what customers paid for the food, delivery fee excluded. */
  sales: number;
}

export interface TodaySalesSummary {
  /** The merchant's calendar day, `YYYY-MM-DD` in Africa/Tunis. */
  date: string;
  currency: string;
  /** The platform's share of food sales, so the card can show its arithmetic. */
  rate: number;
  cash: ChannelTotals;
  online: ChannelTotals;
  total: ChannelTotals & {
    /** Commission recorded today: the 19% accrued by today's NORMAL sales. */
    commission: number;
    /** Commission balance paid off today by SETTLEMENT sales. */
    settled: number;
    /** What the merchant was paid for today's sales (cash in hand + online + driver). */
    received: number;
    /**
     * `received - commission`: today's profit. A settlement's settled part is
     * not deducted again - it paid off debt already counted on earlier days.
     */
    kept: number;
  };
  toCollect: ChannelTotals;
}

/** One `$group` row: a (bucket, channel) pair. */
export interface TodaySalesGroupRow {
  _id: { bucket: 'sold' | 'toCollect'; channel: SalesChannel };
  orders: number;
  sales: number;
  accrued: number;
  settled: number;
  merchantAmount: number;
}

const round = (value: number): number => parseFloat(value.toFixed(3));

/**
 * Online orders are the ones Konnect charged. Cash orders are created with no
 * `paymentProvider` at all (`order.service.ts` only sets it for `online`), so
 * "not Konnect" is the reliable test - never `=== 'cash'`, which matches none.
 */
export const SALES_CHANNEL_EXPR = Object.freeze({
  $cond: [{ $eq: ['$paymentProvider', 'konnect'] }, 'online', 'cash'],
});

export const SALES_BUCKET_EXPR = Object.freeze({
  $cond: [{ $in: ['$status', [...TODAY_SOLD_STATUSES]] }, 'sold', 'toCollect'],
});

/** The frozen decision's figures, 0 / the full subtotal when none was made. */
export const ORDER_ACCRUED_EXPR = Object.freeze({ $ifNull: ['$commission.accrued', 0] });
export const ORDER_SETTLED_EXPR = Object.freeze({ $ifNull: ['$commission.settled', 0] });
/**
 * No decision (a sale completed before the cutoff, or still in progress) means
 * the merchant was paid the full food price - the pre-model behaviour.
 */
export const ORDER_MERCHANT_AMOUNT_EXPR = Object.freeze({
  $ifNull: [
    '$commission.merchantAmount',
    { $ifNull: ['$pricing.merchantAmount', { $ifNull: ['$pricing.subtotal', 0] }] },
  ],
});

export function summariseTodaySales(
  rows: readonly TodaySalesGroupRow[],
  date: string,
): TodaySalesSummary {
  const empty = (): ChannelTotals => ({ orders: 0, sales: 0 });
  const cash = empty();
  const online = empty();
  const toCollect = empty();
  let accrued = 0;
  let settled = 0;
  let received = 0;

  for (const row of rows) {
    if (row._id.bucket === 'toCollect') {
      toCollect.orders += row.orders;
      toCollect.sales += row.sales;
      continue;
    }
    const target = row._id.channel === 'online' ? online : cash;
    target.orders += row.orders;
    target.sales += row.sales;
    accrued += row.accrued;
    settled += row.settled;
    received += row.merchantAmount;
  }

  const sales = round(cash.sales + online.sales);
  const commission = round(accrued);
  const receivedTotal = round(received);

  return {
    date,
    currency: 'TND',
    rate: PLATFORM_FOOD_SHARE,
    cash: { orders: cash.orders, sales: round(cash.sales) },
    online: { orders: online.orders, sales: round(online.sales) },
    total: {
      orders: cash.orders + online.orders,
      sales,
      commission,
      settled: round(settled),
      received: receivedTotal,
      kept: round(receivedTotal - commission),
    },
    toCollect: { orders: toCollect.orders, sales: round(toCollect.sales) },
  };
}
