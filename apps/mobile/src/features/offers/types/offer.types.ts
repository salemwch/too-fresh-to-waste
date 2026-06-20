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
import { OfferStatus } from '@foodwaste/shared';

export type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
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
    offer.isExpired !== true &&
    offer.isSoldOut !== true &&
    now >= fromTime &&
    now <= untilTime
  );
};
