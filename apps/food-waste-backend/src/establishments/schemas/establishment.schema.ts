import { EstablishmentType, EstablishmentStatus } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { Document, Types, Query } from 'mongoose';

import { CoordinatesDto } from '../DTO/cordinates.dto';

export type EstablishmentDocument = Establishment & Document;

// Re-export enums for backward compatibility
export { EstablishmentType, EstablishmentStatus };

export interface BusinessHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates: {
    type: string;
    coordinates: [number, number];
  };
}

/**
 * Document metadata for tracking uploaded files
 */
export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: Date;
  uploadedBy?: string | undefined;
  verified?: boolean | undefined;
  verifiedAt?: Date | undefined;
  verifiedBy?: string | undefined;
  expiryDate?: Date | undefined;
  notes?: string | undefined;
}

/**
 * Enterprise-grade legal documents structure
 * Supports both document IDs/numbers and uploaded file URLs
 */
export interface LegalDocuments {
  // Business registration numbers (text)
  siret?: string | undefined;
  license?: string | undefined;
  vatNumber?: string | undefined;

  // Uploaded document URLs with metadata
  businessLicenseUrl?: string | undefined;
  businessLicenseMetadata?: DocumentMetadata | undefined;

  foodSafetyLicenseUrl?: string | undefined;
  foodSafetyLicenseMetadata?: DocumentMetadata | undefined;

  insuranceDocumentUrl?: string | undefined;
  insuranceDocumentMetadata?: DocumentMetadata | undefined;

  taxCertificateUrl?: string | undefined;
  taxCertificateMetadata?: DocumentMetadata | undefined;

  ownerIdDocumentUrl?: string | undefined;
  ownerIdDocumentMetadata?: DocumentMetadata | undefined;

  // Additional documents
  additionalDocuments?:
    | Array<{
        type: string;
        url: string;
        metadata: DocumentMetadata;
      }>
    | undefined;
}

@Schema({ timestamps: true })
export class Establishment {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 500 })
  description!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  ownerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization' })
  organizationId?: Types.ObjectId;

  @Prop({ type: String, enum: EstablishmentType, required: true })
  type!: EstablishmentType;

  @Prop({ type: String, enum: EstablishmentStatus, default: EstablishmentStatus.PENDING })
  status!: EstablishmentStatus;

  @ValidateNested()
  @Type(() => CoordinatesDto)
  coordinates!: CoordinatesDto;
  @Prop({
    required: true,
    type: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
          type: [Number],
          required: true,
          validate: {
            validator(coords: number[]) {
              const [longitude, latitude] = coords;
              return (
                coords.length === 2 &&
                longitude !== undefined &&
                latitude !== undefined &&
                longitude >= -180 &&
                longitude <= 180 &&
                latitude >= -90 &&
                latitude <= 90
              );
            },
            message: 'Invalid coordinates format',
          },
        },
      },
    },
  })
  address!: Address;

  @Prop({
    required: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number'],
  })
  phoneNumber!: string;

  @Prop({
    required: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
  })
  email!: string;

  @Prop()
  googlePlaceId?: string;

  @Prop()
  website?: string;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [String], default: [] })
  cuisineTypes!: string[];

  @Prop({
    type: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } },
    },
  })
  businessHours?: BusinessHours;

  @Prop({
    type: {
      // Business registration numbers
      siret: String,
      license: String,
      vatNumber: String,

      // Document URLs
      businessLicenseUrl: String,
      businessLicenseMetadata: {
        fileName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: String,
        expiryDate: Date,
        notes: String,
      },

      foodSafetyLicenseUrl: String,
      foodSafetyLicenseMetadata: {
        fileName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: String,
        expiryDate: Date,
        notes: String,
      },

      insuranceDocumentUrl: String,
      insuranceDocumentMetadata: {
        fileName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: String,
        expiryDate: Date,
        notes: String,
      },

      taxCertificateUrl: String,
      taxCertificateMetadata: {
        fileName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: String,
        expiryDate: Date,
        notes: String,
      },

      ownerIdDocumentUrl: String,
      ownerIdDocumentMetadata: {
        fileName: String,
        fileSize: Number,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: String,
        verified: Boolean,
        verifiedAt: Date,
        verifiedBy: String,
        expiryDate: Date,
        notes: String,
      },

      // Additional documents array
      additionalDocuments: [
        {
          type: String,
          url: String,
          metadata: {
            fileName: String,
            fileSize: Number,
            mimeType: String,
            uploadedAt: Date,
            uploadedBy: String,
            verified: Boolean,
            verifiedAt: Date,
            verifiedBy: String,
            expiryDate: Date,
            notes: String,
          },
        },
      ],
    },
  })
  legalDocuments?: LegalDocuments;

  @Prop({ default: 0, min: 0, max: 5 })
  averageRating!: number;

  @Prop({ default: 0, min: 0 })
  totalReviews!: number;

  @Prop({ default: 0, min: 0 })
  totalOffers!: number;

  @Prop({ default: 0, min: 0 })
  completedOrders!: number;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isVerified!: boolean;

  @Prop({
    type: String,
    enum: ['trial', 'paid', 'suspended'],
    default: 'trial',
  })
  subscriptionStatus!: 'trial' | 'paid' | 'suspended';

  @Prop({ type: Date })
  trialEndsAt?: Date;

  @Prop({ type: Date })
  trialExpiringNotifiedAt?: Date;

  @Prop({ default: false })
  acceptsReservations!: boolean;

  @Prop()
  rejectionReason?: string;

  @Prop()
  verifiedAt?: Date;

  @Prop()
  lastActiveAt?: Date;

  @Prop({
    type: {
      scheduledReactivation: {
        jobId: String,
        scheduledFor: Date,
        scheduledAt: Date,
        status: {
          type: String,
          enum: ['pending', 'completed', 'cancelled', 'failed'],
          default: 'pending',
        },
        cancelledAt: Date,
        completedAt: Date,
        failedAt: Date,
        error: String,
      },
    },
    default: {},
  })
  metadata?: {
    scheduledReactivation?: {
      jobId: string;
      scheduledFor: Date;
      scheduledAt: Date;
      status: 'pending' | 'completed' | 'cancelled' | 'failed';
      cancelledAt?: Date;
      completedAt?: Date;
      failedAt?: Date;
      error?: string;
    };
  };

  // Soft Delete Fields
  @Prop({ default: false })
  isDeleted!: boolean;

  @Prop()
  deletedAt?: Date;

  @Prop({ type: String })
  deletedBy?: string;

  @Prop()
  deletionReason?: string;
}

export const EstablishmentSchema = SchemaFactory.createForClass(Establishment);

// =============================================================================
// PERFORMANCE INDEXES - Base Coverage
// =============================================================================

/**
 * Geospatial Index - Establishment Location
 * - Primary index for location-based searches
 * - Supports $near, $geoWithin, $geoIntersects operators
 * - Query pattern: find({ 'address.coordinates': { $near: userLocation } })
 * - Strategy: GeoJSON Point format [longitude, latitude]
 */
EstablishmentSchema.index({ 'address.coordinates': '2dsphere' });

/**
 * Owner Management Index
 * - Enables merchants to filter their establishments by status
 * - Query pattern: find({ ownerId, status: 'active' })
 */
EstablishmentSchema.index({ ownerId: 1, status: 1 });

/**
 * Public Listing Index
 * - Optimizes filtering by status and type
 * - Query pattern: find({ status: 'active', type: 'restaurant' })
 */
EstablishmentSchema.index({ status: 1, type: 1 });

// isActive_1_isVerified_1 removed — prefix-covered by isActive_1_isVerified_1_status_1_averageRating_-1

/**
 * Full-Text Search Index
 * - Enables text search across name and description
 * - Query pattern: find({ $text: { $search: 'pizza italian' } })
 */
EstablishmentSchema.index({ name: 'text', description: 'text' });

// =============================================================================
// ENTERPRISE-GRADE OPTIMIZATION INDEXES
// =============================================================================
// Added per production readiness audit recommendations

/**
 * Google Place ID Lookup Index
 * - Enables deduplication and lookup by Google Place ID
 * - Sparse index (only establishments linked to Google Places)
 * - Query pattern: findOne({ googlePlaceId: 'ChIJ...' })
 */
EstablishmentSchema.index({ googlePlaceId: 1 }, { sparse: true });

/**
 * Email Contact Lookup Index
 * - Enables email-based establishment lookup during onboarding
 * - Prevents duplicate establishment registration
 * - Query pattern: findOne({ email: 'contact@restaurant.com' })
 */
EstablishmentSchema.index({ email: 1 });

/**
 * Phone Number Contact Index
 * - Enables phone-based verification and contact
 * - Query pattern: findOne({ phoneNumber: '+33612345678' })
 */
EstablishmentSchema.index({ phoneNumber: 1 });

/**
 * Premium Listing Index
 * - Optimizes queries for verified, active establishments sorted by rating
 * - Query pattern: find({ isActive: true, isVerified: true, status: 'active' }).sort({ averageRating: -1 })
 * - Use case: "Top-rated restaurants near you"
 */
EstablishmentSchema.index({
  isActive: 1,
  isVerified: 1,
  status: 1,
  averageRating: -1,
});

/**
 * Location + Type + Rating Compound Index
 * - Optimizes geospatial queries with type filtering and rating sort
 * - Used for advanced search: "Best bakeries within 5km"
 * - Query pattern: $geoNear aggregation with type and rating filters
 */
EstablishmentSchema.index({
  type: 1,
  isActive: 1,
  averageRating: -1,
});

/**
 * Verification Audit Index
 * - Tracks verification timeline for compliance
 * - Query pattern: find({ isVerified: true, verifiedAt: { $gte: startDate } })
 */
EstablishmentSchema.index({ isVerified: 1, verifiedAt: 1 }, { sparse: true });

/**
 * Pending Verification Queue Index
 * - Optimizes admin approval workflows
 * - Query pattern: find({ status: 'pending', isVerified: false }).sort({ createdAt: 1 })
 */
EstablishmentSchema.index({ status: 1, isVerified: 1, createdAt: 1 });

/**
 * Activity Tracking Index
 * - Identifies inactive establishments for re-engagement
 * - Query pattern: find({ lastActiveAt: { $lt: thirtyDaysAgo }, isActive: true })
 */
EstablishmentSchema.index({ lastActiveAt: 1, isActive: 1 }, { sparse: true });

/**
 * Performance Analytics Index
 * - Enables merchant performance dashboards
 * - Query pattern: find({ ownerId }).aggregate(completedOrders, totalOffers, averageRating)
 */
EstablishmentSchema.index({
  ownerId: 1,
  completedOrders: -1,
  averageRating: -1,
});

/**
 * Rejection Analysis Index
 * - Tracks rejected establishments for compliance
 * - Query pattern: find({ status: 'rejected', rejectionReason: { $exists: true } })
 */
EstablishmentSchema.index({ status: 1, rejectionReason: 1 }, { sparse: true });

/**
 * Document Verification Index
 * - Optimizes queries for establishments with missing documents
 * - Query pattern: find({ 'legalDocuments.businessLicenseUrl': { $exists: false } })
 */
EstablishmentSchema.index(
  {
    'legalDocuments.businessLicenseMetadata.verified': 1,
    'legalDocuments.foodSafetyLicenseMetadata.verified': 1,
  },
  { sparse: true },
);

/**
 * City + Type Discovery Index
 * - Enables city-wide establishment browsing
 * - Query pattern: find({ 'address.city': 'Paris', type: 'restaurant', isActive: true })
 */
EstablishmentSchema.index({ 'address.city': 1, type: 1, isActive: 1 });

/**
 * Scheduled Reactivation Index
 * - Manages automated reactivation jobs
 * - Query pattern: find({ 'metadata.scheduledReactivation.status': 'pending' })
 */
EstablishmentSchema.index(
  {
    'metadata.scheduledReactivation.status': 1,
    'metadata.scheduledReactivation.scheduledFor': 1,
  },
  { sparse: true },
);

/**
 * Trial Expiry Scanner Index
 * - Powers the daily trial-expiry cron that finds merchants whose free trial has ended
 * - Query pattern: find({ subscriptionStatus: 'trial', trialEndsAt: { $lt: now } })
 * - Also covers expiring-soon queries with a date range on trialEndsAt
 */
EstablishmentSchema.index({ subscriptionStatus: 1, trialEndsAt: 1 }, { sparse: true });

/**
 * Soft Delete Recovery Index
 * - Optimizes queries for deleted establishments (data retention compliance)
 * - Sparse index (only deleted establishments)
 * - Query pattern: find({ isDeleted: true, deletedAt: { $gte: startDate } })
 */
EstablishmentSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });

/**
 * Organization Lookup Index
 * - Enables multi-location queries scoped to an organization
 * - Sparse: only indexes establishments that belong to an organization
 * - Query pattern: find({ organizationId: new Types.ObjectId(orgId) })
 */
EstablishmentSchema.index({ organizationId: 1 }, { sparse: true });

// =============================================================================
// PRE-QUERY MIDDLEWARE - Auto-filter soft-deleted records
// =============================================================================

/**
 * Pre-find middleware to automatically exclude soft-deleted establishments
 * Applies to: find, findOne, findOneAndUpdate, etc.
 */
EstablishmentSchema.pre<Query<EstablishmentDocument[], EstablishmentDocument>>(
  /^find/,
  function (next) {
    const queryOptions = this.getOptions() as Record<string, unknown> | undefined;
    if (queryOptions?.['includeDeleted'] !== true) {
      this.where({ isDeleted: { $ne: true } });
    }
    next();
  },
);

/**
 * Pre-aggregate middleware to exclude soft-deleted establishments
 * Bypass with: .setOptions({ includeDeleted: true })
 */
EstablishmentSchema.pre('aggregate', function () {
  const options = (this as { options?: Record<string, unknown> }).options;
  if (options?.['includeDeleted'] !== true) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  }
});
