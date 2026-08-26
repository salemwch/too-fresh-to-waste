/**
 * Deterministic driver-flow fixtures for the visual matrix.
 *
 * The driver screens are the least-covered surface in the app - there was not a
 * single test under `features/driver` before phase 3 - and they are also the
 * ones phase 5 rewrites most heavily: 71 off-scale font sizes, `colorTokens.light.*`
 * read directly so nothing responds to theme, and a raw map-marker colour.
 *
 * Everything here is frozen against `FROZEN_NOW` for the same reason as
 * `order.ts`: these screens print relative times and `toLocaleDateString`
 * output, so a live clock would churn the baselines daily.
 *
 * Statuses come from the `OrderStatus` enum rather than string literals. The
 * driver screens compare against lowercase literals (`status === 'out_for_delivery'`)
 * and `DriverAvailableOrder.status` is typed as plain `string`, so an uppercase
 * fixture type-checks cleanly and silently misses every status branch. The first
 * draft of this file did exactly that.
 */

import { OrderStatus } from '@foodwaste/shared';

import { FROZEN_NOW } from '../visualMatrix';

import type {
  DriverAvailableOrder,
  DriverEarningsSummary,
  DriverProfile,
} from '@/features/driver/services/driver.service';

const iso = (offsetMinutes: number): string =>
  new Date(FROZEN_NOW.getTime() + offsetMinutes * 60_000).toISOString();

/** Tunis coordinates, fixed - the screens compute distances from these. */
export const DRIVER_COORDS = { lat: 36.8065, lng: 10.1815 };

/**
 * An order sitting in the available pool: no driver, `CONFIRMED`, collection
 * window open at the frozen instant.
 */
export const makeDriverOrder = (
  overrides: Partial<DriverAvailableOrder> = {},
): DriverAvailableOrder => ({
  _id: 'driver-order-1',
  orderNumber: 'ORD-5507',
  customerId: {
    _id: 'customer-1',
    firstName: 'Amine',
    lastName: 'Trabelsi',
    phoneNumber: '+21620123456',
  },
  establishmentId: { _id: 'establishment-1', name: 'Boulangerie du Lac' },
  driverId: null,
  deliveryFee: 4,
  driverEarnings: 3,
  deliveryMode: 'delivery',
  status: OrderStatus.CONFIRMED,
  items: [
    { offerId: 'offer-1', offerTitle: 'Surprise Bag', quantity: 2, unitPrice: 6, totalPrice: 12 },
  ],
  deliveryAddress: {
    street: '12 Rue du Lac Turkana',
    city: 'Tunis',
    postalCode: '1053',
    coordinates: { lat: 36.8325, lng: 10.2345 },
  },
  establishmentAddress: {
    street: '4 Avenue Habib Bourguiba',
    city: 'Tunis',
    coordinates: { lat: 36.8008, lng: 10.1817 },
  },
  collectionStartTime: iso(-30),
  collectionEndTime: iso(90),
  expiresAt: iso(120),
  totalAmount: 16,
  paymentDetails: { method: 'konnect', amount: 16 },
  createdAt: iso(-60),
  updatedAt: iso(-30),
  ...overrides,
});

/** The same order once this driver has taken it - the active-delivery state. */
export const makeAssignedOrder = (
  overrides: Partial<DriverAvailableOrder> = {},
): DriverAvailableOrder =>
  makeDriverOrder({
    driverId: 'driver-1',
    status: OrderStatus.DRIVER_ASSIGNED,
    driverAssignedAt: iso(-10),
    ...overrides,
  });

/** Picked up from the merchant, en route to the customer. */
export const makeOutForDeliveryOrder = (
  overrides: Partial<DriverAvailableOrder> = {},
): DriverAvailableOrder =>
  makeAssignedOrder({
    status: OrderStatus.OUT_FOR_DELIVERY,
    driverPickedUpAt: iso(-5),
    ...overrides,
  });

/** A completed delivery, as the earnings history lists it. */
export const makeDeliveredOrder = (
  overrides: Partial<DriverAvailableOrder> = {},
): DriverAvailableOrder =>
  makeOutForDeliveryOrder({
    _id: 'driver-order-done',
    orderNumber: 'ORD-5490',
    status: OrderStatus.DELIVERED,
    deliveredAt: iso(-120),
    ...overrides,
  });

export const makeDriverProfile = (overrides: Partial<DriverProfile> = {}): DriverProfile => ({
  _id: 'driver-1',
  userId: 'user-1',
  idCardNumber: '09876543',
  address: '18 Rue de Marseille, Tunis',
  isOnline: true,
  lastOnlineAt: iso(-15),
  ...overrides,
});

export const makeEarnings = (
  overrides: Partial<DriverEarningsSummary> = {},
): DriverEarningsSummary => ({
  today: 18,
  thisWeek: 96,
  thisMonth: 412,
  allTime: 2748,
  deliveriesToday: 6,
  deliveriesAllTime: 916,
  currency: 'TND',
  ...overrides,
});
