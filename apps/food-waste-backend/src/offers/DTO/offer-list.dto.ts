import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsOptional,
  Min,
  ValidateNested,
  IsBoolean,
} from 'class-validator';

import { OfferStatus, OfferType, Currency } from '../schemas/offer.schema';

export enum CtaState {
  AVAILABLE = 'available',
  LOW_STOCK = 'low_stock',
  SOLD_OUT = 'sold_out',
  NOT_STARTED = 'not_started',
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
  id!: string;

  @IsString()
  title!: string;

  @IsEnum(OfferType)
  type!: OfferType;

  @IsOptional()
  @IsString()
  image?: string | undefined; // First image only for card display

  @ValidateNested()
  pricing!: {
    originalPrice: number; // Included for UI strikethrough display (not sensitive)
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
  };

  @IsNumber()
  @Min(0)
  availableQuantity!: number; // Computed: totalQuantity - sold - reserved

  @IsDateString()
  availableFrom!: Date; // When offer becomes available for ordering

  @IsDateString()
  availableUntil!: Date;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => Object)
  pickupTimeSlots?:
    | Array<{
        startTime: string;
        endTime: string;
      }>
    | undefined;

  @ValidateNested()
  establishment!: {
    name: string;
    averageRating?: number | undefined; // 0-5 rating for display
    totalReviews?: number | undefined; // Number of reviews
    profileImage?: string | undefined; // Merchant profile image/logo
  };

  @IsOptional()
  @IsNumber()
  distance?: number | undefined; // Only present for geolocation queries

  @IsEnum(CtaState)
  ctaState!: CtaState; // Computed state for UI

  @IsEnum(OfferStatus)
  status!: OfferStatus;

  // =========================================================================
  // FAVORITE STATUS (for authenticated users)
  // =========================================================================

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean | undefined; // True if current user has favorited (only when authenticated)

  // =========================================================================
  // FEATURING METADATA
  // =========================================================================

  @IsBoolean()
  isFeatured!: boolean; // Computed: isFeaturedManual || isFeaturedAuto

  @IsOptional()
  @IsBoolean()
  isFeaturedManual?: boolean | undefined; // True if manually featured by admin

  @IsOptional()
  @IsBoolean()
  isFeaturedAuto?: boolean | undefined; // True if auto-featured by cron (urgency-based)

  @IsOptional()
  @IsDateString()
  featuredAt?: Date | undefined; // When the offer was featured (manual or auto)

  // =========================================================================
  // PICKUP CATEGORIZATION
  // =========================================================================

  @IsOptional()
  @IsBoolean()
  isPickupToday?: boolean | undefined; // True if merchant set this offer for "Pickup Today" section

  @IsOptional()
  @IsBoolean()
  isPickupTomorrow?: boolean | undefined; // True if merchant set this offer for "Pickup Tomorrow" section
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
  establishmentAddress?: Record<string, unknown>;
  status?: OfferStatus;
  distance?: number;
  merchantFirstName?: string;
  merchantLastName?: string;
  createdAt?: Date;
}
