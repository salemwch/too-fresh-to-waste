/**
 * Driver Active Order Screen
 * Shown after a driver accepts an order (status: OUT_FOR_DELIVERY).
 *
 * Data flow:
 *   route.params.orderId → useAvailableOrders cache lookup (best-effort)
 *   NOTE: Accepted orders have status OUT_FOR_DELIVERY and are excluded from
 *   the available pool. The lookup will return `undefined` for MVP.
 *   A dedicated "my active order" endpoint is the proper fix (out of scope).
 *
 * Actions:
 *   - "Open in Maps" → deep-links to Waze (preferred) or Google Maps
 *   - "Mark as Delivered" → calls useMarkDelivered → resets stack to DriverOrdersList
 *   - "Unassign" → Alert confirmation → useUnassignOrder → resets stack to DriverOrdersList
 */

import React, { useCallback, useEffect, useState } from 'react';
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

import Geolocation from '@react-native-community/geolocation';
import { CommonActions } from '@react-navigation/native';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import type {
  DriverActiveOrderNavigationProp,
  DriverActiveOrderRouteProp,
} from '@/navigation/types';

import { useAvailableOrders, useMarkDelivered, useUnassignOrder } from '../hooks/useDriverOrders';

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

interface Coords {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open Waze if installed, otherwise fall back to Google Maps web URL.
 * GeoJSON coordinates are stored as [longitude, latitude].
 */
async function openNavigation(lngLatArray: [number, number]): Promise<void> {
  // GeoJSON: coordinates = [longitude, latitude]
  const [lng, lat] = lngLatArray;
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
  const { orderId } = route.params;
  const [coords, setCoords] = useState<Coords | null>(null);

  // One-shot GPS fix to re-use the same query key as the list screen.
  useEffect(() => {
    try {
      Geolocation.getCurrentPosition(
        pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        _err => {
          setCoords({ lat: 0, lng: 0 });
        },
        { enableHighAccuracy: true, timeout: 15_000 },
      );
    } catch {
      setCoords({ lat: 0, lng: 0 });
    }
  }, []);

  const hasCoords = coords !== null;

  // Re-use the same query key as DriverOrdersListScreen to hit the cache first.
  // OUT_FOR_DELIVERY orders are excluded from the available pool, so `order`
  // will be undefined for MVP. We accept this and render gracefully.
  const { data: orders = [] } = useAvailableOrders(coords?.lat ?? 0, coords?.lng ?? 0, hasCoords);

  const order = orders.find(o => o._id === orderId);

  const { mutate: deliver, isPending: isDelivering } = useMarkDelivered();
  const { mutate: unassign, isPending: isUnassigning } = useUnassignOrder();

  const isBusy = isDelivering || isUnassigning;

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

  const handleDeliver = useCallback(() => {
    deliver(orderId, {
      onSuccess: resetToList,
      onError: () => {
        Alert.alert('Delivery Failed', 'Could not mark order as delivered. Please try again.');
      },
    });
  }, [deliver, orderId, resetToList]);

  const handleUnassign = useCallback(() => {
    Alert.alert(
      'Unassign Order',
      'Are you sure you want to return this order to the pool? Other drivers will be able to accept it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: () => {
            unassign(
              { orderId },
              {
                onSuccess: resetToList,
                onError: () => {
                  Alert.alert(
                    'Unassign Failed',
                    'Could not unassign from this order. Please try again.',
                  );
                },
              },
            );
          },
        },
      ],
    );
  }, [unassign, orderId, resetToList]);

  // ---------------------------------------------------------------------------
  // Loading state — waiting for GPS
  // ---------------------------------------------------------------------------

  if (!hasCoords) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={PRIMARY} />
        <Text style={styles.loadingText}>Locating you…</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — order data is best-effort (may be undefined for OUT_FOR_DELIVERY)
  // ---------------------------------------------------------------------------

  const deliveryCoords = order?.deliveryAddress?.coordinates?.coordinates;
  const deliveryCity = order?.deliveryAddress?.city;
  const deliveryStreet = order?.deliveryAddress?.street;
  const pickupCity = order?.establishmentAddress?.city;
  const pickupStreet = order?.establishmentAddress?.street;
  const earnings = order?.driverEarnings != null ? `${order.driverEarnings.toFixed(3)} TND` : '–';
  const collectionDate = order?.collectionStartTime ? formatDate(order.collectionStartTime) : '–';
  const startTime = order?.collectionStartTime ? formatTime(order.collectionStartTime) : '--:--';
  const endTime = order?.collectionEndTime ? formatTime(order.collectionEndTime) : '--:--';

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
            <Text style={styles.orderNumberLabel}>Active Delivery</Text>
            {order?.orderNumber ? (
              <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
            ) : (
              <Text style={styles.orderNumber}>#{orderId.slice(-6).toUpperCase()}</Text>
            )}
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>In Progress</Text>
          </View>
        </View>

        {/* ── Delivery address ── */}
        <SectionCard title='Delivery address'>
          {deliveryCity || deliveryStreet ? (
            <>
              {deliveryCity ? <InfoRow label='City' value={deliveryCity} /> : null}
              {deliveryStreet ? <InfoRow label='Street' value={deliveryStreet} /> : null}
            </>
          ) : (
            <Text style={styles.placeholderText}>Address details unavailable</Text>
          )}

          {deliveryCoords ? (
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => void openNavigation(deliveryCoords as [number, number])}
              activeOpacity={0.8}
              accessibilityRole='button'
              accessibilityLabel='Open delivery address in maps'
            >
              <Text style={styles.navButtonText}>Open in Maps</Text>
            </TouchableOpacity>
          ) : null}
        </SectionCard>

        {/* ── Pickup location ── */}
        {(pickupCity ?? pickupStreet) ? (
          <SectionCard title='Pickup location'>
            {pickupCity ? <InfoRow label='City' value={pickupCity} /> : null}
            {pickupStreet ? <InfoRow label='Street' value={pickupStreet} /> : null}
            {order?.collectionStartTime ? (
              <>
                <InfoRow label='Date' value={collectionDate} />
                <InfoRow label='Window' value={`${startTime} → ${endTime}`} />
              </>
            ) : null}
          </SectionCard>
        ) : null}

        {/* ── Items ── */}
        {order?.items && order.items.length > 0 ? (
          <SectionCard title={`Items (${order.items.length})`}>
            {order.items.map((item, idx) => (
              <View key={`${item.offerId}-${idx}`} style={styles.itemRow}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.offerTitle}
                </Text>
                <Text style={styles.itemMeta}>
                  x{item.quantity} · {item.totalPrice.toFixed(3)} TND
                </Text>
              </View>
            ))}
          </SectionCard>
        ) : null}

        {/* ── Earnings ── */}
        {order?.driverEarnings != null ? (
          <View style={styles.earningsCard}>
            <View style={styles.earningsRow}>
              <Text style={styles.earningsPrimaryLabel}>Your earnings</Text>
              <Text style={styles.earningsPrimaryAmount}>{earnings}</Text>
            </View>
          </View>
        ) : null}

        {/* Spacer for sticky footer */}
        <View style={{ height: sizing.button.xl * 2 + sp.xl }} />
      </ScrollView>

      {/* ── Sticky footer actions ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.deliverButton, isBusy && styles.buttonDisabled]}
          onPress={handleDeliver}
          disabled={isBusy}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel='Mark order as delivered'
          accessibilityState={{ disabled: isBusy }}
        >
          {isDelivering ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.deliverText}>Mark as Delivered</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.unassignButton, isBusy && styles.buttonDisabled]}
          onPress={handleUnassign}
          disabled={isBusy}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel='Unassign from this order'
          accessibilityState={{ disabled: isBusy }}
        >
          {isUnassigning ? (
            <ActivityIndicator color={ERROR} />
          ) : (
            <Text style={styles.unassignText}>Unassign</Text>
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
  },
  orderNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
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

  // ── Map button (inside card) ──
  navButton: {
    marginTop: sp.md,
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
    textAlign: 'right',
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
  deliverText: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
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
