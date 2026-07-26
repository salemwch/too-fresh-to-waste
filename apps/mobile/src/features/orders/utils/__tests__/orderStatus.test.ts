/**
 * Order status helpers.
 *
 * The exhaustiveness test is the important one. The map covered ten of the
 * thirteen statuses and fell back to `labelKey: order.status`, so the three
 * delivery statuses would have rendered the raw enum value ("driver_assigned")
 * into the badge. Nothing caught it, because nothing asserted that every status
 * resolves to a real translation key.
 */

import { OrderStatus } from '@foodwaste/shared';

import en from '@/i18n/locales/en.json';

import {
  canConfirmPickup,
  getEstablishmentId,
  getPickupErrorKey,
  getStatusBadge,
  isOrderExpired,
  isPickedUp,
} from '../orderStatus';

const ALL_STATUSES = Object.values(OrderStatus);

describe('getStatusBadge', () => {
  // THE REGRESSION GUARD. Add a status to the shared enum without a badge and
  // this fails, instead of shipping snake_case to the user.
  it('resolves every OrderStatus to a translation key', () => {
    const raw = ALL_STATUSES.filter(status => !getStatusBadge(status).labelKey.includes('.'));

    expect(raw).toEqual([]);
  });

  it('has a real English translation behind every key', () => {
    const missing = ALL_STATUSES.filter(status => {
      const key = getStatusBadge(status).labelKey.replace('orders.', '');
      return (en.orders as Record<string, string>)[key] == null;
    });

    expect(missing).toEqual([]);
  });

  it.each([
    [OrderStatus.PENDING, 'warning'],
    [OrderStatus.PENDING_PAYMENT, 'warning'],
    [OrderStatus.RESERVED, 'info'],
    [OrderStatus.READY_FOR_PICKUP, 'success'],
    [OrderStatus.COMPLETED, 'success'],
    [OrderStatus.CANCELLED, 'error'],
    [OrderStatus.EXPIRED, 'error'],
    [OrderStatus.REFUNDED, 'neutral'],
  ])('maps %s to the %s variant', (status, variant) => {
    expect(getStatusBadge(status).variant).toBe(variant);
  });

  describe('unknown statuses', () => {
    // A newer backend, or a value outside the enum entirely.
    it('never echoes the raw value back as a label', () => {
      expect(getStatusBadge('some_future_status').labelKey).toBe('orders.statusUnknown');
    });

    it.each(['', 'UNKNOWN', 'null', 'undefined'])('falls back safely for %p', status => {
      const badge = getStatusBadge(status);

      expect(badge.labelKey).toBe('orders.statusUnknown');
      expect(badge.variant).toBe('neutral');
    });
  });
});

describe('canConfirmPickup', () => {
  it.each([OrderStatus.RESERVED, OrderStatus.CONFIRMED, OrderStatus.READY_FOR_PICKUP])(
    'allows confirming a %s order',
    status => {
      expect(canConfirmPickup(status)).toBe(true);
    },
  );

  // Every other status, including all terminal ones — confirming a cancelled or
  // refunded order must never be offered.
  it.each(
    ALL_STATUSES.filter(
      s =>
        s !== OrderStatus.RESERVED &&
        s !== OrderStatus.CONFIRMED &&
        s !== OrderStatus.READY_FOR_PICKUP,
    ),
  )('does not allow confirming a %s order', status => {
    expect(canConfirmPickup(status)).toBe(false);
  });

  it('rejects an unrecognised status', () => {
    expect(canConfirmPickup('some_future_status')).toBe(false);
  });
});

describe('isPickedUp', () => {
  it.each([OrderStatus.PICKED_UP, OrderStatus.COMPLETED])('is true for %s', status => {
    expect(isPickedUp(status)).toBe(true);
  });

  it.each(ALL_STATUSES.filter(s => s !== OrderStatus.PICKED_UP && s !== OrderStatus.COMPLETED))(
    'is false for %s',
    status => {
      expect(isPickedUp(status)).toBe(false);
    },
  );
});

describe('isOrderExpired', () => {
  const HOUR = 3_600_000;
  const past = new Date(Date.now() - HOUR).toISOString();
  const future = new Date(Date.now() + HOUR).toISOString();

  describe('by status', () => {
    it('is expired when the backend says so, whatever expiresAt says', () => {
      expect(isOrderExpired({ status: OrderStatus.EXPIRED, expiresAt: future })).toBe(true);
    });

    it('is not expired for an active status with time left', () => {
      expect(isOrderExpired({ status: OrderStatus.RESERVED, expiresAt: future })).toBe(false);
    });
  });

  describe('by time', () => {
    // This is what disables the code input without waiting for a refetch.
    it('is expired once expiresAt has passed', () => {
      expect(isOrderExpired({ status: OrderStatus.RESERVED, expiresAt: past })).toBe(true);
    });

    it('accepts a Date as well as a string', () => {
      expect(
        isOrderExpired({ status: OrderStatus.RESERVED, expiresAt: new Date(Date.now() - HOUR) }),
      ).toBe(true);
    });
  });

  describe('missing or malformed expiry', () => {
    it.each([undefined, null])('is not expired when expiresAt is %p', expiresAt => {
      expect(isOrderExpired({ status: OrderStatus.RESERVED, expiresAt })).toBe(false);
    });

    // Failing open is deliberate: reading an unparseable date as "expired"
    // would lock a valid pickup out of its own code.
    it('is not expired when expiresAt cannot be parsed', () => {
      expect(isOrderExpired({ status: OrderStatus.RESERVED, expiresAt: 'not-a-date' })).toBe(false);
    });

    it('still trusts an EXPIRED status when expiresAt is malformed', () => {
      expect(isOrderExpired({ status: OrderStatus.EXPIRED, expiresAt: 'not-a-date' })).toBe(true);
    });
  });
});

describe('getPickupErrorKey', () => {
  const ALL_ERRORS = [
    'CODE_EXPIRED',
    'INVALID_CODE',
    'PICKUP_ALREADY_DONE',
    'PICKUP_LOCKED',
    'ORDER_NOT_READY',
  ] as const;

  it.each(ALL_ERRORS)('maps %s to a translation key', error => {
    expect(getPickupErrorKey(error)).toMatch(/^orders\./);
  });

  it('has a real English translation behind every key', () => {
    const missing = ALL_ERRORS.filter(
      error =>
        (en.orders as Record<string, string>)[getPickupErrorKey(error).replace('orders.', '')] ==
        null,
    );

    expect(missing).toEqual([]);
  });

  // A backend that grows a new pickup error must not leak the code into the UI.
  it('falls back to a translated generic for an unrecognised code', () => {
    expect(getPickupErrorKey('SOME_NEW_CODE' as never)).toBe('orders.pickupFailed');
  });

  it.each([null, undefined])('falls back for %p', error => {
    expect(getPickupErrorKey(error)).toBe('orders.pickupFailed');
  });

  it('has a translation for the fallback itself', () => {
    expect((en.orders as Record<string, string>)['pickupFailed']).toBeTruthy();
  });
});

describe('getEstablishmentId', () => {
  // The field arrives raw or populated depending on the endpoint.
  it('returns a plain id unchanged', () => {
    expect(getEstablishmentId('est-1')).toBe('est-1');
  });

  it('reads _id from a populated document', () => {
    expect(getEstablishmentId({ _id: 'est-1' })).toBe('est-1');
  });

  it('falls back to id when _id is absent', () => {
    expect(getEstablishmentId({ id: 'est-1' })).toBe('est-1');
  });

  it('prefers _id when both are present', () => {
    expect(getEstablishmentId({ _id: 'mongo', id: 'other' })).toBe('mongo');
  });

  it.each([null, undefined, {}])('returns an empty string for %p', value => {
    expect(getEstablishmentId(value)).toBe('');
  });

  it('returns an empty string rather than "undefined" for an empty populated doc', () => {
    expect(getEstablishmentId({ _id: undefined, id: undefined })).toBe('');
  });
});
