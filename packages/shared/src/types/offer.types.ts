import type { OfferStatus, OfferType, CtaState, EstablishmentType, Currency } from '../enums';
import type { PopulatedEstablishmentAddress } from './establishment.types';

/**
 * Pickup time slot for order collection
 */
export interface PickupTimeSlot {
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  maxOrders?: number;
  currentOrders: number;
}

/**
 * Nutritional information for the offer
 */
export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  allergens?: string[];
  dietaryInfo?: string[]; // ['vegetarian', 'vegan', 'gluten-free', etc.]
}

/**
 * Pricing information
 */
export interface PriceInfo {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: Currency;
}

/**
 * Recurring days configuration
 */
export interface RecurringDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

/**
 * Complete Offer data structure.
 * Backend API uses 'id' not '_id' in responses.
 *
 * Note: When fetching single offers via GET /offers/:id, the backend populates
 * establishmentId and merchantId with full objects for better UX.
 */
export interface Offer {
  id: string; // Backend DTO uses 'id' not '_id'
  _id?: string; // Some aggregation/population paths still return Mongo-style IDs
  title: string;
  description: string;
  // Can be either ID string or populated object
  establishmentId:
    | string
    | {
        _id?: string;
        id?: string;
        name: string;
        address?: PopulatedEstablishmentAddress;
        type?: string;
        averageRating?: number;
        totalReviews?: number;
      };
  // Can be either ID string or populated object
  merchantId:
    | string
    | {
        _id?: string;
        id?: string;
        firstName?: string;
        lastName?: string;
        profileImage?: string;
      };
  type: OfferType;
  status: OfferStatus;
  pricing: PriceInfo;

  // Quantity management
  totalQuantity: number;
  reservedQuantity: number;
  soldQuantity: number;
  availableQuantity?: number; // Virtual field computed by backend

  // Media
  images: string[];

  // Categories & Tags
  categories: string[];
  tags: string[];

  // Nutritional
  nutritionalInfo?: NutritionalInfo;

  // Availability
  availableFrom: string;
  availableUntil: string;
  pickupTimeSlots: PickupTimeSlot[];

  // Additional info
  estimatedWeight?: string;

  // Metrics
  viewCount: number;
  favoriteCount: number;

  // Flags
  isActive: boolean;
  isFeatured: boolean;
  isRecurring: boolean;
  isExpired?: boolean; // Virtual field
  isSoldOut?: boolean; // Virtual field

  // Recurring configuration
  recurringDays?: RecurringDays;

  // Additional fields
  specialInstructions?: string;
  cancellationDeadline?: string;
  lastModifiedBy?: string;
  publishedAt?: string;
  expiredAt?: string;

  // Soft delete fields
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Offer list item (card view)
 * Matches backend OfferCardDto — no PII, no internal metrics.
 * Backend calculates availableQuantity and ctaState.
 */
export interface OfferListItem {
  id: string; // Backend uses 'id' not '_id' in DTOs
  _id?: string; // Backward-compatible for raw/aggregated responses
  title: string;
  type: OfferType;
  image?: string | undefined; // Single image (first image only)
  pricing: {
    originalPrice: number; // Backend provides for strikethrough display
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
  };
  availableQuantity: number; // Backend-computed (totalQuantity - soldQuantity - reservedQuantity)
  availableFrom: string; // When offer becomes available for ordering
  availableUntil: string;
  pickupTimeSlots?: Array<{
    startTime: string; // HH:mm format (e.g., "12:15")
    endTime: string; // HH:mm format (e.g., "13:00")
  }>;
  establishment: {
    name: string;
    averageRating?: number; // 0-5 rating from reviews
    totalReviews?: number; // Number of reviews
    profileImage?: string; // Merchant profile image/logo
  };
  categories?: string[]; // Present on some list/search endpoints and favorites population paths
  distance?: number; // In meters (for geolocation queries)
  ctaState: CtaState; // Backend-computed UI state (available/low_stock/sold_out)
  status: OfferStatus;
  isFavorite?: boolean; // Backend-computed (only present when user is authenticated)
}

/**
 * Search/filter parameters for offers
 */
export interface OfferSearchParams {
  page?: number;
  limit?: number;
  status?: OfferStatus;
  type?: OfferType;
  categories?: string[];
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  minDiscount?: number;
  establishmentId?: string;
  isFeatured?: boolean;
  search?: string; // Full-text search
  establishmentTypes?: EstablishmentType[];
  cuisineTypes?: string[];
  maxDistance?: number; // In meters, backend default: 5000m
}

/**
 * Paginated offers response
 */
export interface OffersResponse {
  data: OfferListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Single offer response
 */
export interface OfferResponse {
  data: Offer;
  message: string;
}

/**
 * Featured offers response
 */
export interface FeaturedOffersResponse {
  data: OfferListItem[];
  message: string;
}

/**
 * Reserve quantity request (Consumer action)
 */
export interface ReserveQuantityRequest {
  quantity: number;
}
