import type { PaymentControl } from './payment-control.util';

/**
 * `paymentControl` for an order written before the field existed. Used ONCE,
 * by `scripts/migrations/backfill-payment-control.ts`; runtime code never calls
 * it - new orders get `resolvePaymentControl` at creation.
 *
 * The stored method and fulfilment ARE the historical record of who collected,
 * so this reads them together rather than the method alone. Historical data can
 * hold combinations creation now rejects - a delivery stored as
 * `cash_on_pickup` (the driver collected it at the door) - so the fulfilment
 * decides the collector for cash, and the anomaly is reported, never silently
 * normalised.
 *
 * Returns `null` for a method nothing ever collected (`stripe`, `paypal`,
 * `apple_pay`, `google_pay`, missing): those orders are left without a control
 * and listed by the migration for a human decision.
 */

export interface LegacyOrderPaymentFacts {
  method: string | undefined;
  deliveryMode: 'pickup' | 'delivery' | undefined;
  paymentProvider: string | undefined;
}

export type LegacyControlResult =
  { control: PaymentControl; anomaly: string | null } | { control: null; anomaly: string };

export function legacyPaymentControl(facts: LegacyOrderPaymentFacts): LegacyControlResult {
  const delivery = facts.deliveryMode === 'delivery';

  if (facts.method === 'online' || facts.paymentProvider === 'konnect') {
    return {
      control: { controlledBy: 'TFTW', collector: 'PAYMENT_GATEWAY' },
      anomaly:
        facts.method !== 'online'
          ? `paid through Konnect but stored as "${String(facts.method)}"`
          : null,
    };
  }

  if (facts.method === 'cash_on_pickup' || facts.method === 'pay_on_delivery') {
    if (delivery) {
      return {
        control: { controlledBy: 'TFTW', collector: 'DRIVER' },
        anomaly: facts.method === 'cash_on_pickup' ? 'delivery stored as cash_on_pickup' : null,
      };
    }
    return {
      control: { controlledBy: 'MERCHANT', collector: 'MERCHANT' },
      anomaly: facts.method === 'pay_on_delivery' ? 'pickup stored as pay_on_delivery' : null,
    };
  }

  return { control: null, anomaly: `no collector for payment method "${String(facts.method)}"` };
}
