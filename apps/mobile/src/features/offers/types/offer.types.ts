/**
 * Offer Types
 *
 * Type definitions for food waste offers matching backend schema
 * Backend schema: apps/food-waste-backend/src/offers/schemas/offer.schema.ts
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { OfferStatus, OfferType, CtaState, EstablishmentType } from '@foodwaste/shared';
import { OfferStatus, OfferType } from '@foodwaste/shared';

export type {
  PickupTimeSlot,
  NutritionalInfo,
  PriceInfo,
  RecurringDays,
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
  OfferResponse,
  FeaturedOffersResponse,
  ReserveQuantityRequest,
} from '@foodwaste/shared';

import type { Offer } from '@foodwaste/shared';

// ============================================================================
// Mobile-only helpers
// ============================================================================

/**
 * Check if an offer is currently active.
 *
 * Direct UTC comparison (times are already stored in UTC format)
 */
export const isOfferActive = (offer: Offer): boolean => {
  const now = new Date();
  const fromTime = new Date(offer.availableFrom);
  const untilTime = new Date(offer.availableUntil);

  return (
    offer.status === OfferStatus.ACTIVE &&
    offer.isActive &&
    !offer.isExpired &&
    !offer.isSoldOut &&
    now >= fromTime &&
    now <= untilTime
  );
};

export const canReserveOffer = (offer: Offer, requestedQuantity: number): boolean => {
  const available = offer.availableQuantity ?? 0;
  return isOfferActive(offer) && available >= requestedQuantity && requestedQuantity > 0;
};

export const getOfferStatusLabel = (status: OfferStatus): string => {
  const labels: Record<OfferStatus, string> = {
    [OfferStatus.DRAFT]: 'Draft',
    [OfferStatus.ACTIVE]: 'Active',
    [OfferStatus.SOLD_OUT]: 'Sold Out',
    [OfferStatus.EXPIRED]: 'Expired',
    [OfferStatus.CANCELLED]: 'Cancelled',
    [OfferStatus.SUSPENDED]: 'Suspended',
  };
  return labels[status];
};

export const getOfferTypeLabel = (type: OfferType): string => {
  const labels: Record<OfferType, string> = {
    [OfferType.SURPRISE_BAG]: 'Surprise Bag',
    [OfferType.SPECIFIC_ITEMS]: 'Specific Items',
    [OfferType.MEAL_DEAL]: 'Meal Deal',
    [OfferType.PARCELS_BAG]: 'Parcels Bag',
  };
  return labels[type];
};
