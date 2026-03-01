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
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, StyleSheet, ScrollView, TextInput } from 'react-native';

import { Text, Button, Card, Badge, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { ImpactMoment, useDonationStats } from '@/features/donations';
import { useQueryWithFocus } from '@/lib/react-query';

import { useSecureScreen } from '@/hooks/useSecureScreen';
import { SkeletonOrderDetailsScreen } from '../components/SkeletonOrderDetailsScreen';
import { ordersService } from '../services/ordersService';
import { OrderStatus, isPickupError } from '../types/order.types';
import { analytics } from '@/utils/analytics';

import type { Order } from '../types/order.types';
type InlinePickupError = import('../types/order.types').PickupErrorCode | 'INVALID_CODE';
import type { OrdersStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

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
  { variant: 'warning' | 'info' | 'success' | 'error' | 'neutral'; label: string }
> = {
  [OrderStatus.PENDING]: { variant: 'warning', label: 'Pending' },
  [OrderStatus.RESERVED]: { variant: 'info', label: 'Reserved' },
  [OrderStatus.CONFIRMED]: { variant: 'info', label: 'Confirmed' },
  [OrderStatus.READY_FOR_PICKUP]: { variant: 'success', label: 'Ready' },
  [OrderStatus.PICKED_UP]: { variant: 'success', label: 'Picked Up' },
  [OrderStatus.CANCELLED]: { variant: 'error', label: 'Cancelled' },
  [OrderStatus.EXPIRED]: { variant: 'error', label: 'Expired' },
  [OrderStatus.REFUNDED]: { variant: 'neutral', label: 'Refunded' },
};

// ---------------------------------------------------------------------------
// Pickup-error → user-facing message (single source of truth)
// ---------------------------------------------------------------------------

const PICKUP_ERROR_MESSAGES: Record<InlinePickupError, string> = {
  CODE_EXPIRED: 'Pickup code has expired',
  INVALID_CODE: 'Invalid pickup code',
  PICKUP_ALREADY_DONE: 'This order has already been picked up.',
  PICKUP_LOCKED: 'Too many incorrect attempts. Contact support.',
  ORDER_NOT_READY: 'Order not ready yet. Try again shortly.',
};

// ---------------------------------------------------------------------------
// Statuses that allow the confirm-pickup UI to appear
// ---------------------------------------------------------------------------

const CONFIRMABLE_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
]);

// ---------------------------------------------------------------------------
// Sub-components (pure, no side-effects – extracted for DRY & readability)
// ---------------------------------------------------------------------------

/** Order number row + status badge */
const OrderHeader: React.FC<{ order: Order }> = ({ order }) => {
  const badge = STATUS_BADGE_MAP[order.status] ?? {
    variant: 'neutral' as const,
    label: order.status,
  };

  return (
    <View style={styles.header}>
      <View>
        <Text variant='headline' size='lg' weight='bold'>
          Order Details
        </Text>
        <Text variant='body' size='sm' color='secondary' style={styles.orderNumber}>
          #{order.orderNumber}
        </Text>
      </View>
      <Badge label={badge.label} variant={badge.variant} size='md' />
    </View>
  );
};

/** Single item row */
const ItemRow: React.FC<{ item: Order['items'][0]; currency: string }> = ({ item, currency }) => (
  <View style={styles.itemRow}>
    <View style={styles.itemLeft}>
      <Text variant='body' size='md' weight='semibold'>
        {item.offerTitle}
      </Text>
      <Text variant='body' size='sm' color='secondary'>
        Qty: {item.quantity}
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

/** Items list card */
const ItemsList: React.FC<{ order: Order }> = ({ order }) => (
  <Card style={styles.card}>
    <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
      ITEMS
    </Text>
    {order.items.map((item, index) => (
      <React.Fragment key={typeof item.offerId === 'string' ? item.offerId : item.offerId._id}>
        <ItemRow item={item} currency={order.pricing.currency} />
        {index < order.items.length - 1 && <View style={styles.divider} />}
      </React.Fragment>
    ))}
  </Card>
);

/** Pricing summary card */
const PricingSummary: React.FC<{ order: Order }> = ({ order }) => {
  const { pricing } = order;

  // Calculate original price before discount
  const originalPrice = pricing.subtotal + pricing.discountAmount;

  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        PRICING
      </Text>
      <PricingRow label='Price' value={originalPrice} currency={pricing.currency} />
      {pricing.discountAmount > 0 && (
        <PricingRow
          label='Discount'
          value={-pricing.discountAmount}
          currency={pricing.currency}
          isDiscount
        />
      )}
      <PricingRow label='Final Price' value={pricing.subtotal} currency={pricing.currency} />
      <View style={styles.divider} />
      <PricingRow label='Service Fee' value={pricing.serviceFee} currency={pricing.currency} />
      <View style={styles.divider} />
      <PricingRow label='Total' value={pricing.total} currency={pricing.currency} isBold />
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
        PICKUP DETAILS
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
  const [code, setCode] = useState('');

  // Reset code input after successful confirmation
  useEffect(() => {
    if (isConfirmed) setCode('');
  }, [isConfirmed]);

  if (isConfirmed) {
    return (
      <Card style={styles.card}>
        <View style={styles.successRow}>
          <Icon name='checkmark-circle' family='Ionicons' size={28} color={theme.colors.base?.success?.[500] ?? '#22c55e'} />
          <Text variant='body' size='md' weight='semibold' style={styles.successText}>
            Pickup confirmed!
          </Text>
        </View>
      </Card>
    );
  }

  if (isExpired) {
    return (
      <Card style={styles.card}>
        <View style={styles.expiredRow}>
          <Icon name='timer-off-outline' family='MaterialCommunityIcons' size={28} color={theme.colors.base?.error?.[500] ?? '#ef4444'} />
          <View style={styles.expiredTextContainer}>
            <Text variant='body' size='md' weight='semibold' style={{ color: theme.colors.base?.error?.[500] ?? '#ef4444' }}>
              Order Expired
            </Text>
            <Text variant='body' size='sm' color='secondary'>
              The pickup window has ended. The pickup code is no longer valid.
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant='body' size='sm' weight='bold' color='secondary' style={styles.sectionTitle}>
        CONFIRM PICKUP
      </Text>
      <Text variant='body' size='sm' color='secondary' style={styles.confirmHint}>
        Ask the merchant for the 6-digit pickup code and enter it below.
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
        onChangeText={(text) => {
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
          <Icon name='alert-circle' family='Ionicons' size={16} color={theme.colors.base?.error?.[500] ?? '#ef4444'} />
          <Text
            variant='body'
            size='sm'
            style={{ color: theme.colors.base?.error?.[500] ?? '#ef4444', flex: 1 }}
          >
            {PICKUP_ERROR_MESSAGES[errorCode]}
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
        Confirm Pickup
      </Button>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({ navigation, route }) => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { orderId } = route.params;

  // Prevent screenshots/recordings while the pickup code is visible
  useSecureScreen();

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const queryKey = ['orders', 'detail', orderId];

  const { data: order, isLoading: isLoadingOrder } = useQueryWithFocus<Order>(queryKey, () =>
    ordersService.getOrderById(orderId),
  );

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

  const [showImpactMoment, setShowImpactMoment] = useState(true);
  const { data: donationStats } = useDonationStats();

  useEffect(() => {
    setShowImpactMoment(true);
  }, [orderId]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const isConfirmedPickup = order?.status === OrderStatus.PICKED_UP && confirmMutation.isSuccess;

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
            isConfirmed={isConfirmedPickup}
            isExpired={isOrderExpired}
          />
        )}

        {/* Already picked up – show static success if mutation did not trigger it */}
        {order.status === OrderStatus.PICKED_UP && !confirmMutation.isSuccess && (
          <Card style={styles.card}>
            <View style={styles.successRow}>
              <Icon name='checkmark-circle' family='Ionicons' size={28} color={theme.colors.base?.success?.[500] ?? '#22c55e'} />
              <Text variant='body' size='md' weight='semibold' style={styles.successText}>
                Pickup confirmed!
              </Text>
            </View>
          </Card>
        )}

        {/* Go back button */}
        <Button
          variant='outline'
          size='md'
          onPress={() => navigation.goBack()}
          style={styles.goBackButton}
        >
          Go Back
        </Button>
      </ScrollView>

      {/* Donation impact overlay – shown once on mount when donation > 0 */}
      {order.donationAmount > 0 && donationStats && (
        <ImpactMoment
          visible={showImpactMoment}
          donationAmount={order.donationAmount}
          totalDonations={donationStats.totalDonations}
          mealCount={donationStats.mealCount}
          onDismiss={() => setShowImpactMoment(false)}
          currency={order.pricing.currency}
        />
      )}
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
    backgroundColor: '#e5e7eb',
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
    backgroundColor: '#fafafa',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
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
    color: '#22c55e',
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

  // Go back
  goBackButton: {
    marginTop: 8,
  },
});
