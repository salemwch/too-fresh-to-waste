/**
 * Order Types
 * Type definitions for order creation and management
 */

// Enums — single source of truth from shared package
export { OrderStatus, PaymentStatus } from '@foodwaste/shared';
import { OrderStatus, PaymentStatus } from '@foodwaste/shared';

/**
 * Order item representing a single offer in the order
 */
export interface OrderItemDto {
  offerId: string;
  quantity: number;
}

/**
 * Pickup time slot
 */
export interface PickupTimeSlotDto {
  startTime: string; // Format: "HH:MM" (e.g., "14:00")
  endTime: string; // Format: "HH:MM" (e.g., "16:00")
}

/**
 * Payment method types
 * ✅ Matches backend CreateOrderDto enum
 */
export type PaymentMethod =
  | 'cash_on_pickup'
  | 'pay_on_delivery'
  | 'stripe'
  | 'paypal'
  | 'apple_pay'
  | 'google_pay';

/**
 * DTO for creating a new order
 * Matches backend CreateOrderDto structure
 */
export interface CreateOrderDto {
  items: OrderItemDto[];
  establishmentId: string;
  pickupTimeSlot: PickupTimeSlotDto;
  pickupDate: string; // ISO 8601 format
  paymentMethod: PaymentMethod;
  customerNotes?: string;
  pickupInstructions?: string;
}

// OrderStatus and PaymentStatus enums are re-exported from @foodwaste/shared above.

/**
 * Populated offer returned by backend when using .populate('items.offerId', 'title images')
 * Only contains the fields specified in the .populate() select string.
 */
export interface PopulatedOffer {
  _id: string;
  title?: string;
  images?: string[];
}

/**
 * Populated establishment returned by backend when using .populate()
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
 * Order response from backend
 * Field names match the @Expose() declarations in order-response.dto.ts exactly.
 * pickupCode is optional — stripped from consumer responses via excludeExtraneousValues.
 *
 * establishmentId may be a raw string (older endpoints) or a populated object
 * (my-orders, order detail). Consumers should use getEstablishmentName/getEstablishmentImage helpers.
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
 * pickupCode is mandatory (6 digits). notes is optional.
 */
export interface ConfirmPickupDto {
  pickupCode: string;
  notes?: string;
}

/**
 * Error codes returned by the confirm-pickup endpoint
 */
export type PickupErrorCode = 'CODE_EXPIRED' | 'PICKUP_ALREADY_DONE' | 'PICKUP_LOCKED' | 'ORDER_NOT_READY';

const PICKUP_ERROR_CODES: ReadonlySet<string> = new Set([
  'CODE_EXPIRED',
  'PICKUP_ALREADY_DONE',
  'PICKUP_LOCKED',
  'ORDER_NOT_READY',
]);

/**
 * Shape of the error payload thrown by the backend for pickup failures
 */
export interface PickupErrorResponse {
  statusCode: number;
  message: string;
  code: PickupErrorCode;
}

/**
 * Type guard for pickup error responses
 */
export function isPickupError(error: unknown): error is PickupErrorResponse {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as any).code === 'string' &&
    PICKUP_ERROR_CODES.has((error as any).code)
  );
}

/**
 * Phone verification error from backend
 */
export interface PhoneVerificationRequiredError {
  statusCode: 400;
  message: string;
  code: 'PHONE_VERIFICATION_REQUIRED';
  requiresPhoneSetup: boolean;
  requiresPhoneVerification: boolean;
}

/**
 * Type guard for phone verification error
 */
export function isPhoneVerificationRequired(
  error: unknown,
): error is PhoneVerificationRequiredError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as any).code === 'PHONE_VERIFICATION_REQUIRED'
  );
}

// ---------------------------------------------------------------------------
// Establishment helpers — safely extract data from string | PopulatedEstablishment
// ---------------------------------------------------------------------------

/** Extract establishment display name from order */
export function getEstablishmentName(order: Order): string {
  if (typeof order.establishmentId === 'object' && order.establishmentId?.name) {
    return order.establishmentId.name;
  }
  return 'Restaurant';
}

/** Extract the first offer image URL from the first item (or undefined) */
export function getOfferImage(order: Order): string | undefined {
  const firstItem = order.items?.[0];
  if (!firstItem) return undefined;

  const offerId = firstItem.offerId;
  if (
    typeof offerId === 'object' &&
    offerId !== null &&
    Array.isArray(offerId.images) &&
    offerId.images.length > 0
  ) {
    return offerId.images[0];
  }
  return undefined;
}

/** Extract first establishment image URL (or undefined) from order */
export function getEstablishmentImage(order: Order): string | undefined {
  if (
    typeof order.establishmentId === 'object' &&
    Array.isArray(order.establishmentId.images) &&
    order.establishmentId.images.length > 0
  ) {
    return order.establishmentId.images[0];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Paginated response from GET /orders/my-orders
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Active vs history helpers — delegate to shared, wrap with Order type
// ---------------------------------------------------------------------------
import { isActiveOrderStatus, isHistoryOrderStatus } from '@foodwaste/shared';

/** Returns true if the order is considered "active" (not completed/cancelled) */
export function isActiveOrder(order: Order): boolean {
  return isActiveOrderStatus(order.status);
}

/** Returns true if the order belongs to history */
export function isHistoryOrder(order: Order): boolean {
  return isHistoryOrderStatus(order.status);
}
