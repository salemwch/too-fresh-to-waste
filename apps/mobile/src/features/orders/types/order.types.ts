/**
 * Order Types
 * Type definitions for order creation and management
 */

// ============================================================================
// Shared types — re-exported from @foodwaste/shared (single source of truth)
// ============================================================================
export { OrderStatus } from '@foodwaste/shared';

export type {
  CreateOrderDto,
  Order,
  ConfirmPickupDto,
  PickupErrorCode,
  PaginatedOrdersResponse,
  CursorPaginatedOrdersResponse,
} from '@foodwaste/shared';

export {
  getEstablishmentName,
  getEstablishmentImage,
  getOfferImage,
  isActiveOrder,
  isHistoryOrder,
} from '@foodwaste/shared';

import type { PickupErrorCode } from '@foodwaste/shared';

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

interface ErrorWithCode {
  code: string;
}

const hasStringCode = (error: unknown): error is ErrorWithCode =>
  typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string';

/**
 * Type guard for pickup error responses
 */
export function isPickupError(error: unknown): error is PickupErrorResponse {
  return hasStringCode(error) && PICKUP_ERROR_CODES.has(error.code);
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
  return hasStringCode(error) && error.code === 'PHONE_VERIFICATION_REQUIRED';
}
