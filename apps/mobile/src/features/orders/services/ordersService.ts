/**
 * Orders Service
 * API integration for order operations with centralized error handling
 */

import axios from 'axios';

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import { isPickupError } from '../types/order.types';

import type {
  CreateOrderDto,
  Order,
  ConfirmPickupDto,
  PaginatedOrdersResponse,
  CursorPaginatedOrdersResponse,
} from '../types/order.types';

interface ValidationErrorMessage {
  constraints?: Record<string, string>;
}

interface OrderErrorPayload {
  code?: string;
  message?: string | Array<string | ValidationErrorMessage>;
  response?: OrderErrorPayload;
  details?: unknown;
  requiresPhoneSetup?: boolean;
  requiresPhoneVerification?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const asOrderErrorPayload = (value: unknown): OrderErrorPayload | undefined =>
  isRecord(value) ? (value as OrderErrorPayload) : undefined;

const getPrimaryOrderPayload = (payload: OrderErrorPayload | undefined): unknown =>
  payload?.details ?? payload?.response ?? payload;

const extractValidationReasons = (details: unknown): string[] => {
  if (!Array.isArray(details)) {
    return [];
  }

  return details.flatMap(detail => {
    if (isRecord(detail) && typeof detail['reason'] === 'string' && detail['reason'] !== '') {
      return [detail['reason']];
    }

    return [];
  });
};

/**
 * Error handler for order API requests
 * ✅ BEST PRACTICE: Distinguish between cancellations and real errors
 * ✅ SECURITY: Always return proper Error objects with readable messages
 */
const handleApiError = (error: unknown): Error => {
  if (axios.isAxiosError(error)) {
    const axiosError = error;

    // ✅ BEST PRACTICE: Don't wrap cancellation errors
    if (
      axios.isCancel(error) ||
      axiosError.code === 'ERR_CANCELED' ||
      axiosError.message === 'canceled'
    ) {
      throw error;
    }

    // ✅ CRITICAL: Preserve backend error structure for phone verification
    // Check multiple possible locations for the error code due to NestJS exception filter wrapping:
    // 1. responseData.code (direct)
    // 2. responseData.response.code (wrapped)
    // 3. responseData.details.code (OrderExceptionFilter wrapping) ← PRIMARY PATH
    const responseData = asOrderErrorPayload(axiosError.response?.data);
    const wrappedResponse = asOrderErrorPayload(responseData?.response);
    const detailsPayload = asOrderErrorPayload(responseData?.details);
    const errorCode = responseData?.code ?? wrappedResponse?.code ?? detailsPayload?.code;

    // Debug logging
    if (__DEV__) {
      Logger.debug('[ordersService] Error response structure', {
        hasResponseData: responseData !== undefined,
        responseDataCode: responseData?.code,
        responseDataResponseCode: wrappedResponse?.code,
        responseDataDetailsCode: detailsPayload?.code,
        errorCode,
        fullResponseData: responseData,
      });
    }

    if (errorCode === 'PHONE_VERIFICATION_REQUIRED') {
      Logger.debug('[ordersService] Phone verification required', { errorCode });
      // Throw the complete error object to preserve requiresPhoneSetup/requiresPhoneVerification
      // Priority: details (OrderExceptionFilter) > response (other wrappers) > direct
      const phoneError = getPrimaryOrderPayload(responseData);
      throw phoneError;
    }

    // ✅ PICKUP ERRORS: Preserve backend payload so the UI can show code-specific messages.
    // Same priority chain as phone verification above.
    const pickupPayload = getPrimaryOrderPayload(responseData);
    if (isPickupError(pickupPayload)) {
      if (__DEV__) {
        Logger.debug('[ordersService] Pickup error detected', { code: pickupPayload.code });
      }
      throw pickupPayload;
    }

    // ✅ Per-offer validation reasons (e.g. "Selected pickup time slot is fully booked")
    const detailReasons = extractValidationReasons(responseData?.details);
    if (detailReasons.length > 0) {
      return new Error(detailReasons.join('; '));
    }

    // ✅ CRITICAL FIX: Handle validation errors from NestJS
    let message: string;
    const responseMessage = responseData?.message ?? wrappedResponse?.message;

    if (Array.isArray(responseMessage)) {
      // NestJS validation errors: array of objects with constraints
      message = responseMessage
        .map(err => {
          // Extract constraint messages from validation error objects
          if (isRecord(err) && isRecord(err['constraints'])) {
            const constraintMessages = Object.values(err['constraints']).filter(
              (value): value is string => typeof value === 'string',
            );

            if (constraintMessages.length > 0) {
              return constraintMessages.join(', ');
            }
          }

          // Fallback: if it's a string, use it
          if (typeof err === 'string') {
            return err;
          }
          // Last resort: stringify
          return JSON.stringify(err);
        })
        .join('; ');
    } else if (typeof responseMessage === 'string') {
      message = responseMessage;
    } else {
      message = axiosError.message || 'An unexpected error occurred';
    }

    return new Error(message);
  }

  // ✅ CRITICAL FIX: Always create a proper Error object
  // Don't just cast - extract message or stringify if needed
  if (error instanceof Error) {
    return error;
  }

  // If error is an object with a message property, use it
  if (error !== null && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message));
  }

  // Last resort: stringify the error
  return new Error(typeof error === 'string' ? error : 'An unexpected error occurred');
};

/**
 * Orders API methods
 */
export const ordersService = {
  /**
   * Create a new order
   * @param orderData - Order creation data
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Created order
   * @throws PhoneVerificationRequiredError if phone not verified
   */
  async createOrder(
    orderData: CreateOrderDto,
    signal?: AbortSignal,
  ): Promise<Order & { payUrl?: string }> {
    try {
      const response = await apiClient.post<BackendApiResponse<Order> & { payUrl?: string }>(
        '/orders',
        orderData,
        {
          ...(signal !== undefined && { signal }),
        },
      );

      const order = unwrapBackendResponse(response, 'order creation');
      const payUrl = response.data.payUrl;
      return { ...order, ...(payUrl ? { payUrl } : {}) };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get user's orders (paginated)
   * @param page - Page number (1-based)
   * @param limit - Results per page (max 50)
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getMyOrders(
    page: number = 1,
    limit: number = 20,
    signal?: AbortSignal,
  ): Promise<PaginatedOrdersResponse> {
    try {
      const response = await apiClient.get<BackendApiResponse<Order[]>>('/orders/my-orders', {
        params: { page, limit },
        ...(signal !== undefined && { signal }),
      });

      // Backend envelope: { status, message, data: Order[], meta: { page, limit, total, ... } }
      // unwrapBackendResponse extracts `data` (the orders array).
      // `meta` lives alongside `data` in the envelope, so we read it directly.
      const orders = unwrapBackendResponse<Order[]>(response, 'my orders');
      const meta = response.data.meta;

      const metaWithDefaults = {
        page: meta?.page ?? page,
        limit: meta?.limit ?? limit,
        total: meta?.total ?? (Array.isArray(orders) ? orders.length : 0),
        totalPages: meta?.totalPages ?? 1,
        hasNextPage:
          (meta as unknown as { hasNextPage?: boolean } | undefined)?.hasNextPage ?? false,
        hasPrevPage:
          (meta as unknown as { hasPrevPage?: boolean } | undefined)?.hasPrevPage ?? false,
      };
      return {
        data: Array.isArray(orders) ? orders : [],
        meta: metaWithDefaults,
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get user's orders (cursor-based pagination)
   * @param limit - Results per page (max 50)
   * @param cursor - ISO date string of the last item's createdAt (omit for first page)
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getMyOrdersCursor(
    limit: number = 20,
    cursor?: string,
    signal?: AbortSignal,
  ): Promise<CursorPaginatedOrdersResponse> {
    try {
      const params: Record<string, unknown> = { limit };
      if (cursor) {
        params['cursor'] = cursor;
      }

      const response = await apiClient.get<BackendApiResponse<Order[]>>('/orders/my-orders', {
        params,
        ...(signal !== undefined && { signal }),
      });

      const orders = unwrapBackendResponse<Order[]>(response, 'my orders');
      const meta = response.data.meta as unknown as {
        limit: number;
        hasMore: boolean;
        nextCursor: string | null;
      };

      return {
        data: Array.isArray(orders) ? orders : [],
        meta: {
          limit: meta?.limit ?? limit,
          hasMore: meta?.hasMore ?? false,
          nextCursor: meta?.nextCursor ?? null,
        },
      };
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Get order by ID
   * @param orderId - Order ID
   * @param signal - Optional AbortSignal for request cancellation
   */
  async getOrderById(orderId: string, signal?: AbortSignal): Promise<Order> {
    try {
      const response = await apiClient.get<BackendApiResponse<Order>>(`/orders/${orderId}`, {
        ...(signal !== undefined && { signal }),
      });

      return unwrapBackendResponse(response, 'order details');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Cancel an order
   * @param orderId - Order ID
   * @param reason - Cancellation reason
   * @param signal - Optional AbortSignal for request cancellation
   */
  async cancelOrder(
    orderId: string,
    reason?: string,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.patch<
        BackendApiResponse<{ success: boolean; message: string }>
      >(`/orders/${orderId}/cancel`, { reason }, { ...(signal !== undefined && { signal }) });

      return unwrapBackendResponse(response, 'order cancellation');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  /**
   * Confirm pickup with a 6-digit code
   * @param orderId - Order ID
   * @param dto - Pickup confirmation payload (pickupCode required, notes optional)
   * @param signal - Optional AbortSignal for request cancellation
   * @returns Updated order with status PICKED_UP
   * @throws PickupErrorResponse for CODE_EXPIRED | PICKUP_ALREADY_DONE | PICKUP_LOCKED
   */
  async retryPayment(orderId: string, signal?: AbortSignal): Promise<{ payUrl: string }> {
    try {
      const response = await apiClient.post<BackendApiResponse<{ payUrl: string }>>(
        `/orders/${orderId}/retry-payment`,
        {},
        {
          ...(signal !== undefined && { signal }),
        },
      );

      return unwrapBackendResponse(response, 'retry payment');
    } catch (error) {
      throw handleApiError(error);
    }
  },

  async confirmPickup(
    orderId: string,
    dto: ConfirmPickupDto,
    signal?: AbortSignal,
  ): Promise<Order> {
    try {
      const response = await apiClient.patch<BackendApiResponse<Order>>(
        `/orders/${orderId}/confirm-pickup`,
        dto,
        { ...(signal !== undefined && { signal }) },
      );

      return unwrapBackendResponse(response, 'pickup confirmation');
    } catch (error) {
      throw handleApiError(error);
    }
  },
};
