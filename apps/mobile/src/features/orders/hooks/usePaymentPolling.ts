/**
 * usePaymentPolling
 *
 * Drives payment-status refresh for an order awaiting Konnect payment. Konnect
 * runs as an external browser hand-off (no in-app WebView) and the order status
 * flips via a backend webhook, so the screen has to poll to notice.
 *
 * Behaviour:
 * - Polls every 3s while the order is PENDING_PAYMENT AND the payment window is
 *   still open.
 * - Stops once `paymentExpiresAt` has passed — the backend moves the order to
 *   EXPIRED/CANCELLED, so continuing to poll would just hammer the API on a dead
 *   order.
 * - Refetches when the app returns to the foreground: coming back from the
 *   external Konnect browser resumes an already-mounted screen without firing
 *   React Navigation's focus event, so a completed payment would otherwise go
 *   unnoticed until the next 3s tick (or not at all once expired).
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';

import { OrderStatus } from '../types/order.types';

import type { Order } from '../types/order.types';

export const PAYMENT_POLL_INTERVAL_MS = 3000;

export interface UsePaymentPollingResult {
  isPendingPayment: boolean;
  isPaymentExpired: boolean;
}

export function usePaymentPolling(
  order: Order | undefined,
  refetch: () => void,
): UsePaymentPollingResult {
  const isPendingPayment = order?.status === OrderStatus.PENDING_PAYMENT;

  const isPaymentExpired =
    order?.paymentExpiresAt != null && Date.now() > new Date(order.paymentExpiresAt).getTime();

  const shouldPoll = isPendingPayment && !isPaymentExpired;

  useEffect(() => {
    if (!shouldPoll) return;
    const interval = setInterval(() => {
      refetch();
    }, PAYMENT_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shouldPoll, refetch]);

  useEffect(() => {
    if (!isPendingPayment) return;
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') refetch();
    });
    return () => subscription.remove();
  }, [isPendingPayment, refetch]);

  return { isPendingPayment, isPaymentExpired };
}
