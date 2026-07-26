/**
 * offerMappers — the logic that used to be copy-pasted across SearchScreen,
 * PlaceOffersBottomSheet and EstablishmentBottomSheet.
 *
 * Worth real tests: distance arrives in three different units, and the CTA rules
 * decide what the user is allowed to do with an offer. Neither had any coverage
 * while the logic was triplicated.
 */

import { CtaState, OfferStatus, OfferType } from '@/features/offers/types/offer.types';

import {
  deriveCtaState,
  distanceToMeters,
  mapOfferSummaryToListItem,
  nearbyOfferToListItem,
} from '../offerMappers';

import type { DistanceInfo } from '@foodwaste/shared';

const HOUR = 3_600_000;
const past = new Date(Date.now() - HOUR).toISOString();
const future = new Date(Date.now() + HOUR).toISOString();

const distance = (value: number, unit: DistanceInfo['unit']): DistanceInfo => ({
  value,
  unit,
  formatted: `${value} ${unit}`,
});

const offer = (over: Record<string, unknown> = {}) =>
  ({
    _id: 'o1',
    title: 'Surprise Bag',
    establishmentId: 'e1',
    establishmentName: 'Boulangerie',
    establishmentLogo: 'https://cdn/logo.png',
    images: ['https://cdn/img.png'],
    pricing: {
      originalPrice: 20,
      discountedPrice: 8,
      discountPercentage: 60,
      currency: 'TND',
    },
    availableFrom: past,
    availableUntil: future,
    availableQuantity: 3,
    categories: [],
    ...over,
  }) as never;

const hit = (over: Record<string, unknown> = {}, d = distance(1.2, 'kilometers')) =>
  ({ item: offer(over), distance: d, geoData: {} }) as never;

describe('distanceToMeters', () => {
  it('passes meters through unchanged', () => {
    expect(distanceToMeters(distance(750, 'meters'))).toBe(750);
  });

  it('converts kilometers', () => {
    expect(distanceToMeters(distance(1.2, 'kilometers'))).toBe(1200);
  });

  it('converts miles', () => {
    expect(distanceToMeters(distance(2, 'miles'))).toBeCloseTo(3218.68, 2);
  });

  it('handles zero', () => {
    expect(distanceToMeters(distance(0, 'kilometers'))).toBe(0);
  });
});

describe('deriveCtaState', () => {
  it('is AVAILABLE when open with stock', () => {
    expect(deriveCtaState(past, 3)).toBe(CtaState.AVAILABLE);
  });

  it('is SOLD_OUT when open with no stock', () => {
    expect(deriveCtaState(past, 0)).toBe(CtaState.SOLD_OUT);
  });

  it('is NOT_STARTED before the window opens', () => {
    expect(deriveCtaState(future, 5)).toBe(CtaState.NOT_STARTED);
  });

  // Order of the checks matters — "starts at 18:00" is more useful to show than
  // "sold out" for an offer that was never on sale yet.
  it('prefers NOT_STARTED over SOLD_OUT when both apply', () => {
    expect(deriveCtaState(future, 0)).toBe(CtaState.NOT_STARTED);
  });
});

describe('nearbyOfferToListItem', () => {
  it('maps the offer fields', () => {
    const result = nearbyOfferToListItem(hit());

    expect(result.id).toBe('o1');
    expect(result.title).toBe('Surprise Bag');
    expect(result.type).toBe(OfferType.SURPRISE_BAG);
    expect(result.status).toBe(OfferStatus.ACTIVE);
    expect(result.availableQuantity).toBe(3);
  });

  it('normalises distance to meters', () => {
    expect(nearbyOfferToListItem(hit({}, distance(1.2, 'kilometers'))).distance).toBe(1200);
  });

  // The drift that prompted this extraction: PlaceOffersBottomSheet's copy
  // omitted the logo, so the same offer rendered without an establishment image.
  it('carries the establishment logo through as profileImage', () => {
    expect(nearbyOfferToListItem(hit()).establishment.profileImage).toBe('https://cdn/logo.png');
  });

  // exactOptionalPropertyTypes: the key must be absent, not set to undefined.
  it('omits profileImage entirely when there is no logo', () => {
    const result = nearbyOfferToListItem(hit({ establishmentLogo: null }));

    expect(result.establishment).not.toHaveProperty('profileImage');
  });

  it('takes the first image and tolerates none', () => {
    expect(nearbyOfferToListItem(hit()).image).toBe('https://cdn/img.png');
    expect(nearbyOfferToListItem(hit({ images: [] })).image).toBeUndefined();
  });

  it('defaults currency to TND when the backend omits it', () => {
    const result = nearbyOfferToListItem(
      hit({ pricing: { originalPrice: 20, discountedPrice: 8, discountPercentage: 60 } }),
    );

    expect(result.pricing.currency).toBe('TND');
  });

  it('derives the CTA from the offer window', () => {
    expect(nearbyOfferToListItem(hit()).ctaState).toBe(CtaState.AVAILABLE);
    expect(nearbyOfferToListItem(hit({ availableQuantity: 0 })).ctaState).toBe(CtaState.SOLD_OUT);
    expect(nearbyOfferToListItem(hit({ availableFrom: future })).ctaState).toBe(
      CtaState.NOT_STARTED,
    );
  });
});

describe('mapOfferSummaryToListItem', () => {
  // Establishment details live on the parent here, so they are passed in rather
  // than read off the offer.
  it('uses the establishment passed in, not any on the offer', () => {
    const result = mapOfferSummaryToListItem(offer(), 'Pâtisserie', 'https://cdn/other.png', 900);

    expect(result.establishment.name).toBe('Pâtisserie');
    expect(result.establishment.profileImage).toBe('https://cdn/other.png');
    expect(result.distance).toBe(900);
  });

  it('omits profileImage when the establishment has none', () => {
    const result = mapOfferSummaryToListItem(offer(), 'Pâtisserie', null, 900);

    expect(result.establishment).not.toHaveProperty('profileImage');
  });

  it('applies the same CTA rules', () => {
    expect(mapOfferSummaryToListItem(offer({ availableQuantity: 0 }), 'X', null, 1).ctaState).toBe(
      CtaState.SOLD_OUT,
    );
  });
});
