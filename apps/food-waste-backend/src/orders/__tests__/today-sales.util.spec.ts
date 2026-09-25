/**
 * Today's sales - bucket rules and arithmetic.
 *
 * The aggregation itself runs against a real database in
 * `today-sales.integration.spec.ts`. This file pins the two things that can be
 * decided without one: every order status is placed on purpose, and the
 * summary adds up.
 */

import { OrderStatus } from '../schemas/order.schema';
import { PLATFORM_FOOD_SHARE } from '../utils/order-pricing.util';
import {
  TODAY_EXCLUDED_STATUSES,
  TODAY_SOLD_STATUSES,
  TODAY_TO_COLLECT_STATUSES,
  summariseTodaySales,
  type TodaySalesGroupRow,
} from '../utils/today-sales.util';

/**
 * One (bucket, channel) group. `accrued` / `settled` / `merchantAmount` are
 * sums of each order's frozen `order.commission` - a NORMAL sale accrues 19%
 * and pays the merchant in full; a SETTLEMENT accrues nothing and pays
 * `subtotal - settled`.
 */
const row = (
  bucket: 'sold' | 'toCollect',
  channel: 'cash' | 'online',
  orders: number,
  sales: number,
  money: { accrued?: number; settled?: number; merchantAmount?: number } = {},
): TodaySalesGroupRow => ({
  _id: { bucket, channel },
  orders,
  sales,
  accrued: money.accrued ?? parseFloat((sales * PLATFORM_FOOD_SHARE).toFixed(3)),
  settled: money.settled ?? 0,
  merchantAmount: money.merchantAmount ?? sales,
});

describe('today-sales status buckets', () => {
  const buckets = [TODAY_SOLD_STATUSES, TODAY_TO_COLLECT_STATUSES, TODAY_EXCLUDED_STATUSES];

  it.each(Object.values(OrderStatus))('places %s in exactly one bucket', status => {
    // A status added to the enum later fails here until someone decides whether
    // it is a sale, money still to collect, or nothing.
    expect(buckets.filter(b => b.includes(status))).toHaveLength(1);
  });

  it('never counts an unpaid online checkout as money to expect', () => {
    expect(TODAY_EXCLUDED_STATUSES).toContain(OrderStatus.PENDING_PAYMENT);
    expect(TODAY_TO_COLLECT_STATUSES).not.toContain(OrderStatus.PENDING_PAYMENT);
  });

  it('counts both chains to their end as sold', () => {
    expect(TODAY_SOLD_STATUSES).toEqual(
      expect.arrayContaining([OrderStatus.PICKED_UP, OrderStatus.DELIVERED]),
    );
  });
});

describe('summariseTodaySales', () => {
  it('is all zeros on a day with no orders, not missing fields', () => {
    expect(summariseTodaySales([], '2026-09-24')).toEqual({
      date: '2026-09-24',
      currency: 'TND',
      rate: PLATFORM_FOOD_SHARE,
      cash: { orders: 0, sales: 0 },
      online: { orders: 0, sales: 0 },
      total: { orders: 0, sales: 0, commission: 0, settled: 0, received: 0, kept: 0 },
      toCollect: { orders: 0, sales: 0 },
    });
  });

  it('adds cash and online into one total', () => {
    const s = summariseTodaySales(
      [row('sold', 'cash', 3, 30), row('sold', 'online', 2, 20)],
      '2026-09-24',
    );

    expect(s.cash).toEqual({ orders: 3, sales: 30 });
    expect(s.online).toEqual({ orders: 2, sales: 20 });
    expect(s.total.orders).toBe(5);
    expect(s.total.sales).toBe(50);
  });

  it('NORMAL sale: received in full, 19% recorded, keeps 81%', () => {
    const s = summariseTodaySales([row('sold', 'cash', 1, 10)], '2026-09-24');

    expect(s.total).toMatchObject({ commission: 1.9, settled: 0, received: 10, kept: 8.1 });
  });

  it('SETTLEMENT sale: no new 19%, paid 5 of 10, keeps the 5 - the rest paid old debt', () => {
    const s = summariseTodaySales(
      [row('sold', 'online', 1, 10, { accrued: 0, settled: 5, merchantAmount: 5 })],
      '2026-09-24',
    );

    expect(s.total).toMatchObject({ commission: 0, settled: 5, received: 5, kept: 5 });
  });

  it('a day of both adds up', () => {
    const s = summariseTodaySales(
      [
        row('sold', 'cash', 1, 10),
        row('sold', 'online', 1, 10, { accrued: 0, settled: 5, merchantAmount: 5 }),
      ],
      '2026-09-24',
    );

    expect(s.total).toMatchObject({
      sales: 20,
      commission: 1.9,
      settled: 5,
      received: 15,
      kept: 13.1,
    });
  });

  it('keeps orders still to collect out of every sales figure', () => {
    const s = summariseTodaySales(
      [
        row('sold', 'cash', 1, 10),
        row('toCollect', 'online', 2, 12),
        row('toCollect', 'cash', 1, 5),
      ],
      '2026-09-24',
    );

    expect(s.total.sales).toBe(10);
    expect(s.total.commission).toBe(1.9);
    expect(s.total.received).toBe(10);
    expect(s.toCollect).toEqual({ orders: 3, sales: 17 });
  });

  it('rounds to millimes so float noise never reaches the card', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754.
    const s = summariseTodaySales(
      [row('sold', 'cash', 1, 0.1), row('sold', 'online', 1, 0.2)],
      '2026-09-24',
    );

    expect(s.total.sales).toBe(0.3);
  });
});
