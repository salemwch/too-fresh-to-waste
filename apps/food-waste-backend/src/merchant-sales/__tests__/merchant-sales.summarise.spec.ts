import type { PaymentLine } from '../merchant-sales.expressions';
import { summariseSalesGroups } from '../merchant-sales.summarise';
import type { SalesGroupRow } from '../merchant-sales.types';

// Typed precisely (not `string`/`number`) so the fixture matches
// `SalesGroupRow` and this spec type-checks under `check:ts`.
const g = (
  population: SalesGroupRow['_id']['population'],
  line: PaymentLine,
  orders: number,
  earnedMillimes: number,
  accruedMillimes = 0,
  settledMillimes = 0,
  foodMillimes = earnedMillimes,
  originalMillimes = foodMillimes,
): SalesGroupRow => ({
  _id: { population, line },
  orders,
  earnedMillimes,
  accruedMillimes,
  settledMillimes,
  foodMillimes,
  originalMillimes,
});

describe('summariseSalesGroups', () => {
  it('the three lines sum exactly to the total', () => {
    const s = summariseSalesGroups([
      g('earnings', 'cashStore', 2, 20_100),
      g('earnings', 'cashDelivery', 1, 333),
      g('earnings', 'online', 3, 30_567),
    ]);
    expect(s.total).toMatchObject({ orders: 6, earned: 51 });
    expect(
      s.channels.cashStore.earned + s.channels.cashDelivery.earned + s.channels.online.earned,
    ).toBe(51);
  });

  it('only earnings count; refunded and verifying do not', () => {
    const s = summariseSalesGroups([
      g('earnings', 'cashStore', 1, 10_000),
      g('refunded', 'cashStore', 1, 10_000),
      g('verifying', 'online', 2, 0),
    ]);
    expect(s.total).toMatchObject({ orders: 1, earned: 10 });
    expect(s.unverifiedOrders).toBe(2);
  });

  it('food and original value cover the Earnings orders only, never refunded ones', () => {
    const s = summariseSalesGroups([
      g('earnings', 'online', 1, 4_000, 0, 6_000, 10_000, 20_000), // SETTLEMENT: earned 4, food 10, original 20
      g('refunded', 'online', 1, 10_000, 0, 0, 10_000, 20_000),
    ]);
    expect(s.total).toMatchObject({ earned: 4, foodValue: 10, originalValue: 20 });
  });

  it('commission recorded and paid off come from earnings only', () => {
    const s = summariseSalesGroups([
      g('earnings', 'online', 1, 10_000, 1_900, 0),
      g('earnings', 'online', 1, 4_000, 0, 6_000),
      g('refunded', 'online', 1, 10_000, 1_900, 0),
    ]);
    expect(s.commission).toEqual({ accrued: 1.9, settled: 6 });
  });

  it('empty input is a zero summary, not undefined lines', () => {
    const s = summariseSalesGroups([]);
    expect(s.total).toEqual({ orders: 0, earned: 0, foodValue: 0, originalValue: 0 });
    expect(Object.keys(s.channels).sort()).toEqual(['cashDelivery', 'cashStore', 'online']);
  });

  it("does not carry the verifying orders' own ids - A5 moved that to a capped, separate query", () => {
    const s = summariseSalesGroups([g('verifying', 'online', 2, 0)]);
    expect(s).not.toHaveProperty('unverifiedIds');
  });
});
