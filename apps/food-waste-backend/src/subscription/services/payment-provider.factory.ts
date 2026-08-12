import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { KonnectService } from './konnect.service';
import { StubPaymentService } from './stub-payment.service';

export const PAYMENT_PROVIDER_ENV = 'PAYMENT_PROVIDER';
export const STUB_PAYMENT_PROVIDER = 'stub';

/**
 * Thrown at bootstrap, not at request time, when the stub is configured in a
 * production environment. Failing to start is the point: a service that boots
 * and then silently simulates payments is far worse than one that refuses.
 */
export class InsecurePaymentProviderError extends Error {
  constructor() {
    super(
      `${PAYMENT_PROVIDER_ENV}=${STUB_PAYMENT_PROVIDER} is not permitted when NODE_ENV=production. ` +
        'The stub simulates successful payments in-process and moves no money; ' +
        'running it in production would confirm orders nobody has paid for.',
    );
    this.name = 'InsecurePaymentProviderError';
  }
}

/**
 * Chooses the payment client. Konnect is the default and the only value that
 * production accepts — the stub must be opted into explicitly, and even then
 * only outside production.
 *
 * The guard lives here rather than only in `validate-env.ts` because this is
 * the single place the decision is actually made. A check in a script can be
 * skipped by starting the process another way; this one cannot, because
 * nothing can obtain a payment client without going through it.
 */
export function resolvePaymentProvider(configService: ConfigService): KonnectService {
  const provider = configService.get<string>(PAYMENT_PROVIDER_ENV, 'konnect').trim().toLowerCase();

  if (provider !== STUB_PAYMENT_PROVIDER) {
    return new KonnectService(configService);
  }

  // NODE_ENV is read directly rather than through a helper so that no amount of
  // config layering can make this branch look non-production when it is.
  if (configService.get<string>('NODE_ENV') === 'production') {
    throw new InsecurePaymentProviderError();
  }

  return new StubPaymentService(configService);
}

export const paymentProviderProvider: Provider = {
  provide: KonnectService,
  inject: [ConfigService],
  useFactory: resolvePaymentProvider,
};
