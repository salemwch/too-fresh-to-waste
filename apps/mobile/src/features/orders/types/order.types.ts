/**
 * Order Types
 * Type definitions for order creation and management
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { OrderStatus, PaymentStatus } from '@foodwaste/shared';

export type {
  OrderItemDto,
  PickupTimeSlotDto,
  CreateOrderDto,
  PopulatedOffer,
  PopulatedEstablishment,
  Order,
  ConfirmPickupDto,
  PickupErrorCode,
  PaginatedOrdersResponse,
} from '@foodwaste/shared';

// Backward-compatible alias: mobile uses PaymentMethod, shared uses OrderPaymentMethod
export type { OrderPaymentMethod as PaymentMethod } from '@foodwaste/shared';

import { isActiveOrderStatus, isHistoryOrderStatus } from '@foodwaste/shared';

import type { Order, PickupErrorCode } from '@foodwaste/shared';

// ============================================================================
// Mobile-only types and helpers
// ============================================================================

const PICKUP_ERROR_CODES: ReadonlySet<string> = new Set([
  'CODE_EXPIRED',
  'PICKUP_ALREADY_DONE',
  'PICKUP_LOCKED',
  'ORDER_NOT_READY',
]);

/**
 * Shape of the error payload thrown by the backend for pickup failures
 */
interface PickupErrorResponse {
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
// Active vs history helpers — delegate to shared, wrap with Order type
// ---------------------------------------------------------------------------

/** Returns true if the order is considered "active" (not completed/cancelled) */
export function isActiveOrder(order: Order): boolean {
  return isActiveOrderStatus(order.status);
}

/** Returns true if the order belongs to history */
export function isHistoryOrder(order: Order): boolean {
  return isHistoryOrderStatus(order.status);
}
