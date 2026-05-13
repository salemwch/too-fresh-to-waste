import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Geolocation from 'react-native-geolocation-service';
import { check, PERMISSIONS, request, RESULTS, openSettings } from 'react-native-permissions';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import type { DriverOrdersListNavigationProp } from '@/navigation/types';

import { useAvailableOrders } from '../hooks/useDriverOrders';
import type { DriverAvailableOrder } from '../services/driver.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = colorTokens.base.primary[500];
const SUCCESS = colorTokens.base.success[500];
const SURFACE = colorTokens.light.surface;
const SURFACE_VARIANT = colorTokens.light.surfaceVariant;
const ON_SURFACE = colorTokens.light.onSurface;
const ON_SURFACE_VARIANT = colorTokens.light.onSurfaceVariant;
const OUTLINE = colorTokens.light.outline;

const { base: sp, radius } = spacingTokens;

const LOCATION_PERMISSION = Platform.select({
  ios: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
  android: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
  default: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PermState = 'checking' | 'requesting' | 'granted' | 'denied' | 'blocked';

interface Coords {
  lat: number;
  lng: number;
}

interface Props {
  navigation: DriverOrdersListNavigationProp;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      <View style={styles.cardRow}>
        <Text style={styles.cityText}>{city}</Text>
        {item.orderNumber ? <Text style={styles.orderNumberText}>#{item.orderNumber}</Text> : null}
      </View>
      {street ? <Text style={styles.streetText}>{street}</Text> : null}
      <View style={styles.divider} />
      <View style={styles.cardRow}>
        <Text style={styles.windowLabel}>Collect between</Text>
        <Text style={styles.windowTime}>
          {start} → {end}
        </Text>
      </View>
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
// Permission screen
// ---------------------------------------------------------------------------

interface PermissionViewProps {
  state: 'denied' | 'blocked';
  onRetry: () => void;
}

const PermissionView: React.FC<PermissionViewProps> = ({ state, onRetry }) => {
  const isBlocked = state === 'blocked';
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorIcon}>📍</Text>
      <Text style={styles.loadingTitle}>Location required</Text>
      <Text style={styles.loadingSubtitle}>
        {isBlocked
          ? 'Location permission was permanently denied. Open Settings and enable location for this app.'
          : 'We need your location to show nearby delivery orders.'}
      </Text>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={
          isBlocked
            ? () => {
                void openSettings().catch(() => Linking.openSettings());
              }
            : onRetry
        }
        activeOpacity={0.8}
      >
        <Text style={styles.permissionButtonText}>
          {isBlocked ? 'Open Settings' : 'Grant Location Access'}
        </Text>
      </TouchableOpacity>
    </View>
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
  const [permState, setPermState] = useState<PermState>('checking');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  // ── Permission handling ──────────────────────────────────────────────────

  const startWatcher = useCallback(() => {
    if (watchIdRef.current !== null) return; // already watching
    watchIdRef.current = Geolocation.watchPosition(
      pos => {
        setGpsError(false);
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setGpsError(true),
      { enableHighAccuracy: true, distanceFilter: 100, interval: 10_000, fastestInterval: 5_000 },
    );
  }, []);

  const requestPermission = useCallback(async () => {
    setPermState('requesting');
    try {
      const result = await request(LOCATION_PERMISSION!);
      if (result === RESULTS.GRANTED || result === RESULTS.LIMITED) {
        setPermState('granted');
        startWatcher();
      } else if (result === RESULTS.BLOCKED || result === RESULTS.UNAVAILABLE) {
        setPermState('blocked');
      } else {
        setPermState('denied');
      }
    } catch {
      setPermState('denied');
    }
  }, [startWatcher]);

  // On mount: check first, only request dialog when needed
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const current = await check(LOCATION_PERMISSION!);
        if (cancelled) return;

        if (current === RESULTS.GRANTED || current === RESULTS.LIMITED) {
          setPermState('granted');
          startWatcher();
        } else if (current === RESULTS.BLOCKED || current === RESULTS.UNAVAILABLE) {
          setPermState('blocked');
        } else {
          // undetermined or denied → trigger the system dialog immediately
          await requestPermission();
        }
      } catch {
        if (!cancelled) setPermState('denied');
      }
    };

    void init();
    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        Geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── TanStack Query ───────────────────────────────────────────────────────

  const hasCoords = coords !== null;
  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
  } = useAvailableOrders(coords?.lat ?? 0, coords?.lng ?? 0, hasCoords);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOrderPress = useCallback(
    (item: DriverAvailableOrder) => {
      navigation.navigate('DriverOrderDetail', { orderId: item._id });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }: { item: DriverAvailableOrder }) => (
      <OrderCard item={item} onPress={handleOrderPress} />
    ),
    [handleOrderPress],
  );

  const keyExtractor = useCallback((item: DriverAvailableOrder) => item._id, []);

  // ── Render gates ─────────────────────────────────────────────────────────

  if (permState === 'checking' || permState === 'requesting') {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={PRIMARY} />
        <Text style={styles.loadingTitle}>
          {permState === 'checking' ? 'Starting up…' : 'Requesting location…'}
        </Text>
      </View>
    );
  }

  if (permState === 'denied' || permState === 'blocked') {
    return (
      <PermissionView
        state={permState}
        onRetry={() => {
          void requestPermission();
        }}
      />
    );
  }

  // Permission granted but no GPS fix yet
  if (!hasCoords || (isLoading && orders.length === 0)) {
    return (
      <View style={styles.centerContainer}>
        {gpsError ? (
          <>
            <Text style={styles.errorIcon}>📡</Text>
            <Text style={styles.loadingTitle}>GPS signal weak</Text>
            <Text style={styles.loadingSubtitle}>Move to an open area and wait a moment.</Text>
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

  return (
    <View style={styles.container}>
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
            onRefresh={() => {
              void refetch();
            }}
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
  container: { flex: 1, backgroundColor: SURFACE_VARIANT },
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
  errorIcon: { fontSize: 40, marginBottom: sp.sm },
  permissionButton: {
    marginTop: sp.lg,
    backgroundColor: PRIMARY,
    paddingHorizontal: sp.xl,
    paddingVertical: sp.sm,
    borderRadius: radius.lg,
  },
  permissionButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
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
  liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: SUCCESS },
  headerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countBadge: { fontSize: 13, fontWeight: '700', color: PRIMARY },
  listContent: { padding: sp.md, gap: sp.sm, paddingBottom: sp['2xl'] },
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
  cityText: { fontSize: 16, fontWeight: '700', color: PRIMARY, flex: 1 },
  orderNumberText: {
    fontSize: 12,
    fontWeight: '500',
    color: ON_SURFACE_VARIANT,
    marginStart: sp.xs,
  },
  streetText: { fontSize: 13, color: ON_SURFACE_VARIANT, marginBottom: sp.xs },
  divider: { height: 1, backgroundColor: OUTLINE, marginVertical: sp.sm },
  windowLabel: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  windowTime: { fontSize: 13, fontWeight: '600', color: ON_SURFACE },
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
  earningsLabel: { fontSize: 12, color: colorTokens.base.success[600], fontWeight: '500' },
  earningsAmount: { fontSize: 15, fontWeight: '700', color: SUCCESS },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: sp.xl,
    paddingBottom: sp['4xl'],
  },
  emptyIcon: { fontSize: 48, marginBottom: sp.md },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: ON_SURFACE,
    marginBottom: sp.xs,
    textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: ON_SURFACE_VARIANT, textAlign: 'center', lineHeight: 22 },
});
