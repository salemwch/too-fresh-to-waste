/**
 * SkeletonLoyaltyScreen
 * Shimmer loading placeholder for the loyalty screen.
 */

import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { useTheme } from '@/design-system/providers';

const SkeletonLoyaltyScreenComponent: React.FC = () => {
  const theme = useTheme();
  const anim = useShimmerAnimation();
  const colors: [string, string, string] = [
    theme.colors.surfaceVariant,
    theme.colors.surface,
    theme.colors.surfaceVariant,
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero card placeholder */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.heroCard} />

      {/* Impact stats row */}
      <View style={styles.statsRow}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.statPill} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.statPill} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.statPill} />
      </View>

      {/* How you earn grid */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.sectionTitle} />
      <View style={styles.earnGrid}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.earnCell} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.earnCell} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.earnCell} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.earnCell} />
      </View>

      {/* Badges scroll */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.sectionTitle} />
      <View style={styles.badgesRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <ShimmerBlock key={i} animValue={anim} colors={colors} style={styles.badgeCircle} />
        ))}
      </View>

      {/* Activity list */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.sectionTitle} />
      <ShimmerBlock animValue={anim} colors={colors} style={styles.activityRow} />
      <ShimmerBlock animValue={anim} colors={colors} style={styles.activityRow} />
      <ShimmerBlock animValue={anim} colors={colors} style={styles.activityRow} />
    </View>
  );
};

export const SkeletonLoyaltyScreen = memo(SkeletonLoyaltyScreenComponent);
SkeletonLoyaltyScreenComponent.displayName = 'SkeletonLoyaltyScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  heroCard: {
    height: 200,
    borderRadius: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statPill: {
    flex: 1,
    height: 80,
    borderRadius: 14,
  },
  sectionTitle: {
    width: 140,
    height: 20,
    borderRadius: 6,
    marginBottom: 12,
  },
  earnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  earnCell: {
    width: '47%',
    height: 100,
    borderRadius: 16,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  badgeCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  activityRow: {
    height: 48,
    borderRadius: 10,
    marginBottom: 8,
  },
});
