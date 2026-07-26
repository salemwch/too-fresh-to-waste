/**
 * Search → OfferListItem mapping.
 *
 * These three transforms were written out three times: in SearchScreen, in
 * PlaceOffersBottomSheet and in EstablishmentBottomSheet. The copies had already
 * drifted — PlaceOffersBottomSheet dropped `establishmentLogo`, so the same offer
 * rendered with a logo on the search list and without one in the place sheet.
 *
 * Centralised so a change to pricing, CTA rules or distance units lands in one
 * place. Pure functions, no React, no I/O.
 */

import { Currency } from '@foodwaste/shared';

import { CtaState, OfferStatus, OfferType } from '@/features/offers/types/offer.types';

import type { MapOfferSummary, NearbyOffer, ProximitySearchResult } from '@/features/offers/hooks';
import type { OfferListItem } from '@/features/offers/types/offer.types';
import type { DistanceInfo } from '@foodwaste/shared';

const METERS_PER_KILOMETER = 1000;
const METERS_PER_MILE = 1609.34;

/**
 * Normalise a distance to meters. The backend may answer in any of the three
 * units; OfferListItem.distance is always meters.
 */
export const distanceToMeters = (distance: DistanceInfo): number => {
  switch (distance.unit) {
    case 'kilometers':
      return distance.value * METERS_PER_KILOMETER;
    case 'miles':
      return distance.value * METERS_PER_MILE;
    default:
      return distance.value;
  }
};

/**
 * CTA shown on the offer card.
 *
 * Order matters: an offer that has not opened yet reads NOT_STARTED even when it
 * has no stock, because "starts at 18:00" is more useful than "sold out" for
 * something that was never on sale.
 */
export const deriveCtaState = (availableFrom: string, availableQuantity: number): CtaState => {
  if (new Date() < new Date(availableFrom)) return CtaState.NOT_STARTED;
  return availableQuantity > 0 ? CtaState.AVAILABLE : CtaState.SOLD_OUT;
};

interface OfferCore {
  _id: string;
  title: string;
  images?: string[];
  pricing: NearbyOffer['pricing'];
  availableFrom: string;
  availableUntil: string;
  availableQuantity: number;
}

/** Shared body of both mappers below — everything independent of establishment. */
const toListItem = (
  offer: OfferCore,
  establishmentName: string,
  establishmentImage: string | null | undefined,
  distanceMeters: number,
): OfferListItem => ({
  id: offer._id,
  title: offer.title,
  type: OfferType.SURPRISE_BAG,
  image: offer.images?.[0] ?? undefined,
  pricing: {
    originalPrice: offer.pricing.originalPrice,
    discountedPrice: offer.pricing.discountedPrice,
    discountPercentage: offer.pricing.discountPercentage,
    currency: (offer.pricing.currency as Currency | null | undefined) ?? Currency.TND,
  },
  availableQuantity: offer.availableQuantity,
  availableFrom: offer.availableFrom,
  availableUntil: offer.availableUntil,
  establishment: {
    name: establishmentName,
    // Conditional spread: exactOptionalPropertyTypes rejects `profileImage: undefined`.
    ...(establishmentImage != null ? { profileImage: establishmentImage } : {}),
  },
  distance: distanceMeters,
  ctaState: deriveCtaState(offer.availableFrom, offer.availableQuantity),
  status: OfferStatus.ACTIVE,
});

/** Proximity search hit (carries its own establishment fields) → list item. */
export const nearbyOfferToListItem = (
  result: ProximitySearchResult<NearbyOffer>,
): OfferListItem => {
  const { item, distance } = result;
  return toListItem(
    item,
    item.establishmentName,
    item.establishmentLogo,
    distanceToMeters(distance),
  );
};

/**
 * Offer nested inside a MapEstablishment → list item. The establishment fields
 * and distance belong to the parent, so they are passed in.
 */
export const mapOfferSummaryToListItem = (
  offer: MapOfferSummary,
  establishmentName: string,
  establishmentImage: string | null | undefined,
  distanceMeters: number,
): OfferListItem => toListItem(offer, establishmentName, establishmentImage, distanceMeters);
