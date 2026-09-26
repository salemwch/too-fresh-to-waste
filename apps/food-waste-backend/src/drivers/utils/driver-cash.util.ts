/**
 * Driver cash - pure rules. Source of truth: "Driver cash" and "Failed
 * deliveries" in `.claude/work/commission-settlement-model.md`, row for row in
 * `drivers/__tests__/driver-cash.util.spec.ts`.
 *
 * The driver circulates TFTW's money, never their own:
 *
 *   merchant pickup  driver pays the merchant `merchantAmount` from the float
 *                    (every delivery - the merchant never waits for a transfer)
 *   delivery         driver collects what the payment method says:
 *                      pay_on_delivery -> pricing.total
 *                      online          -> 0 (the customer already paid TFTW)
 *   delivery fee     driver keeps their share from the cash; TFTW gets the rest
 *
 *   dueToTftw = collectedCash + merchantReturnedCash - paidToMerchant - driverKeeps
 *
 * Signed: > 0 the driver holds TFTW money; < 0 TFTW owes the driver (an online
 * delivery drains the float and brings in no cash, so the float must be
 * replenished and the driver's share paid). `outstandingCash` is what is left
 * of it after handovers, with the same sign.
 *
 * A driver-confirmed collection is a RECEIVABLE, not cash in TFTW's account:
 * nothing here marks money as received until a handover batch covers it.
 */

export type DriverCashStatus =
  'EXPECTED' | 'COLLECTED' | 'SHORT' | 'PARTIALLY_HANDED_OVER' | 'HANDED_OVER' | 'FAILED';

export type DeliveryPaymentMethod = 'pay_on_delivery' | 'online';

export interface DeliveryCashFigures {
  paymentMethod: DeliveryPaymentMethod;
  kind: 'NORMAL' | 'SETTLEMENT';
  paidToMerchant: number;
  expectedCash: number;
  collectedCash: number | null;
  merchantReturnedCash: number;
  driverKeeps: number;
  tftwDeliveryRevenue: number;
  tftwSettlement: number;
  dueToTftw: number | null;
  handedOverCash: number;
  outstandingCash: number | null;
  shortfall: number;
  lossAmount: number;
  status: DriverCashStatus;
}

export interface MerchantPickupInput {
  paymentMethod: DeliveryPaymentMethod;
  subtotal: number;
  /** `pricing.total` - food plus delivery fee, what a COD customer owes. */
  total: number;
  deliveryFee: number;
  /** `order.driverEarnings` - the driver's share, fixed at order creation. */
  driverEarnings: number;
  /** `order.platformDeliveryCommission` - TFTW's share of the fee. */
  platformDeliveryCommission: number;
  commission: { kind: 'NORMAL' | 'SETTLEMENT'; settled: number; merchantAmount: number };
}

export interface MerchantPickupCash extends DeliveryCashFigures {
  /** Exactly what the driver app shows. */
  instruction: { payMerchant: number; collectFromCustomer: number; driverKeeps: number };
}

const round3 = (value: number): number => parseFloat(value.toFixed(3));

/** A record once the delivery is resolved: every settlement figure is known. */
export type Resolved<T> = T & { collectedCash: number; dueToTftw: number; outstandingCash: number };

const assertAmount = (value: number, what: string): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${what} must be a finite, non-negative amount (got ${String(value)})`);
  }
};

export function buildMerchantPickupCash(input: MerchantPickupInput): MerchantPickupCash {
  if (input.paymentMethod !== 'pay_on_delivery' && input.paymentMethod !== 'online') {
    throw new Error(`No driver collects payment for "${String(input.paymentMethod)}"`);
  }
  for (const [key, value] of Object.entries({
    subtotal: input.subtotal,
    total: input.total,
    driverEarnings: input.driverEarnings,
    platformDeliveryCommission: input.platformDeliveryCommission,
    merchantAmount: input.commission.merchantAmount,
    settled: input.commission.settled,
  })) {
    assertAmount(value, key);
  }

  const paidToMerchant = round3(input.commission.merchantAmount);
  const expectedCash = input.paymentMethod === 'pay_on_delivery' ? round3(input.total) : 0;
  const driverKeeps = round3(input.driverEarnings);

  return {
    paymentMethod: input.paymentMethod,
    kind: input.commission.kind,
    paidToMerchant,
    expectedCash,
    collectedCash: null,
    merchantReturnedCash: 0,
    driverKeeps,
    tftwDeliveryRevenue: round3(input.platformDeliveryCommission),
    tftwSettlement: round3(input.commission.settled),
    dueToTftw: null,
    handedOverCash: 0,
    outstandingCash: null,
    shortfall: 0,
    lossAmount: 0,
    status: 'EXPECTED',
    instruction: { payMerchant: paidToMerchant, collectFromCustomer: expectedCash, driverKeeps },
  };
}

const dueFrom = (
  f: Pick<DeliveryCashFigures, 'paidToMerchant' | 'driverKeeps' | 'merchantReturnedCash'> & {
    collectedCash: number;
  },
): number => round3(f.collectedCash + f.merchantReturnedCash - f.paidToMerchant - f.driverKeeps);

/** The driver confirms, at the door, what the customer actually paid. */
export function recordCollection<T extends DeliveryCashFigures>(
  record: T,
  collectedCash: number,
): Resolved<T> {
  if (record.status !== 'EXPECTED') {
    throw new Error(`Collection already recorded (status ${record.status})`);
  }
  assertAmount(collectedCash, 'collectedCash');
  if (record.paymentMethod === 'online' && collectedCash !== 0) {
    throw new Error('An online-paid order collects no cash at the door');
  }

  const collected = round3(collectedCash);
  const shortfall = round3(Math.max(0, record.expectedCash - collected));
  const dueToTftw = dueFrom({ ...record, collectedCash: collected });

  return {
    ...record,
    collectedCash: collected,
    shortfall,
    dueToTftw,
    outstandingCash: dueToTftw,
    status: shortfall > 0 ? 'SHORT' : 'COLLECTED',
  };
}

export interface FailureInput {
  faultParty: 'CUSTOMER' | 'MERCHANT' | 'DRIVER';
  recovery: 'RECOVERABLE_PENDING' | 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE';
}

/**
 * The delivery failed after the merchant was paid. Nothing was collected, so
 * the driver keeps nothing: any compensation for the trip is an explicit admin
 * adjustment (open question in the model), never an automatic payout.
 */
export function recordFailure<T extends DeliveryCashFigures>(
  record: T,
  failure: FailureInput,
): Resolved<T> {
  if (record.status !== 'EXPECTED') {
    throw new Error(`Only an undelivered order can fail (status ${record.status})`);
  }
  if (failure.faultParty === 'MERCHANT' && failure.recovery !== 'RETURNED_TO_MERCHANT') {
    // The merchant cannot keep money for food they failed to supply.
    throw new Error('A merchant-fault failure must end with the food returned to the merchant');
  }

  const merchantReturnedCash =
    failure.recovery === 'RETURNED_TO_MERCHANT' ? record.paidToMerchant : 0;
  const withFailure = { ...record, collectedCash: 0, merchantReturnedCash, driverKeeps: 0 };
  const dueToTftw = dueFrom(withFailure);

  /*
   * A cash loss only on pay-on-delivery: TFTW bought food it never sold. On an
   * online order TFTW already holds the customer's payment, so the same event
   * is netted against it in reconciliation rather than booked as lost cash.
   */
  const lossAmount =
    failure.recovery === 'UNRECOVERABLE' && record.paymentMethod === 'pay_on_delivery'
      ? record.paidToMerchant
      : 0;

  return {
    ...withFailure,
    dueToTftw,
    outstandingCash: dueToTftw,
    lossAmount: round3(lossAmount),
    status: 'FAILED',
  };
}

/**
 * A failure recorded as RECOVERABLE_PENDING, settled once someone knows what
 * happened to the food. Anything a handover already reconciled stays
 * reconciled: `outstandingCash` is recomputed as the new due minus what has
 * already moved.
 */
export function resolveRecovery<
  T extends DeliveryCashFigures & { recovery?: FailureInput['recovery'] },
>(record: T, recovery: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE'): Resolved<T> {
  if (record.status !== 'FAILED' || record.merchantReturnedCash !== 0 || record.lossAmount !== 0) {
    throw new Error('Only a failed delivery still pending recovery can be resolved');
  }
  if (record.recovery !== undefined && record.recovery !== 'RECOVERABLE_PENDING') {
    throw new Error(`Recovery already resolved as ${record.recovery}`);
  }

  const merchantReturnedCash = recovery === 'RETURNED_TO_MERCHANT' ? record.paidToMerchant : 0;
  const dueToTftw = dueFrom({ ...record, collectedCash: 0, merchantReturnedCash });
  const lossAmount =
    recovery === 'UNRECOVERABLE' && record.paymentMethod === 'pay_on_delivery'
      ? record.paidToMerchant
      : 0;

  return {
    ...record,
    recovery,
    collectedCash: 0,
    merchantReturnedCash,
    dueToTftw,
    outstandingCash: round3(dueToTftw - record.handedOverCash),
    lossAmount: round3(lossAmount),
  };
}

// ─── Handover batches ───────────────────────────────────────────────────────

export interface AllocatableRecord {
  id: string;
  outstandingCash: number | null;
  status: DriverCashStatus;
}

export interface Allocation {
  id: string;
  /** Signed like the batch. */
  amount: number;
  outstandingAfter: number;
  status: DriverCashStatus;
}

const RECONCILABLE: ReadonlySet<DriverCashStatus> = new Set<DriverCashStatus>([
  'COLLECTED',
  'SHORT',
  'PARTIALLY_HANDED_OVER',
  'FAILED',
]);

/**
 * Spreads one handover across a driver's open records, oldest first.
 *
 * `amount > 0`: the driver hands TFTW cash; it pays down records where the
 * driver owes. `amount < 0`: TFTW replenishes the driver; it pays down records
 * where TFTW owes. Records of the other sign are untouched. What cannot be
 * allocated is returned as `unallocated`, never dropped.
 *
 * SHORT and FAILED keep their status once reconciled, so the flag survives into
 * every later report. The caller passes records oldest first.
 */
export function allocateHandover(
  records: readonly AllocatableRecord[],
  amount: number,
): { allocations: Allocation[]; unallocated: number } {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new Error(`A handover must move a non-zero, finite amount (got ${String(amount)})`);
  }
  const sign = Math.sign(amount);
  let remaining = Math.abs(round3(amount));
  const allocations: Allocation[] = [];

  for (const record of records) {
    if (remaining <= 0) {
      break;
    }
    const outstanding = record.outstandingCash ?? 0;
    if (!RECONCILABLE.has(record.status) || Math.sign(outstanding) !== sign) {
      continue;
    }
    const take = round3(Math.min(remaining, Math.abs(outstanding)));
    const outstandingAfter = round3(outstanding - sign * take);
    remaining = round3(remaining - take);

    const keepsFlag = record.status === 'SHORT' || record.status === 'FAILED';
    allocations.push({
      id: record.id,
      amount: round3(sign * take),
      outstandingAfter,
      status: keepsFlag
        ? record.status
        : outstandingAfter === 0
          ? 'HANDED_OVER'
          : 'PARTIALLY_HANDED_OVER',
    });
  }

  return { allocations, unallocated: round3(sign * remaining) };
}
