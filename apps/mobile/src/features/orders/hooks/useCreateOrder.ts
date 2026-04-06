/**
 * useCreateOrder Hook
 * Smart order creation with automatic phone verification retry logic
 *
 * ✅ BEST PRACTICE: Implements "Intercept & Retry" pattern
 * - Catches PHONE_VERIFICATION_REQUIRED errors
 * - Triggers phone verification modal
 * - Automatically retries order creation after verification
 */

import { useState, useCallback, useRef } from 'react';

import { Logger } from '@/utils/logger';

import { ordersService } from '../services/ordersService';
import { isPhoneVerificationRequired } from '../types/order.types';

import type { CreateOrderDto, Order } from '../types/order.types';

/**
 * Hook state
 */
interface UseCreateOrderState {
  isLoading: boolean;
  error: string | null;
  order: Order | null;
}

/**
 * Phone verification modal state
 */
interface PhoneVerificationModalState {
  isVisible: boolean;
  requiresPhoneSetup: boolean;
  requiresPhoneVerification: boolean;
}

/**
 * Hook options
 */
interface UseCreateOrderOptions {
  onSuccess?: (order: Order) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
}

/**
 * Hook return type
 */
interface UseCreateOrderReturn extends UseCreateOrderState {
  createOrder: (orderData: CreateOrderDto) => Promise<Order | null>;
  resetError: () => void;
  phoneVerificationModal: PhoneVerificationModalState;
  closePhoneVerificationModal: () => void;
  retryOrderCreation: () => Promise<Order | null>;
}

/**
 * ✅ BEST PRACTICE: Smart order creation hook with automatic retry
 *
 * @param options - Hook options with callbacks
 * @param options.onSuccess - Called after successful order creation
 * @param options.onError - Called when order creation fails
 *
 * @example
 * ```tsx
 * const {
 *   createOrder,
 *   isLoading,
 *   error,
 *   phoneVerificationModal,
 *   closePhoneVerificationModal,
 *   retryOrderCreation
 * } = useCreateOrder({
 *   onSuccess: (order) => {
 *     // Show success modal
 *     // Invalidate queries
 *   },
 *   onError: (error) => {
 *     // Show error alert
 *   }
 * });
 *
 * const handleReserve = async () => {
 *   const order = await createOrder(orderData);
 *   if (order) {
 *     navigation.navigate('OrderDetails', { orderId: order._id });
 *   }
 * };
 * ```
 */
export const useCreateOrder = (options?: UseCreateOrderOptions): UseCreateOrderReturn => {
  const [state, setState] = useState<UseCreateOrderState>({
    isLoading: false,
    error: null,
    order: null,
  });

  const [phoneVerificationModal, setPhoneVerificationModal] = useState<PhoneVerificationModalState>(
    {
      isVisible: false,
      requiresPhoneSetup: false,
      requiresPhoneVerification: false,
    },
  );

  // ✅ BEST PRACTICE: Store order data for retry using useRef (doesn't trigger re-renders)
  const pendingOrderDataRef = useRef<CreateOrderDto | null>(null);

  /**
   * Reset error state
   */
  const resetError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  /**
   * Close phone verification modal
   */
  const closePhoneVerificationModal = useCallback(() => {
    setPhoneVerificationModal({
      isVisible: false,
      requiresPhoneSetup: false,
      requiresPhoneVerification: false,
    });
  }, []);

  /**
   * Core order creation logic (shared by initial call and retry)
   */
  const executeOrderCreation = useCallback(
    async (orderData: CreateOrderDto): Promise<Order | null> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const order = await ordersService.createOrder(orderData);

        // Clear pending order data on success
        pendingOrderDataRef.current = null;

        // onSuccess runs while isLoading is still true so the skeleton
        // stays visible until the success modal is mounted.  Both state
        // updates flush in the same React batch — no flash of the
        // underlying checkout screen.
        if (options?.onSuccess) {
          await options.onSuccess(order);
        }

        setState({
          isLoading: false,
          error: null,
          order,
        });

        return order;
      } catch (error) {
        // ✅ CRITICAL: Check if error is phone verification required
        if (isPhoneVerificationRequired(error)) {
          const phoneError = error;

          // ✅ Store order data for retry after verification
          pendingOrderDataRef.current = orderData;

          // ✅ Open phone verification modal with appropriate state
          setPhoneVerificationModal({
            isVisible: true,
            requiresPhoneSetup: phoneError.requiresPhoneSetup,
            requiresPhoneVerification: phoneError.requiresPhoneVerification,
          });

          setState({
            isLoading: false,
            error: null, // ✅ Don't set error - we're handling it with modal
            order: null,
          });

          return null; // Return null to indicate verification needed
        }

        // ✅ Handle other errors normally
        const errorMessage = error instanceof Error ? error.message : 'Failed to create order';

        setState({
          isLoading: false,
          error: errorMessage,
          order: null,
        });

        // ✅ Call onError callback if provided
        if (options?.onError && error instanceof Error) {
          await options.onError(error);
        }

        throw error;
      }
    },
    [options],
  );

  /**
   * Create order (initial call)
   * ✅ BEST PRACTICE: Optimistic call that handles phone verification gracefully
   */
  const createOrder = useCallback(
    async (orderData: CreateOrderDto): Promise<Order | null> => executeOrderCreation(orderData),
    [executeOrderCreation],
  );

  /**
   * Retry order creation after phone verification
   * ✅ CRITICAL: Called automatically by PhoneVerificationModal after successful verification
   */
  const retryOrderCreation = useCallback(async (): Promise<Order | null> => {
    if (!pendingOrderDataRef.current) {
      Logger.warn('[useCreateOrder] No pending order data to retry');
      return null;
    }

    const orderData = pendingOrderDataRef.current;

    // ✅ Close modal before retry
    closePhoneVerificationModal();

    // ✅ Retry with stored order data
    return executeOrderCreation(orderData);
  }, [executeOrderCreation, closePhoneVerificationModal]);

  return {
    ...state,
    createOrder,
    resetError,
    phoneVerificationModal,
    closePhoneVerificationModal,
    retryOrderCreation,
  };
};
