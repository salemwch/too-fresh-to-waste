import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Platform, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Text, Button, Icon } from '@/design-system/components/atoms';
import { updateUser, selectIsPhoneVerified } from '@/features/auth/store/authSlice';
import { useAppSelector, useAppDispatch } from '@/hooks';
import { offersService } from '@/features/offers/services/offersService';
import { showErrorToast, showInfoToast } from '@/utils/toast';
import { CommonActions } from '@react-navigation/native';

import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { PhoneVerificationModal } from '../components/PhoneVerificationModal';
import { SkeletonCheckoutScreen } from '../components/SkeletonCheckoutScreen';
import { SkeletonOrderSuccessModal } from '../components/SkeletonOrderSuccessModal';
import { SkeletonPhoneVerificationModal } from '../components/SkeletonPhoneVerificationModal';
import { useCreateOrder } from '../hooks/useCreateOrder';
import { analytics } from '@/utils/analytics';
import { useSecureScreen } from '@/hooks/useSecureScreen';

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
  const [quantity, setQuantity] = useState(initialQuantity);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<CreateOrderDto['paymentMethod']>('cash_on_pickup');
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
   * Handle quantity increase
   * ✅ Validates against available stock
   */
  const handleIncreaseQuantity = useCallback(() => {
    if (!offer) return;

    const availableQuantity = offer.availableQuantity ?? offer.totalQuantity - offer.soldQuantity;
    const maxQuantity = Math.min(availableQuantity, 10); // Business rule: max 10 per order

    if (quantity >= maxQuantity) {
      showInfoToast(
        'Maximum Quantity Reached',
        availableQuantity <= 10
          ? `Only ${availableQuantity} bags available for this offer.`
          : 'Maximum 10 bags per order.',
      );
      return;
    }

    setQuantity(prev => prev + 1);
  }, [offer, quantity]);

  /**
   * Handle quantity decrease
   * ✅ Minimum quantity is 1
   */
  const handleDecreaseQuantity = useCallback(() => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  }, [quantity]);

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
    console.log('⏰ Parsed offerStartTime:', offerStartTime.toISOString(), `(${offerStartTime.getTime()})`);
    console.log('⏰ Parsed offerEndTime:', offerEndTime.toISOString(), `(${offerEndTime.getTime()})`);

    // ✅ Add safety buffer to ensure pickup time is in the future
    // INCREASED FROM 30s TO 120s to account for:
    // - Network latency (typically 1-5 seconds)
    // - Request processing time
    // - Clock skew between device and server
    // - Validation delay on backend
    const nowWithBuffer = new Date(now.getTime() + 120 * 1000); // 120 seconds (2 minutes) buffer
    console.log('⏱️  Now + 120s buffer:', nowWithBuffer.toISOString(), `(${nowWithBuffer.getTime()})`);

    // ✅ Calculate the earliest valid pickup time
    // Use the later of: (now + buffer) or offer start time
    const earliestPickupTime = Math.max(nowWithBuffer.getTime(), offerStartTime.getTime());
    console.log('🎯 Earliest pickup time (max of now+30s or offer start):', new Date(earliestPickupTime).toISOString(), `(${earliestPickupTime})`);

    // ✅ CRITICAL: Check if offer has enough time remaining
    // We need at least 1 minute buffer before offer expires
    const minimumTimeBeforeExpiry = 60 * 1000; // 1 minute
    const latestAllowedPickup = offerEndTime.getTime() - minimumTimeBeforeExpiry;
    console.log('⚠️  Latest allowed pickup (offer end - 1 min):', new Date(latestAllowedPickup).toISOString(), `(${latestAllowedPickup})`);
    console.log('✅ Time remaining until offer expires:', Math.floor((offerEndTime.getTime() - now.getTime()) / 1000 / 60), 'minutes');

    if (earliestPickupTime >= latestAllowedPickup) {
      console.log('❌ REJECTED: Not enough time remaining!');
      console.log('   Earliest pickup:', new Date(earliestPickupTime).toISOString());
      console.log('   Latest allowed:', new Date(latestAllowedPickup).toISOString());
      console.log('================================================\n');
      showInfoToast(
        'Offer Expired',
        'This offer has expired or doesn\'t have enough time remaining for pickup. Please choose another offer.',
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

  const establishmentName =
    typeof offer.establishmentId === 'string'
      ? 'Loading...'
      : offer.establishmentId?.name || 'Unknown establishment';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Complete Your Order</Text>
          <Text style={styles.headerSubtitle}>Review details before confirming</Text>
        </View>

        {/* Main Content Card */}
        <View style={styles.mainCard}>
          {/* Offer Details Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name='restaurant' family='Ionicons' size={20} color='#005250' />
              <Text style={styles.sectionTitle}>Your Surprise Bag</Text>
            </View>

            <View style={styles.offerDetailsCard}>
              {/* Offer Image & Details Row */}
              <View style={styles.offerImageRow}>
                {/* Offer Image */}
                {offer.images.length > 0 ? (
                  <Image
                    source={{ uri: offer.images[0] }}
                    style={styles.offerImage}
                    resizeMode='cover'
                  />
                ) : (
                  <View style={styles.offerImagePlaceholder}>
                    <Icon name='fast-food' family='Ionicons' size={32} color='#94A3B8' />
                  </View>
                )}

                {/* Offer Details */}
                <View style={styles.offerDetails}>
                  <Text style={styles.offerTitle} numberOfLines={2}>
                    {offer.title}
                  </Text>
                  <Text style={styles.offerEstablishment} numberOfLines={1}>
                    {establishmentName}
                  </Text>
                </View>
              </View>

              {/* Quantity Stepper Section */}
              <View style={styles.quantitySection}>
                <View style={styles.quantityLabelRow}>
                  <Text style={styles.quantityLabel}>Quantity</Text>
                  {offer.availableQuantity !== undefined && offer.availableQuantity <= 10 && (
                    <Text style={styles.availabilityText}>{offer.availableQuantity} available</Text>
                  )}
                </View>

                <View style={styles.quantityStepper}>
                  {/* Decrease Button */}
                  <Pressable
                    onPress={handleDecreaseQuantity}
                    disabled={quantity <= 1}
                    style={[styles.quantityButton, quantity <= 1 && styles.quantityButtonDisabled]}
                    accessibilityLabel='Decrease quantity'
                    accessibilityRole='button'
                  >
                    <Icon
                      name='remove'
                      family='Ionicons'
                      size={20}
                      color={quantity <= 1 ? '#CBD5E1' : '#005250'}
                    />
                  </Pressable>

                  {/* Quantity Display */}
                  <View style={styles.quantityDisplay}>
                    <Text style={styles.quantityValue}>{quantity}</Text>
                    <Text style={styles.quantityBagText}>{quantity === 1 ? 'bag' : 'bags'}</Text>
                  </View>

                  {/* Increase Button */}
                  <Pressable
                    onPress={handleIncreaseQuantity}
                    disabled={
                      quantity >=
                      Math.min(
                        offer.availableQuantity ?? offer.totalQuantity - offer.soldQuantity,
                        10,
                      )
                    }
                    style={[
                      styles.quantityButton,
                      quantity >=
                        Math.min(
                          offer.availableQuantity ?? offer.totalQuantity - offer.soldQuantity,
                          10,
                        ) && styles.quantityButtonDisabled,
                    ]}
                    accessibilityLabel='Increase quantity'
                    accessibilityRole='button'
                  >
                    <Icon
                      name='add'
                      family='Ionicons'
                      size={20}
                      color={
                        quantity >=
                        Math.min(
                          offer.availableQuantity ?? offer.totalQuantity - offer.soldQuantity,
                          10,
                        )
                          ? '#CBD5E1'
                          : '#005250'
                      }
                    />
                  </Pressable>
                </View>
              </View>

              {/* Divider */}
              <View style={styles.offerDivider} />

              {/* Pickup Information */}
              <View style={styles.pickupInfo}>
                <View style={styles.pickupRow}>
                  <Icon name='calendar' family='Ionicons' size={18} color='#64748B' />
                  <Text style={styles.pickupText}>
                    {new Date(offer.availableFrom).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.pickupRow}>
                  <Icon name='time' family='Ionicons' size={18} color='#64748B' />
                  <Text style={styles.pickupText}>
                    Pickup Time: {offer.pickupTimeSlots?.[0]?.startTime} -{' '}
                    {offer.pickupTimeSlots?.[0]?.endTime}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Payment Method Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name='wallet' family='Ionicons' size={20} color='#005250' />
              <Text style={styles.sectionTitle}>Payment Method</Text>
            </View>

            {/* Pay on Pickup */}
            <Pressable
              style={[
                styles.paymentMethodSelectable,
                selectedPaymentMethod === 'cash_on_pickup' && styles.paymentMethodActive,
              ]}
              onPress={() => setSelectedPaymentMethod('cash_on_pickup')}
              accessibilityLabel='Pay on Pickup'
              accessibilityRole='button'
            >
              <View style={styles.paymentMethodContent}>
                <View
                  style={[
                    styles.paymentIconContainer,
                    selectedPaymentMethod === 'cash_on_pickup' && styles.paymentIconContainerActive,
                  ]}
                >
                  <Icon
                    name='cash'
                    family='Ionicons'
                    size={24}
                    color={selectedPaymentMethod === 'cash_on_pickup' ? '#005250' : '#64748B'}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Text
                    style={
                      selectedPaymentMethod === 'cash_on_pickup'
                        ? styles.paymentMethodTitle
                        : styles.paymentMethodTitleUnselected
                    }
                  >
                    Pay on Pickup
                  </Text>
                  <Text style={styles.paymentMethodSubtitle}>Cash payment at restaurant</Text>
                </View>
                {selectedPaymentMethod === 'cash_on_pickup' && (
                  <View style={styles.selectedBadge}>
                    <Icon name='checkmark-circle' family='Ionicons' size={24} color='#10B981' />
                  </View>
                )}
              </View>
            </Pressable>

            {/* Pay on Delivery */}
            <Pressable
              style={[
                styles.paymentMethodSelectable,
                selectedPaymentMethod === 'pay_on_delivery' && styles.paymentMethodActive,
              ]}
              onPress={() => setSelectedPaymentMethod('pay_on_delivery')}
              accessibilityLabel='Pay on Delivery'
              accessibilityRole='button'
            >
              <View style={styles.paymentMethodContent}>
                <View
                  style={[
                    styles.paymentIconContainer,
                    selectedPaymentMethod === 'pay_on_delivery'
                      ? styles.paymentIconContainerActive
                      : styles.paymentIconContainerInactive,
                  ]}
                >
                  <Icon
                    name='bicycle'
                    family='Ionicons'
                    size={24}
                    color={selectedPaymentMethod === 'pay_on_delivery' ? '#005250' : '#64748B'}
                  />
                </View>
                <View style={styles.flexOne}>
                  <Text
                    style={
                      selectedPaymentMethod === 'pay_on_delivery'
                        ? styles.paymentMethodTitle
                        : styles.paymentMethodTitleUnselected
                    }
                  >
                    Pay on Delivery
                  </Text>
                  <Text style={styles.paymentMethodSubtitle}>Cash payment upon delivery</Text>
                </View>
                {selectedPaymentMethod === 'pay_on_delivery' && (
                  <View style={styles.selectedBadge}>
                    <Icon name='checkmark-circle' family='Ionicons' size={24} color='#10B981' />
                  </View>
                )}
              </View>
            </Pressable>

            {/* Online Payment - Coming Soon */}
            <View style={styles.paymentMethodDisabled}>
              <View style={styles.paymentMethodContent}>
                <View style={[styles.paymentIconContainer, styles.paymentIconContainerInactive]}>
                  <Icon name='card' family='Ionicons' size={24} color='#94A3B8' />
                </View>
                <View style={styles.flexOne}>
                  <View style={styles.rowCenter}>
                    <Text style={styles.paymentMethodTitleDisabled}>Online Payment</Text>
                    <View style={styles.comingSoonBadge}>
                      <Text style={styles.comingSoonText}>Coming Soon</Text>
                    </View>
                  </View>
                  <Text style={styles.paymentMethodSubtitleDisabled}>
                    Credit card, PayMe & more
                  </Text>
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
      </ScrollView>

      {/* Context-aware skeleton: show the correct shape based on verification status */}
      <SkeletonOrderSuccessModal visible={isCreatingOrder && isPhoneVerified} />
      <SkeletonPhoneVerificationModal visible={isCreatingOrder && !isPhoneVerified} />

      {/* Phone Verification Modal */}
      <PhoneVerificationModal
        visible={phoneVerificationModal.isVisible}
        requiresPhoneSetup={phoneVerificationModal.requiresPhoneSetup}
        requiresPhoneVerification={phoneVerificationModal.requiresPhoneVerification}
        onClose={closePhoneVerificationModal}
        onVerificationComplete={handleVerificationComplete}
      />

      {/* Order Success Modal - Must be dismissed manually */}
      <OrderSuccessModal
        visible={successModalVisible}
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
  scrollContent: {
    paddingBottom: 32,
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

  // Header

  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#005250',
    marginTop: 12,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
  },

  // Main Card
  mainCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: -16,
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

  // Offer Details
  offerDetailsCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offerImageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  offerImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
  },
  offerImagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  offerDetails: {
    flex: 1,
    marginLeft: 12,
  },
  offerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
    lineHeight: 22,
  },
  offerEstablishment: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },

  // Quantity Stepper
  quantitySection: {
    marginTop: 16,
    marginBottom: 16,
  },
  quantityLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quantityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
  },
  availabilityText: {
    fontSize: 13,
    color: '#EF4444',
    fontWeight: '600',
  },
  quantityStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  quantityButtonDisabled: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  quantityDisplay: {
    marginHorizontal: 24,
    alignItems: 'center',
    minWidth: 60,
  },
  quantityValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#005250',
    lineHeight: 28,
  },
  quantityBagText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    fontWeight: '500',
  },

  offerDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginBottom: 14,
  },
  pickupInfo: {
    gap: 10,
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickupText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 10,
    fontWeight: '500',
  },

  // Payment Methods
  paymentMethodSelectable: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  paymentMethodActive: {
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  paymentMethodDisabled: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    opacity: 0.6,
  },
  paymentMethodContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentIconContainerActive: {
    backgroundColor: '#D1FAE5',
  },
  paymentIconContainerInactive: {
    backgroundColor: '#F1F5F9',
  },
  flexOne: {
    flex: 1,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  paymentMethodTitleUnselected: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 2,
  },
  paymentMethodSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  paymentMethodTitleDisabled: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
  },
  paymentMethodSubtitleDisabled: {
    fontSize: 13,
    color: '#CBD5E1',
  },
  selectedBadge: {
    marginLeft: 'auto',
  },
  comingSoonBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
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
    marginVertical: 24,
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
