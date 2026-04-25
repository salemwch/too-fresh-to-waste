import { CommonActions } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { updateUser, selectIsPhoneVerified } from '@/features/auth/store/authSlice';
import { offersService } from '@/features/offers/services/offersService';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { usePressGuard } from '@/hooks/usePressGuard';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';
import { showErrorToast, showInfoToast } from '@/utils/toast';

import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { PhoneVerificationModal } from '../components/PhoneVerificationModal';
import { SkeletonCheckoutScreen } from '../components/SkeletonCheckoutScreen';
import { useCreateOrder } from '../hooks/useCreateOrder';

import type { CreateOrderDto, Order } from '../types/order.types';
import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type CheckoutScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'Checkout'>;
type CheckoutScreenRouteProp = RouteProp<MainStackParamList, 'Checkout'>;

interface CheckoutScreenProps {
  navigation: CheckoutScreenNavigationProp;
  route: CheckoutScreenRouteProp;
}

const SCREEN_BACKGROUND = '#F8FAFC';
const SURFACE = '#FFFFFF';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#64748B';
const TEXT_TERTIARY = '#475569';
const TEXT_DISABLED = '#94A3B8';
const BORDER_SUBTLE = '#E2E8F0';
const BRAND_PRIMARY = colorTokens.base.primary[500];
const SUCCESS_BORDER = '#10B981';
const SUCCESS_SURFACE = '#F0FDF4';
const SUCCESS_TINT = '#D1FAE5';
const SUCCESS_TEXT = '#059669';
const WARNING_SURFACE = '#FEF3C7';
const WARNING_TEXT = '#92400E';
const ERROR_SURFACE = '#FEF2F2';
const ERROR_BORDER = '#EF4444';
const ERROR_TEXT = '#991B1B';
const WHITE = '#FFFFFF';

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { offerId, quantity: initialQuantity = 1 } = route.params;

  // Named selector returns a primitive boolean — re-renders ONLY when this value flips,
  // not when unrelated user fields (name, avatar, email…) change.
  const isPhoneVerified = useAppSelector(selectIsPhoneVerified);

  // ✅ State for order configuration
  const [quantity] = useState(initialQuantity);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<CreateOrderDto['paymentMethod']>('cash_on_pickup');
  const [customerNotes] = useState('');

  // ✅ State for success modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  // ✅ Fetch offer details
  const { data: offer, isLoading: isLoadingOffer } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: ({ signal }) => offersService.getOfferById(offerId, signal),
  });

  // ── Analytics: checkout_started (fires once when offer data is ready) ──────
  const offerId_stable = offerId; // avoid stale closure warning
  useEffect(() => {
    if (offer) {
      analytics.trackCheckoutStarted(
        offerId_stable,
        offer.title,
        offer.pricing?.discountedPrice ?? offer.pricing?.originalPrice ?? 0,
        quantity,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.id, offer?._id]);

  // ✅ Use smart order creation hook with callbacks
  const {
    createOrder,
    isLoading: isCreatingOrder,
    error: orderError,
    phoneVerificationModal,
    closePhoneVerificationModal,
  } = useCreateOrder({
    onSuccess: order => {
      // Show success modal immediately — do not block on query invalidation.
      setCreatedOrder(order);
      setSuccessModalVisible(true);

      analytics.trackOrderPlaced(
        order._id,
        order.orderNumber,
        order.pricing?.total ?? 0,
        order.pricing?.currency ?? 'TND',
      );

      // Invalidate in the background so inventory stays fresh across the app.
      void queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
      void queryClient.invalidateQueries({ queryKey: ['offers'] });
      void queryClient.invalidateQueries({ queryKey: ['nearby-offers'] });
      void queryClient.invalidateQueries({ queryKey: ['featured-offers'] });
    },
    onError: error => {
      Logger.error('[CheckoutScreen] Order creation failed', {}, error);
    },
  });

  /**
   * Handle order confirmation
   * ✅ BEST PRACTICE: Optimistic order creation with phone verification fallback
   */
  const handleConfirmOrder = useCallback(async () => {
    if (!offer) {
      showErrorToast('Error', 'Offer details not loaded. Please try again.');
      return;
    }

    const establishmentId: string = (() => {
      const eid = offer.establishmentId;
      if (!eid) return '';
      if (typeof eid === 'string') return eid;
      return eid._id ?? eid.id ?? '';
    })();

    // ✅ BUSINESS RULE: Calculate valid pickup date
    // Backend uses strict ">" against its own clock, so we add a 2-minute buffer
    // to cover network latency, request processing time, and clock skew between device and server.
    const now = new Date();
    const offerStartTime = new Date(offer.availableFrom);
    const offerEndTime = new Date(offer.availableUntil);

    Logger.debug('[CheckoutScreen] Calculating pickup date', {
      nowIso: now.toISOString(),
      nowTimestamp: now.getTime(),
      offerAvailableFrom: offer.availableFrom,
      offerAvailableUntil: offer.availableUntil,
      offerStartTimeIso: offerStartTime.toISOString(),
      offerStartTimeTimestamp: offerStartTime.getTime(),
      offerEndTimeIso: offerEndTime.toISOString(),
      offerEndTimeTimestamp: offerEndTime.getTime(),
    });

    // ✅ Add safety buffer to ensure pickup time is in the future
    // INCREASED FROM 30s TO 120s to account for:
    // - Network latency (typically 1-5 seconds)
    // - Request processing time
    // - Clock skew between device and server
    // - Validation delay on backend
    const nowWithBuffer = new Date(now.getTime() + 120 * 1000); // 120 seconds (2 minutes) buffer

    // ✅ Calculate the earliest valid pickup time
    // Use the later of: (now + buffer) or offer start time
    const earliestPickupTime = Math.max(nowWithBuffer.getTime(), offerStartTime.getTime());

    // ✅ CRITICAL: Check if offer has enough time remaining
    // We need at least 1 minute buffer before offer expires
    const minimumTimeBeforeExpiry = 60 * 1000; // 1 minute
    const latestAllowedPickup = offerEndTime.getTime() - minimumTimeBeforeExpiry;
    Logger.debug('[CheckoutScreen] Pickup timing evaluated', {
      nowWithBufferIso: nowWithBuffer.toISOString(),
      nowWithBufferTimestamp: nowWithBuffer.getTime(),
      earliestPickupTimeIso: new Date(earliestPickupTime).toISOString(),
      earliestPickupTimeTimestamp: earliestPickupTime,
      latestAllowedPickupIso: new Date(latestAllowedPickup).toISOString(),
      latestAllowedPickupTimestamp: latestAllowedPickup,
      minutesUntilOfferExpiry: Math.floor((offerEndTime.getTime() - now.getTime()) / 1000 / 60),
    });

    if (earliestPickupTime >= latestAllowedPickup) {
      Logger.warn('[CheckoutScreen] Offer rejected because pickup window is no longer valid', {
        earliestPickupTimeIso: new Date(earliestPickupTime).toISOString(),
        latestAllowedPickupIso: new Date(latestAllowedPickup).toISOString(),
      });
      showInfoToast(
        'Offer Expired',
        "This offer has expired or doesn't have enough time remaining for pickup. Please choose another offer.",
      );
      // Stale data in cache — force a refresh so the UI reflects reality.
      await queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
      return;
    }

    // ✅ Set pickup date to earliest valid time (guaranteed to be in the future)
    const pickupDate = new Date(earliestPickupTime);
    Logger.debug('[CheckoutScreen] Final pickup date selected', {
      pickupDateIso: pickupDate.toISOString(),
      pickupDateTimestamp: pickupDate.getTime(),
    });

    const orderData: CreateOrderDto = {
      items: [{ offerId, quantity }],
      establishmentId,
      pickupTimeSlot: {
        startTime: offer.pickupTimeSlots?.[0]?.startTime ?? '14:00',
        endTime: offer.pickupTimeSlots?.[0]?.endTime ?? '16:00',
      },
      pickupDate: pickupDate.toISOString(),
      paymentMethod: selectedPaymentMethod,
      ...(customerNotes ? { customerNotes } : {}),
    };

    Logger.debug('[CheckoutScreen] Submitting order payload', {
      orderData,
      pickupDateIso: orderData.pickupDate,
      pickupDateLocal: new Date(orderData.pickupDate).toLocaleString(),
      currentTimeIso: new Date().toISOString(),
      currentTimeLocal: new Date().toLocaleString(),
    });

    try {
      await createOrder(orderData);
    } catch (error) {
      const capturedError =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : 'Unknown error');

      Logger.error('[CheckoutScreen] Order creation failed', {}, capturedError);

      // ✅ Extract readable error message
      let errorMessage = 'Failed to create order. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (error != null && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Slot-full errors are already shown inline via the error banner — skip the toast
      if (!errorMessage.includes('pickup slot is full')) {
        showErrorToast('Order Failed', errorMessage);
      }
    }
  }, [offer, offerId, quantity, selectedPaymentMethod, customerNotes, queryClient, createOrder]);

  // Guard confirm button — 2s cooldown prevents duplicate orders from rapid taps
  const { guardedPress: guardedConfirmOrder } = usePressGuard(handleConfirmOrder, 2000);

  /**
   * Handle phone verification completion
   * ✅ CRITICAL: Re-runs full handleConfirmOrder instead of retryOrderCreation
   * because the stored pickupDate becomes stale during the verification flow
   * (user spends 1-2+ minutes entering phone + OTP).
   */
  const handleVerificationComplete = useCallback(async () => {
    try {
      closePhoneVerificationModal();
      // Mark user as verified so the retry shows the order-success skeleton
      dispatch(updateUser({ isPhoneVerified: true }));
      await handleConfirmOrder();
    } catch (error) {
      showErrorToast(
        'Order Failed',
        error instanceof Error
          ? error.message
          : 'Phone verified, but order creation failed. Please try again.',
      );
    }
  }, [closePhoneVerificationModal, handleConfirmOrder, dispatch]);

  /**
   * Calculate pricing
   * ✅ No service fee - customer pays exact bag price (matches backend)
   */
  const subtotal = offer ? offer.pricing.discountedPrice * quantity : 0;
  const serviceFee = 0;
  const total = subtotal;
  const currency = offer?.pricing.currency ?? 'TND';
  const originalPrice = offer ? offer.pricing.originalPrice * quantity : 0;
  const savings = originalPrice - subtotal;

  /**
   * Handle success modal dismissal
   * ✅ Navigate to order details when user clicks "View My Order"
   */
  const handleSuccessModalDismiss = useCallback(() => {
    setSuccessModalVisible(false);

    // Navigate to OrderDetails inside the nested OrdersStack (Orders tab)
    // OrderDetails lives in: MainTabs → Orders (tab) → OrdersStack → OrderDetails
    if (createdOrder) {
      const resetAction = CommonActions.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [
                {
                  name: 'Orders',
                  state: {
                    routes: [
                      { name: 'OrdersList' },
                      { name: 'OrderDetails', params: { orderId: createdOrder._id } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      });
      navigation.dispatch(resetAction as Readonly<{ type: string }>);
    }
  }, [createdOrder, navigation]);

  /**
   * Loading state - Show skeleton screen
   */
  if (isLoadingOffer) {
    return <SkeletonCheckoutScreen />;
  }

  /**
   * Error state
   */
  if (!offer) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name='alert-circle' family='Ionicons' size={64} color='#EF4444' />
          <Text variant='title' size='lg' weight='bold' style={styles.errorTitle}>
            Offer Not Found
          </Text>
          <Button
            variant='primary'
            size='md'
            onPress={() => navigation.goBack()}
            style={styles.errorGoBackButton}
          >
            Go Back
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Main Content Card */}
      <View style={styles.mainCard}>
        {/* Payment Method Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name='wallet' family='Ionicons' size={20} color={BRAND_PRIMARY} />
            <Text style={styles.sectionTitle}>Payment Method</Text>
          </View>

          {/* Payment options — three equal tiles in a single row */}
          <View style={styles.paymentMethodsRow}>
            {/* Pay on Pickup */}
            <Pressable
              style={[
                styles.paymentMethodCard,
                selectedPaymentMethod === 'cash_on_pickup' && styles.paymentMethodCardActive,
              ]}
              onPress={() => setSelectedPaymentMethod('cash_on_pickup')}
              accessibilityLabel='Pay on Pickup'
              accessibilityHint='Selects pay on pickup as payment method'
              accessibilityRole='button'
            >
              {selectedPaymentMethod === 'cash_on_pickup' && (
                <View style={styles.paymentCardCheck}>
                  <Icon name='checkmark-circle' family='Ionicons' size={16} color='#10B981' />
                </View>
              )}
              <Icon
                name='cash'
                family='Ionicons'
                size={28}
                color={selectedPaymentMethod === 'cash_on_pickup' ? BRAND_PRIMARY : '#64748B'}
              />
              <Text
                style={[
                  styles.paymentCardLabel,
                  selectedPaymentMethod === 'cash_on_pickup' && styles.paymentCardLabelActive,
                ]}
              >
                {'Pay on\nPickup'}
              </Text>
            </Pressable>

            {/* Pay on Delivery */}
            <Pressable
              style={[
                styles.paymentMethodCard,
                selectedPaymentMethod === 'pay_on_delivery' && styles.paymentMethodCardActive,
              ]}
              onPress={() => setSelectedPaymentMethod('pay_on_delivery')}
              accessibilityLabel='Pay on Delivery'
              accessibilityHint='Selects pay on delivery as payment method'
              accessibilityRole='button'
            >
              {selectedPaymentMethod === 'pay_on_delivery' && (
                <View style={styles.paymentCardCheck}>
                  <Icon name='checkmark-circle' family='Ionicons' size={16} color='#10B981' />
                </View>
              )}
              <Icon
                name='bicycle'
                family='Ionicons'
                size={28}
                color={selectedPaymentMethod === 'pay_on_delivery' ? BRAND_PRIMARY : '#64748B'}
              />
              <Text
                style={[
                  styles.paymentCardLabel,
                  selectedPaymentMethod === 'pay_on_delivery' && styles.paymentCardLabelActive,
                ]}
              >
                {'Pay on\nDelivery'}
              </Text>
            </Pressable>

            {/* Online Payment — Coming Soon */}
            <View style={[styles.paymentMethodCard, styles.paymentMethodCardDisabled]}>
              <Icon name='card' family='Ionicons' size={28} color='#CBD5E1' />
              <Text style={[styles.paymentCardLabel, styles.paymentCardLabelDisabled]}>
                {'Online\nPayment'}
              </Text>
              <View style={styles.comingSoonBadge}>
                <Text style={styles.comingSoonText}>Soon</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Price Summary Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name='receipt' family='Ionicons' size={20} color={BRAND_PRIMARY} />
            <Text style={styles.sectionTitle}>Order Summary</Text>
          </View>

          <View style={styles.priceBreakdown}>
            {/* Subtotal */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Subtotal</Text>
              <Text style={styles.priceValue}>
                {subtotal.toFixed(2)} {currency}
              </Text>
            </View>

            {/* Service Fee */}
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Service Fee</Text>
              <Text style={styles.priceValue}>
                {serviceFee.toFixed(2)} {currency}
              </Text>
            </View>

            {/* Savings Badge */}
            {savings > 0 && (
              <View style={styles.savingsBadge}>
                <Icon name='trending-down' family='Ionicons' size={16} color='#10B981' />
                <Text style={styles.savingsText}>
                  You save {savings.toFixed(2)} {currency}
                </Text>
              </View>
            )}

            {/* Total */}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                {total.toFixed(2)} {currency}
              </Text>
            </View>
          </View>
        </View>

        {/* Error Message */}
        {orderError != null && (
          <View style={styles.errorBanner}>
            <Icon name='warning' family='Ionicons' size={20} color='#EF4444' />
            <Text style={styles.errorText}>{orderError}</Text>
          </View>
        )}

        {/* Confirm Button with Gradient — guarded against rapid taps */}
        <Pressable
          accessibilityRole='button'
          onPress={() => {
            void guardedConfirmOrder();
          }}
          disabled={isCreatingOrder}
          style={styles.confirmButtonWrapper}
        >
          <LinearGradient
            colors={[BRAND_PRIMARY, colorTokens.base.primary[400]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.confirmButton, isCreatingOrder && styles.confirmButtonDisabled]}
          >
            <Icon name='checkmark-circle' family='Ionicons' size={24} color='#FFFFFF' />
            <Text style={styles.confirmButtonText}>
              Confirm Order • {total.toFixed(2)} {currency}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Cancel Button */}
        <Pressable
          accessibilityRole='button'
          onPress={() => navigation.goBack()}
          disabled={isCreatingOrder}
          style={styles.cancelButton}
        >
          <Text style={styles.cancelButtonText}>Cancel Order</Text>
        </Pressable>
      </View>

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        visible={phoneVerificationModal.isVisible}
        requiresPhoneSetup={phoneVerificationModal.requiresPhoneSetup}
        requiresPhoneVerification={phoneVerificationModal.requiresPhoneVerification}
        onClose={closePhoneVerificationModal}
        onVerificationComplete={handleVerificationComplete}
      />

      {/* Single morph modal: opens with loading state, morphs to content */}
      <OrderSuccessModal
        visible={(isCreatingOrder && isPhoneVerified) || successModalVisible}
        loading={isCreatingOrder && !successModalVisible}
        order={createdOrder}
        onDismiss={handleSuccessModalDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SCREEN_BACKGROUND,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    color: TEXT_PRIMARY,
  },
  errorGoBackButton: {
    marginTop: 24,
  },

  // Main Card
  mainCard: {
    backgroundColor: SURFACE,
    marginHorizontal: 16,
    marginTop: 13,
    borderRadius: 24,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginLeft: 8,
  },

  // Payment Methods — horizontal tile row
  paymentMethodsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  paymentMethodCard: {
    flex: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: BORDER_SUBTLE,
    backgroundColor: SURFACE,
    gap: 6,
    position: 'relative',
  },
  paymentMethodCardActive: {
    borderColor: SUCCESS_BORDER,
    borderWidth: 2,
    backgroundColor: SUCCESS_SURFACE,
  },
  paymentMethodCardDisabled: {
    borderColor: BORDER_SUBTLE,
    backgroundColor: SCREEN_BACKGROUND,
    opacity: 0.6,
  },
  paymentCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_TERTIARY,
    textAlign: 'center',
    lineHeight: 16,
  },
  paymentCardLabelActive: {
    color: BRAND_PRIMARY,
  },
  paymentCardLabelDisabled: {
    color: TEXT_DISABLED,
  },
  paymentCardCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  comingSoonBadge: {
    backgroundColor: WARNING_SURFACE,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: WARNING_TEXT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Price Breakdown
  priceBreakdown: {
    backgroundColor: SCREEN_BACKGROUND,
    borderRadius: 16,
    padding: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SUCCESS_TINT,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: SUCCESS_TEXT,
    marginLeft: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: BORDER_SUBTLE,
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: BRAND_PRIMARY,
    letterSpacing: -0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: BORDER_SUBTLE,
    marginVertical: 12,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ERROR_SURFACE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: ERROR_BORDER,
  },
  errorText: {
    fontSize: 14,
    color: ERROR_TEXT,
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },

  // Buttons
  confirmButtonWrapper: {
    marginTop: 8,
    marginBottom: 12,
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    ...Platform.select({
      ios: {
        shadowColor: BRAND_PRIMARY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: WHITE,
    marginLeft: 10,
    letterSpacing: 0.3,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
});
