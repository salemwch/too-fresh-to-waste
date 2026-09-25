import { PLATFORM_FOOD_SHARE, SETTLEMENT_THRESHOLD } from './order-pricing.util';

import type { ControlledBy } from './payment-control.util';

export type { ControlledBy } from './payment-control.util';

/**
 * The commission-settlement rule. Source of truth:
 * `.claude/work/commission-settlement-model.md`; every worked example in it is
 * a row in `orders/__tests__/commission-model.spec.ts`.
 *
 * - **NORMAL** - the merchant is paid the full subtotal, and 19% of it is
 *   added to the establishment's `commissionDue`.
 * - **SETTLEMENT** - the merchant supplies the food at a reduction of
 *   `min(commissionDue, subtotal)`; that part of the customer's payment is
 *   TFTW's. It adds **no** 19%: a settlement converts commission already
 *   earned on earlier NORMAL sales into cash; it is not a new sale for TFTW.
 *
 * An order is never both. Only a TFTW-controlled payment can settle, and only
 * once the balance before the order has reached the threshold.
 *
 * Deliberately takes no payment method: eligibility is `controlledBy` alone,
 * so it cannot be read from "was it cash".
 */

export type CommissionKind = 'NORMAL' | 'SETTLEMENT';

export interface CommissionInput {
  /** `order.pricing.subtotal` - food only, never `pricing.total`. */
  subtotal: number;
  /** The establishment's balance before this order. May be negative (credit). */
  commissionDue: number;
  controlledBy: ControlledBy;
}

export interface CommissionDecision {
  kind: CommissionKind;
  controlledBy: ControlledBy;
  /** This order's 19%. 0 on a SETTLEMENT. */
  accrued: number;
  /** Balance recovered from this order. 0 on a NORMAL. */
  settled: number;
  /** What the merchant is paid for this order: `subtotal - settled`. */
  merchantAmount: number;
  dueBefore: number;
  dueAfter: number;
}

/** TND is quoted to the millime. */
const round3 = (value: number): number => parseFloat(value.toFixed(3));

const finiteOrZero = (value: number): number => (Number.isFinite(value) ? value : 0);

export function decideCommission(input: CommissionInput): CommissionDecision {
  const subtotal = Math.max(0, round3(finiteOrZero(input.subtotal)));
  const dueBefore = round3(finiteOrZero(input.commissionDue));
  const { controlledBy } = input;

  /*
   * A zero-value sale has nothing to settle with, so it is NORMAL even above
   * the threshold - "SETTLEMENT with settled 0" would break the invariant that
   * a settlement always recovers something.
   */
  const settles = controlledBy === 'TFTW' && dueBefore >= SETTLEMENT_THRESHOLD && subtotal > 0;

  if (settles) {
    const settled = round3(Math.min(dueBefore, subtotal));
    return {
      kind: 'SETTLEMENT',
      controlledBy,
      accrued: 0,
      settled,
      merchantAmount: round3(subtotal - settled),
      dueBefore,
      dueAfter: round3(dueBefore - settled),
    };
  }

  const accrued = round3(subtotal * PLATFORM_FOOD_SHARE);
  return {
    kind: 'NORMAL',
    controlledBy,
    accrued,
    settled: 0,
    merchantAmount: subtotal,
    dueBefore,
    dueAfter: round3(dueBefore + accrued),
  };
}

/**
 * How a refund moves `commissionDue`: the refunded share of this order's
 * accrual leaves the balance, and the refunded share of what it settled comes
 * back. One of the two terms is always 0 now, but the formula needs no branch.
 *
 * @param refundRatio 1 for a full refund, `refunded / subtotal` for a partial.
 *        Non-finite or non-positive means no refund; above 1 is capped at 1.
 */
export function commissionReversalDelta(
  decision: Pick<CommissionDecision, 'accrued' | 'settled'>,
  refundRatio: number,
): number {
  if (!Number.isFinite(refundRatio) || refundRatio <= 0) {
    return 0;
  }
  const ratio = Math.min(refundRatio, 1);
  return round3((decision.settled - decision.accrued) * ratio);
}
