import { CtaState } from '../DTO/offer-list.dto';

import type { OfferCardDto } from '../DTO/offer-list.dto';
import type { OfferLean } from '../offers.service';
import type { OfferDocument } from '../schemas/offer.schema';

/**
 * Type for populated merchant with profile image
 */
interface PopulatedMerchant {
  profileImage?: string;
  [key: string]: unknown;
}

/**
 * Type for populated establishment with basic info
 */
interface PopulatedEstablishment {
  name: string;
  averageRating?: number;
  totalReviews?: number;
  profileImage?: string;
  [key: string]: unknown;
}

/**
 * Type for aggregation result that includes establishment data
 */
interface OfferWithEstablishment {
  establishment?: PopulatedEstablishment;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && value !== undefined && typeof value === 'object';
}

/**
 * Union type for offer entities that the presenter can handle
 * Supports both Mongoose documents and lean query results
 *
 * ✅ TYPE SAFETY: Imports OfferLean from service to ensure consistency
 */
type OfferEntity = OfferDocument | OfferLean;

/**
 * OfferPresenter - Presentation layer for transforming offer entities to DTOs
 * ✅ SECURITY: Removes merchant PII and internal metrics
 * ✅ PRIVACY: Only exposes establishment name (not full address)
 * ✅ UX: Calculates CTA state for frontend consumption
 *
 * Design Pattern: Presenter Pattern (separates data transformation from business logic)
 *
 * Type Support: Handles both OfferDocument (Mongoose) and OfferLean (POJO from aggregations)
 */
export class OfferPresenter {
  /**
   * Transform offer entity to OfferCardDto for list/card display
   *
   * @param offer - Offer entity (Mongoose document or lean object from aggregation)
   * @param distance - Optional distance in meters (from geolocation queries, overrides offer.distance)
   * @param isFavorite - Whether current user has favorited this offer (undefined if unauthenticated)
   * @returns Sanitized DTO safe for public API responses
   *
   * ✅ BEST PRACTICE: Accepts both document and lean types for flexibility
   * ✅ TYPE SAFETY: Uses type guards and safe property access
   */
  static toCardDto(offer: OfferEntity, distance?: number, isFavorite?: boolean): OfferCardDto {
    // ✅ Extract distance from offer if not explicitly provided
    // Lean objects from aggregations may have distance property
    const finalDistance = distance ?? (offer as OfferLean).distance;
    // ✅ Calculate available quantity (hide internal metrics)
    const availableQty = offer.totalQuantity - offer.soldQuantity - offer.reservedQuantity;

    // ✅ Extract establishment data safely
    const establishmentData = this.getEstablishmentData(offer);

    // ✅ TYPE SAFETY: Convert _id to string (works for both ObjectId and FlattenMaps)
    const offerId = typeof offer._id === 'string' ? offer._id : (offer._id?.toString() ?? '');

    return {
      id: offerId,
      title: offer.title,
      type: offer.type,
      image: offer.images?.[0], // First image only for card
      pricing: {
        originalPrice: offer.pricing.originalPrice, // Included for UI strikethrough
        discountedPrice: offer.pricing.discountedPrice,
        discountPercentage: offer.pricing.discountPercentage,
        currency: offer.pricing.currency,
      },
      availableQuantity: availableQty,
      availableFrom: (offer.availableFrom as Date).toISOString(),
      availableUntil: (offer.availableUntil as Date).toISOString(),
      pickupTimeSlots: offer.pickupTimeSlots?.map(slot => ({
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
      establishment: establishmentData,
      distance: finalDistance,
      ctaState: this.calculateCtaState(availableQty, offer.totalQuantity, offer.availableFrom),
      status: offer.status,
      // Favorite status (only when user is authenticated)
      isFavorite,
      // Featuring metadata
      isFeatured: offer.isFeaturedManual === true || offer.isFeaturedAuto === true,
      isFeaturedManual: offer.isFeaturedManual,
      isFeaturedAuto: offer.isFeaturedAuto,
      featuredAt:
        offer.featuredAt !== null && offer.featuredAt !== undefined
          ? (offer.featuredAt as Date).toISOString()
          : undefined,
      // Pickup categorization
      isPickupToday: offer.isPickupToday,
      isPickupTomorrow: offer.isPickupTomorrow,
    };
  }

  /**
   * Calculate CTA (Call-to-Action) state based on availability
   *
   * @param available - Available quantity
   * @param total - Total quantity
   * @returns CTA state enum
   */
  private static calculateCtaState(
    available: number,
    total: number,
    availableFrom: Date,
  ): CtaState {
    // Offer hasn't started yet — takes priority over quantity checks
    if (new Date() < new Date(availableFrom)) {
      return CtaState.NOT_STARTED;
    }

    if (available === 0) {
      return CtaState.SOLD_OUT;
    }

    // Low stock threshold: < 20% remaining
    const percentRemaining = (available / total) * 100;
    if (percentRemaining < 20) {
      return CtaState.LOW_STOCK;
    }

    return CtaState.AVAILABLE;
  }

  /**
   * Safely extract establishment data from offer entity
   *
   * @param offer - Offer entity (document or lean, may or may not have populated establishment and merchant)
   * @returns Establishment data with name, rating, reviews, and profileImage
   */
  private static getEstablishmentData(offer: OfferEntity): {
    name: string;
    averageRating?: number | undefined;
    totalReviews?: number | undefined;
    profileImage?: string | undefined;
  } {
    // Extract merchant profileImage — some pipelines replace offer.merchantId
    // with the populated object (buildMerchantLookup), others put it at
    // offer.merchant (getNearbyOffers). Check both locations.
    let profileImage: string | undefined;
    const merchantId: unknown = offer.merchantId;
    if (isRecord(merchantId)) {
      profileImage = (merchantId as PopulatedMerchant).profileImage;
    }
    if (!profileImage) {
      const merchantField = (offer as unknown as { merchant?: PopulatedMerchant }).merchant;
      if (isRecord(merchantField)) {
        profileImage = (merchantField as PopulatedMerchant).profileImage;
      }
    }

    // ✅ TYPE SAFETY: Handle aggregation pipeline result (has 'establishment' field)
    const offerWithEstablishment = offer as unknown as OfferWithEstablishment;
    const aggregatedEstablishment: unknown = offerWithEstablishment.establishment;
    if (isRecord(aggregatedEstablishment)) {
      const establishment = aggregatedEstablishment as PopulatedEstablishment;
      return {
        name: establishment.name || 'Establishment',
        averageRating: establishment.averageRating,
        totalReviews: establishment.totalReviews,
        profileImage: profileImage ?? establishment.profileImage,
      };
    }

    // ✅ TYPE SAFETY: Handle populated establishment (from buildEstablishmentLookup)
    const establishmentId: unknown = offer.establishmentId;
    if (isRecord(establishmentId)) {
      const establishment = establishmentId as PopulatedEstablishment;
      return {
        name: establishment.name || 'Establishment',
        averageRating: establishment.averageRating,
        totalReviews: establishment.totalReviews,
        profileImage: profileImage ?? establishment.profileImage,
      };
    }

    // Fallback for non-populated documents
    return {
      name: 'Establishment',
      profileImage,
    };
  }

  /**
   * Transform array of offers to DTOs
   *
   * @param offers - Array of offer entities (documents or lean objects)
   * @param distances - Optional map of offer ID to distance
   * @returns Array of sanitized DTOs
   */
  static toCardDtoArray(offers: OfferEntity[], distances?: Map<string, number>): OfferCardDto[] {
    return offers.map(offer => {
      // ✅ TYPE SAFETY: Handle both ObjectId and string _id
      const offerId = typeof offer._id === 'string' ? offer._id : (offer._id?.toString() ?? '');
      const distance = distances?.get(offerId);
      return this.toCardDto(offer, distance);
    });
  }
}
