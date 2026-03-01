import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';
import { DEFAULT_CURRENCY } from '../../common/enums/currency.enum';

export type OrderDocument = Order & Document;

// Specific metadata interface for order context
interface OrderMetadata {
    source?: 'mobile' | 'web' | 'api';
    deviceInfo?: {
        userAgent?: string;
        platform?: string;
        appVersion?: string;
    };
    locationInfo?: {
        ip?: string;
        country?: string;
        city?: string;
    };
    customerPreferences?: {
        communicationPrefs?: string[];
        dietaryRestrictions?: string[];
    };
    orderTracking?: {
        estimatedPickupTime?: string;
        merchantNotes?: string[];
        statusHistory?: Array<{
            status: string;
            timestamp: Date;
            updatedBy?: string;
        }>;
    };
    paymentInfo?: {
        paymentMethod?: string;
        processingTime?: number;
        failureReason?: string;
    };
    analyticsData?: {
        sessionId?: string;
        conversionSource?: string;
        timeToOrder?: number;
    };
}

export enum OrderStatus {
    PENDING = 'pending',
    RESERVED = 'reserved',           // After payment success - money held in escrow
    CONFIRMED = 'confirmed',         // Legacy - kept for backward compatibility
    READY_FOR_PICKUP = 'ready_for_pickup',
    PICKED_UP = 'picked_up',
    CANCELLED = 'cancelled',
    EXPIRED = 'expired',
    REFUNDED = 'refunded',
}

export enum PaymentStatus {
    PENDING = 'pending',
    HELD = 'held',                   // Money held in platform escrow after payment
    PAID = 'paid',                   // Legacy - kept for backward compatibility
    FAILED = 'failed',
    REFUNDED = 'refunded',
    PARTIALLY_REFUNDED = 'partially_refunded',
}

export interface OrderItem {
    offerId: Types.ObjectId;
    offerTitle: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    originalPrice: number;
    discountAmount: number;
}

export interface PickupDetails {
    timeSlot: {
        startTime: string;
        endTime: string;
    };
    scheduledDate: Date;
    actualPickupTime?: Date;
    qrCode: string;
    pickupCode: string;
    instructions?: string;
}

export interface PaymentDetails {
    method: string;
    stripePaymentIntentId?: string;
    transactionId?: string;
    amount: number;
    currency: string;
    processingFee?: number;
}

export interface DeliveryAddress {
    street: string;
    city: string;
    postalCode: string;
    country: string;
    coordinates?: {
        type: string;
        coordinates: [number, number];
    };
}

@Schema({ timestamps: true })
export class Order {
    @Prop({ required: true })
    orderNumber: string;

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    customerId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
    establishmentId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
    merchantId: Types.ObjectId;

    @Prop({
        required: true,
        type: [{
            offerId: { type: Types.ObjectId, ref: 'Offer', required: true },
            offerTitle: { type: String, required: true },
            quantity: { type: Number, required: true, min: 1 },
            unitPrice: { type: Number, required: true, min: 0 },
            totalPrice: { type: Number, required: true, min: 0 },
            originalPrice: { type: Number, required: true, min: 0 },
            discountAmount: { type: Number, required: true, min: 0 },
        }]
    })
    items: OrderItem[];

    @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
    status: OrderStatus;

    @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
    paymentStatus: PaymentStatus;

    @Prop({
        required: true,
        type: {
            timeSlot: {
                startTime: { type: String, required: true },
                endTime: { type: String, required: true },
            },
            scheduledDate: { type: Date, required: true },
            actualPickupTime: Date,
            qrCode: { type: String, required: true},
            pickupCode: { type: String, required: true, length: 6 },
            instructions: String,
        }
    })
    pickupDetails: PickupDetails;

    @Prop({
        required: true,
        type: {
            method: { type: String, required: true },
            stripePaymentIntentId: String,
            transactionId: String,
            amount: { type: Number, required: true, min: 0 },
            currency: { type: String, required: true, default: DEFAULT_CURRENCY },
            processingFee: { type: Number, min: 0 },
        }
    })
    paymentDetails: PaymentDetails;

    @Prop({
        type: {
            subtotal: { type: Number, required: true, min: 0 },
            discountAmount: { type: Number, required: true, min: 0 },
            taxAmount: { type: Number, default: 0, min: 0 },
            serviceFee: { type: Number, default: 0, min: 0 },
            total: { type: Number, required: true, min: 0 },
            currency: { type: String, required: true, default: DEFAULT_CURRENCY },
        }
    })
    pricing: {
        subtotal: number;
        discountAmount: number;
        taxAmount: number;
        serviceFee: number;
        total: number;
        currency: string;
    };

    @Prop({
        type: {
            street: String,
            city: String,
            postalCode: String,
            country: String,
            coordinates: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number] }  // ✅ Removed field-level index (schema-level at line 435)
            }
        }
    })
    establishmentAddress?: DeliveryAddress;

    @Prop()
    customerNotes?: string;

    @Prop()
    merchantNotes?: string;

    @Prop()
    cancellationReason?: string;

    @Prop()
    refundReason?: string;

    @Prop({ type: Date })
    reservedAt?: Date;

    @Prop({ type: Date })
    confirmedAt?: Date;

    @Prop({ type: Date })
    readyAt?: Date;

    @Prop({ type: Date })
    pickedUpAt?: Date;

    @Prop({ type: Date })
    cancelledAt?: Date;

    @Prop({ type: Date })
    expiredAt?: Date;

    @Prop({ type: Date })
    expiresAt?: Date;

    @Prop({ default: false })
    isRated: boolean;

    @Prop({ type: Types.ObjectId, ref: 'Review' })
    reviewId?: Types.ObjectId;

    @Prop({ type: [String], default: [] })
    notificationsSent: string[];

    @Prop({ type: Object })
    metadata?: OrderMetadata;
    @Prop({ type: Date })
    createdAt?: Date;

    @Prop({ type: Date })
    updatedAt?: Date;
    @Prop({ default: false })
    isDeleted: boolean;
    @Prop()
    deletedAt?: Date;
    @Prop({ type: Boolean, default: false })
    merchantApprovedExpiration: boolean;
    @Prop()
    deletedBy?: string;
    @Prop({
        type: {
            newDate: Date,
            requestedAt: Date,
            approved: { type: Boolean, default: null },
        },
        default: null,
    })
    pickupExtensionRequest: {
        newDate: Date;
        requestedAt: Date;
        approved: boolean | null;
    };

    // Donation tracking - 1% of order goes to community food relief
    @Prop({ default: 0, min: 0 })
    donationAmount: number;

    @Prop({ type: Types.ObjectId, ref: 'DonationPool' })
    donationPoolId?: Types.ObjectId;

    // =============================================================================
    // PICKUP SECURITY - Brute-force protection
    // =============================================================================

    /**
     * Tracks failed pickup code attempts for security lockout
     * After 5 failed attempts, order is locked for pickup validation
     */
    @Prop({ default: 0, min: 0 })
    failedPickupAttempts: number;

    @Prop()
    lastFailedPickupAt?: Date;

    /**
     * When true, pickup validation is locked due to too many failed attempts
     * Merchant must manually unlock or customer contacts support
     */
    @Prop({ default: false })
    pickupLocked: boolean;

    @Prop()
    pickupLockedAt?: Date;

    @Prop()
    pickupLockedReason?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// =============================================================================
// PERFORMANCE INDEXES - Base Coverage
// =============================================================================

/**
 * Customer Order History Index
 * - Primary index for customer order retrieval
 * - Sorted by creation date (newest first)
 * - Query pattern: find({ customerId }).sort({ createdAt: -1 })
 */
OrderSchema.index({ customerId: 1, createdAt: -1 });

/**
 * Merchant Order Management Index
 * - Enables merchants to filter orders by status
 * - Query pattern: find({ merchantId, status: 'pending' })
 */
OrderSchema.index({ merchantId: 1, status: 1 });

/**
 * Establishment Order Tracking Index
 * - Tracks orders per establishment location
 * - Query pattern: find({ establishmentId, status: 'confirmed' })
 */
OrderSchema.index({ establishmentId: 1, status: 1 });

/**
 * Order Expiration Management Index
 * - Critical for automated expiration cron jobs
 * - Query pattern: find({ status: 'confirmed', expiresAt: { $lt: now } })
 */
OrderSchema.index({ status: 1, expiresAt: 1 });

/**
 * Order Number Lookup Index
 * - Unique identifier for order retrieval
 * - Query pattern: findOne({ orderNumber: 'ORD-123456' })
 */
OrderSchema.index({ orderNumber: 1 }, { unique: true });

/**
 * QR Code Verification Index
 * - Unique index for pickup verification
 * - Query pattern: findOne({ 'pickupDetails.qrCode': scannedCode })
 */
OrderSchema.index({ 'pickupDetails.qrCode': 1 }, { unique: true });

/**
 * Pickup Code Lookup Index
 * - Manual verification fallback
 * - Query pattern: findOne({ 'pickupDetails.pickupCode': '123456' })
 */
OrderSchema.index({ 'pickupDetails.pickupCode': 1 });

/**
 * Stripe Payment Intent Index
 * - Enables payment webhook reconciliation
 * - Query pattern: findOne({ 'paymentDetails.stripePaymentIntentId': intent_id })
 */
OrderSchema.index({ 'paymentDetails.stripePaymentId': 1 });

// =============================================================================
// ENTERPRISE-GRADE OPTIMIZATION INDEXES
// =============================================================================
// Added per production readiness audit recommendations

/**
 * Triple Compound Index - Customer Filtered History
 * - Optimizes customer order history with status filtering
 * - Supports pagination and filtering simultaneously
 * - Query pattern: find({ customerId, status: 'picked_up' }).sort({ createdAt: -1 })
 * - Use case: "Show me all my completed orders"
 */
OrderSchema.index({ customerId: 1, status: 1, createdAt: -1 });

/**
 * Payment Processing Index
 * - Optimizes payment status queries for reconciliation
 * - Critical for financial reporting and failed payment recovery
 * - Query pattern: find({ paymentStatus: 'failed', createdAt: { $gte: yesterday } })
 */
OrderSchema.index({ paymentStatus: 1, createdAt: -1 });

/**
 * Payment Method Analytics Index
 * - Enables payment method usage analysis
 * - Query pattern: aggregate by payment method type
 */
OrderSchema.index({ 'paymentDetails.method': 1, createdAt: -1 });

/**
 * Soft Delete Recovery Index
 * - Optimizes queries for deleted orders (data retention compliance)
 * - Sparse index (only deleted orders)
 * - Query pattern: find({ isDeleted: true, deletedAt: { $gte: startDate } })
 */
OrderSchema.index({ isDeleted: 1, deletedAt: 1 }, { sparse: true });

/**
 * Merchant Revenue Analytics Index
 * - Optimizes revenue queries per merchant
 * - Query pattern: find({ merchantId, status: 'picked_up' }).aggregate(pricing.total)
 */
OrderSchema.index({ merchantId: 1, status: 1, createdAt: -1 });

/**
 * Pickup Date Range Index
 * - Optimizes queries for orders within specific pickup windows
 * - Query pattern: find({ 'pickupDetails.scheduledDate': { $gte: today, $lt: tomorrow } })
 */
OrderSchema.index({ 'pickupDetails.scheduledDate': 1, status: 1 });

/**
 * Review Tracking Index
 * - Finds orders without reviews for reminder campaigns
 * - Query pattern: find({ isRated: false, status: 'picked_up', pickedUpAt: { $lt: twoDaysAgo } })
 */
OrderSchema.index({ isRated: 1, status: 1, pickedUpAt: 1 });

/**
 * Geospatial Index - Establishment Address
 * - Enables location-based order analytics
 * - Query pattern: find({ 'establishmentAddress.coordinates': { $near: point } })
 * - Strategy: GeoJSON Point format [longitude, latitude]
 */
OrderSchema.index({ 'establishmentAddress.coordinates.coordinates': '2dsphere' });

/**
 * Donation Tracking Index
 * - Optimizes donation pool reconciliation
 * - Query pattern: find({ donationPoolId, createdAt: { $gte: monthStart } })
 */
OrderSchema.index({ donationPoolId: 1, createdAt: -1 }, { sparse: true });

/**
 * Extension Request Management Index
 * - Tracks pickup extension requests needing approval
 * - Query pattern: find({ 'pickupExtensionRequest.approved': null })
 */
OrderSchema.index({ 'pickupExtensionRequest.approved': 1 }, { sparse: true });

// Virtual for checking if order is expired
OrderSchema.virtual('isExpired').get(function () {
    return this.expiresAt && new Date() > this.expiresAt;
});

OrderSchema.virtual('totalItems').get(function () {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Pre-save middleware to auto-expire orders
OrderSchema.pre('save', function (next) {
    // Fallback: if expiresAt was NOT set by the service layer (e.g. legacy
    // code-path), compute it from the pickup end time + 30 minutes.
    // The primary calculation happens in OrdersService.create() using
    // offer.availableUntil + GRACE_PERIOD_MS.
    if (this.isModified('status') &&
        (this.status === OrderStatus.RESERVED || this.status === OrderStatus.CONFIRMED) &&
        !this.expiresAt) {
        const pickupDate = new Date(this.pickupDetails.scheduledDate);
        const endTime = this.pickupDetails.timeSlot.endTime.split(':');
        pickupDate.setHours(parseInt(endTime[0]), parseInt(endTime[1]), 0, 0);
        this.expiresAt = new Date(pickupDate.getTime() + (30 * 60 * 1000)); // +30 minutes fallback
    }

    if (this.isModified('status')) {
        const now = new Date();
        switch (this.status) {
            case OrderStatus.RESERVED:
                this.reservedAt = now;
                break;
            case OrderStatus.CONFIRMED:
                this.confirmedAt = now;
                break;
            case OrderStatus.READY_FOR_PICKUP:
                this.readyAt = now;
                break;
            case OrderStatus.PICKED_UP:
                this.pickedUpAt = now;
                break;
            case OrderStatus.CANCELLED:
                this.cancelledAt = now;
                break;
            case OrderStatus.EXPIRED:
                this.expiredAt = now;
                break;
        }
    }

    next();
});

// =============================================================================
// SOFT-DELETE MIDDLEWARE — Auto-exclude deleted orders from queries
// Bypass with: .setOptions({ includeDeleted: true })
// =============================================================================

OrderSchema.pre<Query<any, OrderDocument>>(/^find/, function (next) {
    if (!(this as any).getOptions()?.includeDeleted) {
        this.where({ isDeleted: { $ne: true } });
    }
    next();
});

OrderSchema.pre('aggregate', function () {
    const options = (this as any).options || {};
    if (!options.includeDeleted) {
        this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    }
});