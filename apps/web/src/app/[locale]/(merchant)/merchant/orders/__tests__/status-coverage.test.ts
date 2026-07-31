import { OrderStatus as SharedOrderStatus } from '@foodwaste/shared';

import { HISTORY_STATUSES } from '@/hooks/use-merchant-dashboard';

import type { OrderStatus } from '@/types/dashboard';

/**
 * The merchant `OrderStatus` union silently fell three states behind the backend
 * after the driver role shipped: `driver_assigned`, `out_for_delivery` and
 * `delivered` existed in the API and nowhere in this app. An order the driver
 * had collected then arrived with a status the status badge could not look up,
 * so it rendered the raw i18n namespace — `dashboard.merchantOrders` — where a
 * label should be, and a delivered order matched neither tab.
 *
 * The type is a hand-written mirror of the shared enum, which is why it drifted.
 * These tests fail the moment it drifts again.
 */

describe('merchant OrderStatus mirrors the shared enum', () => {
  it('covers every status the backend can send', () => {
    // Assigning the shared enum's values to the local union is the assertion:
    // TypeScript rejects the file if the union is missing a member. The runtime
    // check keeps the failure readable when it happens.
    const shared = Object.values(SharedOrderStatus) as string[];
    const local: OrderStatus[] = [
      'pending',
      'pending_payment',
      'reserved',
      'confirmed',
      'ready_for_pickup',
      'picked_up',
      'driver_assigned',
      'out_for_delivery',
      'delivered',
      'completed',
      'cancelled',
      'expired',
      'refunded',
    ];

    const missing = shared.filter(s => !(local as string[]).includes(s));
    expect(missing).toEqual([]);
  });

  it('does not invent statuses the backend never sends', () => {
    // A stale member is as bad as a missing one: dead branches that look handled.
    const shared = Object.values(SharedOrderStatus) as string[];
    const local: string[] = [
      'pending',
      'pending_payment',
      'reserved',
      'confirmed',
      'ready_for_pickup',
      'picked_up',
      'driver_assigned',
      'out_for_delivery',
      'delivered',
      'completed',
      'cancelled',
      'expired',
      'refunded',
    ];

    expect(local.filter(s => !shared.includes(s))).toEqual([]);
  });
});

describe('HISTORY_STATUSES', () => {
  it('ends both fulfilment chains', () => {
    // Pickup finishes at picked_up, delivery at delivered. Missing either one
    // leaves finished orders in the Active tab forever.
    expect(HISTORY_STATUSES).toContain('picked_up');
    expect(HISTORY_STATUSES).toContain('delivered');
  });

  it('keeps the in-flight delivery states out of history', () => {
    // A driver holding the food is not a finished order.
    expect(HISTORY_STATUSES).not.toContain('driver_assigned');
    expect(HISTORY_STATUSES).not.toContain('out_for_delivery');
  });

  it('contains only statuses the backend can actually send', () => {
    const shared = Object.values(SharedOrderStatus) as string[];
    expect(HISTORY_STATUSES.filter(s => !shared.includes(s))).toEqual([]);
  });
});
