/**
 * Offer Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-offer, update-offer,
 * reactivate-offer, search-offers, offer-list).
 *
 * @module shared/schemas/offer
 */
import { z } from 'zod';

import {
  OfferType,
  OfferStatus,
  EstablishmentType,
  Currency,
  CtaState,
  OfferSortField,
} from '../enums';

// ============================================================================
// Nested schemas
// ============================================================================

const PriceInfoSchema = z.object({
  originalPrice: z.coerce.number().min(0.01, 'Original price must be at least 0.01'),
  discountedPrice: z.coerce.number().min(0.01, 'Discounted price must be at least 0.01'),
});

const OfferPickupTimeSlotSchema = z.object({
  startTime: z.string().trim().min(1, 'Start time is required'),
  endTime: z.string().trim().min(1, 'End time is required'),
  maxOrders: z.coerce.number().int().min(1).max(100).optional(),
  currentOrders: z.coerce.number().int().min(0).optional(),
});

const NutritionalInfoSchema = z.object({
  calories: z.coerce.number().min(0).optional(),
  protein: z.coerce.number().min(0).optional(),
  carbs: z.coerce.number().min(0).optional(),
  fat: z.coerce.number().min(0).optional(),
  allergens: z.array(z.string()).optional(),
  dietaryInfo: z.array(z.string()).optional(),
});

const RecurringDaysSchema = z.object({
  monday: z.boolean(),
  tuesday: z.boolean(),
  wednesday: z.boolean(),
  thursday: z.boolean(),
  friday: z.boolean(),
  saturday: z.boolean(),
  sunday: z.boolean(),
});

// ============================================================================
// Create Offer
// ============================================================================

export const CreateOfferSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description cannot exceed 1000 characters'),
  establishmentId: z.string().min(1, 'Establishment ID is required'),
  type: z.nativeEnum(OfferType),
  pricing: PriceInfoSchema,
  totalQuantity: z.coerce
    .number()
    .int()
    .min(1, 'Must have at least 1 item')
    .max(1000, 'Cannot exceed 1000 items'),
  images: z.array(z.string()).optional(),
  categories: z.array(z.string()).min(1).optional(),
  nutritionalInfo: NutritionalInfoSchema.optional(),
  availableFrom: z.string().datetime({ message: 'availableFrom must be a valid ISO 8601 date' }),
  availableUntil: z.string().datetime({ message: 'availableUntil must be a valid ISO 8601 date' }),
  pickupTimeSlots: z
    .array(OfferPickupTimeSlotSchema)
    .min(1, 'At least one pickup time slot required'),
  tags: z.array(z.string()).optional(),
  estimatedWeight: z.string().max(50).optional(),
  isRecurring: z.boolean().optional(),
  recurringDays: RecurringDaysSchema.optional(),
  specialInstructions: z.string().max(500).optional(),
  cancellationDeadline: z.string().datetime().optional(),
  timezone: z.string().optional().default('Africa/Tunis'),
  isPickupToday: z.boolean().optional(),
  isPickupTomorrow: z.boolean().optional(),
});

export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

// ============================================================================
// Update Offer (all fields optional + status)
// ============================================================================

export const UpdateOfferSchema = CreateOfferSchema.partial().extend({
  status: z.nativeEnum(OfferStatus).optional(),
});

export type UpdateOfferInput = z.infer<typeof UpdateOfferSchema>;

// ============================================================================
// Reactivate Offer
// ============================================================================

export const ReactivateOfferSchema = z.object({
  availableFrom: z.string().datetime({ message: 'availableFrom must be a valid ISO 8601 date' }),
  availableUntil: z.string().datetime({ message: 'availableUntil must be a valid ISO 8601 date' }),
  pickupTimeSlots: z
    .array(OfferPickupTimeSlotSchema)
    .min(1, 'At least one pickup time slot required'),
  totalQuantity: z.coerce.number().int().min(1).max(1000).optional(),
  timezone: z.string().optional().default('Africa/Tunis'),
  isPickupToday: z.boolean().optional().default(false),
  isPickupTomorrow: z.boolean().optional().default(false),
});

export type ReactivateOfferInput = z.infer<typeof ReactivateOfferSchema>;

// ============================================================================
// Search Offers
// ============================================================================

export const SearchOffersSchema = z.object({
  search: z.string().optional(),
  type: z.nativeEnum(OfferType).optional(),
  status: z.nativeEnum(OfferStatus).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  establishmentTypes: z.array(z.nativeEnum(EstablishmentType)).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  maxDistance: z.coerce.number().min(100).max(50000).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minDiscount: z.coerce.number().min(50).max(90).optional(),
  isFeatured: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => val === true || val === 'true')
    .optional(),
  establishmentId: z.string().optional(),
  merchantId: z.string().optional(),
  sortBy: z.nativeEnum(OfferSortField).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type SearchOffersInput = z.infer<typeof SearchOffersSchema>;

// ============================================================================
// Offer Card (read-only response shape)
// ============================================================================

export const OfferCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.nativeEnum(OfferType),
  image: z.string().optional(),
  pricing: z.object({
    originalPrice: z.number(),
    discountedPrice: z.number(),
    discountPercentage: z.number(),
    currency: z.nativeEnum(Currency),
  }),
  availableQuantity: z.number().min(0),
  availableFrom: z.string(),
  availableUntil: z.string(),
  pickupTimeSlots: z.array(z.object({ startTime: z.string(), endTime: z.string() })).optional(),
  establishment: z.object({
    name: z.string(),
    averageRating: z.number().optional(),
    totalReviews: z.number().optional(),
    profileImage: z.string().optional(),
  }),
  distance: z.number().optional(),
  ctaState: z.nativeEnum(CtaState),
  status: z.nativeEnum(OfferStatus),
  isFavorite: z.boolean().optional(),
  isFeatured: z.boolean(),
  isFeaturedManual: z.boolean().optional(),
  isFeaturedAuto: z.boolean().optional(),
  featuredAt: z.string().optional(),
  isPickupToday: z.boolean().optional(),
  isPickupTomorrow: z.boolean().optional(),
});

export type OfferCard = z.infer<typeof OfferCardSchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export { PriceInfoSchema, OfferPickupTimeSlotSchema, NutritionalInfoSchema, RecurringDaysSchema };
