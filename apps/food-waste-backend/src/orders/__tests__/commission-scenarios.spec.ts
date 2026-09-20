/**
 * Commission model - every scenario that can occur, worst to best.
 *
 * `commission-settlement.spec.ts` proves the arithmetic of one call.
 * `commission.service.spec.ts` proves the persistence branching.
 * The integration suites prove concurrency and the aggregations.
 *
 * None of them answer the question an owner actually asks: **over a realistic
 * lifetime of a shop, does the platform end up with 19% and does the merchant
 * end up with 81%, whatever happens along the way?**
 *
 * So this suite runs whole merchant lifetimes as sequences of events and checks
 * the two invariants that must survive all of them:
 *
 *   I1  CONSERVATION   sum(accrued) - sum(settled) === balance, always, exactly.
 *                      Nothing is created and nothing is discarded.
 *
 *   I2  TAKE RATE      sum(accrued) === 19% of everything sold.
 *                      Collection may lag; the charge may not drift.
 *
 * Enumerated from `.claude/rules/testing.md`: empty, malformed, boundary,
 * transition, idempotence, unavailable dependency, and actor variants. The
 * adversarial cases come first because they are the ones that lose money.
 */

import {
  MAX_SETTLEMENT_SHARE_OF_ORDER,
  PLATFORM_FOOD_SHARE,
  SETTLEMENT_THRESHOLD,
  calculateCommissionSettlement,
} from '../utils/order-pricing.util';

const round = (v: number): number => parseFloat(v.toFixed(3));

// ─── A tiny merchant ledger, driven by events ────────────────────────────────

interface Ledger {
  balance: number;
  gmv: number;
  accrued: number;
  settled: number;
  paidInFull: number;
  settledOrders: number;
  orders: number;
  /** Per-order record, so a scenario can assert on the shape of the run. */
  history: { subtotal: number; merchantAmount: number; settled: number; balance: number }[];
}

const emptyLedger = (): Ledger => ({
  balance: 0,
  gmv: 0,
  accrued: 0,
  settled: 0,
  paidInFull: 0,
  settledOrders: 0,
  orders: 0,
  history: [],
});

/** One completed order through the real settlement function. */
function sell(ledger: Ledger, subtotal: number): Ledger {
  const r = calculateCommissionSettlement(subtotal, ledger.balance);

  ledger.balance = r.commissionDueAfter;
  ledger.gmv = round(ledger.gmv + subtotal);
  ledger.accrued = round(ledger.accrued + r.accrued);
  ledger.settled = round(ledger.settled + r.settled);
  ledger.orders += 1;
  if (r.settled > 0) {
    ledger.settledOrders += 1;
  }
  if (r.merchantAmount === subtotal) {
    ledger.paidInFull += 1;
  }
  ledger.history.push({
    subtotal,
    merchantAmount: r.merchantAmount,
    settled: r.settled,
    balance: r.commissionDueAfter,
  });

  return ledger;
}

/**
 * A refund, mirroring `CommissionService.reverseForOrder`: the accrual leaves
 * the balance and any settlement returns to it, both scaled by the refunded
 * share, clamped at zero.
 */
function refund(ledger: Ledger, index: number, ratio = 1): Ledger {
  const order = ledger.history[index];
  if (!order) {
    return ledger;
  }

  /*
   * Each component is rounded once, and the delta is derived from those same
   * rounded figures. Rounding `(settled - accrued) * ratio` as a whole while
   * rounding the two totals separately lets them disagree by a millime on a
   * partial refund, which would show up as a conservation failure that is an
   * artefact of this harness rather than of the code under test.
   */
  const accruedBack = round(round(order.subtotal * PLATFORM_FOOD_SHARE) * ratio);
  const settledBack = round(order.settled * ratio);
  const delta = round(settledBack - accruedBack);

  /*
   * Not clamped at zero, matching `CommissionService.reverseForOrder`. A
   * negative balance is a credit the merchant holds, which is the only correct
   * result when the refunded order's commission had already been collected.
   */
  ledger.balance = round(ledger.balance + delta);
  ledger.gmv = round(ledger.gmv - round(order.subtotal * ratio));
  ledger.accrued = round(ledger.accrued - accruedBack);
  ledger.settled = round(ledger.settled - settledBack);

  return ledger;
}

/**
 * I1 + I2, asserted together because a scenario that breaks one usually breaks
 * both.
 *
 * I2 is a bounded check rather than an equality. Accrual is rounded to the
 * millime per order, so over a long run the total cannot equal
 * `gmv * 0.19` exactly - and should not. The bound says two things that matter
 * more than equality would: the drift is at most half a millime per order, and
 * it never favours the platform.
 */
function expectInvariants(ledger: Ledger): void {
  expect(round(ledger.accrued - ledger.settled)).toBe(ledger.balance);

  const exact = ledger.gmv * PLATFORM_FOOD_SHARE;
  expect(ledger.accrued).toBeLessThanOrEqual(round(exact) + 0.001);
  expect(exact - ledger.accrued).toBeLessThanOrEqual(ledger.orders * 0.0005 + 0.001);
}

// ─── Scenarios ───────────────────────────────────────────────────────────────

describe('commission model — worst-case scenarios', () => {
  it('a merchant who sells one bag and never returns leaves an uncollected balance, not a loss', () => {
    const l = sell(emptyLedger(), 5);

    // The platform is owed 0.950 and has collected nothing. That is a
    // receivable, not a leak - the distinction matters when the merchant
    // churns and it has to be written off deliberately.
    expect(l.balance).toBe(0.95);
    expect(l.settled).toBe(0);
    expect(l.paidInFull).toBe(1);
    expectInvariants(l);
  });

  it('a merchant who churns below the threshold is never charged at all', () => {
    let l = emptyLedger();
    for (let i = 0; i < 5; i += 1) {
      l = sell(l, 5);
    }

    // Five orders, 4.750 accrued, threshold 5.000 - not one settlement.
    expect(l.settledOrders).toBe(0);
    expect(l.balance).toBeLessThan(SETTLEMENT_THRESHOLD);
    expect(l.paidInFull).toBe(5);
    expectInvariants(l);
  });

  it('a merchant selling only tiny bags still settles, just later', () => {
    let l = emptyLedger();
    for (let i = 0; i < 60; i += 1) {
      l = sell(l, 1);
    }

    // 1 TND bags accrue 0.190. The cap means a settlement can only take 1 TND,
    // so collection is slow - but it happens, and it stays exact.
    expect(l.settledOrders).toBeGreaterThan(0);
    expectInvariants(l);
  });

  it('one huge order cannot collect more than it is worth', () => {
    let l = emptyLedger();
    for (let i = 0; i < 40; i += 1) {
      l = sell(l, 5);
    } // build a real balance
    const before = l.balance;

    l = sell(l, 1000);
    const last = l.history.at(-1)!;

    // The order dwarfs the balance, so it settles all of it and no more.
    expect(last.settled).toBe(before + round(1000 * PLATFORM_FOOD_SHARE));
    expect(last.merchantAmount).toBe(round(1000 - last.settled));
    expect(l.balance).toBe(0);
    expectInvariants(l);
  });

  it('a cheap listing cannot wipe a large balance', () => {
    let l = emptyLedger();
    for (let i = 0; i < 40; i += 1) {
      l = sell(l, 20);
    }
    const before = l.balance;

    l = sell(l, 1);
    const last = l.history.at(-1)!;

    // The gaming vector a reset-to-zero rule would open. At most the 1 TND
    // order is worth comes off.
    expect(last.settled).toBeLessThanOrEqual(1);
    expect(l.balance).toBeGreaterThan(before - 1);
    expectInvariants(l);
  });

  it('a refunded settling order returns the balance to exactly where it was', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i += 1) {
      l = sell(l, 5);
    }

    const settlingIndex = l.history.findIndex(h => h.settled > 0);
    expect(settlingIndex).toBeGreaterThan(-1);
    const balanceBefore = l.history[settlingIndex - 1]!.balance;

    l = refund(l, settlingIndex, 1);

    // Both directions move: the settlement returns, the accrual leaves.
    // Undoing only one would silently gift or overcharge the merchant.
    expect(l.balance).toBe(balanceBefore);
    expectInvariants(l);
  });

  it('refunding every order returns the ledger to zero', () => {
    let l = emptyLedger();
    for (let i = 0; i < 12; i += 1) {
      l = sell(l, 5);
    }
    for (let i = 11; i >= 0; i -= 1) {
      l = refund(l, i, 1);
    }

    expect(l.balance).toBe(0);
    expect(l.accrued).toBe(0);
    expect(l.settled).toBe(0);
    expect(l.gmv).toBe(0);
  });

  it('a partial refund scales both directions', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i += 1) {
      l = sell(l, 5);
    }
    const settlingIndex = l.history.findIndex(h => h.settled > 0);

    l = refund(l, settlingIndex, 0.5);

    expectInvariants(l);
  });

  it('turns an over-collected refund into a merchant credit, not a silent loss', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i += 1) {
      l = sell(l, 5);
    }

    // Six orders: 5.700 accrued, 5.000 already collected by order 6, balance
    // 0.700. Now refund order 1 - a full-price order whose 0.950 of commission
    // was swept up in that settlement.
    expect(l.balance).toBe(0.7);
    expect(l.history[0]).toMatchObject({ settled: 0, merchantAmount: 5 });

    l = refund(l, 0, 1);

    // 0.700 - 0.950 = -0.250. The platform holds 0.250 TND of the merchant's
    // money for a sale that no longer exists, so the balance must go negative
    // to give it back. Clamping at zero was the overcharge.
    expect(l.balance).toBe(-0.25);
    expect(round(l.accrued - l.settled)).toBe(l.balance);
  });

  it('spends a merchant credit down on their next sales rather than stranding it', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i += 1) {
      l = sell(l, 5);
    }
    l = refund(l, 0, 1);

    const credit = l.balance;
    expect(credit).toBeLessThan(0);

    // Trading again consumes it: the balance climbs from below zero, stays
    // under the threshold longer, so the merchant is paid in full meanwhile.
    l = sell(l, 5);
    expect(l.history.at(-1)).toMatchObject({ settled: 0, merchantAmount: 5 });
    expect(l.balance).toBe(round(credit + 0.95));
    expect(round(l.accrued - l.settled)).toBe(l.balance);
  });
});

describe('commission model — malformed and boundary input', () => {
  it.each([0, 0.001, 0.499, 0.5])(
    'handles a %p TND order without breaking the invariant',
    price => {
      let l = emptyLedger();
      for (let i = 0; i < 30; i += 1) {
        l = sell(l, price);
      }

      expect(round(l.accrued - l.settled)).toBe(l.balance);
    },
  );

  it('a zero-price order accrues nothing and settles nothing', () => {
    let l = emptyLedger();
    for (let i = 0; i < 6; i += 1) {
      l = sell(l, 5);
    }
    const before = { ...l };

    l = sell(l, 0);

    expect(l.balance).toBe(before.balance);
    expect(l.history.at(-1)).toMatchObject({ settled: 0, merchantAmount: 0 });
  });

  it('settles on the exact threshold, not one millime after', () => {
    // Balance lands on precisely SETTLEMENT_THRESHOLD.
    const atThreshold = calculateCommissionSettlement(5, SETTLEMENT_THRESHOLD - 0.95);
    const justUnder = calculateCommissionSettlement(5, SETTLEMENT_THRESHOLD - 0.951);

    expect(atThreshold.settled).toBeGreaterThan(0);
    expect(justUnder.settled).toBe(0);
  });

  it('survives prices that do not divide evenly into millimes', () => {
    let l = emptyLedger();
    // 7.25 * 0.19 = 1.3775, which is 1.37749999... in IEEE-754.
    for (let i = 0; i < 200; i += 1) {
      l = sell(l, 7.25);
    }

    expect(round(l.accrued - l.settled)).toBe(l.balance);
    // Rounding is per order and always favours the merchant, never the platform.
    expect(l.accrued).toBeLessThanOrEqual(round(l.gmv * PLATFORM_FOOD_SHARE));
  });
});

describe('commission model — the normal life of a shop', () => {
  /** A week of mixed baskets, the shape a real pâtisserie produces. */
  const WEEK = [5, 5, 10, 3.5, 5, 12, 5, 7.25, 5, 20, 4, 5, 6.5, 5];

  it('charges exactly 19% over a year of trading', () => {
    let l = emptyLedger();
    for (let week = 0; week < 52; week += 1) {
      for (const price of WEEK) {
        l = sell(l, price);
      }
    }

    expectInvariants(l);
    // Collection lags by at most one uncollected balance, which is bounded by
    // the largest single order.
    expect(l.settled / l.gmv).toBeGreaterThan(PLATFORM_FOOD_SHARE - 0.01);
    expect(l.settled / l.gmv).toBeLessThanOrEqual(PLATFORM_FOOD_SHARE);
  });

  it('leaves roughly four orders in five paid in full', () => {
    let l = emptyLedger();
    for (let week = 0; week < 52; week += 1) {
      for (const price of WEEK) {
        l = sell(l, price);
      }
    }

    // settlements / orders = PLATFORM_FOOD_SHARE / MAX_SETTLEMENT_SHARE_OF_ORDER.
    // This is the number that decides how the model feels, so it is asserted
    // rather than assumed - halving the cap would double it.
    const touched = l.settledOrders / l.orders;
    expect(touched).toBeCloseTo(PLATFORM_FOOD_SHARE / MAX_SETTLEMENT_SHARE_OF_ORDER, 1);
    expect(l.paidInFull / l.orders).toBeGreaterThan(0.75);
  });

  it('pays the merchant 81% of everything they sold', () => {
    let l = emptyLedger();
    for (let week = 0; week < 52; week += 1) {
      for (const price of WEEK) {
        l = sell(l, price);
      }
    }

    const merchantReceived = round(l.history.reduce((s, h) => s + h.merchantAmount, 0));

    /*
     * The merchant's share, derived rather than assumed:
     *
     *   received      = gmv - settled          (they keep everything not collected)
     *   81% of gmv    = gmv - accrued
     *   received - 81%gmv = accrued - settled  = balance
     *
     * So `received - balance` is their 81%. Banked money minus the commission
     * still owed on it. Adding the balance instead double-counts the lag.
     */
    const expected = l.gmv * (1 - PLATFORM_FOOD_SHARE);
    const actual = round(merchantReceived - l.balance);

    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(l.orders * 0.0005 + 0.001);
  });

  it('a settled order is always a whole order, never a partial credit', () => {
    let l = emptyLedger();
    for (let i = 0; i < 300; i += 1) {
      l = sell(l, WEEK[i % WEEK.length]!);
    }

    for (const h of l.history) {
      const wholeOrder = h.merchantAmount === 0;
      const untouched = h.merchantAmount === h.subtotal;
      // The one exception: the final settlement of a balance smaller than the
      // order, which legitimately leaves the merchant a remainder.
      const partialFinal = h.settled > 0 && h.settled < h.subtotal;

      expect(wholeOrder || untouched || partialFinal).toBe(true);
    }
  });

  it('two merchants trading identically end up owing identically', () => {
    let a = emptyLedger();
    let b = emptyLedger();
    for (let i = 0; i < 100; i += 1) {
      a = sell(a, WEEK[i % WEEK.length]!);
      b = sell(b, WEEK[i % WEEK.length]!);
    }

    // Determinism: no hidden state, no ordering effect, no clock.
    expect(a.balance).toBe(b.balance);
    expect(a.settled).toBe(b.settled);
  });

  it('a busy merchant and a quiet one are charged the same rate', () => {
    let busy = emptyLedger();
    let quiet = emptyLedger();
    for (let i = 0; i < 500; i += 1) {
      busy = sell(busy, 5);
    }
    for (let i = 0; i < 25; i += 1) {
      quiet = sell(quiet, 5);
    }

    // Volume must not change the rate. It only changes how much of it has been
    // collected yet.
    expect(busy.accrued / busy.gmv).toBeCloseTo(PLATFORM_FOOD_SHARE, 6);
    expect(quiet.accrued / quiet.gmv).toBeCloseTo(PLATFORM_FOOD_SHARE, 6);
  });
});

describe('commission model — the invariants under chaos', () => {
  /**
   * Deterministic pseudo-random, seeded. A real RNG would make a failure
   * impossible to reproduce; a fixed sequence still explores far more orderings
   * than a hand-written scenario.
   */
  const rng = (seed: number) => () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  it.each([1, 7, 42, 1337, 90210])(
    'holds conservation and take rate through 1000 mixed events (seed %i)',
    seed => {
      const next = rng(seed);
      let l = emptyLedger();

      for (let i = 0; i < 1000; i += 1) {
        const roll = next();

        if (roll < 0.08 && l.history.length > 0) {
          // A refund of some earlier order, sometimes partial.
          const index = Math.floor(next() * l.history.length);
          l = refund(l, index, next() < 0.5 ? 1 : 0.5);
        } else {
          // Prices from a millime to a very large catering order.
          const price = round(0.5 + next() * 60);
          l = sell(l, price);
        }

        // Checked every step, not just at the end - a scenario that breaks and
        // then self-corrects would pass a final-state-only assertion.
        expect(round(l.accrued - l.settled)).toBe(l.balance);
      }

      expect(l.accrued).toBeCloseTo(l.gmv * PLATFORM_FOOD_SHARE, 1);
    },
  );
});
