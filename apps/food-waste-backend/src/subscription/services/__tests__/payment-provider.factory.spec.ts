import { ConfigService } from '@nestjs/config';

import { KonnectService, toMillimes } from '../konnect.service';
import { InsecurePaymentProviderError, resolvePaymentProvider } from '../payment-provider.factory';
import { StubPaymentService } from '../stub-payment.service';

/** ConfigService stand-in backed by a plain map, with `get(key, default)`. */
const configWith = (values: Record<string, string>): ConfigService =>
  ({
    get: <T>(key: string, defaultValue?: T): T | string =>
      key in values ? (values[key] as string) : (defaultValue as T),
  }) as unknown as ConfigService;

describe('payment provider selection', () => {
  it('defaults to the real Konnect client when PAYMENT_PROVIDER is unset', () => {
    const provider = resolvePaymentProvider(configWith({ NODE_ENV: 'development' }));

    expect(provider).toBeInstanceOf(KonnectService);
    expect(provider).not.toBeInstanceOf(StubPaymentService);
  });

  it.each(['konnect', 'KONNECT', 'production-gateway', ''])(
    'returns the real client for PAYMENT_PROVIDER=%p',
    value => {
      const provider = resolvePaymentProvider(
        configWith({ NODE_ENV: 'development', PAYMENT_PROVIDER: value }),
      );

      expect(provider).not.toBeInstanceOf(StubPaymentService);
    },
  );

  it('returns the stub outside production when explicitly requested', () => {
    const provider = resolvePaymentProvider(
      configWith({ NODE_ENV: 'test', PAYMENT_PROVIDER: 'stub' }),
    );

    expect(provider).toBeInstanceOf(StubPaymentService);
  });

  it.each([' stub ', 'STUB', 'Stub'])('normalises %p to the stub', value => {
    // Casing and stray whitespace must not decide whether real payments run.
    const provider = resolvePaymentProvider(
      configWith({ NODE_ENV: 'test', PAYMENT_PROVIDER: value }),
    );

    expect(provider).toBeInstanceOf(StubPaymentService);
  });

  it('refuses to start when the stub is requested in production', () => {
    expect(() =>
      resolvePaymentProvider(configWith({ NODE_ENV: 'production', PAYMENT_PROVIDER: 'stub' })),
    ).toThrow(InsecurePaymentProviderError);
  });

  it.each([' stub ', 'STUB'])('refuses %p in production too', value => {
    // The same normalisation that enables the stub must not become a bypass.
    expect(() =>
      resolvePaymentProvider(configWith({ NODE_ENV: 'production', PAYMENT_PROVIDER: value })),
    ).toThrow(InsecurePaymentProviderError);
  });
});

describe('StubPaymentService', () => {
  const service = new StubPaymentService(configWith({ APP_URL: 'http://localhost:3000' }));

  it('reports back exactly what the webhook will compare against', async () => {
    // This is the contract that matters, and it is the one the first version of
    // these tests got wrong: initOrderPayment converts with toMillimes() before
    // calling initPayment, so `amount` is ALREADY millimes. The stub must not
    // convert again. Asserting the round-trip in isolation proved only that the
    // stub agreed with itself — it was internally consistent and 1000x wrong.
    const orderTotalTnd = 12.5;
    const amountAsCallerSendsIt = toMillimes(orderTotalTnd); // what initOrderPayment does

    const { paymentRef } = await service.initPayment({
      amount: amountAsCallerSendsIt,
      firstName: 'K6',
      lastName: 'Tester',
      email: 'k6@loadtest.local',
      orderId: '507f1f77bcf86cd799439011',
      description: 'load test order',
    });

    const details = await service.getPaymentDetails(paymentRef);

    // handleOrderWebhook compares details.payment.amount with
    // toMillimes(attempt.amount), where attempt.amount is the TND total. Any
    // other value takes the anomalous branch: attempt flagged, refund request
    // opened, order never confirmed.
    expect(details.payment.amount).toBe(toMillimes(orderTotalTnd));
    expect(details.payment.status).toBe('completed');
  });

  it.each([1, 4000, 12345, 999999])('round-trips %p millimes exactly', async amount => {
    const { paymentRef } = await service.initPayment({
      amount,
      firstName: 'K6',
      lastName: 'Tester',
      email: 'k6@loadtest.local',
      orderId: '507f1f77bcf86cd799439011',
      description: 'load test order',
    });

    const details = await service.getPaymentDetails(paymentRef);

    expect(details.payment.amount).toBe(amount);
  });

  it.each([12.5, 0.001, 999.999])(
    'rejects %p — a TND value means the caller forgot to convert',
    async amount => {
      // Silently rounding would reintroduce the 1000x bug in a quieter form.
      await expect(
        service.initPayment({
          amount,
          firstName: 'K6',
          lastName: 'Tester',
          email: 'k6@loadtest.local',
          orderId: '507f1f77bcf86cd799439011',
          description: 'load test order',
        }),
      ).rejects.toThrow();
    },
  );

  it('issues the same reference for the same order', async () => {
    const params = {
      amount: 20000,
      firstName: 'K6',
      lastName: 'Tester',
      email: 'k6@loadtest.local',
      orderId: '507f1f77bcf86cd799439011',
      description: 'load test order',
    };

    const first = await service.initPayment(params);
    const second = await service.initPayment(params);

    // Determinism is what lets a concurrency test replay a webhook across
    // processes without any shared state to look the reference up in.
    expect(first.paymentRef).toBe(second.paymentRef);
  });

  it('issues different references for different orders', async () => {
    const base = {
      amount: 20000,
      firstName: 'K6',
      lastName: 'Tester',
      email: 'k6@loadtest.local',
      description: 'load test order',
    };

    const first = await service.initPayment({ ...base, orderId: '507f1f77bcf86cd799439011' });
    const second = await service.initPayment({ ...base, orderId: '507f1f77bcf86cd799439012' });

    expect(first.paymentRef).not.toBe(second.paymentRef);
  });

  it('rejects an unknown reference rather than inventing a payment', async () => {
    // The webhook treats a throw as "could not verify" and declines to settle.
    // Returning a plausible success here would confirm orders from any string.
    await expect(service.getPaymentDetails('not-a-stub-ref')).rejects.toThrow();
    await expect(service.getPaymentDetails('stub-abc-deadbeefcafe')).rejects.toThrow();
  });

  it.each([0, -1, Number.NaN])('rejects a non-positive amount (%p)', async amount => {
    await expect(
      service.initPayment({
        amount,
        firstName: 'K6',
        lastName: 'Tester',
        email: 'k6@loadtest.local',
        orderId: '507f1f77bcf86cd799439011',
        description: 'load test order',
      }),
    ).rejects.toThrow();
  });
});
