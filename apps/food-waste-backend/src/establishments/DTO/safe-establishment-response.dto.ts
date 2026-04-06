/**
 * Safe Establishment Response DTO
 *
 * SECURITY: Only includes non-sensitive establishment information safe for client exposure.
 * Excludes internal MongoDB fields (_id in nested objects, __v, internal metadata).
 *
 * Reference: OWASP API Security Top 10 - API3:2023 Excessive Data Exposure
 */

import type {
  EstablishmentDocument,
  EstablishmentStatus,
  EstablishmentType,
} from '../schemas/establishment.schema';

/**
 * Safe address data without MongoDB internals
 */
interface SafeAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
}

/**
 * Safe business hours data
 */
interface SafeBusinessHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
}

/**
 * Safe establishment data returned to client
 */
export interface SafeEstablishmentResponse {
  /** Establishment unique identifier */
  id: string;

  /** Business name */
  name: string;

  /** Business description */
  description: string;

  /** Establishment type */
  type: EstablishmentType;

  /** Approval status */
  status: EstablishmentStatus;

  /** Full address with coordinates */
  address: SafeAddress;

  /** Contact phone number */
  phoneNumber: string;

  /** Contact email */
  email: string;

  /** Business website (optional) */
  website?: string | undefined;

  /** Images URLs */
  images: string[];

  /** Cuisine types (for restaurants) */
  cuisineTypes?: string[] | undefined;

  /** Business operating hours (optional) */
  businessHours?: SafeBusinessHours | undefined;

  /** Average rating (0-5) */
  averageRating: number;

  /** Total reviews count */
  totalReviews: number;

  /** Active offers count */
  totalOffers: number;

  /** Completed orders count */
  completedOrders: number;

  /** Operational status */
  isActive: boolean;

  /** Admin verification status */
  isVerified: boolean;

  /** Accepts reservations flag */
  acceptsReservations: boolean;

  /** Verification timestamp (optional) */
  verifiedAt?: Date | undefined;

  /** Rejection reason (if rejected) */
  rejectionReason?: string | undefined;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * Maps database establishment document to safe response DTO
 *
 * @param establishmentDoc - Mongoose establishment document
 * @returns Safe establishment data for client
 */
export function mapToSafeEstablishmentResponse(
  establishmentDoc: EstablishmentDocument,
): SafeEstablishmentResponse {
  const rawEstablishmentId: unknown = establishmentDoc._id;
  const fallbackEstablishmentId = (establishmentDoc as unknown as { id?: unknown }).id;
  const safeEstablishmentId: string =
    rawEstablishmentId !== null && rawEstablishmentId !== undefined
      ? String(rawEstablishmentId)
      : fallbackEstablishmentId !== null && fallbackEstablishmentId !== undefined
        ? String(fallbackEstablishmentId)
        : '';

  // Clean address by removing MongoDB _id field
  const safeAddress: SafeAddress = {
    street: establishmentDoc.address.street,
    city: establishmentDoc.address.city,
    postalCode: establishmentDoc.address.postalCode,
    country: establishmentDoc.address.country,
    coordinates: {
      type: 'Point',
      coordinates: establishmentDoc.address.coordinates.coordinates,
    },
  };

  // Clean business hours by removing _id if present
  const safeBusinessHours: SafeBusinessHours | undefined = establishmentDoc.businessHours
    ? {
        monday: {
          open: establishmentDoc.businessHours.monday.open,
          close: establishmentDoc.businessHours.monday.close,
          closed: establishmentDoc.businessHours.monday.closed,
        },
        tuesday: {
          open: establishmentDoc.businessHours.tuesday.open,
          close: establishmentDoc.businessHours.tuesday.close,
          closed: establishmentDoc.businessHours.tuesday.closed,
        },
        wednesday: {
          open: establishmentDoc.businessHours.wednesday.open,
          close: establishmentDoc.businessHours.wednesday.close,
          closed: establishmentDoc.businessHours.wednesday.closed,
        },
        thursday: {
          open: establishmentDoc.businessHours.thursday.open,
          close: establishmentDoc.businessHours.thursday.close,
          closed: establishmentDoc.businessHours.thursday.closed,
        },
        friday: {
          open: establishmentDoc.businessHours.friday.open,
          close: establishmentDoc.businessHours.friday.close,
          closed: establishmentDoc.businessHours.friday.closed,
        },
        saturday: {
          open: establishmentDoc.businessHours.saturday.open,
          close: establishmentDoc.businessHours.saturday.close,
          closed: establishmentDoc.businessHours.saturday.closed,
        },
        sunday: {
          open: establishmentDoc.businessHours.sunday.open,
          close: establishmentDoc.businessHours.sunday.close,
          closed: establishmentDoc.businessHours.sunday.closed,
        },
      }
    : undefined;

  return {
    id: safeEstablishmentId,
    name: establishmentDoc.name,
    description: establishmentDoc.description,
    type: establishmentDoc.type,
    status: establishmentDoc.status,
    address: safeAddress,
    phoneNumber: establishmentDoc.phoneNumber,
    email: establishmentDoc.email,
    website: establishmentDoc.website,
    images: establishmentDoc.images ?? [],
    cuisineTypes: establishmentDoc.cuisineTypes,
    businessHours: safeBusinessHours,
    averageRating: establishmentDoc.averageRating || 0,
    totalReviews: establishmentDoc.totalReviews || 0,
    totalOffers: establishmentDoc.totalOffers || 0,
    completedOrders: establishmentDoc.completedOrders || 0,
    isActive: establishmentDoc.isActive,
    isVerified: establishmentDoc.isVerified,
    acceptsReservations: establishmentDoc.acceptsReservations,
    verifiedAt: establishmentDoc.verifiedAt,
    rejectionReason: establishmentDoc.rejectionReason,
    createdAt: (establishmentDoc as unknown as { createdAt?: Date }).createdAt ?? new Date(),
    updatedAt: (establishmentDoc as unknown as { updatedAt?: Date }).updatedAt ?? new Date(),
  };
}
