import { BadRequestException } from '@nestjs/common';

import { appError } from '../../common/errors';
/**
 * Who holds the customer's payment - the only input that decides whether an
 * order may settle commission. See `.claude/work/commission-settlement-model.md`.
 *
 * Resolved ONCE, when the order is created, and stored on it as
 * `order.paymentControl`. Nothing downstream re-derives it: a later change to
 * this table must not re-classify an order that already exists.
 *
 * `pay_on_delivery` is cash, and it is TFTW-controlled: TFTW's driver collects
 * it. That is the rule the table exists for - control follows the collector,
 * never the payment method.
 */

export type ControlledBy = 'TFTW' | 'MERCHANT';
export type PaymentCollector = 'MERCHANT' | 'DRIVER' | 'PAYMENT_GATEWAY';

export interface PaymentControl {
  controlledBy: ControlledBy;
  collector: PaymentCollector;
}

const CONTROL: Readonly<Record<SupportedPaymentMethod, PaymentControl>> = Object.freeze({
  cash_on_pickup: { controlledBy: 'MERCHANT', collector: 'MERCHANT' },
  pay_on_delivery: { controlledBy: 'TFTW', collector: 'DRIVER' },
  online: { controlledBy: 'TFTW', collector: 'PAYMENT_GATEWAY' },
});

/**
 * The methods something actually collects. The create-order DTO also lets
 * `stripe`, `paypal`, `apple_pay` and `google_pay` through, but no code path
 * charges them; they are rejected here rather than defaulted, because either
 * default misstates money - MERCHANT records an unpaid order as a paid cash
 * sale, TFTW could settle against money nobody collected.
 */
export const SUPPORTED_PAYMENT_METHODS: readonly string[] = Object.freeze([
  'cash_on_pickup',
  'pay_on_delivery',
  'online',
]);

type SupportedPaymentMethod = 'cash_on_pickup' | 'pay_on_delivery' | 'online';

const isSupported = (method: unknown): method is SupportedPaymentMethod =>
  typeof method === 'string' && SUPPORTED_PAYMENT_METHODS.includes(method);

const UNSUPPORTED_MESSAGE = appError('PAYMENT_METHOD_UNSUPPORTED');

export function resolvePaymentControl(method: unknown): PaymentControl {
  if (!isSupported(method)) {
    throw new BadRequestException(UNSUPPORTED_MESSAGE);
  }
  // A copy, so a caller mutating the stored order cannot edit the table.
  return { ...CONTROL[method] };
}

/**
 * A payment method names who collects, so it must agree with the fulfilment.
 * Cash at the counter on a delivery order, or pay-on-delivery on a pickup,
 * would store a collector that is not physically there.
 */
export function assertPaymentMatchesFulfilment(
  method: unknown,
  deliveryMode: 'pickup' | 'delivery',
): void {
  if (!isSupported(method)) {
    throw new BadRequestException(UNSUPPORTED_MESSAGE);
  }
  if (method === 'cash_on_pickup' && deliveryMode === 'delivery') {
    throw new BadRequestException(appError('CASH_PICKUP_ONLY'));
  }
  if (method === 'pay_on_delivery' && deliveryMode === 'pickup') {
    throw new BadRequestException(appError('PAY_ON_DELIVERY_ONLY'));
  }
}
