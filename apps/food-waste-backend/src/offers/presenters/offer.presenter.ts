import { OfferDocument } from '../schemas/offer.schema';
import { OfferCardDto, CtaState } from '../DTO/offer-list.dto';

/**
 * OfferPresenter - Presentation layer for transforming offer entities to DTOs
 * ✅ SECURITY: Removes merchant PII and internal metrics
 * ✅ PRIVACY: Only exposes establishment name (not full address)
 * ✅ UX: Calculates CTA state for frontend consumption
 *
 * Design Pattern: Presenter Pattern (separates data transformation from business logic)
 */
export class OfferPresenter {
    /**
     * Transform OfferDocument to OfferCardDto for list/card display
     *
     * @param offer - Mongoose offer document (with populated establishment)
     * @param distance - Optional distance in meters (from geolocation queries)
     * @returns Sanitized DTO safe for public API responses
     */
    static toCardDto(offer: OfferDocument, distance?: number): OfferCardDto {
        // ✅ Calculate available quantity (hide internal metrics)
        const availableQty = offer.totalQuantity - offer.soldQuantity - offer.reservedQuantity;

        // ✅ Extract establishment data safely
        const establishmentData = this.getEstablishmentData(offer);

        return {
            id: offer._id.toString(),
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
            availableUntil: offer.availableUntil,
            pickupTimeSlots: offer.pickupTimeSlots?.map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
            })),
            establishment: establishmentData,
            distance,
            ctaState: this.calculateCtaState(availableQty, offer.totalQuantity),
            status: offer.status,
            // Featuring metadata
            isFeatured: offer.isFeaturedManual || offer.isFeaturedAuto,
            isFeaturedManual: offer.isFeaturedManual,
            isFeaturedAuto: offer.isFeaturedAuto,
            featuredAt: offer.featuredAt,
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
    private static calculateCtaState(available: number, total: number): CtaState {
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
     * Safely extract establishment data from populated document
     *
     * @param offer - Offer document (may or may not have populated establishment and merchant)
     * @returns Establishment data with name, rating, reviews, and profileImage
     */
    private static getEstablishmentData(offer: OfferDocument): {
        name: string;
        averageRating?: number;
        totalReviews?: number;
        profileImage?: string;
    } {
        // Get merchant profileImage if populated
        let profileImage: string | undefined;
        if (offer.merchantId && typeof offer.merchantId === 'object') {
            const merchant = offer.merchantId as any;
            profileImage = merchant.profileImage;
        }

        // ✅ Handle aggregation pipeline result (has 'establishment' field)
        if ((offer as any).establishment && typeof (offer as any).establishment === 'object') {
            const establishment = (offer as any).establishment;
            return {
                name: establishment.name || 'Establishment',
                averageRating: establishment.averageRating,
                totalReviews: establishment.totalReviews,
                profileImage: profileImage || establishment.profileImage,
            };
        }

        // ✅ Handle populated establishment (from .populate())
        if (offer.establishmentId && typeof offer.establishmentId === 'object') {
            const establishment = offer.establishmentId as any;
            return {
                name: establishment.name || 'Establishment',
                averageRating: establishment.averageRating,
                totalReviews: establishment.totalReviews,
                profileImage,
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
     * @param offers - Array of offer documents
     * @param distances - Optional map of offer ID to distance
     * @returns Array of sanitized DTOs
     */
    static toCardDtoArray(
        offers: OfferDocument[],
        distances?: Map<string, number>
    ): OfferCardDto[] {
        return offers.map(offer => {
            const distance = distances?.get(offer._id.toString());
            return this.toCardDto(offer, distance);
        });
    }
}
