/**
 * Driver cash - the pure rules. Source of truth: "Driver cash" and "Failed
 * deliveries" in `.claude/work/commission-settlement-model.md`; every worked
 * row there is a row here.
 *
 * The driver runs on a TFTW float. At merchant pickup they pay the merchant
 * `merchantAmount` from it - for every delivery, online or cash. On delivery
 * they collect what the payment method says, keep their 80% of the fee, and
 * owe TFTW the rest. `dueToTftw` is signed: negative means TFTW owes the
 * driver (an online delivery drains the float and brings in no cash).
 */

import {
  allocateHandover,
  buildMerchantPickupCash,
  recordCollection,
  recordFailure,
  resolveRecovery,
  type DeliveryCashFigures,
} from '../utils/driver-cash.util';

/** Fee 4: driver 3.20 (80%), TFTW 0.80. */
const FEE = { deliveryFee: 4, driverEarnings: 3.2, platformDeliveryCommission: 0.8 };

const pickup = (
  method: 'pay_on_delivery' | 'online',
  subtotal: number,
  commission: { kind: 'NORMAL' | 'SETTLEMENT'; settled: number; merchantAmount: number },
) =>
  buildMerchantPickupCash({
    paymentMethod: method,
    subtotal,
    total: subtotal + FEE.deliveryFee,
    ...FEE,
    commission,
  });

const NORMAL_10 = { kind: 'NORMAL' as const, settled: 0, merchantAmount: 10 };
const SETTLE_5_OF_10 = { kind: 'SETTLEMENT' as const, settled: 5, merchantAmount: 5 };
const SETTLE_57_OF_57 = { kind: 'SETTLEMENT' as const, settled: 57, merchantAmount: 0 };

describe('buildMerchantPickupCash - what is frozen when the driver collects the food', () => {
  it.each([
    ['COD NORMAL 10', 'pay_on_delivery', 10, NORMAL_10, 10, 14],
    ['COD SETTLEMENT due 5, 10', 'pay_on_delivery', 10, SETTLE_5_OF_10, 5, 14],
    ['COD full settlement 57', 'pay_on_delivery', 57, SETTLE_57_OF_57, 0, 61],
    ['online NORMAL 10 - customer already paid TFTW', 'online', 10, NORMAL_10, 10, 0],
    ['online SETTLEMENT due 5, 10', 'online', 10, SETTLE_5_OF_10, 5, 0],
  ] as const)('%s', (_label, method, subtotal, commission, payMerchant, expectedCash) => {
    const cash = pickup(method, subtotal, commission);

    expect(cash.paidToMerchant).toBe(payMerchant);
    expect(cash.expectedCash).toBe(expectedCash);
    expect(cash.driverKeeps).toBe(3.2);
    expect(cash.tftwDeliveryRevenue).toBe(0.8);
    expect(cash.tftwSettlement).toBe(commission.settled);
    expect(cash.status).toBe('EXPECTED');
  });

  it('pays the merchant from the float on an online order too - never a later transfer', () => {
    expect(pickup('online', 10, NORMAL_10).paidToMerchant).toBe(10);
  });

  it('gives the driver instruction the app shows, with nothing left to compute', () => {
    const cash = pickup('pay_on_delivery', 10, SETTLE_5_OF_10);

    expect(cash.instruction).toEqual({ payMerchant: 5, collectFromCustomer: 14, driverKeeps: 3.2 });
  });

  it('rejects a pickup-only payment method - there is no driver to collect it', () => {
    expect(() =>
      buildMerchantPickupCash({
        paymentMethod: 'cash_on_pickup' as never,
        subtotal: 10,
        total: 14,
        ...FEE,
        commission: NORMAL_10,
      }),
    ).toThrow();
  });
});

describe('recordCollection - the driver confirms what the customer paid', () => {
  it.each([
    ['COD NORMAL 10', 'pay_on_delivery', 10, NORMAL_10, 14, 0.8],
    ['COD SETTLEMENT due 5, 10', 'pay_on_delivery', 10, SETTLE_5_OF_10, 14, 5.8],
    ['COD full settlement 57', 'pay_on_delivery', 57, SETTLE_57_OF_57, 61, 57.8],
    ['online NORMAL 10', 'online', 10, NORMAL_10, 0, -13.2],
    ['online SETTLEMENT due 5, 10', 'online', 10, SETTLE_5_OF_10, 0, -8.2],
  ] as const)('%s', (_label, method, subtotal, commission, collected, dueToTftw) => {
    const done = recordCollection(pickup(method, subtotal, commission), collected);

    expect(done.collectedCash).toBe(collected);
    expect(done.dueToTftw).toBe(dueToTftw);
    expect(done.outstandingCash).toBe(dueToTftw);
    expect(done.status).toBe('COLLECTED');
  });

  it('splits what TFTW is owed into delivery revenue and settlement', () => {
    const done = recordCollection(pickup('pay_on_delivery', 10, SETTLE_5_OF_10), 14);

    expect(done.tftwDeliveryRevenue + done.tftwSettlement).toBe(done.dueToTftw);
  });

  it('reconciles an online order against what TFTW already holds', () => {
    // TFTW holds 14 from the customer; the driver is owed 13.20 back.
    const done = recordCollection(pickup('online', 10, NORMAL_10), 0);

    expect(14 + done.dueToTftw).toBeCloseTo(done.tftwDeliveryRevenue + done.tftwSettlement, 3);
  });

  it('marks a short collection SHORT and computes from what was actually collected', () => {
    const done = recordCollection(pickup('pay_on_delivery', 10, NORMAL_10), 12);

    expect(done.status).toBe('SHORT');
    expect(done.shortfall).toBe(2);
    expect(done.dueToTftw).toBe(-1.2); // 12 - 10 - 3.20
  });

  it('refuses an online order claiming cash was collected', () => {
    expect(() => recordCollection(pickup('online', 10, NORMAL_10), 14)).toThrow();
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('refuses a collected amount of %p', value => {
    expect(() => recordCollection(pickup('pay_on_delivery', 10, NORMAL_10), value)).toThrow();
  });

  it('refuses to record a collection twice', () => {
    const once = recordCollection(pickup('pay_on_delivery', 10, NORMAL_10), 14);
    expect(() => recordCollection(once, 14)).toThrow();
  });
});

describe('recordFailure - delivery failed after the merchant was paid', () => {
  const codNormal = () => pickup('pay_on_delivery', 10, NORMAL_10);

  it('customer fault, food lost: TFTW bears the float spent on it', () => {
    const failed = recordFailure(codNormal(), {
      faultParty: 'CUSTOMER',
      recovery: 'UNRECOVERABLE',
    });

    expect(failed.status).toBe('FAILED');
    expect(failed.collectedCash).toBe(0);
    expect(failed.driverKeeps).toBe(0); // nothing collected to keep 80% from
    expect(failed.dueToTftw).toBe(-10); // TFTW owes the float its 10 back
    expect(failed.lossAmount).toBe(10);
  });

  it('food returned to the merchant: the merchant hands the cash back, no loss', () => {
    const failed = recordFailure(codNormal(), {
      faultParty: 'CUSTOMER',
      recovery: 'RETURNED_TO_MERCHANT',
    });

    expect(failed.merchantReturnedCash).toBe(10);
    expect(failed.dueToTftw).toBe(0);
    expect(failed.lossAmount).toBe(0);
  });

  it('recovery still pending: no loss booked yet', () => {
    const failed = recordFailure(codNormal(), {
      faultParty: 'CUSTOMER',
      recovery: 'RECOVERABLE_PENDING',
    });

    expect(failed.lossAmount).toBe(0);
    expect(failed.dueToTftw).toBe(-10);
  });

  it('merchant fault must end with the food and the money back with the merchant', () => {
    expect(() =>
      recordFailure(codNormal(), { faultParty: 'MERCHANT', recovery: 'UNRECOVERABLE' }),
    ).toThrow();
    expect(
      recordFailure(codNormal(), { faultParty: 'MERCHANT', recovery: 'RETURNED_TO_MERCHANT' })
        .dueToTftw,
    ).toBe(0);
  });

  it('online order: the loss is netted against the payment TFTW already holds', () => {
    const failed = recordFailure(pickup('online', 10, NORMAL_10), {
      faultParty: 'CUSTOMER',
      recovery: 'UNRECOVERABLE',
    });

    // The float is still owed its 10; but the 14 the customer paid online is
    // TFTW's, so this is not a cash loss.
    expect(failed.dueToTftw).toBe(-10);
    expect(failed.lossAmount).toBe(0);
  });

  it('cannot fail an order twice, or fail one already collected', () => {
    const failed = recordFailure(codNormal(), { faultParty: 'DRIVER', recovery: 'UNRECOVERABLE' });
    expect(() =>
      recordFailure(failed, { faultParty: 'DRIVER', recovery: 'UNRECOVERABLE' }),
    ).toThrow();

    const collected = recordCollection(codNormal(), 14);
    expect(() =>
      recordFailure(collected, { faultParty: 'CUSTOMER', recovery: 'UNRECOVERABLE' }),
    ).toThrow();
  });
});

describe('resolveRecovery - a pending failure is later settled', () => {
  const pending = () =>
    recordFailure(pickup('pay_on_delivery', 10, NORMAL_10), {
      faultParty: 'CUSTOMER',
      recovery: 'RECOVERABLE_PENDING',
    });

  it('returned to the merchant: the cash comes back, nothing is owed, no loss', () => {
    const resolved = resolveRecovery(pending(), 'RETURNED_TO_MERCHANT');

    expect(resolved.merchantReturnedCash).toBe(10);
    expect(resolved.dueToTftw).toBe(0);
    expect(resolved.outstandingCash).toBe(0);
    expect(resolved.lossAmount).toBe(0);
  });

  it('unrecoverable: the float spent on the food is booked as a loss', () => {
    const resolved = resolveRecovery(pending(), 'UNRECOVERABLE');

    expect(resolved.lossAmount).toBe(10);
    expect(resolved.dueToTftw).toBe(-10);
  });

  it('keeps what a handover already reconciled', () => {
    // TFTW replenished 4 of the 10 before the merchant took the food back.
    const partly = { ...pending(), handedOverCash: -4, outstandingCash: -6 };

    const resolved = resolveRecovery(partly, 'RETURNED_TO_MERCHANT');

    // Due is now 0, 4 was already paid to the driver - the driver owes it back.
    expect(resolved.dueToTftw).toBe(0);
    expect(resolved.outstandingCash).toBe(4);
  });

  it('only resolves a failure that is still pending', () => {
    const settled = resolveRecovery(pending(), 'UNRECOVERABLE');
    expect(() => resolveRecovery(settled, 'RETURNED_TO_MERCHANT')).toThrow();
    expect(() => resolveRecovery(pickup('online', 10, NORMAL_10), 'UNRECOVERABLE')).toThrow();
  });
});

describe('allocateHandover - end-of-period cash, oldest first', () => {
  const rec = (
    id: string,
    outstanding: number,
    status: DeliveryCashFigures['status'] = 'COLLECTED',
  ) => ({
    id,
    outstandingCash: outstanding,
    status,
  });

  it('pays off the oldest records first', () => {
    const result = allocateHandover([rec('a', 0.8), rec('b', 5.8), rec('c', 0.8)], 6.6);

    expect(result.allocations).toEqual([
      { id: 'a', amount: 0.8, outstandingAfter: 0, status: 'HANDED_OVER' },
      { id: 'b', amount: 5.8, outstandingAfter: 0, status: 'HANDED_OVER' },
    ]);
    expect(result.unallocated).toBe(0);
  });

  it('leaves a record PARTIALLY_HANDED_OVER when the cash runs out mid-record', () => {
    const result = allocateHandover([rec('a', 5.8)], 3);

    expect(result.allocations).toEqual([
      { id: 'a', amount: 3, outstandingAfter: 2.8, status: 'PARTIALLY_HANDED_OVER' },
    ]);
  });

  it('records cash handed over beyond what is owed, never drops it', () => {
    const result = allocateHandover([rec('a', 0.8)], 5);

    expect(result.unallocated).toBe(4.2);
  });

  it('allocates a replenishment (TFTW -> driver) only against records where TFTW owes', () => {
    const result = allocateHandover([rec('a', 0.8), rec('b', -13.2)], -13.2);

    expect(result.allocations).toEqual([
      { id: 'b', amount: -13.2, outstandingAfter: 0, status: 'HANDED_OVER' },
    ]);
  });

  it('keeps a SHORT record SHORT after it is reconciled, so the flag survives', () => {
    const result = allocateHandover([rec('a', 0.8, 'SHORT')], 0.8);

    expect(result.allocations[0]?.status).toBe('SHORT');
    expect(result.allocations[0]?.outstandingAfter).toBe(0);
  });

  it('ignores records already reconciled or still awaiting delivery', () => {
    const result = allocateHandover(
      [rec('done', 0, 'HANDED_OVER'), rec('pending', 0, 'EXPECTED'), rec('a', 0.8)],
      0.8,
    );

    expect(result.allocations.map(a => a.id)).toEqual(['a']);
  });

  it.each([0, Number.NaN])('refuses a batch of %p', amount => {
    expect(() => allocateHandover([rec('a', 0.8)], amount)).toThrow();
  });
});
