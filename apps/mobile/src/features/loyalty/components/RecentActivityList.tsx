/**
 * RecentActivityList
 * Last 5 pointsHistory transactions with green earned / red spent indicators.
 */

import React, { memo, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';

import type { PointTransaction } from '../types/loyalty.types';

interface RecentActivityListProps {
  transactions: PointTransaction[];
  /** Max items to display */
  limit?: number;
}

const SURFACE_MUTED = '#F1F5F9';

/** Format a relative timestamp (e.g. "2 hours ago", "3 days ago") */
function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60_000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}w ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const TRANSACTION_ICONS: Record<string, { icon: string; color: string }> = {
  earned: { icon: 'arrow-up-circle-outline', color: '#10B981' },
  redeemed: { icon: 'arrow-down-circle-outline', color: '#EF4444' },
  expired: { icon: 'time-outline', color: '#94A3B8' },
  donated: { icon: 'heart-outline', color: '#8B5CF6' },
};

const FALLBACK_ICON = { icon: 'arrow-up-circle-outline', color: '#10B981' };

const TransactionRow: React.FC<{ tx: PointTransaction }> = ({ tx }) => {
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
          {formatRelativeTime(tx.createdAt)}
        </Text>
      </View>
      <Text variant='body' size='sm' weight='bold' style={{ color: config.color }}>
        {sign}
        {Math.abs(tx.amount)} pts
      </Text>
    </View>
  );
};

const RecentActivityListComponent: React.FC<RecentActivityListProps> = ({
  transactions,
  limit = 5,
}) => {
  const recentTxs = useMemo(() => {
    // Sort newest first, take limit
    const sorted = [...transactions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
    return sorted.slice(0, limit);
  }, [transactions, limit]);

  if (recentTxs.length === 0) {
    return (
      <Card variant='elevated' style={styles.card}>
        <Text variant='title' size='md' weight='semibold' style={styles.title}>
          Recent Activity
        </Text>
        <View style={styles.emptyState}>
          <Icon name='receipt-outline' family='Ionicons' size={32} color='#CBD5E1' />
          <Text variant='body' size='sm' color='secondary' style={styles.emptyText}>
            No activity yet. Save a bag to earn your first points!
          </Text>
        </View>
      </Card>
    );
  }

  return (
    <Card variant='elevated' style={styles.card}>
      <Text variant='title' size='md' weight='semibold' style={styles.title}>
        Recent Activity
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
    padding: 20,
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
    marginLeft: 12,
    marginRight: 8,
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
