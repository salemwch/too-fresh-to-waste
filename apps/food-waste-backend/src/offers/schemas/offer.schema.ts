import { OfferStatus, OfferType, Currency } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Query } from 'mongoose';

export type OfferDocument = Offer &
  Document & {
    availableQuantity: number;
    isExpired: boolean;
    isSoldOut: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

export { OfferStatus, OfferType, Currency };

export interface PickupTimeSlot {
  startTime: string;
  endTime: string;
  maxOrders?: number; // Optional — business decides. No limit if unset.
  currentOrders: number;
}

export interface NutritionalInfo {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  allergens?: string[];
  dietaryInfo?: string[]; // ['vegetarian', 'vegan', 'gluten-free', etc.]
}

export interface PriceInfo {
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  currency: Currency;
}

@Schema({ timestamps: true })
export class Offer {
  @Prop({ required: true, trim: true, minlength: 5, maxlength: 100 })
  title!: string;

  @Prop({ required: true, trim: true, maxlength: 1000 })
  description!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  establishmentId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  @Prop({ type: String, enum: OfferType, required: true })
  type!: OfferType;

  @Prop({ type: String, enum: OfferStatus, default: OfferStatus.DRAFT })
  status!: OfferStatus;

  @Prop({
    required: true,
    type: {
      originalPrice: { type: Number, required: true, min: 0 },
      discountedPrice: { type: Number, required: true, min: 0 },
      discountPercentage: { type: Number, required: true, min: 40, max: 90 },
      currency: { type: String, enum: Currency, required: true, default: Currency.TND },
    },
    validate: {
      validator(priceInfo: PriceInfo) {
        return (
          priceInfo.discountedPrice < priceInfo.originalPrice &&
          priceInfo.discountPercentage ===
            Math.round(
              ((priceInfo.originalPrice - priceInfo.discountedPrice) / priceInfo.originalPrice) *
                100,
            )
        );
      },
      message: 'Price validation failed',
    },
  })
  pricing!: PriceInfo;

  @Prop({ required: true, min: 1, max: 1000 })
  totalQuantity!: number;

  @Prop({ default: 0, min: 0 })
  reservedQuantity!: number;

  @Prop({ default: 0, min: 0 })
  soldQuantity!: number;

  @Prop({ type: [String], default: [] })
  images!: string[];

  @Prop({ type: [String], default: [] })
  categories!: string[];

  @Prop({
    type: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fat: Number,
      allergens: [String],
      dietaryInfo: [String],
    },
  })
  nutritionalInfo?: NutritionalInfo;

  @Prop({ required: true })
  availableFrom!: Date;

  @Prop({ required: true })
  availableUntil!: Date;

  @Prop({
    required: true,
    type: [
      {
        startTime: { type: String, required: true, match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ },
        endTime: { type: String, required: true, match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ },
        maxOrders: { type: Number, min: 1 },
        currentOrders: { type: Number, default: 0, min: 0 },
      },
    ],
    validate: {
      validator(slots: PickupTimeSlot[]) {
        return (
          slots.length > 0 &&
          slots.every(slot => {
            // Treat "00:00" end time as midnight (end of day),
            // which is always after any start time.
            const endIsValid = slot.endTime === '00:00' || slot.startTime < slot.endTime;
            return endIsValid && slot.currentOrders <= (slot.maxOrders ?? Infinity);
          })
        );
      },
      message: 'Invalid pickup time slots',
    },
  })
  pickupTimeSlots!: PickupTimeSlot[];

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop()
  estimatedWeight?: string;

  @Prop({ default: 0, min: 0 })
  viewCount!: number;

  // Tracks which users have already been counted — atomic dedup via $addToSet / $ne
  @Prop({ type: [Types.ObjectId], default: [] })
  viewedBy!: Types.ObjectId[];

  @Prop({ default: 0, min: 0 })
  favoriteCount!: number;

  @Prop({ default: true })
  isActive!: boolean;

  // =============================================================================
  // FEATURING SYSTEM - Hybrid Manual + Auto
  // =============================================================================

  /**
   * Manual featuring flag - Set by admins only
   * Persists until admin explicitly removes it
   */
  @Prop({ default: false })
  isFeaturedManual!: boolean;

  /**
   * Auto-featuring flag - Managed by cron job
   * Set automatically when offer is urgent (≤1.5h remaining, existed ≥2h)
   */
  @Prop({ default: false })
  isFeaturedAuto!: boolean;

  /**
   * Timestamp when offer was featured (manual or auto)
   * Used for audit trail and analytics
   */
  @Prop()
  featuredAt?: Date;

  /**
   * User ID who manually featured the offer
   * Only set for manual featuring (admin action)
   */
  @Prop({ type: Types.ObjectId, ref: 'User' })
  featuredBy?: Types.ObjectId;

  // =============================================================================
  // PICKUP CATEGORIZATION - Merchant-Controlled
  // =============================================================================

  /**
   * Pickup Today flag - Set by merchant when creating/editing offer
   * Shows offer in "Pickup Today" section on mobile app
   */
  @Prop({ default: false })
  isPickupToday!: boolean;

  /**
   * Pickup Tomorrow flag - Set by merchant when creating/editing offer
   * Shows offer in "Pickup Tomorrow" section on mobile app
   */
  @Prop({ default: false })
  isPickupTomorrow!: boolean;

  @Prop({ default: false })
  isRecurring!: boolean;

  @Prop({
    type: {
      monday: Boolean,
      tuesday: Boolean,
      wednesday: Boolean,
      thursday: Boolean,
      friday: Boolean,
      saturday: Boolean,
      sunday: Boolean,
    },
  })
  recurringDays?: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };

  @Prop()
  specialInstructions?: string;

  @Prop()
  cancellationDeadline?: Date;

  @Prop()
  lastModifiedBy?: Types.ObjectId;

  @Prop()
  publishedAt?: Date;

  @Prop()
  expiredAt?: Date;

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

export const OfferSchema = SchemaFactory.createForClass(Offer);

// ✅ BEST PRACTICE: Use _id only (MongoDB convention)
// Apply standard schema configuration to ensure consistent API responses
import { applyStandardSchemaConfig } from 'src/common/utils/schema-config.util';
applyStandardSchemaConfig(OfferSchema);

// =============================================================================
// INDEXES — 14 targeted indexes (trimmed from 30)
// =============================================================================

// Establishment offer listing: find({ establishmentId, status })
OfferSchema.index({ establishmentId: 1, status: 1 });

// Establishment last-offer lookup: admin $lookup sort { createdAt: -1 } + limit 1
OfferSchema.index({ establishmentId: 1, createdAt: -1 });

// Merchant dashboard: find({ merchantId, status })
OfferSchema.index({ merchantId: 1, status: 1 });

// Availability & expiration cron: find({ status, availableFrom: {$lte}, availableUntil: {$gte} })
OfferSchema.index({ status: 1, availableFrom: 1, availableUntil: 1 });

// Category browsing: find({ categories, status })
OfferSchema.index({ categories: 1, status: 1 });

// Tag discovery: find({ tags: {$in} })
OfferSchema.index({ tags: 1 });

// Featured offers (manual): find({ status, isFeaturedManual }).sort({ createdAt: -1 })
// Subsumes the simpler {isFeaturedManual:1, status:1} index
OfferSchema.index({ status: 1, isFeaturedManual: 1, availableFrom: 1, createdAt: -1 });

// Featured offers (auto): find({ status, isFeaturedAuto }).sort({ createdAt: -1 })
// Subsumes the simpler {isFeaturedAuto:1, status:1} index
OfferSchema.index({ status: 1, isFeaturedAuto: 1, availableFrom: 1, createdAt: -1 });

// Mobile "Pickup Today" section: find({ isPickupToday: true, status })
OfferSchema.index({ isPickupToday: 1, status: 1 });

// Mobile "Pickup Tomorrow" section: find({ isPickupTomorrow: true, status })
OfferSchema.index({ isPickupTomorrow: 1, status: 1 });

// Auto-featuring cron (every 5 min): find({ status, createdAt: {$lte}, availableUntil })
OfferSchema.index({ status: 1, createdAt: 1, availableUntil: 1, isFeaturedAuto: 1 });

// Newest offers sort: find({}).sort({ createdAt: -1 })
OfferSchema.index({ createdAt: -1 });

// Full-text search: find({ $text: { $search } })
OfferSchema.index({ title: 'text', description: 'text' });

// Type-based filtering: find({ type, status }).sort({ createdAt: -1 })
OfferSchema.index({ type: 1, status: 1, createdAt: -1 });

// Soft-delete recovery: find({ isDeleted: true, deletedAt })
OfferSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });

// =============================================================================
// PRE-QUERY MIDDLEWARE - Auto-filter soft-deleted records
// =============================================================================

/**
 * Pre-find middleware to automatically exclude soft-deleted offers
 * Applies to: find, findOne, findOneAndUpdate, etc.
 */
OfferSchema.pre<Query<OfferDocument[], OfferDocument>>(/^find/, function (next) {
  const queryOptions = this.getOptions() as Record<string, unknown> | undefined;
  if (queryOptions?.['includeDeleted'] !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

/**
 * Pre-aggregate middleware to exclude soft-deleted offers
 * Bypass with: .setOptions({ includeDeleted: true })
 */
OfferSchema.pre('aggregate', function () {
  const options = (this as { options?: Record<string, unknown> }).options;
  if (options?.['includeDeleted'] !== true) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  }
});

// =============================================================================
// VIRTUAL FIELDS
// =============================================================================

OfferSchema.virtual('availableQuantity').get(function () {
  return this.totalQuantity - this.reservedQuantity - this.soldQuantity;
});

OfferSchema.virtual('isExpired').get(function () {
  return new Date() > this.availableUntil;
});

OfferSchema.virtual('isSoldOut').get(function () {
  const available = this.totalQuantity - this.reservedQuantity - this.soldQuantity;
  return available <= 0;
});

/**
 * Computed isFeatured - Combines manual and auto featuring
 * Returns true if EITHER manual OR auto featuring is active
 */
OfferSchema.virtual('isFeatured').get(function () {
  return this.isFeaturedManual || this.isFeaturedAuto;
});

OfferSchema.pre('save', function (next) {
  const now = new Date();
  const availableQuantity = this.totalQuantity - this.reservedQuantity - this.soldQuantity;

  if (
    this.isModified('availableUntil') ||
    this.isModified('totalQuantity') ||
    this.isModified('reservedQuantity') ||
    this.isModified('soldQuantity')
  ) {
    if (now > this.availableUntil) {
      this.status = OfferStatus.EXPIRED;
      this.expiredAt = now;
    } else if (availableQuantity <= 0 && this.status === OfferStatus.ACTIVE) {
      this.status = OfferStatus.SOLD_OUT;
    } else if (availableQuantity > 0 && this.status === OfferStatus.SOLD_OUT) {
      this.status = OfferStatus.ACTIVE;
    }
  }

  next();
});

/**
 * Indexes below were declared only in the former ALL_INDEXES constant, never on
 * this schema. Because `autoIndex` is off in production, that constant was what
 * production actually had — so these are live indexes, and dropping the constant
 * without declaring them here would have removed them. Names are kept verbatim:
 * the same key pattern cannot exist under two names.
 *
 * Not ported: `{ isFeatured, status, createdAt }`. There is no `isFeatured`
 * field — the persisted flags are `isFeaturedManual` / `isFeaturedAuto`, and
 * `isFeatured` is only a search-DTO filter name that `offers.service.ts`
 * translates. That index matches no document and should be dropped in
 * production; `verify-indexes.ts` reports it as EXTRA.
 */

/** Merchant offer management, newest first. */
OfferSchema.index(
  { merchantId: 1, status: 1, createdAt: -1 },
  { name: 'idx_offers_merchantId_status_createdAt' },
);

/** Establishment offer listing, newest first. */
OfferSchema.index(
  { establishmentId: 1, status: 1, createdAt: -1 },
  { name: 'idx_offers_establishmentId_status_createdAt' },
);

/**
 * Public availability window. `offers.service.ts` adds `isActive: true`
 * alongside `status`, so both equality keys lead, then the two range keys.
 */
OfferSchema.index(
  { status: 1, isActive: 1, availableFrom: 1, availableUntil: 1 },
  { name: 'idx_offers_active_availability' },
);

/** Expiring-offers sweep and cron jobs. */
OfferSchema.index({ availableUntil: 1, status: 1 }, { name: 'idx_offers_availableUntil_status' });

/** Price-range filtering. */
OfferSchema.index(
  { 'pricing.discountedPrice': 1, status: 1 },
  { name: 'idx_offers_discountedPrice_status' },
);

/** Sort by biggest discount. */
OfferSchema.index(
  { 'pricing.discountPercentage': -1, status: 1 },
  { name: 'idx_offers_discountPercentage_status' },
);
