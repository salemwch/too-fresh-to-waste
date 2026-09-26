import i18n from '@/i18n';

import { categorizeError } from '../errorCategorization';

import type { AxiosError } from 'axios';

/**
 * The message a business error (400 / 403 / 422) shows.
 *
 * With a backend `code`, the message was written for users and is in the
 * app's language, so it is shown as is. The English blocklist that used to
 * run on every message ("not found", "cannot", "failed to") turned real
 * English copy into a generic line - while French and Arabic got through.
 */

const httpError = (status: number, data: unknown): AxiosError =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, data },
    config: { url: '/orders/1/cancel' },
  }) as unknown as AxiosError;

describe('categorizeError message', () => {
  it.each([
    [400, 'You cannot cancel this order once it is ready for pickup.'],
    [403, 'This offer was not found in your store.'],
    [422, 'Échec de la mise à jour : le créneau est complet.'],
  ])(
    '%i with a code: the backend message, even when it contains a blocked word',
    (status, message) => {
      expect(
        categorizeError(httpError(status, { status, code: 'ORDER_NOT_CANCELLABLE', message }))
          .message,
      ).toBe(message);
    },
  );

  it('without a code, a technical message is still replaced', () => {
    const result = categorizeError(
      httpError(400, { message: 'Cannot read properties of undefined (reading "x")' }),
    );
    expect(result.message).toBe(i18n.t('errors.generic'));
  });

  it('a non-JSON body (proxy page) is never shown', () => {
    expect(categorizeError(httpError(400, '<html>Bad Request</html>')).message).toBe(
      i18n.t('errors.generic'),
    );
  });
});
