import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { BG_CREAM, GOLD_15 } from '../constants/palette';

const { base: sp } = spacingTokens;

/*
 * Tints for the cream ground, not the dark one this screen used to have. A
 * skeleton is the first thing drawn, so leaving it dark meant every load
 * flashed a near-black screen and then snapped to cream.
 */
const SHIMMER_BASE = 'rgba(30,68,72,0.06)';
const SHIMMER_HIGHLIGHT = 'rgba(30,68,72,0.12)';
const COLORS: [string, string, string] = [SHIMMER_BASE, SHIMMER_HIGHLIGHT, SHIMMER_BASE];

const SkeletonLeaderboardComponent: React.FC = () => {
  const anim = useShimmerAnimation();

  return (
    <View style={styles.container}>
      {/* Block 1: Header + Countdown */}
      <View style={styles.headerBlock}>
        <View style={styles.headerTop}>
          <View>
            <ShimmerBlock animValue={anim} colors={COLORS} style={styles.titleBar} />
            <ShimmerBlock animValue={anim} colors={COLORS} style={styles.subtitleBar} />
          </View>
          <ShimmerBlock animValue={anim} colors={COLORS} style={styles.infoBtn} />
        </View>

        <View style={styles.countdownRow}>
          {[0, 1, 2, 3].map(i => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.cdColonSpace} />}
              <ShimmerBlock animValue={anim} colors={COLORS} style={styles.cdSegment} />
            </React.Fragment>
          ))}
        </View>

        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.endDateBar} />
      </View>

      {/* Block 2: Prize Cards */}
      <View style={styles.prizesBlock}>
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.prizeCard} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.prizeCard} />
      </View>

      {/* Block 3: Top 5 Podium */}
      <View style={styles.podiumBlock}>
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.podiumSmall} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.podiumMedium} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.podiumLarge} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.podiumMedium} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.podiumSmall} />
      </View>

      {/* Block 4: Rankings header */}
      <View style={styles.listHeader}>
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.listTitleBar} />
        <ShimmerBlock animValue={anim} colors={COLORS} style={styles.listMetaBar} />
      </View>

      {/* Block 4: Rank rows */}
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <View key={i} style={styles.row}>
          <ShimmerBlock animValue={anim} colors={COLORS} style={styles.rankBadge} />
          <ShimmerBlock animValue={anim} colors={COLORS} style={styles.rowAvatar} />
          <View style={styles.rowNameCol}>
            <ShimmerBlock animValue={anim} colors={COLORS} style={styles.rowName} />
            <ShimmerBlock animValue={anim} colors={COLORS} style={styles.rowBadgeLabel} />
          </View>
          <ShimmerBlock animValue={anim} colors={COLORS} style={styles.rowPts} />
        </View>
      ))}
    </View>
  );
};

export const SkeletonLeaderboardScreen = memo(SkeletonLeaderboardComponent);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_CREAM },

  // Block 1: Header
  headerBlock: {
    paddingHorizontal: sp[5],
    paddingTop: 16,
    paddingBottom: sp[5],
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  titleBar: { width: 130, height: 22, borderRadius: 6 },
  subtitleBar: { width: 180, height: 12, borderRadius: 4, marginTop: 6 },
  infoBtn: { width: 36, height: 36, borderRadius: 18 },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cdSegment: {
    flex: 1,
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GOLD_15,
  },
  cdColonSpace: { width: 6 },
  endDateBar: {
    width: 140,
    height: 10,
    borderRadius: 4,
    alignSelf: 'center',
    marginTop: 10,
  },

  // Block 2: Prize Cards
  prizesBlock: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: sp[5],
    marginBottom: 8,
  },
  prizeCard: {
    flex: 1,
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.035)',
  },

  // Block 3: Podium
  podiumBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: sp[5],
    gap: 6,
  },
  podiumLarge: { width: 68, height: 110, borderRadius: 14 },
  podiumMedium: { width: 52, height: 85, borderRadius: 12 },
  podiumSmall: { width: 42, height: 65, borderRadius: 10 },

  // Block 4: Rankings
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp[5],
    marginBottom: sp[3],
    marginTop: 4,
  },
  listTitleBar: { width: 80, height: 15, borderRadius: 6 },
  listMetaBar: { width: 90, height: 10, borderRadius: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(30,68,72,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.035)',
  },
  rankBadge: { width: 26, height: 26, borderRadius: 7 },
  rowAvatar: { width: 36, height: 36, borderRadius: 18 },
  rowNameCol: { flex: 1, gap: 4 },
  rowName: { width: '65%', height: 13, borderRadius: 5 },
  rowBadgeLabel: { width: '35%', height: 10, borderRadius: 4 },
  rowPts: { width: 50, height: 12, borderRadius: 4 },
});
