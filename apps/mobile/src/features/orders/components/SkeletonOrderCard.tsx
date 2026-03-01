/**
 * SkeletonOrderCard Component
 * Shimmer loading placeholder matching OrderCard layout exactly.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

// ---------------------------------------------------------------------------
// Shimmer block
// ---------------------------------------------------------------------------

const SHIMMER_BASE = '#F1F5F9';
const SHIMMER_HIGHLIGHT = '#E2E8F0';

const ShimmerBlock: React.FC<{ style?: any; animValue: Animated.Value }> = ({
  style,
  animValue,
}) => {
  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View style={[styles.shimmerContainer, style]}>
      <Animated.View style={[styles.shimmerWrapper, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[SHIMMER_BASE, SHIMMER_HIGHLIGHT, SHIMMER_BASE]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// SkeletonOrderCard
// ---------------------------------------------------------------------------

const SkeletonOrderCardComponent: React.FC = () => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  return (
    <View style={styles.card}>
      {/* Status badge placeholder */}
      <ShimmerBlock animValue={anim} style={styles.statusPlaceholder} />

      {/* Top row: thumbnail + text */}
      <View style={styles.topRow}>
        <ShimmerBlock animValue={anim} style={styles.thumbnail} />
        <View style={styles.infoColumn}>
          <ShimmerBlock animValue={anim} style={styles.titleLine} />
          <ShimmerBlock animValue={anim} style={styles.subtitleLine} />
          <ShimmerBlock animValue={anim} style={styles.orderNumLine} />
        </View>
      </View>

      {/* Pickup row placeholder */}
      <ShimmerBlock animValue={anim} style={styles.pickupLine} />

      {/* Divider */}
      <View style={styles.divider} />

      {/* Bottom row */}
      <View style={styles.bottomRow}>
        <ShimmerBlock animValue={anim} style={styles.qtyBlock} />
        <ShimmerBlock animValue={anim} style={styles.priceBlock} />
      </View>
    </View>
  );
};

export const SkeletonOrderCard = React.memo(SkeletonOrderCardComponent);

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

  // Status badge placeholder (top-right)
  statusPlaceholder: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 64,
    height: 22,
    borderRadius: 8,
    zIndex: 1,
  },

  // Top row
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

  // Pickup
  pickupLine: {
    width: '65%',
    height: 14,
    borderRadius: 4,
    marginBottom: 12,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 12,
  },

  // Bottom row
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

  // Shimmer internals
  shimmerContainer: {
    backgroundColor: SHIMMER_BASE,
    overflow: 'hidden',
  },
  shimmerWrapper: {
    width: '100%',
    height: '100%',
  },
  shimmerGradient: {
    width: 300,
    height: '100%',
  },
});
