/**
 * Deterministic `Order` fixtures for the visual matrix.
 *
 * Every value here is fixed on purpose. These objects feed snapshot baselines,
 * so anything derived from the current time, a random id or a locale-dependent
 * format would make the baseline churn for reasons unrelated to any diff.
 *
 * Dates are expressed relative to `FROZEN_NOW` (2026-01-15T10:30:00Z, a
 * Thursday), which `renderCase` installs before every render. That is what makes
 * "Today" mean today: `makeOrder()` schedules pickup on the frozen date, so
 * `OrderCard` takes its today branch every run rather than whenever the suite
 * happens to execute.
 */

import { OrderStatus } from '@foodwaste/shared';

import { FROZEN_NOW } from '../visualMatrix';

import type { Order } from '@foodwaste/shared';

/** The frozen day, as the `YYYY-MM-DD` the pickup fields use. */
const FROZEN_DAY = FROZEN_NOW.toISOString().slice(0, 10);

/**
 * A paid, confirmed pickup order whose window is currently **open** - the frozen
 * clock is 10:30 UTC and the slot is 09:00-18:00, so the "pickup window is live"
 * branch renders. Override `pickupDetails.timeSlot` to exercise the closed one.
 */
export const makeOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    _id: 'order-fixture-1',
    orderNumber: 'ORD-4821',
    customerId: 'customer-1',
    establishmentId: {
      _id: 'establishment-1',
      name: 'Boulangerie du Lac',
      type: 'bakery',
      images: ['https://example.test/establishment.jpg'],
      averageRating: 4.6,
    },
    merchantId: 'merchant-1',
    items: [
      {
        offerId: 'offer-1',
        offerTitle: 'Surprise Bag',
        quantity: 2,
        unitPrice: 6,
        totalPrice: 12,
        originalPrice: 24,
        discountAmount: 12,
      },
    ],
    status: OrderStatus.CONFIRMED,
    paymentStatus: 'paid' as Order['paymentStatus'],
    pickupDetails: {
      timeSlot: { startTime: '09:00', endTime: '18:00' },
      scheduledDate: `${FROZEN_DAY}T09:00:00.000Z`,
      qrCode: 'qr-fixture',
      pickupCode: '4821',
    },
    paymentDetails: {
      method: 'konnect',
      transactionId: 'txn-fixture',
      amount: 12,
      currency: 'TND',
    },
    pricing: {
      subtotal: 12,
      discountAmount: 12,
      taxAmount: 0,
      deliveryFee: 0,
      total: 12,
      currency: 'TND',
    },
    deliveryMode: 'pickup',
    donationAmount: 0.14,
    createdAt: `${FROZEN_DAY}T08:00:00.000Z`,
    updatedAt: `${FROZEN_DAY}T08:05:00.000Z`,
    ...overrides,
  }) as Order;
