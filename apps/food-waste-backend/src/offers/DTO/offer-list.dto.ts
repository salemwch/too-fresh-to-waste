import { IsString, IsNumber, IsEnum, IsDateString, IsOptional, Min, Max, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { OfferStatus, OfferType, Currency } from '../schemas/offer.schema';

export enum CtaState {
    AVAILABLE = 'available',
    LOW_STOCK = 'low_stock',
    SOLD_OUT = 'sold_out',
}

/**
 * OfferCardDto - Presentation layer for offer list/card display
 * ✅ SECURITY: No merchant PII (firstName/lastName removed)
 * ✅ SECURITY: No internal metrics (soldQuantity/reservedQuantity removed)
 * ✅ PRIVACY: No full establishment address (only name)
 * ✅ UX: Includes computed CTA state for frontend
 */
export class OfferCardDto {
    @IsString()
    id: string;

    @IsString()
    title: string;

    @IsEnum(OfferType)
    type: OfferType;

    @IsOptional()
    @IsString()
    image?: string; // First image only for card display

    @ValidateNested()
    pricing: {
        originalPrice: number; // Included for UI strikethrough display (not sensitive)
        discountedPrice: number;
        discountPercentage: number;
        currency: Currency;
    };

    @IsNumber()
    @Min(0)
    availableQuantity: number; // Computed: totalQuantity - sold - reserved

    @IsDateString()
    availableUntil: Date;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => Object)
    pickupTimeSlots?: Array<{
        startTime: string;
        endTime: string;
    }>;

    @ValidateNested()
    establishment: {
        name: string;
        averageRating?: number; // 0-5 rating for display
        totalReviews?: number; // Number of reviews
        profileImage?: string; // Merchant profile image/logo
    };

    @IsOptional()
    @IsNumber()
    distance?: number; // Only present for geolocation queries

    @IsEnum(CtaState)
    ctaState: CtaState; // Computed state for UI

    @IsEnum(OfferStatus)
    status: OfferStatus;

    // =========================================================================
    // FEATURING METADATA
    // =========================================================================

    @IsBoolean()
    isFeatured: boolean; // Computed: isFeaturedManual || isFeaturedAuto

    @IsOptional()
    @IsBoolean()
    isFeaturedManual?: boolean; // True if manually featured by admin

    @IsOptional()
    @IsBoolean()
    isFeaturedAuto?: boolean; // True if auto-featured by cron (urgency-based)

    @IsOptional()
    @IsDateString()
    featuredAt?: Date; // When the offer was featured (manual or auto)

    // =========================================================================
    // PICKUP CATEGORIZATION
    // =========================================================================

    @IsOptional()
    @IsBoolean()
    isPickupToday?: boolean; // True if merchant set this offer for "Pickup Today" section

    @IsOptional()
    @IsBoolean()
    isPickupTomorrow?: boolean; // True if merchant set this offer for "Pickup Tomorrow" section
}

/**
 * @deprecated Use OfferCardDto instead
 * This DTO leaked merchant PII and internal metrics
 */
export class OfferListDto {
    id?: string;
    title?: string;
    type?: string;
    images?: string[];
    pricing?: {
        originalPrice?: number;
        discountedPrice?: number;
        discountPercentage?: number;
    };
    totalQuantity?: number;
    soldQuantity?: number;
    reservedQuantity?: number;
    availableFrom?: Date;
    availableUntil?: Date;
    establishmentId?: string;
    establishmentName?: string;
    establishmentAddress?: any;
    status?: OfferStatus;
    distance?: number;
    merchantFirstName?: string;
    merchantLastName?: string;
    createdAt?: Date;
}
