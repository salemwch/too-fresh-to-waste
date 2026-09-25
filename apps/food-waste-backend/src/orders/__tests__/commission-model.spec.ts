/**
 * The commission-settlement model - pure rules.
 *
 * Source of truth: `.claude/work/commission-settlement-model.md`. Every worked
 * example in that file is a row here, so the document and the code cannot
 * drift without a test going red.
 *
 * The model in one paragraph: a NORMAL sale pays the merchant in full and adds
 * 19% of the food subtotal to the establishment's `commissionDue`. A SETTLEMENT
 * sale adds nothing - the merchant supplies the food at a reduction of
 * `min(commissionDue, subtotal)`, and that part of the customer's payment is
 * TFTW's. Only a sale whose payment TFTW controls can settle, and "controls" is
 * decided by who collects the money (`controlledBy`), never by whether it was
 * cash (`paymentMethod`).
 *
 * RED until implementation steps 0 and 1 add `payment-control.util.ts` and
 * `commission-model.util.ts`. The DB-backed half (T2) and the driver cash
 * ledger (T4) wait on the open questions in the work file.
 */

import { BadRequestException } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';

import { CreateOrderDto } from '../DTO/create-order.dto';
import {
  commissionReversalDelta,
  decideCommission,
  type CommissionDecision,
  type ControlledBy,
} from '../utils/commission-model.util';
import { PLATFORM_FOOD_SHARE, SETTLEMENT_THRESHOLD } from '../utils/order-pricing.util';
import {
  assertPaymentMatchesFulfilment,
  resolvePaymentControl,
  SUPPORTED_PAYMENT_METHODS,
} from '../utils/payment-control.util';

const round3 = (value: number): number => parseFloat(value.toFixed(3));

// ─── T0 - payment control ───────────────────────────────────────────────────

/** Every value the create-order DTO lets through, read from its decorators. */
function dtoAcceptedPaymentMethods(): string[] {
  const metadata = getMetadataStorage().getTargetValidationMetadatas(
    CreateOrderDto,
    '',
    true,
    false,
  );
  const isEnum = metadata.find(m => m.propertyName === 'paymentMethod' && m.name === 'isEnum');
  if (!isEnum) {
    throw new Error('CreateOrderDto.paymentMethod has no @IsEnum - this test cannot enumerate it');
  }
  return Object.values(isEnum.constraints[0] as Record<string, string>);
}

describe('resolvePaymentControl', () => {
  it.each([
    ['cash_on_pickup', 'MERCHANT', 'MERCHANT'],
    ['pay_on_delivery', 'TFTW', 'DRIVER'],
    ['online', 'TFTW', 'PAYMENT_GATEWAY'],
  ])('%s is controlled by %s, collected by %s', (method, controlledBy, collector) => {
    expect(resolvePaymentControl(method)).toEqual({ controlledBy, collector });
  });

  it('treats pay-on-delivery as TFTW money although it is cash', () => {
    // The rule this whole table exists for: control follows the collector.
    expect(resolvePaymentControl('pay_on_delivery').controlledBy).toBe('TFTW');
    expect(resolvePaymentControl('cash_on_pickup').controlledBy).toBe('MERCHANT');
  });

  it.each(['stripe', 'paypal', 'apple_pay', 'google_pay', '', undefined, null, 'CASH'])(
    'rejects %p rather than guessing who holds the money',
    method => {
      // Defaulting to MERCHANT would record an unpaid order as a paid cash
      // sale; defaulting to TFTW could settle against money nobody collected.
      expect(() => resolvePaymentControl(method)).toThrow(BadRequestException);
    },
  );

  it('says why in words a customer can read', () => {
    try {
      resolvePaymentControl('stripe');
      throw new Error('expected a rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const message = String((error as BadRequestException).message);
      expect(message).not.toMatch(/controlledBy|enum|dto|undefined/i);
    }
  });

  it.each(dtoAcceptedPaymentMethods())(
    'places %s explicitly: supported with a control, or rejected',
    method => {
      // A method added to the DTO later fails here until someone decides who
      // collects its money.
      if (SUPPORTED_PAYMENT_METHODS.includes(method)) {
        expect(() => resolvePaymentControl(method)).not.toThrow();
        expect(['TFTW', 'MERCHANT']).toContain(resolvePaymentControl(method).controlledBy);
      } else {
        expect(() => resolvePaymentControl(method)).toThrow(BadRequestException);
      }
    },
  );

  it.each([
    ['cash_on_pickup', 'pickup'],
    ['pay_on_delivery', 'delivery'],
    ['online', 'pickup'],
    ['online', 'delivery'],
  ])('accepts %s with %s', (method, mode) => {
    expect(() =>
      assertPaymentMatchesFulfilment(method, mode as 'pickup' | 'delivery'),
    ).not.toThrow();
  });

  it.each([
    // Cash at the counter on a delivery order: nobody at the counter is the
    // customer, so "the merchant collects" would be false.
    ['cash_on_pickup', 'delivery'],
    // Pay on delivery for a pickup order: no driver exists to collect it.
    ['pay_on_delivery', 'pickup'],
  ])('rejects %s with %s - controlledBy would name the wrong collector', (method, mode) => {
    expect(() => assertPaymentMatchesFulfilment(method, mode as 'pickup' | 'delivery')).toThrow(
      BadRequestException,
    );
  });

  it('supports exactly the three methods the mobile checkout sends', () => {
    expect([...SUPPORTED_PAYMENT_METHODS].sort()).toEqual(
      ['cash_on_pickup', 'online', 'pay_on_delivery'].sort(),
    );
  });
});

// ─── T1 - the commission rule ───────────────────────────────────────────────

type Row = readonly [
  id: string,
  dueBefore: number,
  subtotal: number,
  controlledBy: ControlledBy,
  kind: CommissionDecision['kind'],
  accrued: number,
  settled: number,
  merchantAmount: number,
  dueAfter: number,
];

/** The worked examples in the work file, row for row. */
const EXAMPLES: readonly Row[] = [
  ['#1 cash pickup, no balance', 0, 10, 'MERCHANT', 'NORMAL', 1.9, 0, 10, 1.9],
  [
    '#2 cash pickup never settles, however large the balance',
    20,
    10,
    'MERCHANT',
    'NORMAL',
    1.9,
    0,
    10,
    21.9,
  ],
  ['#3 online, no balance', 0, 10, 'TFTW', 'NORMAL', 1.9, 0, 10, 1.9],
  ['#4 online, balance under the threshold', 3, 10, 'TFTW', 'NORMAL', 1.9, 0, 10, 4.9],
  ['#5 online, one millime under the threshold', 4.99, 10, 'TFTW', 'NORMAL', 1.9, 0, 10, 6.89],
  ['#6 online settles the whole balance', 5, 10, 'TFTW', 'SETTLEMENT', 0, 5, 5, 0],
  [
    '#7 online settles the whole sale, balance carries forward',
    20,
    10,
    'TFTW',
    'SETTLEMENT',
    0,
    10,
    0,
    10,
  ],
  [
    '#8 pay-on-delivery settlement worth exactly the balance',
    57,
    57,
    'TFTW',
    'SETTLEMENT',
    0,
    57,
    0,
    0,
  ],
  ['#9 online with a credit balance', -3, 10, 'TFTW', 'NORMAL', 1.9, 0, 10, -1.1],
  ['#10 pay-on-delivery settles', 5, 10, 'TFTW', 'SETTLEMENT', 0, 5, 5, 0],
  ['#11 pay-on-delivery under the threshold', 3, 10, 'TFTW', 'NORMAL', 1.9, 0, 10, 4.9],
  [
    '#12 cash pickup with the same balance as #10 does not settle',
    5,
    10,
    'MERCHANT',
    'NORMAL',
    1.9,
    0,
    10,
    6.9,
  ],
  // #13 (10 food + 4 delivery fee) is the same call as #3: the fee never
  // reaches this function - `subtotal` is food only. Asserted separately below.
];

describe('decideCommission', () => {
  it.each(EXAMPLES)(
    '%s',
    (_id, dueBefore, subtotal, controlledBy, kind, accrued, settled, merchantAmount, dueAfter) => {
      expect(decideCommission({ subtotal, commissionDue: dueBefore, controlledBy })).toEqual({
        kind,
        controlledBy,
        accrued,
        settled,
        merchantAmount,
        dueBefore,
        dueAfter,
      });
    },
  );

  it('#10 vs #12: same cash, same amount, same balance - only the collector decides', () => {
    const tftw = decideCommission({ subtotal: 10, commissionDue: 5, controlledBy: 'TFTW' });
    const merchant = decideCommission({ subtotal: 10, commissionDue: 5, controlledBy: 'MERCHANT' });

    expect(tftw.kind).toBe('SETTLEMENT');
    expect(merchant.kind).toBe('NORMAL');
  });

  it('never reads the payment method, even when one is passed', () => {
    // A caller that sneaks `paymentMethod` in must not change the outcome:
    // eligibility is controlledBy alone.
    const input = {
      subtotal: 10,
      commissionDue: 5,
      controlledBy: 'TFTW' as const,
      paymentMethod: 'cash_on_pickup',
    };
    expect(decideCommission(input).kind).toBe('SETTLEMENT');
  });

  it('never both accrues and settles on one order', () => {
    for (const due of [-10, 0, 4.999, 5, 5.001, 19, 57, 500]) {
      for (const subtotal of [0, 0.5, 5, 10, 57]) {
        for (const controlledBy of ['TFTW', 'MERCHANT'] as const) {
          const d = decideCommission({ subtotal, commissionDue: due, controlledBy });
          expect(d.accrued > 0 && d.settled > 0).toBe(false);
        }
      }
    }
  });

  it.each([0, 4.99, 5, 100])('MERCHANT never settles at a balance of %p', due => {
    const d = decideCommission({ subtotal: 10, commissionDue: due, controlledBy: 'MERCHANT' });
    expect(d.kind).toBe('NORMAL');
    expect(d.settled).toBe(0);
    expect(d.merchantAmount).toBe(10);
  });

  it('settles at exactly the threshold and not one millime below it', () => {
    const at = decideCommission({
      subtotal: 10,
      commissionDue: SETTLEMENT_THRESHOLD,
      controlledBy: 'TFTW',
    });
    const below = decideCommission({
      subtotal: 10,
      commissionDue: round3(SETTLEMENT_THRESHOLD - 0.001),
      controlledBy: 'TFTW',
    });

    expect(at.kind).toBe('SETTLEMENT');
    expect(below.kind).toBe('NORMAL');
  });

  it('accrues 19% of food only - the delivery fee never enters (#13)', () => {
    // 10 TND food + 4 TND delivery: the caller passes pricing.subtotal (10),
    // never pricing.total (14).
    const d = decideCommission({ subtotal: 10, commissionDue: 0, controlledBy: 'TFTW' });
    expect(d.accrued).toBe(1.9);
    expect(d.accrued).not.toBe(round3(14 * PLATFORM_FOOD_SHARE));
  });

  it('handles a zero-value sale without anything going negative', () => {
    for (const due of [0, 10]) {
      const d = decideCommission({ subtotal: 0, commissionDue: due, controlledBy: 'TFTW' });
      expect(d.accrued).toBe(0);
      expect(d.settled).toBe(0);
      expect(d.merchantAmount).toBe(0);
      expect(d.kind).toBe('NORMAL');
      expect(d.dueAfter).toBe(due);
    }
  });

  it('rounds the accrual to the millime', () => {
    // 7.35 * 0.19 = 1.3965 exactly; 1.3965 in IEEE 754 sits either side of the
    // half - whatever it does, the result has at most 3 decimals.
    const d = decideCommission({ subtotal: 7.35, commissionDue: 0, controlledBy: 'TFTW' });
    expect(d.accrued).toBe(round3(d.accrued));
  });
});

// ─── Refunds ────────────────────────────────────────────────────────────────

describe('commissionReversalDelta', () => {
  const decisionFor = (id: string): CommissionDecision => {
    const row = EXAMPLES.find(r => r[0].startsWith(id));
    if (!row) {
      throw new Error(`no example ${id}`);
    }
    return decideCommission({ subtotal: row[2], commissionDue: row[1], controlledBy: row[3] });
  };

  it.each([
    ['R1 full refund of a NORMAL sale takes its accrual back', '#1', 1, -1.9, 0],
    ['R2 full refund of a settlement restores the debt it paid', '#6', 1, 5, 5],
    ['R3 full refund of a partial settlement restores exactly what it took', '#7', 1, 10, 20],
    ['R4 half refund of a settlement restores half', '#6', 0.5, 2.5, 2.5],
  ])('%s', (_label, id, ratio, delta, dueAfterRefund) => {
    const d = decisionFor(id);
    expect(commissionReversalDelta(d, ratio)).toBe(delta);
    expect(round3(d.dueAfter + commissionReversalDelta(d, ratio))).toBe(dueAfterRefund);
  });

  it.each([0, -1, Number.NaN])('treats a refund ratio of %p as no refund', ratio => {
    expect(commissionReversalDelta(decisionFor('#6'), ratio)).toBe(0);
  });

  it('caps the ratio at a full refund', () => {
    expect(commissionReversalDelta(decisionFor('#6'), 3)).toBe(5);
  });
});

// ─── Invariants over a long run ─────────────────────────────────────────────

/** Deterministic PRNG so a failure reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the model over 10,000 mixed sales', () => {
  const random = mulberry32(20260924);
  const METHODS = ['cash_on_pickup', 'pay_on_delivery', 'online'] as const;

  let due = 0;
  let sumBalanceDelta = 0;
  let normalSubtotal = 0;
  let sumAccrued = 0;
  let sumSettled = 0;
  let sumReversed = 0;
  const applied: CommissionDecision[] = [];
  const violations: string[] = [];

  for (let i = 0; i < 10_000; i++) {
    // 5% of events refund an earlier sale in full.
    if (applied.length > 0 && random() < 0.05) {
      const index = Math.floor(random() * applied.length);
      const refunded = applied.splice(index, 1)[0] as CommissionDecision;
      const delta = commissionReversalDelta(refunded, 1);
      due = round3(due + delta);
      sumBalanceDelta = round3(sumBalanceDelta + delta);
      sumReversed = round3(sumReversed + delta);
      if (refunded.kind === 'NORMAL') {
        normalSubtotal = round3(normalSubtotal - refunded.merchantAmount);
      }
      continue;
    }

    const subtotal = round3(1 + Math.floor(random() * 58) * 0.5); // 1.0 .. 29.5
    const method = METHODS[Math.floor(random() * METHODS.length)] as (typeof METHODS)[number];
    const { controlledBy } = resolvePaymentControl(method);
    const d = decideCommission({ subtotal, commissionDue: due, controlledBy });

    const check = (ok: boolean, what: string) => {
      if (!ok) {
        violations.push(`event ${i}: ${what} ${JSON.stringify(d)}`);
      }
    };
    check(d.dueBefore === due, 'dueBefore is the running balance');
    check(
      round3(d.merchantAmount + d.settled) === subtotal,
      'merchantAmount + settled == subtotal',
    );
    check(d.settled <= subtotal, 'settled <= subtotal');
    check(!(d.accrued > 0 && d.settled > 0), 'never both accrue and settle');
    check(d.dueAfter === round3(d.dueBefore + d.accrued - d.settled), 'dueAfter arithmetic');
    check(d.kind !== 'SETTLEMENT' || d.controlledBy === 'TFTW', 'only TFTW settles');
    check(d.kind !== 'SETTLEMENT' || d.dueBefore >= SETTLEMENT_THRESHOLD, 'threshold');
    check(d.kind !== 'SETTLEMENT' || d.settled <= d.dueBefore, 'never settles more than is owed');
    check(
      d.kind !== 'NORMAL' || d.accrued === round3(subtotal * PLATFORM_FOOD_SHARE),
      '19% of NORMAL',
    );
    check(d.kind !== 'NORMAL' || d.merchantAmount === subtotal, 'NORMAL pays in full');
    check(controlledBy === 'TFTW' || d.settled === 0, 'merchant-collected cash never settles');

    due = d.dueAfter;
    sumBalanceDelta = round3(sumBalanceDelta + d.accrued - d.settled);
    sumAccrued = round3(sumAccrued + d.accrued);
    sumSettled = round3(sumSettled + d.settled);
    if (d.kind === 'NORMAL') {
      normalSubtotal = round3(normalSubtotal + subtotal);
    }
    applied.push(d);
  }

  it('holds every per-order invariant after every event', () => {
    expect(violations).toEqual([]);
  });

  it('conserves the balance: it is exactly the sum of its movements', () => {
    expect(due).toBe(sumBalanceDelta);
    expect(due).toBe(round3(sumAccrued - sumSettled + sumReversed));
  });

  it('accrues 19% of NORMAL sales still standing, to rounding', () => {
    const standingAccrued = applied
      .filter(d => d.kind === 'NORMAL')
      .reduce((sum, d) => sum + d.accrued, 0);
    // Per-order rounding: at most half a millime per order.
    const tolerance = applied.length * 0.0005;
    expect(Math.abs(standingAccrued - normalSubtotal * PLATFORM_FOOD_SHARE)).toBeLessThanOrEqual(
      tolerance,
    );
  });

  it('actually exercised every path it claims to cover', () => {
    // A run that never settled, or never saw cash, would pass the invariants
    // vacuously.
    expect(applied.some(d => d.kind === 'SETTLEMENT')).toBe(true);
    expect(applied.some(d => d.kind === 'SETTLEMENT' && d.merchantAmount > 0)).toBe(true);
    expect(applied.some(d => d.kind === 'SETTLEMENT' && d.merchantAmount === 0)).toBe(true);
    expect(applied.some(d => d.controlledBy === 'MERCHANT' && d.dueBefore >= 5)).toBe(true);
    expect(sumReversed).not.toBe(0);
  });
});
