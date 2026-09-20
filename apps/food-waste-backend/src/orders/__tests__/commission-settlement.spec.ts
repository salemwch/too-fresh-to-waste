/**
 * Commission settlement - the merchant keeps the full price, the 19% accrues.
 *
 * The merchant is credited the **full** subtotal on almost every order. The
 * platform's 19% is not deducted per order; it accrues into a per-establishment
 * balance and is collected in occasional lumps from later orders. The take rate
 * is unchanged. Only the shape of collection is.
 *
 * ## The bug this pins down
 *
 * The obvious rule is wrong, and wrong in a way that no type-checker, and no
 * test of a single order, can see:
 *
 * > "When the balance reaches the price of a bag, the next order goes entirely
 * > to the platform. That order's money is already ours, so we don't charge
 * > commission on it."
 *
 * That rule collects **15.97%**, not 19%. It is self-consistent, it never loses
 * a millime it has accrued, and every single-order assertion about it passes.
 * The leak is only visible in aggregate: skipping the accrual on settling
 * orders means one settlement per 6.26 orders instead of per 5.26.
 *
 * The balance is a **debt counter**, not revenue. A settling order is still a
 * sale - a customer paid for a bag - so it owes 19% like every other sale. The
 * settlement pays off *prior* debt; it does not exempt *this* sale.
 *
 * `naive` below is that wrong rule, kept as an executable counter-example.
 * Deleting it would leave the doc comment in `order-pricing.util.ts` as the only
 * record of why the accrual is unconditional, and a comment is a claim, not
 * evidence.
 *
 * ## What is asserted
 *
 * - Conservation: `sum(accrued) - sum(settled) === commissionDue`, exactly.
 *   Nothing is discarded, which is why the balance is decremented rather than
 *   reset.
 * - Convergence: collected / GMV → 0.19 over a long run of mixed prices.
 * - The merchant is never credited zero (the 50% cap).
 * - The balance never goes negative.
 */

import {
  MAX_SETTLEMENT_SHARE_OF_ORDER,
  PLATFORM_FOOD_SHARE,
  SETTLEMENT_THRESHOLD,
  calculateCommissionSettlement,
} from '../utils/order-pricing.util';

/** TND is quoted to three decimals. Mirrors `round()` in the util. */
const round = (value: number): number => parseFloat(value.toFixed(3));

describe('calculateCommissionSettlement', () => {
  describe('the common case - merchant is credited the full price', () => {
    it('credits the full subtotal while the balance is below the threshold', () => {
      const result = calculateCommissionSettlement(5, 0);

      expect(result.merchantAmount).toBe(5);
      expect(result.settled).toBe(0);
      expect(result.accrued).toBe(0.95);
      expect(result.commissionDueAfter).toBe(0.95);
    });

    it('still credits the full subtotal one millime below the threshold', () => {
      // Balance lands on 4.999, which must not settle.
      const result = calculateCommissionSettlement(5, SETTLEMENT_THRESHOLD - 0.951);

      expect(result.commissionDueAfter).toBe(4.999);
      expect(result.settled).toBe(0);
      expect(result.merchantAmount).toBe(5);
    });
  });

  describe('accrual is unconditional', () => {
    it('accrues on an order that also settles', () => {
      // Balance 5.700 after accrual -> settles. The accrual must still be there.
      const result = calculateCommissionSettlement(5, 4.75);

      expect(result.accrued).toBe(0.95);
      expect(result.settled).toBe(2.5);
      // 4.750 + 0.950 - 2.500
      expect(result.commissionDueAfter).toBe(3.2);
    });

    it('never returns a zero accrual for a non-zero subtotal', () => {
      for (const subtotal of [0.5, 5, 12.75, 100]) {
        for (const due of [0, 4.9, 5, 50]) {
          expect(calculateCommissionSettlement(subtotal, due).accrued).toBe(
            round(subtotal * PLATFORM_FOOD_SHARE),
          );
        }
      }
    });
  });

  describe('the 50% cap - the merchant is never credited zero', () => {
    it('caps settlement at half the order even when the balance dwarfs it', () => {
      const result = calculateCommissionSettlement(10, 500);

      expect(result.settled).toBe(5);
      expect(result.merchantAmount).toBe(5);
      // 500 + 1.900 - 5
      expect(result.commissionDueAfter).toBe(496.9);
    });

    it.each([0.5, 1, 5, 7.25, 10, 99.99])(
      'credits at least half of a %p TND order against any balance',
      subtotal => {
        for (const due of [0, 5, 20, 1000]) {
          const { merchantAmount } = calculateCommissionSettlement(subtotal, due);

          expect(merchantAmount).toBeGreaterThanOrEqual(
            round(subtotal * (1 - MAX_SETTLEMENT_SHARE_OF_ORDER)) - 0.001,
          );
        }
      },
    );

    it('settles only what is owed when the balance is under the cap', () => {
      // Balance 5.200 after accrual; cap on a 20 TND order is 10.
      const result = calculateCommissionSettlement(20, 1.4);

      expect(result.settled).toBe(5.2);
      expect(result.commissionDueAfter).toBe(0);
      expect(result.merchantAmount).toBe(14.8);
    });
  });

  describe('balance is decremented, never reset', () => {
    it('carries the remainder forward instead of discarding it', () => {
      const result = calculateCommissionSettlement(5, 10);

      // 10 + 0.950 = 10.950, cap takes 2.500, 8.450 carries.
      expect(result.settled).toBe(2.5);
      expect(result.commissionDueAfter).toBe(8.45);
    });

    it('does not let a cheap order wipe a large balance', () => {
      // The gaming vector a reset-to-zero rule would open.
      const result = calculateCommissionSettlement(1, 40);

      expect(result.settled).toBe(0.5);
      expect(result.commissionDueAfter).toBe(39.69);
    });
  });

  describe('boundaries', () => {
    it('settles exactly at the threshold', () => {
      const result = calculateCommissionSettlement(5, SETTLEMENT_THRESHOLD - 0.95);

      expect(result.commissionDueAfter + result.settled).toBe(SETTLEMENT_THRESHOLD);
      expect(result.settled).toBe(2.5);
    });

    it('handles a zero subtotal without settling or going negative', () => {
      const result = calculateCommissionSettlement(0, 20);

      expect(result.accrued).toBe(0);
      expect(result.settled).toBe(0);
      expect(result.merchantAmount).toBe(0);
      expect(result.commissionDueAfter).toBe(20);
    });

    it('never returns a negative balance', () => {
      for (const subtotal of [0, 0.001, 5, 1000]) {
        for (const due of [0, 0.001, 4.999, 5, 10_000]) {
          expect(
            calculateCommissionSettlement(subtotal, due).commissionDueAfter,
          ).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  /**
   * The worked example from `.claude/work/merchant-commission-wallet.md`.
   * Driven as a running sequence rather than independent rows, so a change that
   * breaks the carry-forward fails here even if each row still looks right.
   */
  describe('worked example - eight 5 TND orders', () => {
    it('matches the spec table and conserves every millime', () => {
      const expected = [
        { settled: 0, merchant: 5, after: 0.95 },
        { settled: 0, merchant: 5, after: 1.9 },
        { settled: 0, merchant: 5, after: 2.85 },
        { settled: 0, merchant: 5, after: 3.8 },
        { settled: 0, merchant: 5, after: 4.75 },
        { settled: 2.5, merchant: 2.5, after: 3.2 },
        { settled: 0, merchant: 5, after: 4.15 },
        { settled: 2.5, merchant: 2.5, after: 2.6 },
      ];

      let due = 0;
      let accruedTotal = 0;
      let settledTotal = 0;
      const actual: typeof expected = [];

      for (let i = 0; i < expected.length; i += 1) {
        const result = calculateCommissionSettlement(5, due);

        actual.push({
          settled: result.settled,
          merchant: result.merchantAmount,
          after: result.commissionDueAfter,
        });

        accruedTotal = round(accruedTotal + result.accrued);
        settledTotal = round(settledTotal + result.settled);
        due = result.commissionDueAfter;
      }

      // Compared as a whole sequence: a broken carry-forward shows up as the
      // row where the two lists diverge, not as eight separate failures.
      expect(actual).toEqual(expected);

      expect(accruedTotal).toBe(7.6);
      expect(settledTotal).toBe(5);
      expect(round(accruedTotal - settledTotal)).toBe(due);
    });
  });

  describe('long run', () => {
    /** Deterministic mixed basket - no RNG, so a failure is reproducible. */
    const PRICES = [5, 10, 3.5, 7.25, 15, 4, 12, 6.5, 2, 20];

    const simulate = (orderCount: number) => {
      let due = 0;
      let gmv = 0;
      let accrued = 0;
      let collected = 0;
      let minMerchantShare = 1;

      for (let i = 0; i < orderCount; i += 1) {
        const subtotal = PRICES[i % PRICES.length]!;
        const result = calculateCommissionSettlement(subtotal, due);

        gmv = round(gmv + subtotal);
        accrued = round(accrued + result.accrued);
        collected = round(collected + result.settled);
        minMerchantShare = Math.min(minMerchantShare, result.merchantAmount / subtotal);
        due = result.commissionDueAfter;
      }

      return { due, gmv, accrued, collected, minMerchantShare };
    };

    it('conserves exactly: accrued minus collected is the outstanding balance', () => {
      const { accrued, collected, due } = simulate(1000);

      expect(round(accrued - collected)).toBe(due);
    });

    it('converges on a 19% take rate', () => {
      const { gmv, accrued, collected, due } = simulate(2000);

      // Everything accrued is either collected or still owed. Exact.
      expect(round(collected + due)).toBe(accrued);

      // The residual balance is bounded, so the realised rate sits at 19%.
      expect(collected / gmv).toBeGreaterThan(0.185);
      expect(collected / gmv).toBeLessThanOrEqual(0.19);
    });

    /**
     * Accrual is rounded to the millime per order, so the running total cannot
     * equal `GMV * 0.19` exactly - and should not. `7.25 * 0.19` is `1.3775`
     * in decimal but `1.37749999...` in IEEE-754, so it rounds *down* to
     * `1.377`, losing half a millime each time it occurs.
     *
     * This is the correct trade: a merchant is never billed a fraction of a
     * millime. The drift is bounded at half a millime per order and always
     * favours the merchant. Pinned so that a future change to the rounding
     * strategy is a deliberate decision rather than a surprise.
     */
    it('loses at most half a millime per order to rounding, never in the platform’s favour', () => {
      const orderCount = 2000;
      const { gmv, accrued } = simulate(orderCount);
      const exact = gmv * PLATFORM_FOOD_SHARE;

      expect(accrued).toBeLessThanOrEqual(round(exact));
      expect(exact - accrued).toBeLessThanOrEqual(orderCount * 0.0005);
      expect(Math.abs(accrued / gmv - PLATFORM_FOOD_SHARE)).toBeLessThan(0.0001);
    });

    it('never credits a merchant less than half of any order', () => {
      expect(simulate(2000).minMerchantShare).toBeGreaterThanOrEqual(
        1 - MAX_SETTLEMENT_SHARE_OF_ORDER,
      );
    });

    /**
     * Executable counter-example. This is the rule that feels obviously right
     * and collects 16%. It is not production code and must never become any.
     *
     * Rule: when the balance covers a whole bag, that order goes entirely to
     * the platform and does **not** accrue commission.
     */
    it('documents why skipping accrual on a settling order collects 16%, not 19%', () => {
      let due = 0;
      let gmv = 0;
      let collected = 0;

      for (let i = 0; i < 2000; i += 1) {
        const subtotal = PRICES[i % PRICES.length]!;
        gmv = round(gmv + subtotal);

        if (due >= subtotal) {
          due = round(due - subtotal);
          collected = round(collected + subtotal);
        } else {
          due = round(due + subtotal * PLATFORM_FOOD_SHARE);
        }
      }

      const naiveRate = collected / gmv;

      expect(naiveRate).toBeLessThan(0.17);
      expect(naiveRate).toBeGreaterThan(0.15);

      // The real rule, on the identical basket, reaches 19%.
      const {
        collected: realCollected,
        due: realDue,
        accrued: realAccrued,
        gmv: realGmv,
      } = simulate(2000);

      expect(round(realCollected + realDue)).toBe(realAccrued);
      expect(realCollected / realGmv).toBeGreaterThan(naiveRate + 0.02);
    });
  });
});
