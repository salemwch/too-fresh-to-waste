import { OrderStatus } from '../enums/order.enum';

import type { PaymentStatus } from '../enums/order.enum';

/**
 * Order item representing a single offer in the order
 */
export interface OrderItemDto {
  offerId: string;
  quantity: number;
}

/**
 * Pickup time slot for orders
 */
export interface PickupTimeSlotDto {
  startTime: string; // Format: "HH:MM"
  endTime: string; // Format: "HH:MM"
}

/**
 * Payment method types matching backend CreateOrderDto
 */
export type OrderPaymentMethod =
  | 'cash_on_pickup'
  | 'pay_on_delivery'
  | 'online'
  | 'stripe'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay';

/**
 * Delivery address shape used when deliveryMode is 'delivery'
 */
export interface DeliveryAddressDto {
  city: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

/**
 * DTO for creating a new order
 * Matches backend CreateOrderDto structure
 */
export interface CreateOrderDto {
  items: OrderItemDto[];
  establishmentId: string;
  pickupTimeSlot: PickupTimeSlotDto;
  pickupDate: string; // ISO 8601
  paymentMethod: OrderPaymentMethod;
  customerNotes?: string;
  pickupInstructions?: string;
  deliveryMode?: 'pickup' | 'delivery';
  deliveryAddress?: DeliveryAddressDto;
}

/**
 * Populated offer fields from .populate('items.offerId')
 * Only contains fields specified in the .populate() select string.
 */
export interface PopulatedOffer {
  _id: string;
  title?: string;
  images?: string[];
}

/**
 * Populated establishment fields from .populate()
 * Matches PopulatedEstablishmentResponseDto in order-response.dto.ts
 */
export interface PopulatedEstablishment {
  _id: string;
  name: string;
  address?: Record<string, unknown>;
  phoneNumber?: string;
  type?: string;
  images?: string[];
  averageRating?: number;
}

/**
 * Order response from backend.
 * Field names match @Expose() declarations in order-response.dto.ts.
 *
 * establishmentId may be a raw string (older endpoints) or a populated object
 * (my-orders, order detail). Use getEstablishmentName/getEstablishmentImage helpers.
 */
export interface Order {
  _id: string;
  orderNumber: string;
  customerId: string;
  establishmentId: string | PopulatedEstablishment;
  merchantId: string;
  items: Array<{
    offerId: string | PopulatedOffer;
    offerTitle: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    originalPrice: number;
    discountAmount: number;
  }>;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  pickupDetails: {
    timeSlot: PickupTimeSlotDto;
    scheduledDate: string;
    actualPickupTime?: string;
    qrCode: string;
    pickupCode?: string;
    instructions?: string;
  };
  paymentDetails: {
    method: string;
    stripePaymentIntentId?: string;
    transactionId?: string;
    amount: number;
    currency: string;
    processingFee?: number;
  };
  pricing: {
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    serviceFee: number;
    total: number;
    currency: string;
  };
  paymentProvider?: 'konnect' | 'smt' | 'cash';
  paymentSession?: {
    provider: string;
    reference: string;
    payUrl: string;
    expiresAt: string;
  };
  paymentExpiresAt?: string;
  paymentAttemptSequence?: number;
  completedAt?: string;
  pendingPaymentAt?: string;
  deliveryMode?: 'pickup' | 'delivery';
  donationAmount: number;
  expiresAt?: string;
  customerNotes?: string;
  merchantNotes?: string;
  cancellationReason?: string;
  isRated?: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO sent to PATCH /orders/:id/confirm-pickup
 */
export interface ConfirmPickupDto {
  pickupCode: string;
  notes?: string;
}

/**
 * Error codes returned by the confirm-pickup endpoint
 */
export type PickupErrorCode =
  | 'CODE_EXPIRED'
  | 'PICKUP_ALREADY_DONE'
  | 'PICKUP_LOCKED'
  | 'ORDER_NOT_READY';

/**
 * Paginated response from GET /orders/my-orders
 */
export interface PaginatedOrdersResponse {
  data: Order[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// ============================================================================
// Order status helpers — usable by any app that has { status: OrderStatus }
// ============================================================================

/** Statuses that represent an in-progress order (pickup and delivery modes) */
const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.PENDING,
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
  OrderStatus.DRIVER_ASSIGNED,
  OrderStatus.OUT_FOR_DELIVERY,
]);

/** Statuses that represent a completed/terminal order (pickup and delivery modes) */
const HISTORY_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.PICKED_UP,
  OrderStatus.COMPLETED,
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
  OrderStatus.REFUNDED,
]);

/** Returns true if the order status is considered "active" (in-progress) */
export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Returns true if the order status belongs to history (terminal) */
export function isHistoryOrderStatus(status: OrderStatus): boolean {
  return HISTORY_STATUSES.has(status);
}
