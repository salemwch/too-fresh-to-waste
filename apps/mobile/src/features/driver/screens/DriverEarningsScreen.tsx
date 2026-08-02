/**
 * Driver Earnings & History
 *
 * Answers the two questions a driver opens the app to ask: what have I made,
 * and what did I deliver. Earnings buckets come from the server (which owns the
 * week/month boundaries) so the client never re-derives money.
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Platform, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { useDriverEarnings, useDriverOrderHistory } from '../hooks/useDriverOrders';
import type { DriverAvailableOrder, DriverEarningsSummary } from '../services/driver.service';

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

interface EarningsSummaryProps {
  summary: DriverEarningsSummary;
}

const EarningsSummary: React.FC<EarningsSummaryProps> = ({ summary }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.summaryWrapper}>
      {/* Today is the number drivers check most, so it gets the hero treatment. */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>{t('driver.earnedToday')}</Text>
        <Text style={styles.heroAmount}>
          {summary.today.toFixed(3)} <Text style={styles.heroCurrency}>{summary.currency}</Text>
        </Text>
        <Text style={styles.heroMeta}>
          {t('driver.deliveryCount', { count: summary.deliveriesToday })}
        </Text>
      </View>

      <View style={styles.statRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('driver.thisWeek')}</Text>
          <Text style={styles.statValue}>{summary.thisWeek.toFixed(3)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t('driver.thisMonth')}</Text>
          <Text style={styles.statValue}>{summary.thisMonth.toFixed(3)}</Text>
        </View>
      </View>

      <View style={styles.allTimeCard}>
        <View style={styles.allTimeItem}>
          <Text style={styles.statLabel}>{t('driver.allTime')}</Text>
          <Text style={styles.statValue}>
            {summary.allTime.toFixed(3)} {t('common.currency')}
          </Text>
        </View>
        <View style={styles.allTimeDivider} />
        <View style={styles.allTimeItem}>
          <Text style={styles.statLabel}>{t('driver.deliveries')}</Text>
          <Text style={styles.statValue}>{summary.deliveriesAllTime}</Text>
        </View>
      </View>

      <Text style={styles.sectionHeading}>{t('driver.pastDeliveries')}</Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// History row
// ---------------------------------------------------------------------------

const HistoryRow: React.FC<{ item: DriverAvailableOrder }> = ({ item }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyBody}>
        <Text style={styles.historyCity} numberOfLines={1}>
          {item.deliveryAddress?.city ??
            item.establishmentAddress?.city ??
            t('driver.deliveryFallback')}
        </Text>
        <Text style={styles.historyDate}>{formatDate(item.deliveredAt)}</Text>
      </View>
      <Text style={styles.historyEarnings}>
        +{(item.driverEarnings ?? 0).toFixed(3)}{' '}
        <Text style={styles.historyCurrency}>{t('common.currency')}</Text>
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function DriverEarningsScreen() {
  const { t } = useTranslation();

  const {
    data: earnings,
    isLoading: earningsLoading,
    isRefetching: earningsRefetching,
    refetch: refetchEarnings,
  } = useDriverEarnings();

  const {
    data: history,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useDriverOrderHistory(1);

  const handleRefresh = useCallback(() => {
    void refetchEarnings();
    void refetchHistory();
  }, [refetchEarnings, refetchHistory]);

  const keyExtractor = useCallback((item: DriverAvailableOrder) => item._id, []);
  const renderItem = useCallback(
    ({ item }: { item: DriverAvailableOrder }) => <HistoryRow item={item} />,
    [],
  );

  if (earningsLoading || historyLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size='large' color={PRIMARY} />
        <Text style={styles.loadingTitle}>{t('driver.loadingEarnings')}</Text>
      </View>
    );
  }

  if (!earnings) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyIcon}>⚠️</Text>
        <Text style={styles.emptyTitle}>{t('driver.earningsUnavailable')}</Text>
        <Text style={styles.emptySubtitle}>{t('driver.pullToRetry')}</Text>
      </View>
    );
  }

  return (
    <FlashList
      style={styles.container}
      data={history?.orders ?? []}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      ListHeaderComponent={<EarningsSummary summary={earnings} />}
      estimatedItemSize={100}
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🛵</Text>
          <Text style={styles.emptyTitle}>{t('driver.noDeliveriesYet')}</Text>
          <Text style={styles.emptySubtitle}>{t('driver.emptyHistorySubtitle')}</Text>
        </View>
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={earningsRefetching}
          onRefresh={handleRefresh}
          tintColor={PRIMARY}
          colors={[PRIMARY]}
        />
      }
    />
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
  listContent: { padding: sp.md, paddingBottom: sp['2xl'] },
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

  summaryWrapper: { gap: sp.sm },

  // ── Hero: today ──
  heroCard: {
    backgroundColor: PRIMARY,
    borderRadius: radius.lg,
    padding: sp.lg,
    ...CARD_SHADOW,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    opacity: 0.75,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  heroAmount: { marginTop: sp.xs, fontSize: 34, fontWeight: '800', color: '#fff' },
  heroCurrency: { fontSize: 18, fontWeight: '600', opacity: 0.8 },
  heroMeta: { marginTop: sp.xxs, fontSize: 13, color: '#fff', opacity: 0.8 },

  // ── Week / month ──
  statRow: { flexDirection: 'row', gap: sp.sm },
  statCard: {
    flex: 1,
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: sp.md,
    ...CARD_SHADOW,
  },
  statLabel: {
    fontSize: 12,
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: { marginTop: sp.xxs, fontSize: 18, fontWeight: '700', color: ON_SURFACE },

  // ── All time ──
  allTimeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: sp.md,
    ...CARD_SHADOW,
  },
  allTimeItem: { flex: 1 },
  allTimeDivider: { width: 1, alignSelf: 'stretch', backgroundColor: OUTLINE, marginEnd: sp.md },

  sectionHeading: {
    marginTop: sp.md,
    marginBottom: sp.xxs,
    fontSize: 13,
    fontWeight: '700',
    color: ON_SURFACE_VARIANT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── History ──
  historyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: radius.lg,
    padding: sp.md,
    marginBottom: sp.sm,
    ...CARD_SHADOW,
  },
  historyBody: { flex: 1 },
  historyCity: { fontSize: 15, fontWeight: '600', color: ON_SURFACE },
  historyDate: { marginTop: 2, fontSize: 12, color: ON_SURFACE_VARIANT },
  historyEarnings: { fontSize: 16, fontWeight: '700', color: SUCCESS },
  historyCurrency: { fontSize: 12, fontWeight: '600' },

  // ── Empty ──
  emptyContainer: { alignItems: 'center', paddingVertical: sp['2xl'], paddingHorizontal: sp.lg },
  emptyIcon: { fontSize: 44, marginBottom: sp.sm },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: ON_SURFACE,
    marginBottom: sp.xxs,
    textAlign: 'center',
  },
  emptySubtitle: { fontSize: 14, color: ON_SURFACE_VARIANT, textAlign: 'center', lineHeight: 21 },
});
