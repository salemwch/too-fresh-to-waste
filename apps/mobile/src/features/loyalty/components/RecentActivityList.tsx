/**
 * RecentActivityList
 * Last 5 pointsHistory transactions with green earned / red spent indicators.
 */

import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';

import type { PointTransaction } from '../types/loyalty.types';
import type { Translate } from '@/i18n/translate';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const NO_TRANSACTIONS: readonly PointTransaction[] = Object.freeze([]);

interface RecentActivityListProps {
  transactions: PointTransaction[];
  /** Max items to display */
  limit?: number;
}

const SURFACE_MUTED = colorTokens.base.neutral[100];

/**
 * Relative timestamp ("2h ago", "il y a 2 h", "منذ ساعتين"). Counts go through
 * i18next plurals, because Arabic has six forms. Past five weeks it falls back
 * to a short date in the viewer's locale.
 */
export function formatRelativeTime(dateString: string, t: Translate, locale: string): string {
  try {
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return t('loyalty.justNow', {});
    if (diffMin < 60) return t('loyalty.minutesAgo', { count: diffMin });

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return t('loyalty.hoursAgo', { count: diffHours });

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return t('loyalty.daysAgo', { count: diffDays });

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return t('loyalty.weeksAgo', { count: diffWeeks });

    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const TRANSACTION_ICONS: Record<
  string,
  { icon: string; color: string; amountStyle: { color: string } }
> = {
  earned: {
    icon: 'arrow-up-circle-outline',
    color: colorTokens.base.success[500],
    amountStyle: { color: colorTokens.base.success[500] },
  },
  redeemed: {
    icon: 'arrow-down-circle-outline',
    color: colorTokens.base.error[500],
    amountStyle: { color: colorTokens.base.error[500] },
  },
  expired: {
    icon: 'time-outline',
    color: colorTokens.light.onSurfaceVariant,
    amountStyle: { color: colorTokens.light.onSurfaceVariant },
  },
  donated: { icon: 'heart-outline', color: '#8B5CF6', amountStyle: { color: '#8B5CF6' } },
};

const FALLBACK_ICON = {
  icon: 'arrow-up-circle-outline',
  color: colorTokens.base.success[500],
  amountStyle: { color: colorTokens.base.success[500] },
};

const TransactionRow: React.FC<{ tx: PointTransaction }> = ({ tx }) => {
  const { t, i18n } = useTranslation();
  const config = TRANSACTION_ICONS[tx.type] ?? FALLBACK_ICON;
  const isPositive = tx.type === 'earned';
  const sign = isPositive ? '+' : '-';

  return (
    <View style={styles.txRow}>
      <Icon name={config.icon} family='Ionicons' size={24} color={config.color} />
      <View style={styles.txInfo}>
        <Text variant='body' size='sm' weight='medium' numberOfLines={1}>
          {tx.reason}
        </Text>
        <Text variant='body' size='xs' color='secondary'>
          {formatRelativeTime(tx.createdAt, t, i18n.language)}
        </Text>
      </View>
      <Text variant='body' size='sm' weight='bold' style={config.amountStyle}>
        {t('loyalty.pointsSigned', { sign, count: Math.abs(tx.amount) })}
      </Text>
    </View>
  );
};

const RecentActivityListComponent: React.FC<RecentActivityListProps> = ({
  transactions: transactionsRaw,
  limit = 5,
}) => {
  const { t } = useTranslation();
  const transactions = transactionsRaw ?? NO_TRANSACTIONS;
  const recentTxs = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, limit);
  }, [transactions, limit]);

  if (recentTxs.length === 0) {
    return (
      <Card variant='elevated' style={styles.card}>
        <Text variant='title' size='md' weight='semibold' style={styles.title}>
          {t('loyalty.recentActivity')}
        </Text>
        <View style={styles.emptyState}>
          <Icon
            name='receipt-outline'
            family='Ionicons'
            size={32}
            color={colorTokens.base.neutral[300]}
          />
          <Text variant='body' size='sm' color='secondary' style={styles.emptyText}>
            {t('loyalty.noActivity')}
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card variant='elevated' style={styles.card}>
      <Text variant='title' size='md' weight='semibold' style={styles.title}>
        {t('loyalty.recentActivity')}
      </Text>
      {recentTxs.map((tx, idx) => (
        <View key={`${tx.createdAt}-${tx.amount}-${idx}`}>
          <TransactionRow tx={tx} />
          {idx < recentTxs.length - 1 && <View style={styles.divider} />}
        </View>
      ))}
    </Card>
  );
};

export const RecentActivityList = memo(RecentActivityListComponent);
RecentActivityListComponent.displayName = 'RecentActivityList';

const styles = StyleSheet.create({
  card: {
    padding: sp[5],
    borderRadius: 16,
    marginBottom: 16,
  },
  title: {
    marginBottom: 14,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  txInfo: {
    flex: 1,
    marginStart: sp[3],
    marginEnd: 8,
  },
  divider: {
    height: 1,
    backgroundColor: SURFACE_MUTED,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    marginTop: 8,
    textAlign: 'center',
  },
});
