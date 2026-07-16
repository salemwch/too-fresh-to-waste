import { OrderStatus, PaymentStatus, DEFAULT_CURRENCY } from '@foodwaste/shared';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Query, Types } from 'mongoose';

export type OrderDocument = Order & Document;

export { OrderStatus, PaymentStatus };

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
  orderNumber!: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  customerId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
  establishmentId!: Types.ObjectId;

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  merchantId!: Types.ObjectId;

  @Prop({
    required: true,
    type: [
      {
        offerId: { type: Types.ObjectId, ref: 'Offer', required: true },
        offerTitle: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true, min: 0 },
        totalPrice: { type: Number, required: true, min: 0 },
        originalPrice: { type: Number, required: true, min: 0 },
        discountAmount: { type: Number, required: true, min: 0 },
      },
    ],
  })
  items!: OrderItem[];

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.PENDING })
  status!: OrderStatus;

  @Prop({ type: String, enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus!: PaymentStatus;

  @Prop({
    required: true,
    type: {
      timeSlot: {
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
      },
      scheduledDate: { type: Date, required: true },
      actualPickupTime: Date,
      qrCode: { type: String, required: true },
      pickupCode: { type: String, required: true, length: 6 },
      instructions: String,
    },
  })
  pickupDetails!: PickupDetails;

  @Prop({
    required: true,
    type: {
      method: { type: String, required: true },
      stripePaymentIntentId: String,
      transactionId: String,
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true, default: DEFAULT_CURRENCY },
      processingFee: { type: Number, min: 0 },
    },
  })
  paymentDetails!: PaymentDetails;

  @Prop({
    type: {
      subtotal: { type: Number, required: true, min: 0 },
      discountAmount: { type: Number, required: true, min: 0 },
      taxAmount: { type: Number, default: 0, min: 0 },
      serviceFee: { type: Number, default: 0, min: 0 },
      total: { type: Number, required: true, min: 0 },
      currency: { type: String, required: true, default: DEFAULT_CURRENCY },
    },
  })
  pricing!: {
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
        coordinates: { type: [Number] }, // ✅ Removed field-level index (schema-level at line 435)
      },
    },
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
  isRated!: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Review' })
  reviewId?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  notificationsSent!: string[];

  @Prop({ type: Object })
  metadata?: OrderMetadata;
  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
  @Prop({ default: false })
  isDeleted!: boolean;
  @Prop()
  deletedAt?: Date;
  @Prop({ type: Boolean, default: false })
  merchantApprovedExpiration!: boolean;
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
  pickupExtensionRequest!: {
    newDate: Date;
    requestedAt: Date;
    approved: boolean | null;
  };

  // =============================================================================
  // ONLINE PAYMENT FIELDS — Konnect Consumer Payment
  // =============================================================================

  @Prop({ type: String, enum: ['konnect', 'smt', 'cash'] })
  paymentProvider?: string;

  @Prop({
    type: {
      _id: false,
      provider: String,
      reference: String,
      payUrl: String,
      expiresAt: Date,
    },
  })
  paymentSession?: {
    provider: string;
    reference: string;
    payUrl: string;
    expiresAt: Date;
  };

  @Prop({ type: Date })
  paymentExpiresAt?: Date;

  @Prop({ type: Number, default: 0 })
  paymentAttemptSequence?: number;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Date })
  pendingPaymentAt?: Date;

  // Donation tracking - 1% of order goes to community food relief
  @Prop({ default: 0, min: 0 })
  donationAmount!: number;

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
  failedPickupAttempts!: number;

  @Prop()
  lastFailedPickupAt?: Date;

  /**
   * When true, pickup validation is locked due to too many failed attempts
   * Merchant must manually unlock or customer contacts support
   */
  @Prop({ default: false })
  pickupLocked!: boolean;

  @Prop()
  pickupLockedAt?: Date;

  @Prop()
  pickupLockedReason?: string;

  // =============================================================================
  // DELIVERY FIELDS — Driver Role MVP (Task 4)
  // =============================================================================

  // Delivery mode — customer selects at order creation
  @Prop({ type: String, enum: ['pickup', 'delivery'], default: 'pickup' })
  deliveryMode!: 'pickup' | 'delivery';

  // Customer delivery address — written once at order creation, never updated
  @Prop({
    type: {
      _id: false,
      city: String,
      coordinates: { _id: false, lat: Number, lng: Number },
    },
  })
  deliveryAddress?: {
    city: string;
    coordinates: { lat: number; lng: number };
  };

  // Pre-computed pickup window boundaries — indexed for driver pool query
  @Prop({ type: Date })
  collectionStartTime?: Date;

  @Prop({ type: Date })
  collectionEndTime?: Date;

  // Driver assignment
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  driverId?: Types.ObjectId | null;

  // Delivery lifecycle timestamps — set by DriversService on each transition.
  // findOneAndUpdate bypasses pre-save hooks, so these are written explicitly.
  @Prop({ type: Date })
  driverAssignedAt?: Date;

  @Prop({ type: Date })
  driverPickedUpAt?: Date;

  @Prop({ type: Date })
  deliveredAt?: Date;

  // Financials — all computed at order creation, immutable
  @Prop({ type: Number, min: 0 })
  estimatedDistanceKm?: number;

  @Prop({ type: Number, min: 0 })
  deliveryFee?: number;

  @Prop({ type: Number, min: 0 })
  driverEarnings?: number;

  @Prop({ type: Number, min: 0 })
  platformDeliveryCommission?: number;

  // Driver reliability — incremented on each unassign
  @Prop({ type: Number, default: 0, min: 0 })
  driverCancellationCount!: number;

  // Audit trail of every unassignment — who dropped the order, why, and when.
  // `auto` distinguishes a delivery-timeout release from a manual driver action.
  @Prop({
    type: [
      {
        _id: false,
        driverId: { type: Types.ObjectId, ref: 'User' },
        reason: String,
        auto: Boolean,
        at: Date,
      },
    ],
    default: [],
  })
  driverUnassignments!: Array<{
    driverId: Types.ObjectId;
    reason?: string;
    auto: boolean;
    at: Date;
  }>;
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

// merchantId_1_status_1 removed — prefix-covered by merchantId_1_status_1_createdAt_-1
// establishmentId_1_status_1 removed — prefix-covered by establishmentId_1_status_1_createdAt_-1

/**
 * Establishment Last-Order Lookup Index
 * - Optimises admin $lookup: { establishmentId } + sort { createdAt: -1 } + limit 1
 * - Without this MongoDB does a full collection scan per establishment row
 */
OrderSchema.index({ establishmentId: 1, createdAt: -1 });

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
 * Establishment Filtered History Index
 * - Completes the triple compound for establishment-scoped dashboard queries
 * - Supports pagination, status filtering, and date sorting simultaneously
 * - Query pattern: find({ establishmentId, status }).sort({ createdAt: -1 })
 */
OrderSchema.index({ establishmentId: 1, status: 1, createdAt: -1 });

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

// =============================================================================
// DELIVERY INDEXES — Driver Role MVP (Task 4)
// =============================================================================

/**
 * 2dsphere index for $near queries against establishment location.
 * Standalone — cannot be combined into a compound index (MongoDB limitation for $near).
 */
OrderSchema.index({ 'establishmentAddress.coordinates': '2dsphere' }, { sparse: true });

/**
 * Compound index covering all driver-pool filter fields.
 * Supports: find({ deliveryMode, status, driverId, collectionEndTime, collectionStartTime })
 */
OrderSchema.index({
  deliveryMode: 1,
  status: 1,
  driverId: 1,
  collectionEndTime: 1,
  collectionStartTime: 1,
});

/**
 * Driver own active/history order queries.
 * Supports: find({ driverId }).sort({ createdAt: -1 }) with optional status filter
 */
OrderSchema.index({ driverId: 1, status: 1, createdAt: -1 });

/**
 * Payment Expiry Cron Index
 * - Query pattern: find({ status: 'pending_payment', paymentExpiresAt: { $lte: now } })
 */
OrderSchema.index({ status: 1, paymentExpiresAt: 1 });

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
  if (
    this.isModified('status') &&
    (this.status === OrderStatus.RESERVED || this.status === OrderStatus.CONFIRMED) &&
    !this.expiresAt
  ) {
    const pickupDate = new Date(this.pickupDetails.scheduledDate);
    const [endHour = '0', endMinute = '0'] = this.pickupDetails.timeSlot.endTime.split(':');
    pickupDate.setHours(parseInt(endHour, 10), parseInt(endMinute, 10), 0, 0);
    this.expiresAt = new Date(pickupDate.getTime() + 30 * 60 * 1000); // +30 minutes fallback
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
      case OrderStatus.DRIVER_ASSIGNED:
        this.driverAssignedAt = now;
        break;
      case OrderStatus.OUT_FOR_DELIVERY:
        this.driverPickedUpAt = now;
        break;
      case OrderStatus.DELIVERED:
        this.deliveredAt = now;
        break;
      case OrderStatus.CANCELLED:
        this.cancelledAt = now;
        break;
      case OrderStatus.EXPIRED:
        this.expiredAt = now;
        break;
      case OrderStatus.PENDING_PAYMENT:
        this.pendingPaymentAt = now;
        break;
      case OrderStatus.COMPLETED:
        this.completedAt = now;
        break;
      case OrderStatus.PENDING:
      case OrderStatus.REFUNDED:
        break;
    }
  }

  next();
});

// =============================================================================
// SOFT-DELETE MIDDLEWARE — Auto-exclude deleted orders from queries
// Bypass with: .setOptions({ includeDeleted: true })
// =============================================================================

OrderSchema.pre<Query<OrderDocument[], OrderDocument>>(/^find/, function (next) {
  const queryOptions = this.getOptions() as Record<string, unknown> | undefined;
  if (queryOptions?.['includeDeleted'] !== true) {
    this.where({ isDeleted: { $ne: true } });
  }
  next();
});

OrderSchema.pre('aggregate', function () {
  const options = (this as { options?: Record<string, unknown> }).options;
  if (options?.['includeDeleted'] !== true) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
  }
});
