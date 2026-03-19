import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OfferDocument = Offer & Document & {
    availableQuantity: number;
    isExpired: boolean;
    isSoldOut: boolean;
    createdAt: Date;
    updatedAt: Date;
};
export enum OfferStatus {
    DRAFT = 'draft',
    ACTIVE = 'active',
    SOLD_OUT = 'sold_out',
    EXPIRED = 'expired',
    CANCELLED = 'cancelled',
    SUSPENDED = 'suspended',
}

export enum OfferType {
    SURPRISE_BAG = 'surprise_bag',
    SPECIFIC_ITEMS = 'specific_items',
    MEAL_DEAL = 'meal_deal',
    PARCLES_BAG = 'parcels_bag'
}

export enum Currency {
    TND = 'TND', // Tunisia Dinar (primary currency for this platform)
}

export interface PickupTimeSlot {
    startTime: string;
    endTime: string;
    maxOrders?: number;      // Optional — business decides. No limit if unset.
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
    title: string;

    @Prop({ required: true, trim: true, maxlength: 1000 })
    description: string;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
    establishmentId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    merchantId: Types.ObjectId;

    @Prop({ type: String, enum: OfferType, required: true })
    type: OfferType;

    @Prop({ type: String, enum: OfferStatus, default: OfferStatus.DRAFT })
    status: OfferStatus;

    @Prop({
        required: true,
        type: {
            originalPrice: { type: Number, required: true, min: 0 },
            discountedPrice: { type: Number, required: true, min: 0 },
            discountPercentage: { type: Number, required: true, min: 50, max: 90 },
            currency: { type: String, enum: Currency, required: true, default: Currency.TND },
        },
        validate: {
            validator(priceInfo: PriceInfo) {
                return priceInfo.discountedPrice < priceInfo.originalPrice &&
                    priceInfo.discountPercentage === Math.round(((priceInfo.originalPrice - priceInfo.discountedPrice) / priceInfo.originalPrice) * 100);
            },
            message: 'Price validation failed'
        }
    })
    pricing: PriceInfo;

    @Prop({ required: true, min: 1, max: 1000 })
    totalQuantity: number;

    @Prop({ default: 0, min: 0 })
    reservedQuantity: number;

    @Prop({ default: 0, min: 0 })
    soldQuantity: number;

    @Prop({ type: [String], default: [] })
    images: string[];

    @Prop({ type: [String], default: [] })
    categories: string[];

    @Prop({
        type: {
            calories: Number,
            protein: Number,
            carbs: Number,
            fat: Number,
            allergens: [String],
            dietaryInfo: [String],
        }
    })
    nutritionalInfo?: NutritionalInfo;

    @Prop({ required: true })
    availableFrom: Date;

    @Prop({ required: true })
    availableUntil: Date;

    @Prop({
        required: true,
        type: [{
            startTime: { type: String, required: true, match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ },
            endTime: { type: String, required: true, match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/ },
            maxOrders: { type: Number, min: 1 },
            currentOrders: { type: Number, default: 0, min: 0 },
        }],
        validate: {
            validator (slots: PickupTimeSlot[]) {
                return slots.length > 0 && slots.every(slot => {
                    // Treat "00:00" end time as midnight (end of day),
                    // which is always after any start time.
                    const endIsValid = slot.endTime === '00:00' || slot.startTime < slot.endTime;
                    return endIsValid && slot.currentOrders <= (slot.maxOrders ?? Infinity);
                });
            },
            message: 'Invalid pickup time slots'
        }
    })
    pickupTimeSlots: PickupTimeSlot[];


    @Prop({ type: [String], default: [] })
    tags: string[];

    @Prop()
    estimatedWeight?: string;

    @Prop({ default: 0, min: 0 })
    viewCount: number;

    // Tracks which users have already been counted — atomic dedup via $addToSet / $ne
    @Prop({ type: [Types.ObjectId], default: [] })
    viewedBy: Types.ObjectId[];

    @Prop({ default: 0, min: 0 })
    favoriteCount: number;

    @Prop({ default: true })
    isActive: boolean;

    // =============================================================================
    // FEATURING SYSTEM - Hybrid Manual + Auto
    // =============================================================================

    /**
     * Manual featuring flag - Set by admins only
     * Persists until admin explicitly removes it
     */
    @Prop({ default: false })
    isFeaturedManual: boolean;

    /**
     * Auto-featuring flag - Managed by cron job
     * Set automatically when offer is urgent (≤1.5h remaining, existed ≥2h)
     */
    @Prop({ default: false })
    isFeaturedAuto: boolean;

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
    isPickupToday: boolean;

    /**
     * Pickup Tomorrow flag - Set by merchant when creating/editing offer
     * Shows offer in "Pickup Tomorrow" section on mobile app
     */
    @Prop({ default: false })
    isPickupTomorrow: boolean;

    @Prop({ default: false })
    isRecurring: boolean;

    @Prop({
        type: {
            monday: Boolean,
            tuesday: Boolean,
            wednesday: Boolean,
            thursday: Boolean,
            friday: Boolean,
            saturday: Boolean,
            sunday: Boolean,
        }
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
    isDeleted: boolean;

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
// PERFORMANCE INDEXES - Base Coverage
// =============================================================================

/**
 * Establishment Offer Management Index
 * - Primary index for establishment-specific offer queries
 * - Query pattern: find({ establishmentId, status: 'active' })
 */
OfferSchema.index({ establishmentId: 1, status: 1 });

/**
 * Merchant Offer Portfolio Index
 * - Enables merchants to manage all offers across establishments
 * - Query pattern: find({ merchantId, status: 'active' })
 */
OfferSchema.index({ merchantId: 1, status: 1 });

/**
 * Time-Based Availability Index
 * - Critical for offer expiration and activation cron jobs
 * - Query pattern: find({ status: 'active', availableFrom: { $lte: now }, availableUntil: { $gte: now } })
 */
OfferSchema.index({ status: 1, availableFrom: 1, availableUntil: 1 });

/**
 * Category Filtering Index
 * - Enables category-based offer browsing
 * - Query pattern: find({ categories: 'bakery', status: 'active' })
 */
OfferSchema.index({ categories: 1, status: 1 });

/**
 * Tag Search Index
 * - Supports tag-based discovery
 * - Query pattern: find({ tags: { $in: ['vegan', 'gluten-free'] } })
 */
OfferSchema.index({ tags: 1 });

/**
 * Featured Offers Index - Manual Featuring
 * - Optimizes queries for manually promoted offers
 * - Query pattern: find({ isFeaturedManual: true, status: 'active' })
 */
OfferSchema.index({ isFeaturedManual: 1, status: 1 });

/**
 * Auto-Featured Offers Index
 * - Optimizes queries for auto-promoted offers
 * - Query pattern: find({ isFeaturedAuto: true, status: 'active' })
 */
OfferSchema.index({ isFeaturedAuto: 1, status: 1 });

/**
 * Pickup Today Offers Index
 * - Optimizes queries for pickup today section
 * - Query pattern: find({ isPickupToday: true, status: 'active' })
 */
OfferSchema.index({ isPickupToday: 1, status: 1 });

/**
 * Pickup Tomorrow Offers Index
 * - Optimizes queries for pickup tomorrow section
 * - Query pattern: find({ isPickupTomorrow: true, status: 'active' })
 */
OfferSchema.index({ isPickupTomorrow: 1, status: 1 });

/**
 * Auto-Featuring Eligibility Index
 * - Critical for cron job performance
 * - Query pattern: find({ status: 'active', createdAt: { $lte: cutoff }, availableUntil: { $lte: urgency, $gte: now } })
 * - Used by: Auto-featuring cron job (every 5 minutes)
 */
OfferSchema.index({
    status: 1,
    createdAt: 1,
    availableUntil: 1,
    isFeaturedAuto: 1  // Include to speed up update queries
});

/**
 * Chronological Sorting Index
 * - Supports "newest offers" queries
 * - Query pattern: find({}).sort({ createdAt: -1 })
 */
OfferSchema.index({ createdAt: -1 });

/**
 * Full-Text Search Index
 * - Enables text search across title and description
 * - Query pattern: find({ $text: { $search: 'pizza italian' } })
 */
OfferSchema.index({ title: 'text', description: 'text' });

// =============================================================================
// ENTERPRISE-GRADE OPTIMIZATION INDEXES
// =============================================================================
// Added per production readiness audit recommendations

/**
 * Active Featured Offers Index - Manual
 * - Optimizes high-visibility featured offer queries with availability
 * - Query pattern: find({ status: 'active', isFeaturedManual: true, availableFrom: { $lte: now } }).sort({ createdAt: -1 })
 * - Use case: Homepage featured section (manually featured offers)
 */
OfferSchema.index({
    status: 1,
    isFeaturedManual: 1,
    availableFrom: 1,
    createdAt: -1
});

/**
 * Active Featured Offers Index - Auto
 * - Optimizes high-visibility featured offer queries with availability
 * - Query pattern: find({ status: 'active', isFeaturedAuto: true, availableFrom: { $lte: now } }).sort({ createdAt: -1 })
 * - Use case: Homepage featured section (auto-featured offers)
 */
OfferSchema.index({
    status: 1,
    isFeaturedAuto: 1,
    availableFrom: 1,
    createdAt: -1
});

/**
 * Type-Based Discovery Index
 * - Enables offer type filtering (surprise bags, specific items, meal deals)
 * - Query pattern: find({ type: 'surprise_bag', status: 'active' }).sort({ createdAt: -1 })
 */
OfferSchema.index({ type: 1, status: 1, createdAt: -1 });

/**
 * Availability Window Index
 * - Optimizes "available now" queries
 * - Query pattern: find({ availableFrom: { $lte: now }, availableUntil: { $gte: now }, status: 'active' })
 */
OfferSchema.index({ availableFrom: 1, availableUntil: 1, status: 1 });

/**
 * Sold Out Detection Index
 * - Identifies offers approaching sold-out status
 * - Query pattern: find({ reservedQuantity: { $gte: totalQuantity * 0.9 }, status: 'active' })
 */
OfferSchema.index({ soldQuantity: 1, totalQuantity: 1, status: 1 });

/**
 * Discount Range Index
 * - Enables discount percentage filtering
 * - Query pattern: find({ 'pricing.discountPercentage': { $gte: 50 }, status: 'active' })
 * - Use case: "Offers 50% off or more"
 */
OfferSchema.index({ 'pricing.discountPercentage': -1, status: 1 });

/**
 * Price Range Index
 * - Supports price-based filtering
 * - Query pattern: find({ 'pricing.discountedPrice': { $lte: 10 }, status: 'active' })
 */
OfferSchema.index({ 'pricing.discountedPrice': 1, status: 1 });

/**
 * Popularity Metrics Index
 * - Enables sorting by popularity (views, favorites)
 * - Query pattern: find({ status: 'active' }).sort({ viewCount: -1, favoriteCount: -1 })
 */
OfferSchema.index({ viewCount: -1, favoriteCount: -1, status: 1 });

/**
 * Unique View Dedup Index
 * - Speeds up the $ne membership check in the atomic view-count update
 * - Query pattern: findOneAndUpdate({ _id, viewedBy: { $ne: userId } })
 */
OfferSchema.index({ viewedBy: 1 });

/**
 * Dietary Filtering Index
 * - Optimizes dietary preference searches
 * - Query pattern: find({ 'nutritionalInfo.dietaryInfo': { $in: ['vegan'] }, status: 'active' })
 */
OfferSchema.index({ 'nutritionalInfo.dietaryInfo': 1, status: 1 });

/**
 * Allergen Filtering Index
 * - Critical for allergy-safe browsing
 * - Query pattern: find({ 'nutritionalInfo.allergens': { $nin: ['peanuts'] }, status: 'active' })
 */
OfferSchema.index({ 'nutritionalInfo.allergens': 1, status: 1 });

/**
 * Recurring Offers Index
 * - Identifies recurring offer patterns
 * - Query pattern: find({ isRecurring: true, isActive: true })
 */
OfferSchema.index({ isRecurring: 1, isActive: 1 });

/**
 * Draft Management Index
 * - Helps merchants manage unpublished offers
 * - Query pattern: find({ merchantId, status: 'draft' }).sort({ createdAt: -1 })
 */
OfferSchema.index({ merchantId: 1, status: 1, publishedAt: 1 });

/**
 * Expiration Processing Index
 * - Optimizes automated expiration jobs
 * - Query pattern: find({ status: 'active', availableUntil: { $lt: now } })
 */
OfferSchema.index({ status: 1, availableUntil: 1, expiredAt: 1 });

/**
 * Pickup Time Slot Availability Index
 * - Helps identify available time slots
 * - Query pattern: aggregate pipeline for slot availability analysis
 */
OfferSchema.index({ 'pickupTimeSlots.currentOrders': 1, 'pickupTimeSlots.maxOrders': 1 });

/**
 * Modifier Tracking Index
 * - Audit trail for offer modifications
 * - Query pattern: find({ lastModifiedBy, updatedAt: { $gte: startDate } })
 */
OfferSchema.index({ lastModifiedBy: 1, updatedAt: -1 }, { sparse: true });

/**
 * Category + Type Compound Index
 * - Advanced filtering for category and type combinations
 * - Query pattern: find({ categories: 'bakery', type: 'surprise_bag', status: 'active' })
 */
OfferSchema.index({ categories: 1, type: 1, status: 1 });

/**
 * Soft Delete Recovery Index
 * - Optimizes queries for deleted offers (data retention compliance)
 * - Sparse index (only deleted offers)
 * - Query pattern: find({ isDeleted: true, deletedAt: { $gte: startDate } })
 */
OfferSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });

// =============================================================================
// PRE-QUERY MIDDLEWARE - Auto-filter soft-deleted records
// =============================================================================

import { Query } from 'mongoose';

/**
 * Pre-find middleware to automatically exclude soft-deleted offers
 * Applies to: find, findOne, findOneAndUpdate, etc.
 */
OfferSchema.pre<Query<any, OfferDocument>>(/^find/, function (next) {
    if (!(this as any).getOptions()?.includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

/**
 * Pre-aggregate middleware to exclude soft-deleted offers
 * Bypass with: .setOptions({ includeDeleted: true })
 */
OfferSchema.pre('aggregate', function () {
    const options = (this as any).options || {};
    if (!options.includeDeleted) {
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

    if (this.isModified('availableUntil') || this.isModified('totalQuantity') ||
        this.isModified('reservedQuantity') || this.isModified('soldQuantity')) {

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