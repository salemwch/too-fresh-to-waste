/**
 * Order Details Screen
 * Displays a full order fetched from the API and provides the confirm-pickup flow.
 *
 * Data flow:
 *   useQueryWithFocus → ordersService.getOrderById → Order
 *   useMutation        → ordersService.confirmPickup → invalidate order query
 *
 * Sections (DRY – each rendered by a dedicated component):
 *   OrderHeader        – orderNumber + status badge
 *   ItemsList          – per-item pricing row
 *   PricingSummary     – price / discount / final price / fee / total
 *   PickupDetails      – date, time-slot, instructions
 *   ConfirmPickupSection – 6-digit input + submit + error/success states
 *   ImpactMoment       – donation animation overlay (shown once on mount)
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';

import { KonnectPaymentSheet } from '../components/KonnectPaymentSheet';
import { ReviewModal } from '../components/ReviewModal';

import { Text, Button, Card, Badge, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ImpactMoment, useDonationStats } from '@/features/donations';
import { useQueryWithFocus } from '@/lib/react-query';
import { analytics } from '@/utils/analytics';
import { mmkv } from '@/utils/mmkvStorage';

import { SkeletonOrderDetailsScreen } from '../components/SkeletonOrderDetailsScreen';
import { usePaymentPolling } from '../hooks/usePaymentPolling';
import { ordersService } from '../services/ordersService';
import { OrderStatus, isPickupError } from '../types/order.types';

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

// ---------------------------------------------------------------------------
// Status → Badge variant mapping (single source of truth)
// ---------------------------------------------------------------------------

const STATUS_BADGE_MAP: Record<
  string,
  { variant: 'warning' | 'info' | 'success' | 'error' | 'neutral'; labelKey: string }
> = {
  [OrderStatus.PENDING]: { variant: 'warning', labelKey: 'orders.statusPending' },
  [OrderStatus.RESERVED]: { variant: 'info', labelKey: 'orders.statusReserved' },
  [OrderStatus.CONFIRMED]: { variant: 'info', labelKey: 'orders.statusConfirmed' },
  [OrderStatus.READY_FOR_PICKUP]: { variant: 'success', labelKey: 'orders.statusReady' },
  [OrderStatus.PICKED_UP]: { variant: 'success', labelKey: 'orders.statusPickedUp' },
  [OrderStatus.COMPLETED]: { variant: 'success', labelKey: 'orders.statusCompleted' },
  [OrderStatus.PENDING_PAYMENT]: { variant: 'warning', labelKey: 'orders.statusPendingPayment' },
  [OrderStatus.CANCELLED]: { variant: 'error', labelKey: 'orders.statusCancelled' },
  [OrderStatus.EXPIRED]: { variant: 'error', labelKey: 'orders.statusExpired' },
  [OrderStatus.REFUNDED]: { variant: 'neutral', labelKey: 'orders.statusRefunded' },
};

// ---------------------------------------------------------------------------
// Pickup-error → user-facing message (single source of truth)
// ---------------------------------------------------------------------------

const PICKUP_ERROR_KEYS: Record<InlinePickupError, string> = {
  CODE_EXPIRED: 'orders.codeExpired',
  INVALID_CODE: 'orders.invalidCode',
  PICKUP_ALREADY_DONE: 'orders.alreadyPickedUp',
  PICKUP_LOCKED: 'orders.pickupLocked',
  ORDER_NOT_READY: 'orders.orderNotReady',
};

// ---------------------------------------------------------------------------
// Statuses that allow the confirm-pickup UI to appear
// ---------------------------------------------------------------------------

const CONFIRMABLE_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
]);

const DIVIDER = '#e5e7eb';
const CODE_INPUT_BACKGROUND = '#fafafa';
const SUCCESS_COLOR = '#22c55e';

// ---------------------------------------------------------------------------
// Sub-components (pure, no side-effects – extracted for DRY & readability)
// ---------------------------------------------------------------------------

/** Order number row + status badge */
const OrderHeader: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  const badge = STATUS_BADGE_MAP[order.status] ?? {
    variant: 'neutral' as const,
    labelKey: order.status,
  };

  return (
    <View style={styles.header}>
      <View>
        <Text variant='headline' size='lg' weight='bold'>
          {t('orders.orderDetails')}
        </Text>
        <Text variant='body' size='sm' color='secondary' style={styles.orderNumber}>
          #{order.orderNumber}
        </Text>
      </View>
      <Badge label={t(badge.labelKey)} variant={badge.variant} size='md' />
    </View>
  );
};

/** Single item row */
const ItemRow: React.FC<{ item: Order['items'][0]; currency: string }> = ({ item, currency }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        <Text variant='body' size='md' weight='semibold'>
          {item.offerTitle}
        </Text>
        <Text variant='body' size='sm' color='secondary'>
          {t('common.quantity')}: {item.quantity}
        </Text>
      </View>
      <View style={styles.itemRight}>
        {item.discountAmount > 0 && (
          <Text variant='body' size='xs' color='secondary' style={styles.originalPrice}>
            {item.originalPrice.toFixed(2)} {currency}
          </Text>
        )}
        <Text variant='body' size='md' weight='semibold'>
          {item.totalPrice.toFixed(2)} {currency}
        </Text>
      </View>
    </View>
  );
};

/** Items list card */
const ItemsList: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        {t('orders.items')}
      </Text>
      {order.items.map((item, index) => (
        <React.Fragment key={typeof item.offerId === 'string' ? item.offerId : item.offerId._id}>
          <ItemRow item={item} currency={order.pricing.currency} />
          {index < order.items.length - 1 && <View style={styles.divider} />}
        </React.Fragment>
      ))}
    </Card>
  );
};

/** Pricing summary card */
const PricingSummary: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  const { pricing } = order;

  // Calculate original price before discount
  const originalPrice = pricing.subtotal + pricing.discountAmount;

  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        {t('orders.pricing')}
      </Text>
      <PricingRow label={t('orders.price')} value={originalPrice} currency={pricing.currency} />
      {pricing.discountAmount > 0 && (
        <PricingRow
          label={t('orders.discount')}
          value={-pricing.discountAmount}
          currency={pricing.currency}
          isDiscount
        />
      )}
      <PricingRow
        label={t('orders.finalPrice')}
        value={pricing.subtotal}
        currency={pricing.currency}
      />
      {pricing.serviceFee > 0 && (
        <>
          <View style={styles.divider} />
          <PricingRow
            label={t('orders.deliveryFee')}
            value={pricing.serviceFee}
            currency={pricing.currency}
          />
        </>
      )}
      <View style={styles.divider} />
      <PricingRow
        label={t('common.total')}
        value={pricing.total}
        currency={pricing.currency}
        isBold
      />
    </Card>
  );
};

/** Single pricing line */
const PricingRow: React.FC<{
  label: string;
  value: number;
  currency: string;
  isBold?: boolean;
  isDiscount?: boolean;
}> = ({ label, value, currency, isBold, isDiscount }) => (
  <View style={styles.pricingRow}>
    <Text variant='body' size='md' weight={(isBold ?? false) ? 'bold' : 'regular'}>
      {label}
    </Text>
    <Text
      variant='body'
      size='md'
      weight={(isBold ?? false) ? 'bold' : 'regular'}
      color={(isDiscount ?? false) ? 'success' : ''}
    >
      {isDiscount === true ? '-' : ''}
      {Math.abs(value).toFixed(2)} {currency}
    </Text>
  </View>
);

/** Pickup details card */
const PickupDetailsCard: React.FC<{ order: Order }> = ({ order }) => {
  const { t } = useTranslation();
  const { pickupDetails } = order;

  const formattedDate = useMemo(() => {
    try {
      return new Date(pickupDetails.scheduledDate).toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return pickupDetails.scheduledDate;
    }
  }, [pickupDetails.scheduledDate]);

  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        {t('orders.pickupDetails')}
      </Text>
      <View style={styles.pickupRow}>
        <Icon name='calendar' family='Ionicons' size={18} color='#888' />
        <Text variant='body' size='md' style={styles.pickupText}>
          {formattedDate}
        </Text>
      </View>
      <View style={styles.pickupRow}>
        <Icon name='time' family='Ionicons' size={18} color='#888' />
        <Text variant='body' size='md' style={styles.pickupText}>
          {pickupDetails.timeSlot.startTime} – {pickupDetails.timeSlot.endTime}
        </Text>
      </View>
      {pickupDetails.instructions != null && (
        <View style={styles.pickupRow}>
          <Icon name='information-circle-outline' family='Ionicons' size={18} color='#888' />
          <Text variant='body' size='sm' color='secondary' style={styles.pickupText}>
            {pickupDetails.instructions}
          </Text>
        </View>
      )}
    </Card>
  );
};

/** Confirm-pickup section (input + button + error/success states) */
const ConfirmPickupSection: React.FC<{
  onConfirm: (code: string) => void;
  onClearError: () => void;
  isLoading: boolean;
  errorCode: InlinePickupError | null;
  isConfirmed: boolean;
  isExpired: boolean;
}> = ({ onConfirm, onClearError, isLoading, errorCode, isConfirmed, isExpired }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [code, setCode] = useState('');

  if (isConfirmed) {
    return (
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
    );
  }

  if (isExpired) {
    return (
      <Card style={styles.card}>
        <View style={styles.expiredRow}>
          <Icon
            name='timer-outline'
            family='Ionicons'
            size={28}
            color={theme.colors.base?.error?.[500] ?? '#ef4444'}
          />
          <View style={styles.expiredTextContainer}>
            <Text
              variant='body'
              size='md'
              weight='semibold'
              style={{ color: theme.colors.base?.error?.[500] ?? '#ef4444' }}
            >
              {t('orders.orderExpired')}
            </Text>
            <Text variant='body' size='sm' color='secondary'>
              {t('orders.orderExpiredMessage')}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        {t('orders.confirmPickup')}
      </Text>
      <Text variant='body' size='sm' color='secondary' style={styles.confirmHint}>
        {t('orders.confirmPickupHint')}
      </Text>

      {/* 6-digit numeric input */}
      <TextInput
        style={[
          styles.codeInput,
          {
            borderColor: errorCode
              ? (theme.colors.base?.error?.[500] ?? '#ef4444')
              : (theme.colors.base?.neutral?.[300] ?? '#d1d5db'),
          },
          { color: theme.colors.onBackground ?? '#000' },
        ]}
        value={code}
        onChangeText={text => {
          setCode(text);
          if (errorCode) onClearError();
        }}
        keyboardType='numeric'
        maxLength={6}
        placeholder='• • • • • •'
        placeholderTextColor='#aaa'
        autoFocus={false}
        editable={!isLoading}
        textAlign='center'
        accessibilityLabel='Pickup code input'
        accessibilityHint='Enter the 6-digit code shown by the merchant'
      />

      {/* Inline error directly under input */}
      {errorCode && (
        <View style={styles.inlineError}>
          <Icon
            name='alert-circle'
            family='Ionicons'
            size={16}
            color={theme.colors.base?.error?.[500] ?? '#ef4444'}
          />
          <Text
            variant='body'
            size='sm'
            style={[
              styles.inlineErrorText,
              { color: theme.colors.base?.error?.[500] ?? '#ef4444' },
            ]}
          >
            {t(PICKUP_ERROR_KEYS[errorCode])}
          </Text>
        </View>
      )}

      <Button
        variant='primary'
        size='lg'
        disabled={code.length !== 6 || isLoading}
        loading={isLoading}
        onPress={() => onConfirm(code)}
        style={styles.confirmButton}
      >
        {t('orders.confirmPickupButton')}
      </Button>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

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

  // Persist reviewed state across sessions via MMKV
  const [hasReviewed, setHasReviewed] = useState(() => {
    try {
      const stored = mmkv.getString?.('reviewed_orders');
      if (!stored) return false;
      return (JSON.parse(stored) as string[]).includes(orderId);
    } catch {
      return false;
    }
  });

  const markOrderReviewed = useCallback(() => {
    try {
      const stored = mmkv.getString?.('reviewed_orders');
      const ids: string[] = stored ? (JSON.parse(stored) as string[]) : [];
      if (!ids.includes(orderId)) {
        mmkv.set?.('reviewed_orders', JSON.stringify([...ids, orderId]));
      }
    } catch {
      // storage errors are non-fatal
    }
    setHasReviewed(true);
  }, [orderId]);

  // Persist "impact shown" state across sessions so ImpactMoment shows exactly once per order
  const [impactMomentShown, setImpactMomentShown] = useState(() => {
    try {
      const stored = mmkv.getString?.('impact_shown_orders');
      if (!stored) return false;
      return (JSON.parse(stored) as string[]).includes(orderId);
    } catch {
      return false;
    }
  });

  const markImpactMomentShown = useCallback(() => {
    try {
      const stored = mmkv.getString?.('impact_shown_orders');
      const ids: string[] = stored ? (JSON.parse(stored) as string[]) : [];
      if (!ids.includes(orderId)) {
        mmkv.set?.('impact_shown_orders', JSON.stringify([...ids, orderId]));
      }
    } catch {
      // storage errors are non-fatal
    }
    setImpactMomentShown(true);
  }, [orderId]);

  const { data: donationStats } = useDonationStats();

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isPickedUp =
    order?.status === OrderStatus.PICKED_UP || order?.status === OrderStatus.COMPLETED;

  // Time-based expiry check: if expiresAt has passed, the pickup code is no longer valid
  const isOrderExpired = useMemo(() => {
    if (!order) return false;
    if (order.status === OrderStatus.EXPIRED) return true;
    if (order.expiresAt) {
      return new Date() > new Date(order.expiresAt);
    }
    return false;
  }, [order]);

  const canConfirm = order ? CONFIRMABLE_STATUSES.has(order.status) : false;
  // Show ImpactMoment once per order (MMKV-persisted so it survives navigation/remount)
  const showImpactMoment = isPickedUp && !impactMomentShown;

  // Auto-show review modal for picked-up orders that haven't been reviewed.
  // If there's a donation overlay, wait for it to dismiss first.
  useEffect(() => {
    if (!isPickedUp || hasReviewed || reviewModalVisible || reviewDismissedRef.current) return;
    if ((order?.donationAmount ?? 0) > 0 && showImpactMoment) return;
    const timer = setTimeout(() => setReviewModalVisible(true), 800);
    return () => clearTimeout(timer);
  }, [isPickedUp, showImpactMoment, hasReviewed, reviewModalVisible, order?.donationAmount]);

  const reviewEstablishmentId: string = useMemo(() => {
    if (!order) return '';
    const est = order.establishmentId as { _id?: string; id?: string } | string | null;
    if (typeof est === 'string') return est;
    return est?._id ?? est?.id ?? '';
  }, [order]);

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
          accessibilityHint='Attempts to reload the order details'
        >
          {t('common.retry')}
        </Button>
        <Button
          variant='ghost'
          size='sm'
          onPress={() => navigation.goBack()}
          style={styles.goBackButton}
          accessibilityLabel={t('common.goBack')}
          accessibilityHint='Returns to the previous screen'
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
        <ItemsList order={order} />
        <PricingSummary order={order} />
        <PickupDetailsCard order={order} />

        {(canConfirm || isOrderExpired) && (
          <ConfirmPickupSection
            onConfirm={handleConfirm}
            onClearError={() => setPickupError(null)}
            isLoading={confirmMutation.isPending}
            errorCode={pickupError}
            isConfirmed={confirmMutation.isSuccess}
            isExpired={isOrderExpired}
          />
        )}

        {/* Already picked up – show static success when arriving at screen after pickup */}
        {isPickedUp && !confirmMutation.isSuccess && (
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderNumber: {
    marginTop: 2,
  },

  // Cards
  card: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: DIVIDER,
    marginVertical: 8,
  },

  // Item rows
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemLeft: {
    flex: 1,
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    textDecorationLine: 'line-through',
  },

  // Pricing rows
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  // Pickup details
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  pickupText: {
    marginLeft: 10,
  },

  // Confirm pickup
  confirmHint: {
    marginBottom: 12,
  },
  codeInput: {
    height: 56,
    borderWidth: 1.5,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 8,
    backgroundColor: CODE_INPUT_BACKGROUND,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  inlineErrorText: {
    flex: 1,
  },
  confirmButton: {
    marginTop: 16,
  },

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
  expiredRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  expiredTextContainer: {
    flex: 1,
    gap: 2,
  },
});
