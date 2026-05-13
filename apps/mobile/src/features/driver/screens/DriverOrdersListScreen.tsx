/**
 * Driver Orders List Screen
 * Displays available delivery orders near the driver's current location.
 *
 * Data flow:
 *   Geolocation.watchPosition → coords state
 *   useAvailableOrders(lat, lng) → FlatList<DriverAvailableOrder>
 *
 * Design spec:
 *   - Location loading state while GPS acquires fix
 *   - Auto-refreshes every 30 s (handled inside useAvailableOrders)
 *   - Order card: establishment city, collection window, driver earnings
 *   - Empty state with icon + message
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Geolocation from 'react-native-geolocation-service';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import type { DriverOrdersListNavigationProp } from '@/navigation/types';

import { useAvailableOrders } from '../hooks/useDriverOrders';
import type { DriverAvailableOrder } from '../services/driver.service';

// ---------------------------------------------------------------------------
// Constants (from design tokens)
// ---------------------------------------------------------------------------

const PRIMARY = colorTokens.base.primary[500];
const SUCCESS = colorTokens.base.success[500];
const SURFACE = colorTokens.light.surface;
const SURFACE_VARIANT = colorTokens.light.surfaceVariant;
const ON_SURFACE = colorTokens.light.onSurface;
const ON_SURFACE_VARIANT = colorTokens.light.onSurfaceVariant;
const OUTLINE = colorTokens.light.outline;

const { base: sp, radius } = spacingTokens;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  navigation: DriverOrdersListNavigationProp;
}

interface Coords {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format an ISO date string to a short time string.
 * e.g. "09:30" (24-h) on Android, locale-aware on iOS.
 */
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

// ---------------------------------------------------------------------------
// Order Card
// ---------------------------------------------------------------------------

interface OrderCardProps {
  item: DriverAvailableOrder;
  onPress: (item: DriverAvailableOrder) => void;
}

const OrderCard: React.FC<OrderCardProps> = ({ item, onPress }) => {
  const city = item.establishmentAddress?.city ?? 'Unknown location';
  const street = item.establishmentAddress?.street;
  const start = formatTime(item.collectionStartTime);
  const end = formatTime(item.collectionEndTime);
  const earnings = item.driverEarnings != null ? item.driverEarnings.toFixed(3) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.75}
      accessibilityRole='button'
      accessibilityLabel={`Order in ${city}, collect between ${start} and ${end}${earnings ? `, earn ${earnings} TND` : ''}`}
    >
      {/* Location */}
      <View style={styles.cardRow}>
        <Text style={styles.cityText}>{city}</Text>
        {item.orderNumber ? <Text style={styles.orderNumberText}>#{item.orderNumber}</Text> : null}
      </View>

      {street ? <Text style={styles.streetText}>{street}</Text> : null}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Collection window */}
      <View style={styles.cardRow}>
        <Text style={styles.windowLabel}>Collect between</Text>
        <Text style={styles.windowTime}>
          {start} → {end}
        </Text>
      </View>

      {/* Earnings */}
      {earnings != null ? (
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>Your earnings</Text>
          <Text style={styles.earningsAmount}>{earnings} TND</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

const EmptyState: React.FC = () => (
  <View style={styles.emptyContainer}>
    <Text style={styles.emptyIcon}>📦</Text>
    <Text style={styles.emptyTitle}>No orders nearby</Text>
    <Text style={styles.emptySubtitle}>
      There are no available delivery orders near you right now.{'\n'}Pull down to refresh.
    </Text>
  </View>
);

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function DriverOrdersListScreen({ navigation }: Props) {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Watch GPS position so the list stays fresh as driver moves.
  // distanceFilter = 100 m prevents excessive re-renders while moving slowly.
  useEffect(() => {
    const watchId = Geolocation.watchPosition(
      pos => {
        setLocationError(false);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      _err => {
        setLocationError(true);
      },
      { enableHighAccuracy: true, distanceFilter: 100, interval: 10_000, fastestInterval: 5_000 },
    );

    return () => {
      Geolocation.clearWatch(watchId);
    };
  }, []);

  const hasCoords = coords !== null;

  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
  } = useAvailableOrders(coords?.lat ?? 0, coords?.lng ?? 0, hasCoords);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleOrderPress = useCallback(
    (item: DriverAvailableOrder) => {
      navigation.navigate('DriverOrderDetail', { orderId: item._id });
    },
    [navigation],
  );

  const handleRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const renderItem = useCallback(
    ({ item }: { item: DriverAvailableOrder }) => (
      <OrderCard item={item} onPress={handleOrderPress} />
    ),
    [handleOrderPress],
  );

  const keyExtractor = useCallback((item: DriverAvailableOrder) => item._id, []);

  // ---------------------------------------------------------------------------
  // Loading: waiting for first GPS fix or first fetch
  // ---------------------------------------------------------------------------

  if (!hasCoords || (isLoading && orders.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        {locationError ? (
          <>
            <Text style={styles.errorIcon}>📍</Text>
            <Text style={styles.loadingTitle}>Location unavailable</Text>
            <Text style={styles.loadingSubtitle}>
              Please enable location permissions and try again.
            </Text>
          </>
        ) : (
          <>
            <ActivityIndicator size='large' color={PRIMARY} />
            <Text style={styles.loadingTitle}>Locating you…</Text>
            <Text style={styles.loadingSubtitle}>Searching for nearby orders</Text>
          </>
        )}
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Order list
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Live indicator */}
      <View style={styles.headerBar}>
        <View style={styles.liveIndicator} />
        <Text style={styles.headerText}>Live orders near you</Text>
        <Text style={styles.countBadge}>{orders.length}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={orders.length === 0 ? styles.centerContainer : styles.listContent}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SURFACE_VARIANT,
  },

  // ── Center / loading / error ──
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: sp.lg,
    backgroundColor: SURFACE_VARIANT,
  },
  loadingTitle: {
    marginTop: sp.md,
    fontSize: 16,
    fontWeight: '600',
    color: ON_SURFACE,
    textAlign: 'center',
  },
  loadingSubtitle: {
    marginTop: sp.xs,
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: sp.sm,
  },

  // ── Header bar ──
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp.md,
    paddingVertical: sp.sm,
    backgroundColor: SURFACE,
    borderBottomWidth: 1,
    borderBottomColor: OUTLINE,
    gap: sp.xs,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS,
  },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY,
  },

  // ── List ──
  listContent: {
    padding: sp.md,
    gap: sp.sm,
    paddingBottom: sp['2xl'],
  },

  // ── Order card ──
  card: {
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: sp.md,
    marginBottom: sp.sm,
    ...CARD_SHADOW,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp.xxs,
  },
  cityText: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
    flex: 1,
  },
  orderNumberText: {
    fontSize: 12,
    fontWeight: '500',
    color: ON_SURFACE_VARIANT,
    marginStart: sp.xs,
  },
  streetText: {
    fontSize: 13,
    color: ON_SURFACE_VARIANT,
    marginBottom: sp.xs,
  },
  divider: {
    height: 1,
    backgroundColor: OUTLINE,
    marginVertical: sp.sm,
  },
  windowLabel: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  windowTime: {
    fontSize: 13,
    fontWeight: '600',
    color: ON_SURFACE,
  },
  earningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: sp.sm,
    backgroundColor: colorTokens.base.success[50],
    borderRadius: radius.md,
    paddingHorizontal: sp.sm,
    paddingVertical: sp.xs,
  },
  earningsLabel: {
    fontSize: 12,
    color: colorTokens.base.success[600],
    fontWeight: '500',
  },
  earningsAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: SUCCESS,
  },

  // ── Empty state ──
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp.xl,
    paddingBottom: sp['4xl'],
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: sp.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ON_SURFACE,
    marginBottom: sp.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: ON_SURFACE_VARIANT,
    textAlign: 'center',
    lineHeight: 22,
  },
});
