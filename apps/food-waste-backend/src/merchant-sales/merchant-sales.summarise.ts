import type { PaymentLine } from './merchant-sales.expressions';
import type { LineTotals, SalesGroupRow } from './merchant-sales.types';

const LINES: readonly PaymentLine[] = ['cashStore', 'cashDelivery', 'online'];
const tnd = (millimes: number): number => millimes / 1000;

/** Millimes in, TND out. Lines are summed in integers, so they reconcile exactly. */
export function summariseSalesGroups(rows: readonly SalesGroupRow[]): {
  total: LineTotals & { foodValue: number; originalValue: number };
  channels: Record<PaymentLine, LineTotals>;
  commission: { accrued: number; settled: number };
  unverifiedOrders: number;
  unverifiedIds: string[];
} {
  const millimes: Record<PaymentLine, { orders: number; earned: number }> = {
    cashStore: { orders: 0, earned: 0 },
    cashDelivery: { orders: 0, earned: 0 },
    online: { orders: 0, earned: 0 },
  };
  let accrued = 0;
  let settled = 0;
  let food = 0;
  let original = 0;
  let unverifiedOrders = 0;
  const unverifiedIds: string[] = [];

  for (const row of rows) {
    if (row._id.population === 'verifying') {
      unverifiedOrders += row.orders;
      unverifiedIds.push(...row.unverifiedIds.map(String));
      continue;
    }
    if (row._id.population !== 'earnings') {
      continue;
    }
    millimes[row._id.line].orders += row.orders;
    millimes[row._id.line].earned += row.earnedMillimes;
    accrued += row.accruedMillimes;
    settled += row.settledMillimes;
    food += row.foodMillimes;
    original += row.originalMillimes;
  }

  const channels = Object.fromEntries(
    LINES.map(line => [
      line,
      { orders: millimes[line].orders, earned: tnd(millimes[line].earned) },
    ]),
  ) as Record<PaymentLine, LineTotals>;
  const totalMillimes = LINES.reduce((sum, line) => sum + millimes[line].earned, 0);

  return {
    total: {
      orders: LINES.reduce((sum, line) => sum + millimes[line].orders, 0),
      earned: tnd(totalMillimes),
      foodValue: tnd(food),
      originalValue: tnd(original),
    },
    channels,
    commission: { accrued: tnd(accrued), settled: tnd(settled) },
    unverifiedOrders,
    unverifiedIds,
  };
}
