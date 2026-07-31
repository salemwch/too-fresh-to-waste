import { CommonActions } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MapView from 'react-native-maps';

import { Text, Button, Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { getCurrentPositionOnce } from '@/services/location/getCurrentPositionOnce';
import { selectAuthUser, selectIsPhoneVerified } from '@/features/auth/store/authSlice';
import { offersService } from '@/features/offers/services/offersService';
import { nearbyOffersService } from '@/features/offers/services/nearbyOffersService';
import { useAppSelector } from '@/hooks';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useLocation } from '@/hooks/useLocation';
import { usePressGuard } from '@/hooks/usePressGuard';
import { analytics } from '@/utils/analytics';
import { Logger } from '@/utils/logger';

import { KonnectPaymentSheet } from '../components/KonnectPaymentSheet';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { PhoneVerificationModal } from '../components/PhoneVerificationModal';
import { SkeletonCheckoutScreen } from '../components/SkeletonCheckoutScreen';
import { useCreateOrder } from '../hooks/useCreateOrder';

import {
  styles,
  BRAND_PRIMARY,
  SUCCESS_TEXT,
  WARNING_TEXT,
  ERROR_TEXT,
} from './CheckoutScreen.styles';

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

const MAX_DELIVERY_KM = 5;

/** Mirrors FLAT_DELIVERY_FEE in the backend order.service.ts. */
const DELIVERY_FEE_TND = 4;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a2 =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(a2), Math.sqrt(1 - a2));
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { offerId, quantity: initialQuantity = 1 } = route.params;

  // Named selector returns a primitive boolean — re-renders ONLY when this value flips,
  // not when unrelated user fields (name, avatar, email…) change.
  const isPhoneVerified = useAppSelector(selectIsPhoneVerified);
  const authUser = useAppSelector(selectAuthUser);
  const { coordinates: userCoords } = useLocation();

  // ✅ State for order configuration
  const [quantity] = useState(initialQuantity);
  const [selectedFulfillment, setSelectedFulfillment] = useState<'pickup' | 'delivery'>('pickup');
  const [selectedPayment, setSelectedPayment] = useState<'cash' | 'online'>('cash');
  const [customerNotes] = useState('');

  const { onlinePayment: onlinePaymentEnabled } = useFeatureFlags();

  // The flag arrives after first paint and can flip mid-session, so a stale
  // 'online' selection has to be walked back — otherwise the card disappears
  // while the order still carries paymentMethod: 'online'.
  useEffect(() => {
    if (!onlinePaymentEnabled && selectedPayment === 'online') {
      setSelectedPayment('cash');
    }
  }, [onlinePaymentEnabled, selectedPayment]);

  const deliveryMode = selectedFulfillment;

  const selectedPaymentMethod: CreateOrderDto['paymentMethod'] = (() => {
    if (selectedPayment === 'online' && onlinePaymentEnabled) return 'online';
    return selectedFulfillment === 'delivery' ? 'pay_on_delivery' : 'cash_on_pickup';
  })();
  const [deliveryPin, setDeliveryPin] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryAddressText, setDeliveryAddressText] = useState<string>('');

  // ✅ State for success modal
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Payment sheet state for online payments
  const [paymentSheetVisible, setPaymentSheetVisible] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  // ✅ Fetch offer details
  const { data: offer, isLoading: isLoadingOffer } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: ({ signal }) => offersService.getOfferById(offerId, signal),
  });

  // Establishment coordinates from the populated offer (GeoJSON [lng, lat])
  const estCoords = (() => {
    const eid = offer?.establishmentId;
    if (typeof eid === 'object' && eid?.address?.coordinates?.coordinates) {
      const [lng, lat] = eid.address.coordinates.coordinates;
      return { lat: lat ?? 0, lng: lng ?? 0 };
    }
    return null;
  })();

  const distanceKm = deliveryPin && estCoords ? haversineKm(estCoords, deliveryPin) : null;
  const tooFar = distanceKm !== null && distanceKm > MAX_DELIVERY_KM;

  // True when the establishment is outside the delivery zone based on the user's
  // stored location (not the delivery pin) — used to disable the delivery option proactively.
  const isOutsideDeliveryZone = useMemo(() => {
    if (!estCoords || !userCoords) return false;
    return (
      haversineKm(estCoords, {
        lat: userCoords.latitude,
        lng: userCoords.longitude,
      }) > MAX_DELIVERY_KM
    );
  }, [estCoords, userCoords]);

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

  // ── GPS permission + initial pin when delivery mode selected ─────────────
  useEffect(() => {
    if (deliveryMode !== 'delivery') {
      setDeliveryPin(null);
      return;
    }

    let active = true;

    // One request, routed through getCurrentPositionOnce so it cannot overlap
    // another screen's single-shot request — two overlapping ones crash the
    // process (Play Services `NullPointerException: Listener must not be
    // null`). This previously had two call sites in try/catch branches; they
    // were mutually exclusive so they never raced each other, but they could
    // still race the home screen's location request.
    const acquirePin = async (): Promise<void> => {
      try {
        const { request, PERMISSIONS } = await import('react-native-permissions');
        const result = await request(PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION);
        if (result !== 'granted') return;
      } catch {
        // Permissions module unavailable — fall through and try anyway. The
        // permission may already be granted, and the request below fails
        // harmlessly if it is not.
      }

      try {
        const fix = await getCurrentPositionOnce({ enableHighAccuracy: true, timeoutMs: 15_000 });
        if (active) setDeliveryPin({ lat: fix.latitude, lng: fix.longitude });
      } catch {
        // No pin. The user can still place one manually on the map, so this
        // must stay silent rather than surfacing a technical error.
      }
    };

    void acquirePin();

    return () => {
      active = false;
    };
  }, [deliveryMode]);

  // Reverse-geocode the delivery pin to get a real address (debounced)
  useEffect(() => {
    if (!deliveryPin) {
      setDeliveryAddressText('');
      return;
    }

    const timer = setTimeout(() => {
      nearbyOffersService
        .reverseGeocode({ latitude: deliveryPin.lat, longitude: deliveryPin.lng })
        .then(addr => {
          const text =
            addr.formattedAddress ||
            [addr.street, addr.city, addr.postalCode].filter(Boolean).join(', ') ||
            `${deliveryPin.lat.toFixed(5)}, ${deliveryPin.lng.toFixed(5)}`;
          setDeliveryAddressText(text);
        })
        .catch(() => {
          setDeliveryAddressText(`${deliveryPin.lat.toFixed(5)}, ${deliveryPin.lng.toFixed(5)}`);
        });
    }, 600);

    return () => clearTimeout(timer);
  }, [deliveryPin]);

  // ✅ Use smart order creation hook with callbacks
  const {
    createOrder,
    isLoading: isCreatingOrder,
    error: orderError,
    phoneVerificationModal,
    openPhoneSetupModal,
    closePhoneVerificationModal,
  } = useCreateOrder({
    onSuccess: order => {
      // The order is placed the moment the backend accepts it — track it now for
      // both flows. Online payment success/failure is a separate concern handled
      // by OrderDetailsScreen polling; it is not known at this point.
      analytics.trackOrderPlaced(
        order._id,
        order.orderNumber,
        order.pricing?.total ?? 0,
        order.pricing?.currency ?? 'TND',
      );

      // Online payment: open KonnectPaymentSheet instead of success modal
      if (order.payUrl) {
        setCreatedOrder(order);
        setPaymentUrl(order.payUrl);
        setPaymentSheetVisible(true);
        return;
      }

      // Cash/pickup: show success modal immediately
      setCreatedOrder(order);
      setSuccessModalVisible(true);

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

  // Prompt for phone number immediately when the user enters checkout without one
  useEffect(() => {
    if (!authUser?.phoneNumber) {
      openPhoneSetupModal();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount-only check

  /**
   * Handle order confirmation
   * ✅ BEST PRACTICE: Optimistic order creation with phone verification fallback
   */
  const handleConfirmOrder = useCallback(async () => {
    setValidationError(null);

    if (!offer) {
      setValidationError(t('checkout.offerNotLoaded'));
      return;
    }

    if (deliveryMode === 'delivery' && !deliveryPin) {
      setValidationError(t('checkout.waitForLocation'));
      return;
    }

    if (deliveryMode === 'delivery' && tooFar) {
      setValidationError(
        t('checkout.tooFarError', { distance: distanceKm!.toFixed(1), max: MAX_DELIVERY_KM }),
      );
      return;
    }

    const establishmentId: string = (() => {
      const eid = offer.establishmentId;
      if (!eid) return '';
      if (typeof eid === 'string') return eid;
      return eid._id ?? eid.id ?? '';
    })();

    const now = new Date();
    const offerStartTime = new Date(offer.availableFrom);
    const offerEndTime = new Date(offer.availableUntil);

    // Block if fewer than 30 seconds remain — not enough time to complete a pickup
    const msUntilExpiry = offerEndTime.getTime() - now.getTime();
    if (msUntilExpiry < 30 * 1000) {
      setValidationError(t('checkout.offerExpired'));
      await queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
      return;
    }

    // pickupDate must be strictly in the future for @IsFutureDate(0) on the backend.
    // 2-minute buffer absorbs network latency and server clock skew safely.
    const pickupDate = new Date(Math.max(now.getTime() + 2 * 60 * 1000, offerStartTime.getTime()));
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
      deliveryMode,
      ...(customerNotes ? { customerNotes } : {}),
      ...(deliveryMode === 'delivery' && deliveryPin
        ? {
            deliveryAddress: {
              city:
                deliveryAddressText ||
                `${deliveryPin.lat.toFixed(5)}, ${deliveryPin.lng.toFixed(5)}`,
              coordinates: deliveryPin,
            },
          }
        : {}),
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

      // Error already shown inline via the errorBanner — no toast needed
    }
  }, [
    offer,
    offerId,
    quantity,
    selectedPaymentMethod,
    customerNotes,
    deliveryMode,
    deliveryPin,
    deliveryAddressText,
    distanceKm,
    tooFar,
    queryClient,
    createOrder,
    t,
  ]);

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
      await handleConfirmOrder();
    } catch (error) {
      Logger.error(
        '[CheckoutScreen] Order creation failed after phone verification',
        {},
        error instanceof Error ? error : new Error('Unknown error'),
      );
      setValidationError(t('checkout.orderFailed'));
    }
  }, [closePhoneVerificationModal, handleConfirmOrder, t]);

  const handlePaymentFailed = useCallback(() => {
    setPaymentSheetVisible(false);
    setPaymentUrl(null);
  }, []);

  const handlePaymentDismiss = useCallback(() => {
    setPaymentSheetVisible(false);
    setPaymentUrl(null);

    // Inventory is reserved the moment the pending-payment order is created, so
    // refresh offer stock across the app even though payment isn't confirmed yet.
    void queryClient.invalidateQueries({ queryKey: ['offer', offerId] });
    void queryClient.invalidateQueries({ queryKey: ['offers'] });
    void queryClient.invalidateQueries({ queryKey: ['nearby-offers'] });
    void queryClient.invalidateQueries({ queryKey: ['featured-offers'] });

    // Navigate to order details so user can retry later
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
  }, [createdOrder, navigation, offerId, queryClient]);

  /**
   * Calculate pricing.
   *
   * The fee is shown here and charged by the backend, so the two must agree —
   * a customer who sees one total and is charged another has been misled. This
   * mirrors FLAT_DELIVERY_FEE in order.service.ts; change both together.
   */
  const subtotal = offer ? offer.pricing.discountedPrice * quantity : 0;
  const deliveryFee = selectedFulfillment === 'delivery' ? DELIVERY_FEE_TND : 0;
  const total = subtotal + deliveryFee;
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
          <Icon
            name='alert-circle'
            family='Ionicons'
            size={64}
            color={colorTokens.base.error[500]}
          />
          <Text variant='title' size='lg' weight='bold' style={styles.errorTitle}>
            {t('offers.offerNotFound')}
          </Text>
          <Button
            variant='primary'
            size='md'
            onPress={() => navigation.goBack()}
            style={styles.errorGoBackButton}
          >
            {t('common.goBack')}
          </Button>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={styles.scrollContent}
      >
        {/* Main Content Card */}
        <View style={styles.mainCard}>
          {/* Fulfillment Method Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name='bag-handle' family='Ionicons' size={20} color={BRAND_PRIMARY} />
              <Text style={styles.sectionTitle}>{t('checkout.fulfillmentMethod')}</Text>
            </View>

            <View style={styles.paymentMethodsRow}>
              {/* Pickup */}
              <Pressable
                style={[
                  styles.paymentMethodCard,
                  selectedFulfillment === 'pickup' && styles.paymentMethodCardActive,
                ]}
                onPress={() => setSelectedFulfillment('pickup')}
                accessibilityLabel={t('checkout.pickup')}
                accessibilityHint={t('checkout.pickupHint')}
                accessibilityRole='button'
              >
                {selectedFulfillment === 'pickup' && (
                  <View style={styles.paymentCardCheck}>
                    <Icon
                      name='checkmark-circle'
                      family='Ionicons'
                      size={16}
                      color={colorTokens.base.success[500]}
                    />
                  </View>
                )}
                <Icon
                  name='storefront'
                  family='Ionicons'
                  size={28}
                  color={selectedFulfillment === 'pickup' ? BRAND_PRIMARY : '#64748B'}
                />
                <Text
                  style={[
                    styles.paymentCardLabel,
                    selectedFulfillment === 'pickup' && styles.paymentCardLabelActive,
                  ]}
                >
                  {t('checkout.pickup')}
                </Text>
              </Pressable>

              {/* Delivery */}
              <Pressable
                style={[
                  styles.paymentMethodCard,
                  selectedFulfillment === 'delivery' && styles.paymentMethodCardActive,
                  isOutsideDeliveryZone && styles.paymentMethodCardDisabled,
                ]}
                onPress={() => !isOutsideDeliveryZone && setSelectedFulfillment('delivery')}
                accessibilityLabel={
                  isOutsideDeliveryZone ? t('checkout.deliveryUnavailable') : t('checkout.delivery')
                }
                accessibilityHint={
                  isOutsideDeliveryZone
                    ? t('checkout.pickupOnlyWarning')
                    : t('checkout.deliveryHint')
                }
                accessibilityRole='button'
                accessibilityState={{ disabled: isOutsideDeliveryZone }}
              >
                {selectedFulfillment === 'delivery' && !isOutsideDeliveryZone && (
                  <View style={styles.paymentCardCheck}>
                    <Icon
                      name='checkmark-circle'
                      family='Ionicons'
                      size={16}
                      color={colorTokens.base.success[500]}
                    />
                  </View>
                )}
                <Icon
                  name='bicycle'
                  family='Ionicons'
                  size={28}
                  color={
                    isOutsideDeliveryZone
                      ? '#CBD5E1'
                      : selectedFulfillment === 'delivery'
                        ? BRAND_PRIMARY
                        : '#64748B'
                  }
                />
                <Text
                  style={[
                    styles.paymentCardLabel,
                    selectedFulfillment === 'delivery' &&
                      !isOutsideDeliveryZone &&
                      styles.paymentCardLabelActive,
                    isOutsideDeliveryZone && styles.paymentCardLabelDisabled,
                  ]}
                >
                  {t('checkout.delivery')}
                </Text>
                {isOutsideDeliveryZone && (
                  <View style={styles.comingSoonBadge}>
                    <Text style={styles.comingSoonText}>5km+</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>

          {/* Pick-Up Only warning — shown when establishment is outside 5 km zone */}
          {isOutsideDeliveryZone && (
            <View style={styles.pickupOnlyWarning}>
              <Icon name='location-outline' family='Ionicons' size={16} color={WARNING_TEXT} />
              <Text style={styles.pickupOnlyWarningText}>{t('checkout.pickupOnlyWarning')}</Text>
            </View>
          )}

          {/* Payment Method Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name='wallet' family='Ionicons' size={20} color={BRAND_PRIMARY} />
              <Text style={styles.sectionTitle}>{t('checkout.paymentMethod')}</Text>
            </View>

            <View style={styles.paymentMethodsRow}>
              {/* Cash */}
              <Pressable
                style={[
                  styles.paymentMethodCard,
                  selectedPayment === 'cash' && styles.paymentMethodCardActive,
                ]}
                onPress={() => setSelectedPayment('cash')}
                accessibilityLabel={t('checkout.cashPayment')}
                accessibilityHint={t('checkout.cashPaymentHint')}
                accessibilityRole='button'
              >
                {selectedPayment === 'cash' && (
                  <View style={styles.paymentCardCheck}>
                    <Icon
                      name='checkmark-circle'
                      family='Ionicons'
                      size={16}
                      color={colorTokens.base.success[500]}
                    />
                  </View>
                )}
                <Icon
                  name='cash'
                  family='Ionicons'
                  size={28}
                  color={selectedPayment === 'cash' ? BRAND_PRIMARY : '#64748B'}
                />
                <Text
                  style={[
                    styles.paymentCardLabel,
                    selectedPayment === 'cash' && styles.paymentCardLabelActive,
                  ]}
                >
                  {t('checkout.cashPayment')}
                </Text>
              </Pressable>

              {/* Online Payment — server-gated, see useFeatureFlags */}
              {onlinePaymentEnabled && (
                <Pressable
                  style={[
                    styles.paymentMethodCard,
                    selectedPayment === 'online' && styles.paymentMethodCardActive,
                  ]}
                  onPress={() => setSelectedPayment('online')}
                  accessibilityLabel={t('checkout.onlinePayment')}
                  accessibilityHint={t('checkout.onlinePaymentHint')}
                  accessibilityRole='button'
                >
                  {selectedPayment === 'online' && (
                    <View style={styles.paymentCardCheck}>
                      <Icon
                        name='checkmark-circle'
                        family='Ionicons'
                        size={16}
                        color={colorTokens.base.success[500]}
                      />
                    </View>
                  )}
                  <Icon
                    name='card'
                    family='Ionicons'
                    size={28}
                    color={selectedPayment === 'online' ? BRAND_PRIMARY : '#64748B'}
                  />
                  <Text
                    style={[
                      styles.paymentCardLabel,
                      selectedPayment === 'online' && styles.paymentCardLabelActive,
                    ]}
                  >
                    {t('checkout.onlinePayment')}
                  </Text>
                </Pressable>
              )}

              {/* Holds the second column open when online payment is switched
                  off, so the lone cash card keeps the width of a card in the
                  fulfilment row above instead of stretching across the screen. */}
              {!onlinePaymentEnabled && <View style={styles.paymentMethodCardSpacer} />}
            </View>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Price Summary Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Icon name='receipt' family='Ionicons' size={20} color={BRAND_PRIMARY} />
              <Text style={styles.sectionTitle}>{t('checkout.orderSummary')}</Text>
            </View>

            <View style={styles.priceBreakdown}>
              {/* Subtotal */}
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>{t('common.subtotal')}</Text>
                <Text style={styles.priceValue}>
                  {subtotal.toFixed(2)} {currency}
                </Text>
              </View>

              {/* Delivery Fee — shown when delivery fulfillment is selected */}
              {deliveryFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>{t('checkout.deliveryFee')}</Text>
                  <Text style={styles.priceValue}>
                    {deliveryFee.toFixed(2)} {currency}
                  </Text>
                </View>
              )}

              {/* Savings Badge */}
              {savings > 0 && (
                <View style={styles.savingsBadge}>
                  <Icon
                    name='trending-down'
                    family='Ionicons'
                    size={16}
                    color={colorTokens.base.success[500]}
                  />
                  <Text style={styles.savingsText}>
                    {t('checkout.youSave', { amount: savings.toFixed(2), currency })}
                  </Text>
                </View>
              )}

              {/* Total */}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{t('checkout.totalAmount')}</Text>
                <Text style={styles.totalValue}>
                  {total.toFixed(2)} {currency}
                </Text>
              </View>
            </View>
          </View>

          {/* Map pin — only shown when Pay on Delivery is selected */}
          {deliveryMode === 'delivery' && (
            <View style={styles.mapContainer}>
              <Text style={styles.mapLabel}>{t('checkout.mapLabel')}</Text>
              {deliveryPin ? (
                <View style={styles.mapWrapper}>
                  <MapView
                    style={StyleSheet.absoluteFill}
                    initialRegion={{
                      latitude: deliveryPin.lat,
                      longitude: deliveryPin.lng,
                      latitudeDelta: 0.005,
                      longitudeDelta: 0.005,
                    }}
                    zoomEnabled={true}
                    zoomControlEnabled={true}
                    onRegionChangeComplete={region =>
                      setDeliveryPin({ lat: region.latitude, lng: region.longitude })
                    }
                  />
                  {/* Static crosshair pin — map scrolls beneath it */}
                  <View style={styles.mapPinOverlay} pointerEvents='none'>
                    <Icon name='location-sharp' family='Ionicons' size={40} color={BRAND_PRIMARY} />
                  </View>
                </View>
              ) : (
                <View style={styles.mapPlaceholder}>
                  <ActivityIndicator color={BRAND_PRIMARY} />
                  <Text style={styles.mapPlaceholderText}>{t('checkout.gettingLocation')}</Text>
                </View>
              )}
              {/* Distance feedback — shown once pin is set and establishment coords known */}
              {distanceKm !== null && (
                <View style={[styles.distanceRow, tooFar && styles.distanceRowError]}>
                  <Icon
                    name={tooFar ? 'warning' : 'navigate'}
                    family='Ionicons'
                    size={14}
                    color={tooFar ? ERROR_TEXT : SUCCESS_TEXT}
                  />
                  <Text style={[styles.distanceText, tooFar && styles.distanceTextError]}>
                    {tooFar
                      ? t('checkout.distanceTooFar', {
                          distance: distanceKm.toFixed(1),
                          max: MAX_DELIVERY_KM,
                        })
                      : t('checkout.distanceFromMerchant', { distance: distanceKm.toFixed(1) })}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Error Message */}
          {(orderError ?? validationError) != null && (
            <View style={styles.errorBanner}>
              <Icon
                name='warning'
                family='Ionicons'
                size={20}
                color={colorTokens.base.error[500]}
              />
              <Text style={styles.errorText}>{orderError ?? validationError}</Text>
            </View>
          )}

          {/* Confirm Button with Gradient — guarded against rapid taps */}
          <Pressable
            accessibilityRole='button'
            onPress={() => {
              void guardedConfirmOrder();
            }}
            disabled={
              isCreatingOrder || (deliveryMode === 'delivery' && (deliveryPin === null || tooFar))
            }
            style={styles.confirmButtonWrapper}
          >
            <LinearGradient
              colors={[BRAND_PRIMARY, colorTokens.base.primary[400]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.confirmButton,
                (isCreatingOrder ||
                  (deliveryMode === 'delivery' && (deliveryPin === null || tooFar))) &&
                  styles.confirmButtonDisabled,
              ]}
            >
              <Icon name='checkmark-circle' family='Ionicons' size={24} color='#FFFFFF' />
              <Text style={styles.confirmButtonText}>
                {t('checkout.confirmOrder')} • {total.toFixed(2)} {currency}
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
            <Text style={styles.cancelButtonText}>{t('checkout.cancelOrder')}</Text>
          </Pressable>
        </View>
      </ScrollView>

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

      {/* Konnect payment WebView for online payments */}
      {paymentUrl ? (
        <KonnectPaymentSheet
          visible={paymentSheetVisible}
          payUrl={paymentUrl}
          onPaymentFailed={handlePaymentFailed}
          onDismiss={handlePaymentDismiss}
        />
      ) : null}
    </View>
  );
};
