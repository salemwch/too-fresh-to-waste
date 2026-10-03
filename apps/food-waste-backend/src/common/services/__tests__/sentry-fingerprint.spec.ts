import * as Sentry from '@sentry/node';

import { SentryService } from '../sentry.service';

jest.mock('@sentry/node', () => ({ captureMessage: jest.fn().mockReturnValue('evt') }));

describe('SentryService.captureMessage fingerprint', () => {
  const service = Object.create(SentryService.prototype) as SentryService;
  Object.assign(service, { isInitialized: true });

  it('passes a stable fingerprint so every occurrence groups into one issue', () => {
    service.captureMessage('m', 'error', { k: { a: 1 } }, ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS']);

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'm',
      expect.objectContaining({
        level: 'error',
        fingerprint: ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS'],
      }),
    );
  });

  it('sends no fingerprint when none is given', () => {
    service.captureMessage('m', 'info');
    const [, options] = (Sentry.captureMessage as jest.Mock).mock.calls.at(-1) as [string, object];
    expect(options).not.toHaveProperty('fingerprint');
  });
});
