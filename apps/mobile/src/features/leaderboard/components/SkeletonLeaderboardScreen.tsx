import React, { memo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { useTheme } from '@/design-system/providers';

const SURFACE = '#FFFFFF';
const BORDER = '#E8EEEF';

const SkeletonLeaderboardComponent: React.FC = () => {
  const theme = useTheme();
  const anim = useShimmerAnimation();
  const colors: [string, string, string] = [
    theme.colors.surfaceVariant,
    theme.colors.surface,
    theme.colors.surfaceVariant,
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Greeting row */}
      <View style={styles.greetingRow}>
        <View style={styles.greetingLeft}>
          <ShimmerBlock animValue={anim} colors={colors} style={styles.avatar} />
          <View style={styles.greetingText}>
            <ShimmerBlock animValue={anim} colors={colors} style={styles.greetingLine1} />
            <ShimmerBlock animValue={anim} colors={colors} style={styles.greetingLine2} />
          </View>
        </View>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.infoBtn} />
      </View>

      {/* Prize strip */}
      <View style={styles.prizeStrip}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.stripTile} />
        <View style={styles.stripDivider} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.stripTile} />
      </View>

      {/* Top 5 champions area */}
      <View style={styles.top5Row}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.top5Side} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.top5Side} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.top5Center} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.top5Side} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.top5Side} />
      </View>

      {/* Section header */}
      <View style={styles.sectionHeader}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.sectionTitle} />
      </View>

      {/* Rank rows */}
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={styles.row}>
          <ShimmerBlock animValue={anim} colors={colors} style={styles.rankNum} />
          <ShimmerBlock animValue={anim} colors={colors} style={styles.rowAvatar} />
          <View style={styles.rowNameCol}>
            <ShimmerBlock animValue={anim} colors={colors} style={styles.rowName} />
            <ShimmerBlock animValue={anim} colors={colors} style={styles.rowBadge} />
          </View>
          <ShimmerBlock animValue={anim} colors={colors} style={styles.rowPill} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonLeaderboardScreen = memo(SkeletonLeaderboardComponent);

const styles = StyleSheet.create({
  container: { flex: 1 },

  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  greetingText: { gap: 6 },
  greetingLine1: { width: 80, height: 14, borderRadius: 6 },
  greetingLine2: { width: 110, height: 18, borderRadius: 6 },
  infoBtn: { width: 40, height: 40, borderRadius: 20 },

  prizeStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
    height: 72,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  stripTile: { flex: 1, height: '100%', borderRadius: 0 },
  stripDivider: { width: 1, backgroundColor: BORDER, marginVertical: 12 },

  top5Row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  top5Center: { width: 60, height: 90, borderRadius: 14 },
  top5Side: { width: 42, height: 70, borderRadius: 12 },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { width: 130, height: 22, borderRadius: 8 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 20,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  rankNum: { width: 22, height: 16, borderRadius: 4 },
  rowAvatar: { width: 38, height: 38, borderRadius: 19 },
  rowNameCol: { flex: 1, gap: 4 },
  rowName: { width: '70%', height: 14, borderRadius: 6 },
  rowBadge: { width: '40%', height: 11, borderRadius: 4 },
  rowPill: { width: 60, height: 26, borderRadius: 14 },
});
