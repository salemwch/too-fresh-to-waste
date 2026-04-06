/**
 * Establishment Domain Zod Schemas
 *
 * Converted from backend class-validator DTOs (create-establishment, update-establishment,
 * search-establishments, coordinates, upload-documents, verify-document).
 *
 * @module shared/schemas/establishment
 */
import { z } from 'zod';

import { EstablishmentType, EstablishmentStatus, DocumentType } from '../enums';

// ============================================================================
// Nested schemas
// ============================================================================

const DayHoursSchema = z.object({
  open: z.string(),
  close: z.string(),
  closed: z.boolean(),
});

const BusinessHoursSchema = z.object({
  monday: DayHoursSchema,
  tuesday: DayHoursSchema,
  wednesday: DayHoursSchema,
  thursday: DayHoursSchema,
  friday: DayHoursSchema,
  saturday: DayHoursSchema,
  sunday: DayHoursSchema,
});

const GeoJsonPointSchema = z.object({
  type: z.string(),
  coordinates: z.tuple([z.number(), z.number()]),
});

const AddressSchema = z.object({
  street: z
    .string()
    .min(5, 'Street must be at least 5 characters')
    .max(200, 'Street cannot exceed 200 characters'),
  city: z
    .string()
    .min(2, 'City must be at least 2 characters')
    .max(50, 'City cannot exceed 50 characters'),
  postalCode: z.string().regex(/^\d{4,5}$/, 'Postal code must be 4 or 5 digits'),
  country: z
    .string()
    .min(2, 'Country must be at least 2 characters')
    .max(50, 'Country cannot exceed 50 characters'),
  coordinates: GeoJsonPointSchema,
});

const LegalDocumentsSchema = z.object({
  siret: z.string().optional(),
  license: z.string().optional(),
  vatNumber: z.string().optional(),
  businessLicense: z.string().optional(),
  foodSafetyLicense: z.string().optional(),
});

// ============================================================================
// Create Establishment
// ============================================================================

export const CreateEstablishmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description cannot exceed 500 characters'),
  type: z.nativeEnum(EstablishmentType),
  address: AddressSchema,
  phoneNumber: z.string().trim().min(1, 'Phone number is required'),
  email: z.string().trim().toLowerCase().email('Please provide a valid email address'),
  website: z.string().optional(),
  images: z.array(z.string()).optional(),
  cuisineTypes: z.array(z.string()).optional(),
  businessHours: BusinessHoursSchema.optional(),
  legalDocuments: LegalDocumentsSchema.optional(),
  acceptsReservations: z.boolean().optional(),
});

export type CreateEstablishmentInput = z.infer<typeof CreateEstablishmentSchema>;

// ============================================================================
// Update Establishment (all fields optional + status)
// ============================================================================

export const UpdateEstablishmentSchema = CreateEstablishmentSchema.partial().extend({
  status: z.nativeEnum(EstablishmentStatus).optional(),
});

export type UpdateEstablishmentInput = z.infer<typeof UpdateEstablishmentSchema>;

// ============================================================================
// Search Establishments
// ============================================================================

export const SearchEstablishmentsSchema = z.object({
  search: z.string().optional(),
  type: z.nativeEnum(EstablishmentType).optional(),
  status: z.nativeEnum(EstablishmentStatus).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  maxDistance: z.coerce.number().min(100).max(50000).optional(),
  minRating: z.coerce.number().min(1).optional(),
  isVerified: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(val => val === true || val === 'true')
    .optional(),
  acceptsReservations: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform(val => val === true || val === 'true')
    .optional(),
});

export type SearchEstablishmentsInput = z.infer<typeof SearchEstablishmentsSchema>;

// ============================================================================
// Coordinates
// ============================================================================

export const CoordinatesSchema = z.object({
  type: z.string(),
  coordinates: z.array(z.coerce.number()),
});

export type CoordinatesInput = z.infer<typeof CoordinatesSchema>;

// ============================================================================
// Upload Documents
// ============================================================================

export const UploadDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType, { message: 'Invalid document type' }),
  expiryDate: z
    .string()
    .datetime({ message: 'Expiry date must be a valid date string' })
    .optional(),
  notes: z.string().max(500, 'Notes cannot exceed 500 characters').optional(),
  additionalType: z.string().max(100, 'Additional type cannot exceed 100 characters').optional(),
});

export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

// ============================================================================
// Verify Document (admin)
// ============================================================================

export const VerifyDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType, { message: 'Invalid document type' }),
  notes: z.string().max(500).optional(),
});

export type VerifyDocumentInput = z.infer<typeof VerifyDocumentSchema>;

// ============================================================================
// Sub-exports
// ============================================================================

export {
  AddressSchema,
  BusinessHoursSchema,
  DayHoursSchema,
  GeoJsonPointSchema,
  LegalDocumentsSchema,
};
