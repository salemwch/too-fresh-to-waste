/**
 * Deterministic `Offer` fixture for the checkout baselines.
 *
 * Only the fields `CheckoutScreen` actually reads are populated - title,
 * pricing, availability window, pickup slots and the populated establishment
 * with GeoJSON coordinates. A fuller object would suggest the baseline covers
 * more of the type than it does.
 *
 * Coordinates are chosen against `DRIVER_COORDS` so the establishment sits
 * ~2.5 km from the stored user location: inside `MAX_DELIVERY_KM` (5), so the
 * delivery option renders enabled. Override them to cross that boundary.
 */

import { FROZEN_NOW } from '../visualMatrix';

import type { Offer } from '@foodwaste/shared';

const iso = (offsetMinutes: number): string =>
  new Date(FROZEN_NOW.getTime() + offsetMinutes * 60_000).toISOString();

/** Avenue Habib Bourguiba, Tunis - GeoJSON order is [lng, lat]. */
const ESTABLISHMENT_LNG_LAT: [number, number] = [10.1817, 36.8008];

export const makeOffer = (overrides: Partial<Offer> = {}): Offer =>
  ({
    _id: 'offer-1',
    title: 'Surprise Bag',
    description: 'Assorted breads and pastries from the day.',
    images: ['https://example.test/offer.jpg'],
    quantity: 5,
    quantityAvailable: 5,
    pricing: {
      originalPrice: 12,
      discountedPrice: 6,
      currency: 'TND',
      discountPercentage: 50,
    },
    availableFrom: iso(-120),
    availableUntil: iso(240),
    pickupTimeSlots: [{ startTime: '14:00', endTime: '16:00' }],
    establishmentId: {
      _id: 'establishment-1',
      name: 'Boulangerie du Lac',
      type: 'bakery',
      images: ['https://example.test/establishment.jpg'],
      averageRating: 4.6,
      address: {
        street: '4 Avenue Habib Bourguiba',
        city: 'Tunis',
        postalCode: '1000',
        coordinates: { type: 'Point', coordinates: ESTABLISHMENT_LNG_LAT },
      },
    },
    createdAt: iso(-600),
    updatedAt: iso(-120),
    ...overrides,
  }) as unknown as Offer;
