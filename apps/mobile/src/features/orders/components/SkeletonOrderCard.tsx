/**
 * SkeletonOrderCard Component
 * Shimmer loading placeholder matching OrderCard layout exactly.
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

const SHIMMER_BASE = '#F1F5F9';

const SkeletonOrderCardComponent: React.FC = () => {
  const anim = useShimmerAnimation();
  const colors: [string, string, string] = [SHIMMER_BASE, '#E2E8F0', SHIMMER_BASE];

  return (
    <View style={styles.card}>
      {/* Status badge placeholder */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.statusPlaceholder} />

      {/* Top row: thumbnail + text */}
      <View style={styles.topRow}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.thumbnail} />
        <View style={styles.infoColumn}>
          <ShimmerBlock animValue={anim} colors={colors} style={styles.titleLine} />
          <ShimmerBlock animValue={anim} colors={colors} style={styles.subtitleLine} />
          <ShimmerBlock animValue={anim} colors={colors} style={styles.orderNumLine} />
        </View>
      </View>

      {/* Pickup row placeholder */}
      <ShimmerBlock animValue={anim} colors={colors} style={styles.pickupLine} />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <ShimmerBlock animValue={anim} colors={colors} style={styles.qtyBlock} />
        <ShimmerBlock animValue={anim} colors={colors} style={styles.priceBlock} />
      </View>
    </View>
  );
};

export const SkeletonOrderCard = React.memo(SkeletonOrderCardComponent);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  statusPlaceholder: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 64,
    height: 22,
    borderRadius: 8,
    zIndex: 1,
  },
  topRow: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingRight: 80,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  infoColumn: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
    gap: 6,
  },
  titleLine: {
    width: '80%',
    height: 16,
    borderRadius: 4,
  },
  subtitleLine: {
    width: '55%',
    height: 12,
    borderRadius: 4,
  },
  orderNumLine: {
    width: '35%',
    height: 11,
    borderRadius: 4,
  },
  pickupLine: {
    width: '65%',
    height: 14,
    borderRadius: 4,
    marginBottom: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  qtyBlock: {
    width: 60,
    height: 16,
    borderRadius: 4,
  },
  priceBlock: {
    width: 90,
    height: 18,
    borderRadius: 4,
  },
});
