/**
 * Order Details Screen
 * Displays a full order fetched from the API and provides the confirm-pickup flow.
 *
 * Data flow:
 *   useQueryWithFocus → ordersService.getOrderById → Order
 *   useMutation        → ordersService.confirmPickup → invalidate order query
 *
 * The screen owns data fetching, the confirm-pickup mutation, payment retry and
 * the modal/overlay sequencing. Everything it renders lives in its own file:
 *
 *   components/OrderDetailCards    header, items, pricing, pickup details
 *   components/ConfirmPickupSection  code entry + confirmed/expired states
 *   utils/orderStatus              status badges, expiry, pickup errors
 *   hooks/useOncePerOrderFlag      per-order "already shown" persistence
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView } from 'react-native';

import { KonnectPaymentSheet } from '../components/KonnectPaymentSheet';
import { ReviewModal } from '../components/ReviewModal';

import { Text, Button, Card, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ImpactMoment, useDonationStats } from '@/features/donations';
import { useQueryWithFocus } from '@/lib/react-query';
import { analytics } from '@/utils/analytics';

import { ConfirmPickupSection } from '../components/ConfirmPickupSection';
import {
  OrderHeader,
  OrderItemsCard,
  OrderPricingCard,
  PickupDetailsCard,
} from '../components/OrderDetailCards';
import { SkeletonOrderDetailsScreen } from '../components/SkeletonOrderDetailsScreen';
import { useOncePerOrderFlag } from '../hooks/useOncePerOrderFlag';
import { usePaymentPolling } from '../hooks/usePaymentPolling';
import { ordersService } from '../services/ordersService';
import { OrderStatus, isPickupError } from '../types/order.types';
import {
  canConfirmPickup,
  getEstablishmentId,
  isOrderExpired,
  isPickedUp,
} from '../utils/orderStatus';

import type { Order, PickupErrorCode } from '../types/order.types';
import type { OrdersStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type InlinePickupError = PickupErrorCode | 'INVALID_CODE';

// ---------------------------------------------------------------------------
// Navigation types
// ---------------------------------------------------------------------------

type OrderDetailsScreenNavigationProp = NativeStackNavigationProp<
  OrdersStackParamList,
  'OrderDetails'
>;

type OrderDetailsScreenRouteProp = RouteProp<OrdersStackParamList, 'OrderDetails'>;

interface OrderDetailsScreenProps {
  navigation: OrderDetailsScreenNavigationProp;
  route: OrderDetailsScreenRouteProp;
}

const SUCCESS_COLOR = '#22c55e';

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const queryKey = ['orders', 'detail', orderId];

  const {
    data: order,
    isLoading: isLoadingOrder,
    error: orderError,
    refetch: refetchOrder,
  } = useQueryWithFocus<Order>(queryKey, () => ordersService.getOrderById(orderId));

  // Poll for the webhook-driven payment status flip (see hook for full behaviour).
  const { isPaymentExpired } = usePaymentPolling(order, refetchOrder);

  // ---------------------------------------------------------------------------
  // Retry payment
  // ---------------------------------------------------------------------------

  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [retryPayUrl, setRetryPayUrl] = useState<string | null>(null);

  const handleRetryPayment = useCallback(async () => {
    setIsRetryingPayment(true);
    try {
      const { payUrl } = await ordersService.retryPayment(orderId);
      setRetryPayUrl(payUrl);
    } catch {
      // Error is handled by the service layer
    } finally {
      setIsRetryingPayment(false);
    }
  }, [orderId]);

  // ---------------------------------------------------------------------------
  // Confirm-pickup mutation
  // ---------------------------------------------------------------------------

  const [pickupError, setPickupError] = useState<InlinePickupError | null>(null);

  const confirmMutation = useMutation({
    mutationFn: (code: string) => ordersService.confirmPickup(orderId, { pickupCode: code }),
    onSuccess: () => {
      analytics.trackPickupConfirmed(orderId, order?.orderNumber ?? orderId);
      // Invalidate so the order refetches with PICKED_UP status
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: error => {
      if (isPickupError(error)) {
        setPickupError(error.code);
      } else {
        // Generic wrong code — show inline "invalid" message
        setPickupError('INVALID_CODE');
      }
    },
  });

  const handleConfirm = useCallback(
    (code: string) => {
      setPickupError(null);
      confirmMutation.mutate(code);
    },
    [confirmMutation],
  );

  // ---------------------------------------------------------------------------
  // Donation impact moment
  // ---------------------------------------------------------------------------

  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const reviewDismissedRef = React.useRef(false);

  // Both survive a remount: React Navigation keeps this screen mounted, and the
  // user can leave and return. Same shape, different keys — see the hook.
  const [hasReviewed, markOrderReviewed] = useOncePerOrderFlag('reviewed_orders', orderId);
  const [impactMomentShown, markImpactMomentShown] = useOncePerOrderFlag(
    'impact_shown_orders',
    orderId,
  );

  const { data: donationStats } = useDonationStats();

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const orderIsPickedUp = order != null && isPickedUp(order.status);

  // Time-based expiry check: if expiresAt has passed, the pickup code is no longer valid
  const orderIsExpired = order != null && isOrderExpired(order);

  const canConfirm = order != null && canConfirmPickup(order.status);
  // Show ImpactMoment once per order (MMKV-persisted so it survives navigation/remount)
  const showImpactMoment = orderIsPickedUp && !impactMomentShown;

  // Auto-show review modal for picked-up orders that haven't been reviewed.
  // If there's a donation overlay, wait for it to dismiss first.
  useEffect(() => {
    if (!orderIsPickedUp || hasReviewed || reviewModalVisible || reviewDismissedRef.current) return;
    if ((order?.donationAmount ?? 0) > 0 && showImpactMoment) return;
    const timer = setTimeout(() => setReviewModalVisible(true), 800);
    return () => clearTimeout(timer);
  }, [orderIsPickedUp, showImpactMoment, hasReviewed, reviewModalVisible, order?.donationAmount]);

  const reviewEstablishmentId = useMemo(
    () => getEstablishmentId(order?.establishmentId as never),
    [order?.establishmentId],
  );

  // ---------------------------------------------------------------------------
  // Render – error
  // ---------------------------------------------------------------------------

  if (orderError && !order) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContent,
          { backgroundColor: theme.colors.background },
        ]}
      >
        <Icon name='alert-circle-outline' family='Ionicons' size={48} color={theme.colors.error} />
        <Text variant='title' size='lg' weight='semibold' style={styles.errorTitle}>
          {t('orders.orderNotFound')}
        </Text>
        <Text variant='body' size='md' color='secondary' align='center' style={styles.errorSubtext}>
          {t('orders.orderNotFoundMessage')}
        </Text>
        <Button
          variant='primary'
          size='md'
          onPress={() => {
            void refetchOrder();
          }}
          style={styles.retryButton}
          accessibilityLabel={t('common.retry')}
          accessibilityHint={t('orders.a11yReloadOrderHint')}
        >
          {t('common.retry')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onPress={() => navigation.goBack()}
          style={styles.goBackButton}
          accessibilityLabel={t('common.goBack')}
          accessibilityHint={t('orders.a11yGoBackHint')}
        >
          {t('common.goBack')}
        </Button>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render – loading
  // ---------------------------------------------------------------------------

  if (isLoadingOrder || !order) {
    return <SkeletonOrderDetailsScreen />;
  }

  // ---------------------------------------------------------------------------
  // Render – full screen
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <OrderHeader order={order} />
        <OrderItemsCard order={order} />
        <OrderPricingCard order={order} />
        <PickupDetailsCard order={order} />

        {(canConfirm || orderIsExpired) && (
          <ConfirmPickupSection
            onConfirm={handleConfirm}
            onClearError={() => setPickupError(null)}
            isLoading={confirmMutation.isPending}
            errorCode={pickupError}
            isConfirmed={confirmMutation.isSuccess}
            isExpired={orderIsExpired}
          />
        )}

        {/* Already picked up – show static success when arriving at screen after pickup */}
        {orderIsPickedUp && !confirmMutation.isSuccess && (
          <Card style={styles.card}>
            <View style={styles.successRow}>
              <Icon
                name='checkmark-circle'
                family='Ionicons'
                size={28}
                color={theme.colors.base?.success?.[500] ?? '#22c55e'}
              />
              <Text variant='body' size='md' weight='semibold' style={styles.successText}>
                {t('orders.pickupConfirmed')}
              </Text>
            </View>
          </Card>
        )}

        {/* Pending payment — retry button, or expired notice once the window closes */}
        {order.status === OrderStatus.PENDING_PAYMENT && (
          <Card style={styles.card}>
            <View style={styles.successRow}>
              <Icon
                name={isPaymentExpired ? 'close-circle-outline' : 'time-outline'}
                family='Ionicons'
                size={28}
                color={isPaymentExpired ? '#EF4444' : '#F59E0B'}
              />
              <Text variant='body' size='md' weight='semibold' style={styles.pendingPaymentText}>
                {isPaymentExpired ? t('orders.paymentWindowExpired') : t('orders.awaitingPayment')}
              </Text>
            </View>
            {!isPaymentExpired && (
              <Button
                variant='primary'
                size='md'
                onPress={() => {
                  void handleRetryPayment();
                }}
                loading={isRetryingPayment}
                style={styles.payNowButton}
              >
                {t('orders.payNow')}
              </Button>
            )}
          </Card>
        )}

        {/* Rate your bag — shown for picked-up or completed orders that haven't been reviewed */}
        {(order.status === OrderStatus.PICKED_UP || order.status === OrderStatus.COMPLETED) &&
          !hasReviewed && (
            <Button
              variant='outline'
              size='md'
              onPress={() => setReviewModalVisible(true)}
              style={styles.goBackButton}
            >
              ⭐ {t('orders.rateBag')}
            </Button>
          )}

        {/* Go back button */}
        <Button
          variant='outline'
          size='md'
          onPress={() => navigation.goBack()}
          style={styles.goBackButton}
        >
          {t('common.goBack')}
        </Button>
      </ScrollView>

      {/* Donation impact overlay – shown once on mount when donation > 0 */}
      {order.donationAmount > 0 && donationStats && (
        <ImpactMoment
          visible={showImpactMoment}
          donationAmount={order.donationAmount}
          totalDonations={donationStats.totalDonations}
          mealCount={donationStats.mealCount}
          onDismiss={markImpactMomentShown}
          currency={order.pricing.currency}
        />
      )}

      {/* Konnect payment WebView for retry-payment */}
      {retryPayUrl ? (
        <KonnectPaymentSheet
          visible={!!retryPayUrl}
          payUrl={retryPayUrl}
          onPaymentFailed={() => {
            setRetryPayUrl(null);
          }}
          onDismiss={() => {
            setRetryPayUrl(null);
            void refetchOrder();
          }}
        />
      ) : null}

      {/* Review bottom sheet */}
      <ReviewModal
        visible={reviewModalVisible}
        orderId={orderId}
        establishmentId={reviewEstablishmentId}
        {...(() => {
          const raw = order.items[0]?.offerId;
          const id =
            typeof raw === 'string'
              ? raw
              : ((raw as { _id?: string; id?: string } | null)?._id ??
                (raw as { _id?: string; id?: string } | null)?.id);
          return id ? { offerId: id } : {};
        })()}
        onClose={() => {
          reviewDismissedRef.current = true;
          setReviewModalVisible(false);
        }}
        onSuccess={() => {
          setReviewModalVisible(false);
          markOrderReviewed();
        }}
      />
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
  },
  errorSubtext: {
    marginTop: 8,
    maxWidth: 280,
  },
  retryButton: {
    marginTop: 20,
  },
  goBackButton: {
    marginTop: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header

  // Cards
  card: {
    padding: 16,
    marginBottom: 12,
  },

  // Item rows

  // Pricing rows

  // Pickup details

  // Confirm pickup

  // Success state
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  successText: {
    color: SUCCESS_COLOR,
  },
  pendingPaymentText: {
    marginStart: 8,
    flex: 1,
  },
  payNowButton: {
    marginTop: 12,
  },

  // Expired state
});
