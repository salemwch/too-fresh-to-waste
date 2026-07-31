/**
 * Driver Active Order Screen
 * The driver's in-flight delivery, in two stages:
 *
 *   driver_assigned   → heading to the store. Primary action: "Confirm Pickup".
 *   out_for_delivery  → carrying the food. Primary action: "Mark as Delivered".
 *
 * Data flow:
 *   useActiveOrder() is the source of truth — it survives an app restart. The
 *   order passed via route params only seeds the first paint so the screen has
 *   something to show before the query resolves.
 *
 * Actions:
 *   - "Navigate in Maps" → deep-links to Waze (preferred) or Google Maps, aimed
 *     at the store before pickup and at the customer after it
 *   - "Confirm Pickup" → driver_assigned → out_for_delivery
 *   - "Mark as Delivered" → out_for_delivery → delivered, resets to DriverOrdersList
 *   - "Unassign" → Alert confirmation → returns the order to the pool
 */

import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { CommonActions } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { textAlignEnd } from '@/utils/rtl';
import type {
  DriverActiveOrderNavigationProp,
  DriverActiveOrderRouteProp,
} from '@/navigation/types';

import {
  useActiveOrder,
  useMarkDelivered,
  useMarkPickedUp,
  useUnassignOrder,
} from '../hooks/useDriverOrders';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const PRIMARY = colorTokens.base.primary[500];
const PRIMARY_CONTAINER = colorTokens.base.primary[50];
const ERROR = colorTokens.base.error[500];
const ERROR_CONTAINER = colorTokens.base.error[50];
const SUCCESS = colorTokens.base.success[500];
const SUCCESS_CONTAINER = colorTokens.base.success[50];
const SUCCESS_ON = colorTokens.base.success[600];
const SURFACE = colorTokens.light.surface;
const SURFACE_VARIANT = colorTokens.light.surfaceVariant;
const ON_SURFACE = colorTokens.light.onSurface;
const ON_SURFACE_VARIANT = colorTokens.light.onSurfaceVariant;
const OUTLINE = colorTokens.light.outline;
const WHITE = colorTokens.base.neutral[0];

const { base: sp, radius, sizing } = spacingTokens;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  navigation: DriverActiveOrderNavigationProp;
  route: DriverActiveOrderRouteProp;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractLatLng(
  coords:
    | { lat: number; lng: number }
    | { type: string; coordinates: [number, number] }
    | undefined,
): { latitude: number; longitude: number } | null {
  if (!coords) return null;
  if ('lat' in coords) return { latitude: coords.lat, longitude: coords.lng };
  if ('coordinates' in coords && Array.isArray(coords.coordinates)) {
    const [lng, lat] = coords.coordinates;
    return { latitude: lat, longitude: lng };
  }
  return null;
}

async function openNavigation(latLng: { latitude: number; longitude: number }): Promise<void> {
  const { latitude: lat, longitude: lng } = latLng;
  const wazeUrl = `waze://ul?ll=${lat},${lng}&navigate=yes`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

  try {
    const canWaze = await Linking.canOpenURL(wazeUrl);
    await Linking.openURL(canWaze ? wazeUrl : gmapsUrl);
  } catch {
    // Silently ignore — both URLs failed (unlikely in prod)
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '–';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children }) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DriverActiveOrderScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { orderId, order: passedOrder } = route.params;

  // Server-owned active order. Survives an app restart, unlike the route param,
  // which only seeds the first paint so the screen is never briefly blank.
  const { data: fetchedOrder, isLoading } = useActiveOrder();
  const order = fetchedOrder ?? passedOrder;

  const { mutate: confirmPickup, isPending: isPickingUp } = useMarkPickedUp();
  const { mutate: deliver, isPending: isDelivering } = useMarkDelivered();
  const { mutate: unassign, isPending: isUnassigning } = useUnassignOrder();

  const isBusy = isPickingUp || isDelivering || isUnassigning;

  // Before pickup the driver is heading to the store; after it, to the customer.
  // This drives the map focus, the nav deep-link, and the primary action.
  const hasCollected = order?.status === 'out_for_delivery';

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const resetToList = useCallback(() => {
    // exactOptionalPropertyTypes causes a spurious mismatch between
    // ResetState | undefined and dispatch's payload type. The cast is safe —
    // the action is well-formed at runtime. See CheckoutScreen for precedent.
    const resetAction = CommonActions.reset({
      index: 0,
      routes: [{ name: 'DriverOrdersList' }],
    });
    navigation.dispatch(resetAction as Readonly<{ type: string }>);
  }, [navigation]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  const handleConfirmPickup = useCallback(() => {
    confirmPickup(orderId, {
      onError: () => {
        Alert.alert(t('driver.pickupFailedTitle'), t('driver.pickupFailedBody'));
      },
    });
  }, [confirmPickup, orderId, t]);

  const handleDeliver = useCallback(() => {
    deliver(orderId, {
      onSuccess: resetToList,
      onError: () => {
        Alert.alert(t('driver.deliveryFailedTitle'), t('driver.deliveryFailedBody'));
      },
    });
  }, [deliver, orderId, resetToList, t]);

  const handleUnassign = useCallback(() => {
    // Dropping an order after collecting the food strands real food with the
    // driver, so the confirmation has to say so plainly.
    Alert.alert(
      t('driver.unassignTitle'),
      hasCollected ? t('driver.unassignBodyCollected') : t('driver.unassignBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('driver.unassign'),
          style: 'destructive',
          onPress: () => {
            unassign(
              { orderId },
              {
                onSuccess: resetToList,
                onError: () => {
                  Alert.alert(t('driver.unassignFailedTitle'), t('driver.unassignFailedBody'));
                },
              },
            );
          },
        },
      ],
    );
  }, [unassign, orderId, resetToList, hasCollected, t]);

  // ---------------------------------------------------------------------------
  // Loading / recovery states
  // ---------------------------------------------------------------------------

  if (isLoading && !passedOrder) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={PRIMARY} />
        <Text style={styles.loadingText}>{t('driver.loadingDelivery')}</Text>
      </View>
    );
  }

  // The delivery ended elsewhere (timeout auto-unassign, or an admin acted).
  // Send the driver back rather than leaving them on a screen with no order.
  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>{t('driver.noLongerAssigned')}</Text>
        <TouchableOpacity
          style={styles.backToListButton}
          onPress={resetToList}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yBackToOrders')}
          accessibilityHint={t('driver.a11yBackToOrdersHint')}
        >
          <Text style={styles.backToListText}>{t('driver.backToOrders')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const deliveryLatLng = extractLatLng(order?.deliveryAddress?.coordinates);
  const pickupLatLng = extractLatLng(order?.establishmentAddress?.coordinates);

  // Where the driver is headed next. Falls back to the other leg if one set of
  // coordinates is missing, so the map still renders something useful.
  const navTarget = hasCollected
    ? (deliveryLatLng ?? pickupLatLng)
    : (pickupLatLng ?? deliveryLatLng);

  const pickupCity = order?.establishmentAddress?.city;
  const pickupStreet = order?.establishmentAddress?.street;
  const earnings =
    order?.driverEarnings != null
      ? `${order.driverEarnings.toFixed(3)} ${t('common.currency')}`
      : '–';
  const collectionDate = order?.collectionStartTime ? formatDate(order.collectionStartTime) : '–';
  const startTime = order?.collectionStartTime ? formatTime(order.collectionStartTime) : '--:--';
  const endTime = order?.collectionEndTime ? formatTime(order.collectionEndTime) : '--:--';

  const customer =
    order?.customerId && typeof order.customerId === 'object' ? order.customerId : null;
  const customerName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    : null;
  const customerPhone = customer?.phoneNumber ?? null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Order header ── */}
        <View style={styles.headerCard}>
          <View style={styles.orderNumberRow}>
            <Text style={styles.orderNumberLabel}>{t('driver.activeDelivery')}</Text>
            {/* Shrinks and ellipsises rather than pushing the row: an order
                number is a reference the driver rarely reads, while the status
                below it is what tells them where to go. */}
            <Text style={styles.orderNumber} numberOfLines={1} ellipsizeMode='middle'>
              #{order?.orderNumber ?? orderId.slice(-6).toUpperCase()}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText} numberOfLines={2}>
              {hasCollected ? t('driver.deliveringToCustomer') : t('driver.collectFromStore')}
            </Text>
          </View>
        </View>

        {/* ── Live map — centred on wherever the driver is headed next ── */}
        {navTarget ? (
          <View style={styles.liveMapCard}>
            <MapView
              provider={PROVIDER_GOOGLE}
              style={styles.liveMap}
              initialRegion={{
                ...navTarget,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              zoomEnabled={true}
              zoomControlEnabled={true}
            >
              {deliveryLatLng ? (
                <Marker
                  coordinate={deliveryLatLng}
                  pinColor={colorTokens.base.info[500]}
                  title={t('driver.marker_customer')}
                  description='Delivery location'
                />
              ) : null}
              {pickupLatLng ? (
                <Marker
                  coordinate={pickupLatLng}
                  pinColor='#FF9800'
                  title={t('driver.pickup')}
                  description={pickupCity ?? t('driver.establishment')}
                />
              ) : null}
            </MapView>
            <TouchableOpacity
              style={styles.navButtonFloating}
              onPress={() => {
                void openNavigation(navTarget);
              }}
              activeOpacity={0.85}
              accessibilityRole='button'
              accessibilityLabel={
                hasCollected ? t('driver.a11yNavigateToCustomer') : t('driver.a11yNavigateToStore')
              }
              accessibilityHint={t('driver.a11yNavigateHint')}
            >
              <Text style={styles.navButtonText}>
                {hasCollected ? t('driver.navigateToCustomer') : t('driver.navigateToStore')}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Customer info ── */}
        {customerName || customerPhone ? (
          <SectionCard title={t('driver.customer')}>
            {customerName ? <InfoRow label={t('driver.name')} value={customerName} /> : null}
            {customerPhone ? <InfoRow label={t('driver.phone')} value={customerPhone} /> : null}
          </SectionCard>
        ) : null}

        {/* ── Pickup location ── */}
        {(pickupCity ?? pickupStreet) ? (
          <SectionCard title={t('driver.pickupLocation')}>
            {pickupCity ? <InfoRow label={t('driver.city')} value={pickupCity} /> : null}
            {pickupStreet ? <InfoRow label={t('driver.street')} value={pickupStreet} /> : null}
            {order?.collectionStartTime ? (
              <>
                <InfoRow label={t('driver.date')} value={collectionDate} />
                <InfoRow label={t('driver.window')} value={`${startTime} → ${endTime}`} />
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Items ── */}
        {order?.items && order.items.length > 0 ? (
          <SectionCard title={t('driver.itemsCount', { count: order.items.length })}>
            {order.items.map((item, idx) => (
              <View key={`${item.offerId}-${idx}`} style={styles.itemRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.offerTitle}
                </Text>
                <Text style={styles.itemMeta}>
                  x{item.quantity} · {item.totalPrice.toFixed(3)} {t('common.currency')}
                </Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ── Earnings ── */}
        {order?.driverEarnings != null ? (
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsPrimaryLabel}>{t('driver.yourEarnings')}</Text>
              <Text style={styles.earningsPrimaryAmount}>{earnings}</Text>
            </View>
          </View>
        ) : null}

        {/* Spacer for sticky footer */}
        <View style={{ height: sizing.button.xl * 2 + sp.xl }} />
      </ScrollView>

      {/* ── Sticky footer — one primary action per stage ── */}
      <View style={styles.footer}>
        {hasCollected ? (
          <TouchableOpacity
            style={[styles.deliverButton, isBusy && styles.buttonDisabled]}
            onPress={handleDeliver}
            disabled={isBusy}
            activeOpacity={0.85}
            accessibilityRole='button'
            accessibilityLabel={t('driver.a11yMarkDelivered')}
            accessibilityHint={t('driver.a11yMarkDeliveredHint')}
            accessibilityState={{ disabled: isBusy }}
          >
            {isDelivering ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.deliverText}>{t('driver.markDelivered')}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.pickupButton, isBusy && styles.buttonDisabled]}
            onPress={handleConfirmPickup}
            disabled={isBusy}
            activeOpacity={0.85}
            accessibilityRole='button'
            accessibilityLabel={t('driver.a11yConfirmPickup')}
            accessibilityHint={t('driver.a11yConfirmPickupHint')}
            accessibilityState={{ disabled: isBusy }}
          >
            {isPickingUp ? (
              <ActivityIndicator color={WHITE} />
            ) : (
              <Text style={styles.deliverText}>{t('driver.confirmPickup')}</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.unassignButton, isBusy && styles.buttonDisabled]}
          onPress={handleUnassign}
          disabled={isBusy}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yUnassign')}
          accessibilityHint={t('driver.a11yUnassignHint')}
          accessibilityState={{ disabled: isBusy }}
        >
          {isUnassigning ? (
            <ActivityIndicator color={ERROR} />
          ) : (
            <Text style={styles.unassignText}>{t('driver.unassign')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CARD_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 2 },
});

const FOOTER_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  android: { elevation: 8 },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE_VARIANT,
  },

  // ── Center / loading ──
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.lg,
    backgroundColor: SURFACE_VARIANT,
  },
  loadingText: {
    marginTop: sp.md,
    fontSize: 15,
    color: ON_SURFACE_VARIANT,
  },

  // ── Scroll ──
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: sp.md,
    gap: sp.sm,
  },

  // ── Header card ──
  headerCard: {
    backgroundColor: PRIMARY_CONTAINER,
    borderRadius: radius.lg,
    padding: sp.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.xs,
    ...CARD_SHADOW,
  },
  orderNumberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: sp.xs,
  },
  orderNumberLabel: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    // Never gives up its width: this is the label that says what the screen is.
    flexShrink: 0,
  },
  orderNumber: {
    // Was 18, which let a long order number push the row past the card edge and
    // clip the status text underneath. Smaller and allowed to shrink — the
    // driver needs the status far more than the reference.
    fontSize: 15,
    fontWeight: '800',
    color: PRIMARY,
    flexShrink: 1,
  },
  statusPill: {
    flexDirection: 'row',
    // flex-start, not center: with two lines of status text the dot should sit
    // beside the first line rather than float in the middle.
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    backgroundColor: SUCCESS_CONTAINER,
    borderRadius: radius.full,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xxs,
    gap: sp.xxs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: SUCCESS,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: SUCCESS_ON,
  },

  // ── Section card ──
  card: {
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: sp.md,
    marginBottom: sp.xs,
    ...CARD_SHADOW,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: sp.sm,
  },
  placeholderText: {
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    fontStyle: 'italic',
  },

  // ── Live map ──
  liveMapCard: {
    height: 280,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: sp.xs,
    ...CARD_SHADOW,
  },
  liveMap: {
    ...StyleSheet.absoluteFillObject,
  },
  navButtonFloating: {
    position: 'absolute',
    bottom: sp.sm,
    left: sp.sm,
    right: sp.sm,
    backgroundColor: PRIMARY,
    borderRadius: radius.md,
    padding: sp.sm,
    alignItems: 'center',
  },
  navButtonText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },

  // ── Info row ──
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: sp.xxs,
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE,
  },
  infoLabel: {
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    flex: 1,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: ON_SURFACE,
    flex: 2,
    textAlign: textAlignEnd(),
  },

  // ── Item row ──
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: sp.xxs,
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE,
  },
  itemTitle: {
    fontSize: 13,
    color: ON_SURFACE,
    flex: 1,
    marginEnd: sp.sm,
  },
  itemMeta: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    fontWeight: '500',
  },

  // ── Earnings card ──
  earningsCard: {
    backgroundColor: SUCCESS_CONTAINER,
    borderRadius: radius.lg,
    padding: sp.md,
    marginBottom: sp.xs,
    ...CARD_SHADOW,
  },
  earningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsPrimaryLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: SUCCESS,
  },
  earningsPrimaryAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: SUCCESS,
  },

  // ── Sticky footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: sp.md,
    paddingBottom: sp.lg,
    gap: sp.sm,
    backgroundColor: SURFACE,
    borderTopWidth: 1,
    borderTopColor: OUTLINE,
    ...FOOTER_SHADOW,
  },

  // ── Deliver button ──
  deliverButton: {
    backgroundColor: SUCCESS,
    borderRadius: radius.lg,
    height: sizing.button.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pickup is a progress step, not a completion — primary blue, not success green,
  // so "Mark as Delivered" stays the only green (terminal) action in the flow.
  pickupButton: {
    backgroundColor: PRIMARY,
    borderRadius: radius.lg,
    height: sizing.button.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliverText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backToListButton: {
    marginTop: sp.lg,
    backgroundColor: PRIMARY,
    borderRadius: radius.lg,
    paddingHorizontal: sp.xl,
    paddingVertical: sp.sm,
  },
  backToListText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Unassign button ──
  unassignButton: {
    borderRadius: radius.lg,
    height: sizing.button.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: ERROR,
    backgroundColor: ERROR_CONTAINER,
  },
  unassignText: {
    color: ERROR,
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Shared state ──
  buttonDisabled: {
    opacity: 0.55,
  },
});
