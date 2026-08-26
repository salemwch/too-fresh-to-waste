/**
 * Driver Order Detail Screen
 * Shows the details of an available delivery order and lets the driver accept it.
 *
 * Data flow:
 *   route.params.orderId → useAvailableOrders (cached) → find matching order
 *   Accept button → useAcceptOrder(orderId) → navigate to DriverActiveOrder
 *
 * Design spec:
 *   - Summary cards: establishment, collection window, earnings, delivery address
 *   - Full-width Accept button (brand primary, disabled while pending)
 *   - Error alert if the order was already taken
 */

import React, { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { getCurrentPositionOnce } from '@/services/location/getCurrentPositionOnce';
import { textAlignEnd } from '@/utils/rtl';
import type {
  DriverOrderDetailNavigationProp,
  DriverOrderDetailRouteProp,
} from '@/navigation/types';

import { useAvailableOrders, useAcceptOrder } from '../hooks/useDriverOrders';
import { getDriverErrorMessage, type DriverAvailableOrder } from '../services/driver.service';

import { typographyTokens } from '@/design-system/tokens/typography';

import { useTheme } from '@/design-system/providers';

import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY_CONTAINER = colorTokens.base.primary[50];
const SUCCESS_CONTAINER = colorTokens.base.success[50];
const SUCCESS_ON = colorTokens.base.success[600];
const WHITE = colorTokens.base.neutral[0];

const { base: sp, radius, sizing } = spacingTokens;
const { fontSize } = typographyTokens;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  navigation: DriverOrderDetailNavigationProp;
  route: DriverOrderDetailRouteProp;
}

interface Coords {
  lat: number;
  lng: number;
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
// Info Row component
// ---------------------------------------------------------------------------

interface InfoRowProps {
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value }) => {
  const styles = useStyles();

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Section Card component
// ---------------------------------------------------------------------------

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, children }) => {
  const styles = useStyles();

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function DriverOrderDetailScreen({ navigation, route }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { orderId } = route.params;
  const [coords, setCoords] = useState<Coords | null>(null);

  // Acquire a one-time GPS fix to feed into the available-orders query.
  // We only need coords to re-use the cached query; we don't watch continuously here.
  //
  // Routed through getCurrentPositionOnce: this screen can open while the
  // driver's 30s location heartbeat is mid-request, and two overlapping
  // single-shot requests crash the process (Play Services
  // `NullPointerException: Listener must not be null`).
  useEffect(() => {
    let active = true;

    void getCurrentPositionOnce({ enableHighAccuracy: true, timeoutMs: 15_000 })
      .then(fix => {
        if (active) setCoords({ lat: fix.latitude, lng: fix.longitude });
      })
      .catch(() => {
        // (0, 0) is the screen's existing "no fix" sentinel — it still enables
        // the query so the order can be found from the cached list.
        if (active) setCoords({ lat: 0, lng: 0 });
      });

    return () => {
      active = false;
    };
  }, []);

  const hasCoords = coords !== null;

  // Re-use the same query key as the list screen so we hit the cache first.
  const { data: orders = [], isLoading } = useAvailableOrders(
    coords?.lat ?? 0,
    coords?.lng ?? 0,
    hasCoords,
  );

  const order: DriverAvailableOrder | undefined = orders.find(o => o._id === orderId);

  const { mutate: acceptOrder, isPending } = useAcceptOrder();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAccept = useCallback(() => {
    acceptOrder(orderId, {
      onSuccess: acceptedOrder => {
        navigation.navigate('DriverActiveOrder', { orderId, order: acceptedOrder });
      },
      onError: error => {
        // Accept can fail three ways — lost the race, offline, or already
        // carrying an order — so show the backend's reason rather than guessing.
        Alert.alert(
          t('driver.cannotAcceptTitle'),
          getDriverErrorMessage(error, t('driver.orderTakenBody')),
          [{ text: t('common.goBack'), onPress: () => navigation.goBack() }],
        );
      },
    });
  }, [acceptOrder, orderId, navigation, t]);

  // ---------------------------------------------------------------------------
  // Loading state — waiting for GPS or query
  // ---------------------------------------------------------------------------

  if (!hasCoords || (isLoading && orders.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingText}>{t('driver.loadingOrderDetails')}</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Order not found — may have been taken already
  // ---------------------------------------------------------------------------

  if (!order) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.notFoundIcon}>🚫</Text>
        <Text style={styles.notFoundTitle}>{t('driver.orderNoLongerAvailable')}</Text>
        <Text style={styles.notFoundSubtitle}>
          This order may have been accepted by another driver.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yGoBack')}
          accessibilityHint={t('driver.a11yGoBackHint')}
        >
          <Text style={styles.backButtonText}>{t('driver.backToOrders')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render order details
  // ---------------------------------------------------------------------------

  const pickupCity = order.establishmentAddress?.city ?? 'Unknown';
  const pickupStreet = order.establishmentAddress?.street;
  const deliveryLatLng = extractLatLng(order.deliveryAddress?.coordinates);
  const earnings = order.driverEarnings != null ? `${order.driverEarnings.toFixed(3)} TND` : '–';

  const customer = typeof order.customerId === 'object' ? order.customerId : null;
  const customerName = customer
    ? [customer.firstName, customer.lastName].filter(Boolean).join(' ')
    : null;
  const customerPhone = customer?.phoneNumber ?? null;
  const deliveryFee = order.deliveryFee != null ? `${order.deliveryFee.toFixed(3)} TND` : '–';
  const collectionDate = formatDate(order.collectionStartTime);
  const startTime = formatTime(order.collectionStartTime);
  const endTime = formatTime(order.collectionEndTime);

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
            <Text style={styles.orderNumberLabel}>{t('driver.order')}</Text>
            <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{t('driver.available')}</Text>
          </View>
        </View>

        {/* ── Pickup location ── */}
        <SectionCard title={t('driver.pickupLocation')}>
          <InfoRow label={t('driver.city')} value={pickupCity} />
          {pickupStreet ? <InfoRow label={t('driver.street')} value={pickupStreet} /> : null}
          <InfoRow label={t('driver.date')} value={collectionDate} />
          <InfoRow label={t('driver.collectionWindow')} value={`${startTime} → ${endTime}`} />
        </SectionCard>

        {/* ── Delivery location map ── */}
        {deliveryLatLng ? (
          <SectionCard title={t('driver.deliveryLocation')}>
            <View style={styles.mapContainer}>
              <MapView
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                initialRegion={{
                  ...deliveryLatLng,
                  latitudeDelta: 0.005,
                  longitudeDelta: 0.005,
                }}
                zoomEnabled={true}
                zoomControlEnabled={true}
                scrollEnabled={false}
                pitchEnabled={false}
                rotateEnabled={false}
              >
                <Marker
                  coordinate={deliveryLatLng}
                  pinColor={colorTokens.base.info[500]}
                  title={t('driver.customerLocation')}
                />
              </MapView>
            </View>
          </SectionCard>
        ) : null}

        {/* ── Customer info ── */}
        {customerName || customerPhone ? (
          <SectionCard title={t('driver.customer')}>
            {customerName ? <InfoRow label={t('driver.name')} value={customerName} /> : null}
            {customerPhone ? <InfoRow label={t('driver.phone')} value={customerPhone} /> : null}
          </SectionCard>
        ) : null}

        {/* ── Items ── */}
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

        {/* ── Earnings ── */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsRow}>
            <Text style={styles.earningsLabel}>{t('driver.deliveryFee')}</Text>
            <Text style={styles.earningsSecondary}>{deliveryFee}</Text>
          </View>
          <View style={styles.earningsDivider} />
          <View style={styles.earningsRow}>
            <Text style={styles.earningsPrimaryLabel}>{t('driver.yourEarnings')}</Text>
            <Text style={styles.earningsPrimaryAmount}>{earnings}</Text>
          </View>
        </View>

        {/* Bottom spacer for the sticky button */}
        <View style={{ height: sizing.button.xl + sp.xl }} />
      </ScrollView>

      {/* ── Accept button (sticky) ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acceptButton, isPending && styles.acceptButtonDisabled]}
          onPress={handleAccept}
          disabled={isPending}
          activeOpacity={0.85}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yAcceptOrder')}
          accessibilityHint={t('driver.a11yAcceptOrderHint')}
          accessibilityState={{ disabled: isPending }}
        >
          {isPending ? (
            <ActivityIndicator color={WHITE} />
          ) : (
            <Text style={styles.acceptButtonText}>{t('driver.acceptAndStart')}</Text>
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

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.surfaceVariant,
    },

    // ── Center / loading ──
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: sp.lg,
      backgroundColor: c.surfaceVariant,
    },
    loadingText: {
      marginTop: sp.md,
      fontSize: fontSize.base,
      color: c.onSurfaceVariant,
    },
    notFoundIcon: {
      fontSize: fontSize['7xl'],
      marginBottom: sp.md,
    },
    notFoundTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: sp.xs,
      textAlign: 'center',
    },
    notFoundSubtitle: {
      fontSize: fontSize.base,
      color: c.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: sp.xl,
    },
    backButton: {
      paddingHorizontal: sp.lg,
      paddingVertical: sp.sm,
      borderRadius: radius.lg,
      borderWidth: 1.5,
      borderColor: c.primary,
    },
    backButtonText: {
      fontSize: fontSize.base,
      fontWeight: '600',
      color: c.primary,
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
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    orderNumber: {
      fontSize: fontSize.lg,
      fontWeight: '800',
      color: c.primary,
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
      backgroundColor: c.success,
    },
    statusText: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: SUCCESS_ON,
    },

    // ── Section card ──
    card: {
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: sp.md,
      marginBottom: sp.xs,
      ...CARD_SHADOW,
    },
    cardTitle: {
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: sp.sm,
    },

    // ── Map ──
    mapContainer: {
      height: 180,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    map: {
      ...StyleSheet.absoluteFillObject,
    },

    // ── Info row ──
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingVertical: sp.xxs,
      borderBottomWidth: 1,
      borderBottomColor: c.outline,
    },
    infoLabel: {
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      flex: 1,
    },
    infoValue: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: c.onSurface,
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
      borderBottomColor: c.outline,
    },
    itemTitle: {
      fontSize: fontSize.sm,
      color: c.onSurface,
      flex: 1,
      marginEnd: sp.sm,
    },
    itemMeta: {
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
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
    earningsLabel: {
      fontSize: fontSize.sm,
      color: SUCCESS_ON,
    },
    earningsSecondary: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: SUCCESS_ON,
    },
    earningsDivider: {
      height: 1,
      backgroundColor: colorTokens.base.success[300],
      marginVertical: sp.sm,
      opacity: 0.4,
    },
    earningsPrimaryLabel: {
      fontSize: fontSize.base,
      fontWeight: '700',
      color: c.success,
    },
    earningsPrimaryAmount: {
      fontSize: fontSize.lg,
      fontWeight: '800',
      color: c.success,
    },

    // ── Footer (sticky accept button) ──
    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: sp.md,
      paddingBottom: sp.lg,
      backgroundColor: c.surface,
      borderTopWidth: 1,
      borderTopColor: c.outline,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        android: { elevation: 8 },
      }),
    },
    acceptButton: {
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      height: sizing.button.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButtonDisabled: {
      opacity: 0.55,
    },
    acceptButtonText: {
      color: WHITE,
      fontSize: fontSize.md,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
  }),
);
