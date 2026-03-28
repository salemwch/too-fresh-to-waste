import { CommonActions } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Button, Icon } from '@/design-system/components/atoms';
import { updateUser, selectIsPhoneVerified } from '@/features/auth/store/authSlice';
import { offersService } from '@/features/offers/services/offersService';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { useSecureScreen } from '@/hooks/useSecureScreen';
import { analytics } from '@/utils/analytics';
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

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const dispatch = useAppDispatch();
  const { offerId, quantity: initialQuantity = 1 } = route.params;

  // Prevent screenshots/recordings of payment details
  useSecureScreen();

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
  React.useEffect(() => {
    if (offer) {
      analytics.trackCheckoutStarted(
        offerId_stable,
        offer.title,
        offer.pricing?.discountedPrice ?? offer.pricing?.originalPrice ?? 0,
        quantity,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offer?.id ?? (offer as any)?._id]);

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
      console.error('❌ Order creation failed:', error.message);
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
      if (typeof offer.establishmentId === 'string') return offer.establishmentId;
      if (offer.establishmentId?.id != null) return offer.establishmentId.id;
      if (offer.establishmentId?._id != null) return offer.establishmentId._id;
      return '';
    })();

    // ✅ BUSINESS RULE: Calculate valid pickup date
    // Backend uses strict ">" against its own clock, so we add a 2-minute buffer
    // to cover network latency, request processing time, and clock skew between device and server.
    const now = new Date();
    const offerStartTime = new Date(offer.availableFrom);
    const offerEndTime = new Date(offer.availableUntil);

    // ✅ DEBUG LOGGING: Log all time values
    console.log('\n============ PICKUP DATE CALCULATION ============');
    console.log('📱 Device current time:', now.toISOString(), `(${now.getTime()})`);
    console.log('📅 Offer availableFrom:', offer.availableFrom);
    console.log('📅 Offer availableUntil:', offer.availableUntil);
    console.log(
      '⏰ Parsed offerStartTime:',
      offerStartTime.toISOString(),
      `(${offerStartTime.getTime()})`,
    );
    console.log(
      '⏰ Parsed offerEndTime:',
      offerEndTime.toISOString(),
      `(${offerEndTime.getTime()})`,
    );

    // ✅ Add safety buffer to ensure pickup time is in the future
    // INCREASED FROM 30s TO 120s to account for:
    // - Network latency (typically 1-5 seconds)
    // - Request processing time
    // - Clock skew between device and server
    // - Validation delay on backend
    const nowWithBuffer = new Date(now.getTime() + 120 * 1000); // 120 seconds (2 minutes) buffer
    console.log(
      '⏱️  Now + 120s buffer:',
      nowWithBuffer.toISOString(),
      `(${nowWithBuffer.getTime()})`,
    );

    // ✅ Calculate the earliest valid pickup time
    // Use the later of: (now + buffer) or offer start time
    const earliestPickupTime = Math.max(nowWithBuffer.getTime(), offerStartTime.getTime());
    console.log(
      '🎯 Earliest pickup time (max of now+30s or offer start):',
      new Date(earliestPickupTime).toISOString(),
      `(${earliestPickupTime})`,
    );

    // ✅ CRITICAL: Check if offer has enough time remaining
    // We need at least 1 minute buffer before offer expires
    const minimumTimeBeforeExpiry = 60 * 1000; // 1 minute
    const latestAllowedPickup = offerEndTime.getTime() - minimumTimeBeforeExpiry;
    console.log(
      '⚠️  Latest allowed pickup (offer end - 1 min):',
      new Date(latestAllowedPickup).toISOString(),
      `(${latestAllowedPickup})`,
    );
    console.log(
      '✅ Time remaining until offer expires:',
      Math.floor((offerEndTime.getTime() - now.getTime()) / 1000 / 60),
      'minutes',
    );

    if (earliestPickupTime >= latestAllowedPickup) {
      console.log('❌ REJECTED: Not enough time remaining!');
      console.log('   Earliest pickup:', new Date(earliestPickupTime).toISOString());
      console.log('   Latest allowed:', new Date(latestAllowedPickup).toISOString());
      console.log('================================================\n');
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
    console.log('✅ FINAL pickupDate:', pickupDate.toISOString(), `(${pickupDate.getTime()})`);
    console.log('================================================\n');

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

    console.log('\n============ ORDER DATA TO SEND ============');
    console.log('📦 Order data:', JSON.stringify(orderData, null, 2));
    console.log('🕐 pickupDate (ISO):', orderData.pickupDate);
    console.log('🕐 pickupDate (local):', new Date(orderData.pickupDate).toLocaleString());
    console.log('⏰ Current time (ISO):', new Date().toISOString());
    console.log('⏰ Current time (local):', new Date().toLocaleString());
    console.log('============================================\n');

    try {
      await createOrder(orderData);
    } catch (error) {
      // ✅ DEBUGGING: Log the full error for troubleshooting
      console.error('[CheckoutScreen] Order creation failed:', error);

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
  const currency = offer?.pricing.currency || 'TND';
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
      navigation.dispatch(resetAction as any);
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
            <Icon name='wallet' family='Ionicons' size={20} color='#005250' />
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
                color={selectedPaymentMethod === 'cash_on_pickup' ? '#005250' : '#64748B'}
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
                color={selectedPaymentMethod === 'pay_on_delivery' ? '#005250' : '#64748B'}
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
            <Icon name='receipt' family='Ionicons' size={20} color='#005250' />
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

        {/* Confirm Button with Gradient */}
        <Pressable
          onPress={() => {
            void handleConfirmOrder();
          }}
          disabled={isCreatingOrder}
          style={styles.confirmButtonWrapper}
        >
          <LinearGradient
            colors={['#005250', '#007B77']}
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
    backgroundColor: '#F8FAFC',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    marginTop: 16,
    color: '#1F2937',
  },
  errorGoBackButton: {
    marginTop: 24,
  },

  // Main Card
  mainCard: {
    backgroundColor: '#FFFFFF',
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
    color: '#1F2937',
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
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 6,
    position: 'relative',
  },
  paymentMethodCardActive: {
    borderColor: '#10B981',
    borderWidth: 2,
    backgroundColor: '#F0FDF4',
  },
  paymentMethodCardDisabled: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    opacity: 0.6,
  },
  paymentCardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 16,
  },
  paymentCardLabelActive: {
    color: '#005250',
  },
  paymentCardLabelDisabled: {
    color: '#94A3B8',
  },
  paymentCardCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Price Breakdown
  priceBreakdown: {
    backgroundColor: '#F8FAFC',
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
    color: '#64748B',
  },
  priceValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 8,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#005250',
    letterSpacing: -0.5,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },

  // Error Banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
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
        shadowColor: '#005250',
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
    color: '#FFFFFF',
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
    color: '#64748B',
  },
});
