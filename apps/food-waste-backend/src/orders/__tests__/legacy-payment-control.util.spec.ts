/**
 * The one-time classification of orders written before `paymentControl`.
 * Historical data holds combinations creation now rejects, so every case is
 * pinned - including the anomalies the migration must report, not hide.
 */

import { legacyPaymentControl } from '../utils/legacy-payment-control.util';

describe('legacyPaymentControl', () => {
  it.each([
    ['cash at the counter', 'cash_on_pickup', 'pickup', undefined, 'MERCHANT', 'MERCHANT', null],
    ['cash to the driver', 'pay_on_delivery', 'delivery', undefined, 'TFTW', 'DRIVER', null],
    ['online pickup', 'online', 'pickup', 'konnect', 'TFTW', 'PAYMENT_GATEWAY', null],
    ['online delivery', 'online', 'delivery', 'konnect', 'TFTW', 'PAYMENT_GATEWAY', null],
  ] as const)(
    '%s',
    (_label, method, deliveryMode, paymentProvider, controlledBy, collector, anomaly) => {
      expect(legacyPaymentControl({ method, deliveryMode, paymentProvider })).toEqual({
        control: { controlledBy, collector },
        anomaly,
      });
    },
  );

  it('classifies a delivery stored as cash_on_pickup by who was there - the driver', () => {
    const result = legacyPaymentControl({
      method: 'cash_on_pickup',
      deliveryMode: 'delivery',
      paymentProvider: undefined,
    });

    expect(result.control).toEqual({ controlledBy: 'TFTW', collector: 'DRIVER' });
    expect(result.anomaly).toMatch(/cash_on_pickup/);
  });

  it('classifies a pickup stored as pay_on_delivery as merchant cash, and reports it', () => {
    const result = legacyPaymentControl({
      method: 'pay_on_delivery',
      deliveryMode: 'pickup',
      paymentProvider: undefined,
    });

    expect(result.control).toEqual({ controlledBy: 'MERCHANT', collector: 'MERCHANT' });
    expect(result.anomaly).not.toBeNull();
  });

  it('trusts the Konnect provider over a mislabelled method', () => {
    const result = legacyPaymentControl({
      method: 'cash_on_pickup',
      deliveryMode: 'pickup',
      paymentProvider: 'konnect',
    });

    expect(result.control?.controlledBy).toBe('TFTW');
    expect(result.anomaly).not.toBeNull();
  });

  it('treats a missing delivery mode as pickup, the schema default', () => {
    expect(
      legacyPaymentControl({
        method: 'cash_on_pickup',
        deliveryMode: undefined,
        paymentProvider: undefined,
      }).control,
    ).toEqual({ controlledBy: 'MERCHANT', collector: 'MERCHANT' });
  });

  it.each(['stripe', 'paypal', 'apple_pay', 'google_pay', undefined])(
    'leaves %p unclassified for a human, never guesses',
    method => {
      const result = legacyPaymentControl({
        method,
        deliveryMode: 'pickup',
        paymentProvider: undefined,
      });

      expect(result.control).toBeNull();
      expect(result.anomaly).toMatch(/no collector/);
    },
  );
});
