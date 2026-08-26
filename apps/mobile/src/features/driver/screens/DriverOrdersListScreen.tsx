import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import Geolocation from '@react-native-community/geolocation';
import { check, PERMISSIONS, request, RESULTS, openSettings } from 'react-native-permissions';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { mirrorGlyph } from '@/utils/rtl';
import type { DriverOrdersListNavigationProp } from '@/navigation/types';

import {
  useActiveOrder,
  useAvailableOrders,
  useDriverProfile,
  useSetOnlineStatus,
} from '../hooks/useDriverOrders';
import { useLocationHeartbeat } from '../hooks/useLocationHeartbeat';
import type { DriverAvailableOrder } from '../services/driver.service';

import { typographyTokens } from '@/design-system/tokens/typography';

import { useTheme } from '@/design-system/providers';

import { createDriverStyles, type DriverPalette } from '../driverTheme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WARNING = colorTokens.base.warning[500];

const { base: sp, radius } = spacingTokens;
const { fontSize } = typographyTokens;

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
  const styles = useStyles();
  const { t } = useTranslation();
  const city = item.establishmentAddress?.city ?? t('driver.unknownLocation');
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
      accessibilityLabel={t('driver.a11yOrderCard', {
        city,
        start,
        end,
        earningsSuffix:
          earnings != null
            ? t('driver.a11yOrderCardEarnings', {
                amount: earnings,
                currency: t('common.currency'),
              })
            : '',
      })}
      accessibilityHint={t('driver.a11yOrderCardHint')}
    >
      <View style={styles.cardRow}>
        <Text style={styles.cityText} numberOfLines={1}>
          {city}
        </Text>
        {item.orderNumber ? <Text style={styles.orderNumberText}>#{item.orderNumber}</Text> : null}
      </View>
      {street ? (
        <Text style={styles.streetText} numberOfLines={1}>
          {street}
        </Text>
      ) : null}
      <View style={styles.divider} />
      <View style={styles.cardRow}>
        <Text style={styles.windowLabel}>{t('driver.collectBetween')}</Text>
        <Text style={styles.windowTime}>
          {start} → {end}
        </Text>
      </View>
      {earnings != null ? (
        <View style={styles.earningsRow}>
          <Text style={styles.earningsLabel}>{t('driver.yourEarnings')}</Text>
          <Text style={styles.earningsAmount}>
            {earnings} {t('common.currency')}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ---------------------------------------------------------------------------
// Active delivery banner — the app-restart recovery path
// ---------------------------------------------------------------------------

interface ActiveOrderBannerProps {
  order: DriverAvailableOrder;
  onResume: () => void;
}

const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ order, onResume }) => {
  const styles = useStyles();
  const { t } = useTranslation();
  const collected = order.status === 'out_for_delivery';

  return (
    <TouchableOpacity
      style={styles.activeBanner}
      onPress={onResume}
      activeOpacity={0.85}
      accessibilityRole='button'
      accessibilityLabel={t('driver.a11yResume')}
      accessibilityHint={t('driver.a11yResumeHint')}
    >
      <View style={styles.activeBannerBody}>
        <Text style={styles.activeBannerTitle}>{t('driver.deliveryInProgress')}</Text>
        <Text style={styles.activeBannerSubtitle}>
          {collected ? t('driver.bannerCollected') : t('driver.bannerHeadToStore')}
        </Text>
      </View>
      {/* Chevron kept out of the translation string and mirrored explicitly —
          RN flips layout under RTL but not directional glyphs. */}
      <Text style={styles.activeBannerAction}>
        {t('driver.resume')} {mirrorGlyph('›')}
      </Text>
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
  const styles = useStyles();
  const { t } = useTranslation();
  const isBlocked = state === 'blocked';
  return (
    <View style={styles.centerContainer}>
      <Text style={styles.errorIcon}>📍</Text>
      <Text style={styles.loadingTitle}>{t('driver.locationRequired')}</Text>
      <Text style={styles.loadingSubtitle}>
        {isBlocked ? t('driver.locationBlockedBody') : t('driver.locationNeededBody')}
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
        accessibilityRole='button'
        accessibilityLabel={isBlocked ? t('driver.openSettings') : t('driver.a11yGrantLocation')}
        accessibilityHint={
          isBlocked ? t('driver.a11yOpenSettingsHint') : t('driver.a11yGrantLocationHint')
        }
      >
        <Text style={styles.permissionButtonText}>
          {isBlocked ? t('driver.openSettings') : t('driver.grantLocationAccess')}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Empty States
// ---------------------------------------------------------------------------

const EmptyState: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>📦</Text>
      <Text style={styles.emptyTitle}>{t('driver.noOrdersNearby')}</Text>
      <Text style={styles.emptySubtitle}>{t('driver.noOrdersNearbyBody', { newline: '\n' })}</Text>
    </View>
  );
};

const OfflineState: React.FC = () => {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🌙</Text>
      <Text style={styles.emptyTitle}>{t('driver.youreOffline')}</Text>
      <Text style={styles.emptySubtitle}>{t('driver.offlineBody')}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function DriverOrdersListScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
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

  // ── Server state ─────────────────────────────────────────────────────────

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useDriverProfile();
  const { mutate: setOnline, isPending: isTogglingStatus } = useSetOnlineStatus();
  const isOnline = profile?.isOnline ?? false;

  // Report position only while online — an offline driver never leaks location.
  useLocationHeartbeat(isOnline && permState === 'granted');

  // Recovers an in-flight delivery after an app restart. Accepted orders are
  // excluded from the available pool, so this is the only way back to them.
  const { data: activeOrder } = useActiveOrder(permState === 'granted');

  const hasCoords = coords !== null;
  const {
    data: orders = [],
    isLoading: ordersLoading,
    isRefetching,
    isError: ordersError,
    refetch,
  } = useAvailableOrders(coords?.lat ?? 0, coords?.lng ?? 0, hasCoords && isOnline && !activeOrder);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOrderPress = useCallback(
    (item: DriverAvailableOrder) => {
      navigation.navigate('DriverOrderDetail', { orderId: item._id });
    },
    [navigation],
  );

  const handleResumeActive = useCallback(() => {
    if (!activeOrder) return;
    navigation.navigate('DriverActiveOrder', { orderId: activeOrder._id, order: activeOrder });
  }, [activeOrder, navigation]);

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
        <ActivityIndicator size='large' color={colors.primary} />
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

  if (profileLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={colors.primary} />
        <Text style={styles.loadingTitle}>{t('driver.loadingProfile')}</Text>
        <Text style={styles.loadingSubtitle}>
          The server may be waking up — this can take up to a minute.
        </Text>
      </View>
    );
  }

  // Without this the driver is stranded on the loading spinner forever: the rest
  // of the screen is gated on the profile, so a failed fetch has no way out.
  if (profileError || !profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>📡</Text>
        <Text style={styles.loadingTitle}>{t('driver.cantReachServer')}</Text>
        <Text style={styles.loadingSubtitle}>{t('driver.serverErrorBody')}</Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={() => {
            void refetchProfile();
          }}
          activeOpacity={0.8}
          accessibilityRole='button'
          accessibilityLabel={t('driver.a11yRetryProfile')}
          accessibilityHint={t('driver.a11yRetryProfileHint')}
        >
          <Text style={styles.permissionButtonText}>{t('common.tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // The status bar stays mounted in every state below so the driver can always
  // go online/offline and reach their earnings.
  const statusBar = (
    <View style={styles.statusBar}>
      <View
        style={[styles.statusDot, isOnline ? styles.statusDotOnline : styles.statusDotOffline]}
      />
      <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>

      <Switch
        value={isOnline}
        onValueChange={next => setOnline(next)}
        disabled={isTogglingStatus}
        trackColor={{ false: colors.outline, true: colorTokens.base.success[300] }}
        thumbColor={isOnline ? colors.success : colors.surface}
        accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
        accessibilityHint={
          isOnline
            ? 'Stops new delivery orders and alerts from reaching you'
            : 'Starts showing nearby delivery orders and sending you alerts'
        }
      />

      <TouchableOpacity
        style={styles.earningsButton}
        onPress={() => navigation.navigate('DriverEarnings')}
        activeOpacity={0.75}
        accessibilityRole='button'
        accessibilityLabel={t('driver.a11yViewEarnings')}
        accessibilityHint={t('driver.a11yViewEarningsHint')}
      >
        <Text style={styles.earningsButtonText}>{t('driver.earnings')}</Text>
      </TouchableOpacity>
    </View>
  );

  // An active delivery takes over the screen: the driver may only carry one
  // order, so showing the pool underneath would offer orders they cannot accept.
  if (activeOrder) {
    return (
      <View style={styles.container}>
        {statusBar}
        <View style={styles.activeOnlyContainer}>
          <ActiveOrderBanner order={activeOrder} onResume={handleResumeActive} />
          <Text style={styles.activeHint}>{t('driver.finishDeliveryFirst')}</Text>
        </View>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={styles.container}>
        {statusBar}
        <OfflineState />
      </View>
    );
  }

  // Waiting for first GPS fix
  if (!hasCoords) {
    return (
      <View style={styles.container}>
        {statusBar}
        <View style={styles.centerContainer}>
          {gpsError ? (
            <>
              <Text style={styles.errorIcon}>📡</Text>
              <Text style={styles.loadingTitle}>{t('driver.gpsWeak')}</Text>
              <Text style={styles.loadingSubtitle}>{t('driver.gpsWeakHint')}</Text>
            </>
          ) : (
            <>
              <ActivityIndicator size='large' color={colors.primary} />
              <Text style={styles.loadingTitle}>{t('driver.locatingYou')}</Text>
              <Text style={styles.loadingSubtitle}>{t('driver.acquiringGps')}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (ordersLoading) {
    return (
      <View style={styles.container}>
        {statusBar}
        <View style={styles.centerContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
          <Text style={styles.loadingTitle}>{t('driver.searchingOrders')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {statusBar}

      <View style={styles.headerBar}>
        <View style={[styles.liveIndicator, ordersError && styles.liveIndicatorError]} />
        <Text style={styles.headerText}>
          {ordersError ? 'No orders available' : 'Live orders near you'}
        </Text>
        {!ordersError && <Text style={styles.countBadge}>{orders.length}</Text>}
      </View>

      <FlashList
        data={orders}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<EmptyState />}
        showsVerticalScrollIndicator={false}
        estimatedItemSize={140}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              void refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
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

const useStyles = createDriverStyles((c: DriverPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surfaceVariant },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: sp.lg,
      backgroundColor: c.surfaceVariant,
    },
    loadingTitle: {
      marginTop: sp.md,
      fontSize: fontSize.md,
      fontWeight: '600',
      color: c.onSurface,
      textAlign: 'center',
    },
    loadingSubtitle: {
      marginTop: sp.xs,
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      textAlign: 'center',
    },
    errorIcon: { fontSize: fontSize['6xl'], marginBottom: sp.sm },
    permissionButton: {
      marginTop: sp.lg,
      backgroundColor: c.primary,
      paddingHorizontal: sp.xl,
      paddingVertical: sp.sm,
      borderRadius: radius.lg,
    },
    permissionButtonText: { color: '#fff', fontSize: fontSize.base, fontWeight: '600' },

    // ── Status bar (online toggle + earnings) ──
    statusBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp.md,
      paddingVertical: sp.sm,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.outline,
      gap: sp.xs,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusDotOnline: { backgroundColor: c.success },
    statusDotOffline: { backgroundColor: c.onSurfaceVariant },
    statusText: { flex: 1, fontSize: fontSize.base, fontWeight: '700', color: c.onSurface },
    earningsButton: {
      marginStart: sp.sm,
      paddingHorizontal: sp.sm,
      paddingVertical: sp.xxs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: c.primary,
    },
    earningsButtonText: { fontSize: fontSize.sm, fontWeight: '600', color: c.primary },

    // ── Active delivery banner ──
    activeOnlyContainer: { flex: 1, padding: sp.md },
    activeBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colorTokens.base.warning[50],
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: WARNING,
      padding: sp.md,
      ...CARD_SHADOW,
    },
    activeBannerBody: { flex: 1 },
    activeBannerTitle: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: sp.xxs,
    },
    activeBannerSubtitle: { fontSize: fontSize.sm, color: c.onSurfaceVariant, lineHeight: 18 },
    activeBannerAction: {
      fontSize: fontSize.base,
      fontWeight: '700',
      color: c.primary,
      marginStart: sp.sm,
    },
    activeHint: {
      marginTop: sp.md,
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      textAlign: 'center',
    },

    headerBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: sp.md,
      paddingVertical: sp.sm,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.outline,
      gap: sp.xs,
    },
    liveIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
    liveIndicatorError: { backgroundColor: c.onSurfaceVariant },
    headerText: {
      flex: 1,
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    countBadge: { fontSize: fontSize.sm, fontWeight: '700', color: c.primary },
    listContent: { padding: sp.md, gap: sp.sm, paddingBottom: sp['2xl'] },
    card: {
      backgroundColor: c.surface,
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
    cityText: { fontSize: fontSize.md, fontWeight: '700', color: c.primary, flex: 1 },
    orderNumberText: {
      fontSize: fontSize.sm,
      fontWeight: '500',
      color: c.onSurfaceVariant,
      marginStart: sp.xs,
    },
    streetText: { fontSize: fontSize.sm, color: c.onSurfaceVariant, marginBottom: sp.xs },
    divider: { height: 1, backgroundColor: c.outline, marginVertical: sp.sm },
    windowLabel: {
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    windowTime: { fontSize: fontSize.sm, fontWeight: '600', color: c.onSurface },
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
      fontSize: fontSize.sm,
      color: colorTokens.base.success[600],
      fontWeight: '500',
    },
    earningsAmount: { fontSize: fontSize.base, fontWeight: '700', color: c.success },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: sp.xl,
      paddingBottom: sp['4xl'],
    },
    emptyIcon: { fontSize: fontSize['7xl'], marginBottom: sp.md },
    emptyTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: sp.xs,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fontSize.base,
      color: c.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 22,
    },
  }),
);
