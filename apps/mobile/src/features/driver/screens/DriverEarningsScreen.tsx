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

import { spacingTokens } from '@/design-system/tokens/spacing';

import { useDriverEarnings, useDriverOrderHistory } from '../hooks/useDriverOrders';
import type { DriverAvailableOrder, DriverEarningsSummary } from '../services/driver.service';

import { typographyTokens } from '@/design-system/tokens/typography';

import { useTheme } from '@/design-system/providers';

import { createThemedStyles, type ThemePalette } from '@/design-system/hooks/createThemedStyles';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { base: sp, radius } = spacingTokens;
const { fontSize } = typographyTokens;

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
  const styles = useStyles();
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
  const styles = useStyles();
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
  const styles = useStyles();
  const { colors } = useTheme();
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
        <ActivityIndicator size='large' color={colors.primary} />
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
          tintColor={colors.primary}
          colors={[colors.primary]}
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

const useStyles = createThemedStyles((c: ThemePalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.surfaceVariant },
    listContent: { padding: sp.md, paddingBottom: sp['2xl'] },
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

    summaryWrapper: { gap: sp.sm },

    // ── Hero: today ──
    heroCard: {
      backgroundColor: c.primary,
      borderRadius: radius.lg,
      padding: sp.lg,
      ...CARD_SHADOW,
    },
    heroLabel: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: '#fff',
      opacity: 0.75,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    heroAmount: { marginTop: sp.xs, fontSize: fontSize['4xl'], fontWeight: '800', color: '#fff' },
    heroCurrency: { fontSize: fontSize.lg, fontWeight: '600', opacity: 0.8 },
    heroMeta: { marginTop: sp.xxs, fontSize: fontSize.sm, color: '#fff', opacity: 0.8 },

    // ── Week / month ──
    statRow: { flexDirection: 'row', gap: sp.sm },
    statCard: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: sp.md,
      ...CARD_SHADOW,
    },
    statLabel: {
      fontSize: fontSize.sm,
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    statValue: { marginTop: sp.xxs, fontSize: fontSize.lg, fontWeight: '700', color: c.onSurface },

    // ── All time ──
    allTimeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: sp.md,
      ...CARD_SHADOW,
    },
    allTimeItem: { flex: 1 },
    allTimeDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: c.outlineVariant,
      marginEnd: sp.md,
    },

    sectionHeading: {
      marginTop: sp.md,
      marginBottom: sp.xxs,
      fontSize: fontSize.sm,
      fontWeight: '700',
      color: c.onSurfaceVariant,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // ── History ──
    historyCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.lg,
      padding: sp.md,
      marginBottom: sp.sm,
      ...CARD_SHADOW,
    },
    historyBody: { flex: 1 },
    historyCity: { fontSize: fontSize.base, fontWeight: '600', color: c.onSurface },
    historyDate: { marginTop: 2, fontSize: fontSize.sm, color: c.onSurfaceVariant },
    historyEarnings: { fontSize: fontSize.md, fontWeight: '700', color: c.success },
    historyCurrency: { fontSize: fontSize.sm, fontWeight: '600' },

    // ── Empty ──
    emptyContainer: { alignItems: 'center', paddingVertical: sp['2xl'], paddingHorizontal: sp.lg },
    emptyIcon: { fontSize: fontSize['6xl'], marginBottom: sp.sm },
    emptyTitle: {
      fontSize: fontSize.md,
      fontWeight: '700',
      color: c.onSurface,
      marginBottom: sp.xxs,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: fontSize.base,
      color: c.onSurfaceVariant,
      textAlign: 'center',
      lineHeight: 21,
    },
  }),
);
