/**
 * SkeletonOrderDetailsScreen
 * Shimmer skeleton that mirrors OrderDetailsScreen layout exactly.
 * Shown while the order-detail query is in flight — eliminates the
 * ActivityIndicator and prevents layout shift when data arrives.
 *
 * Performance notes:
 * - Single Animated.Value drives all boxes via one shared interpolation
 *   that runs entirely on the native thread (useNativeDriver: true).
 * - No props, no state → zero re-renders during the loading window.
 * - Card container styles are copied directly from the design-system
 *   tokens: Card default/md = radius 8, shadow sm, surface (#FFF).
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView, Platform } from 'react-native';

export const SkeletonOrderDetailsScreen: React.FC = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ]),
    );
    shimmer.start();
    return () => shimmer.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  // Inline skeleton-box — shared opacity keeps all boxes in sync with
  // a single native-thread animation loop.
  const Box = ({
    width,
    height,
    borderRadius = 8,
    style,
  }: {
    width: number | string;
    height: number;
    borderRadius?: number;
    style?: object;
  }) => (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: '#E2E8F0',
          borderRadius,
          opacity: shimmerOpacity,
        },
        style,
      ]}
    />
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* ── Header: "Order Details" + #number (left), status badge (right) ── */}
        <View style={styles.header}>
          <View>
            <Box width={160} height={24} borderRadius={12} />
            <Box width={100} height={14} borderRadius={7} style={{ marginTop: 4 }} />
          </View>
          <Box width={76} height={28} borderRadius={14} />
        </View>

        {/* ── Items card ── */}
        <View style={styles.card}>
          <Box width={48} height={12} borderRadius={6} style={styles.sectionTitle} />

          {/* item row 1 */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Box width={150} height={16} borderRadius={8} />
              <Box width={60} height={13} borderRadius={6} style={{ marginTop: 4 }} />
            </View>
            <Box width={64} height={16} borderRadius={8} />
          </View>

          <View style={styles.divider} />

          {/* item row 2 */}
          <View style={styles.itemRow}>
            <View style={styles.itemLeft}>
              <Box width={120} height={16} borderRadius={8} />
              <Box width={50} height={13} borderRadius={6} style={{ marginTop: 4 }} />
            </View>
            <Box width={64} height={16} borderRadius={8} />
          </View>
        </View>

        {/* ── Pricing card ── */}
        <View style={styles.card}>
          <Box width={65} height={12} borderRadius={6} style={styles.sectionTitle} />

          <View style={styles.pricingRow}>
            <Box width={60} height={16} borderRadius={8} />
            <Box width={68} height={16} borderRadius={8} />
          </View>
          <View style={styles.pricingRow}>
            <Box width={40} height={16} borderRadius={8} />
            <Box width={68} height={16} borderRadius={8} />
          </View>
          <View style={styles.pricingRow}>
            <Box width={75} height={16} borderRadius={8} />
            <Box width={68} height={16} borderRadius={8} />
          </View>

          <View style={styles.divider} />

          {/* Total row — slightly taller to mirror the bold total text */}
          <View style={styles.pricingRow}>
            <Box width={42} height={18} borderRadius={9} />
            <Box width={88} height={20} borderRadius={10} />
          </View>
        </View>

        {/* ── Pickup Details card ── */}
        <View style={styles.card}>
          <Box width={115} height={12} borderRadius={6} style={styles.sectionTitle} />

          <View style={styles.pickupRow}>
            <Box width={18} height={18} borderRadius={9} />
            <Box width={170} height={16} borderRadius={8} style={{ marginLeft: 10 }} />
          </View>
          <View style={styles.pickupRow}>
            <Box width={18} height={18} borderRadius={9} />
            <Box width={110} height={16} borderRadius={8} style={{ marginLeft: 10 }} />
          </View>
        </View>

        {/* ── Confirm Pickup card ── */}
        <View style={styles.card}>
          <Box width={120} height={12} borderRadius={6} style={styles.sectionTitle} />

          {/* hint text (wraps to ~2 lines) */}
          <Box width="100%" height={13} borderRadius={6} />
          <Box width="70%" height={13} borderRadius={6} style={{ marginTop: 5, marginBottom: 12 }} />

          {/* 6-digit code input */}
          <Box width="100%" height={56} borderRadius={12} />

          {/* Confirm Pickup button (lg = 48 px) */}
          <Box width="100%" height={48} borderRadius={12} style={{ marginTop: 16 }} />
        </View>

        {/* ── Go Back button (md = 40 px) ── */}
        <Box width="100%" height={40} borderRadius={8} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },

  // Header — matches OrderDetailsScreen styles.header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },

  // Card shell — tokens: Card default/md
  //   backgroundColor = colors.surface  (#FFFFFF)
  //   borderRadius    = radius.md       (8)
  //   shadow          = card.resting    (shadows.sm)
  //   overflow        = hidden
  // External style from OrderDetailsScreen adds padding 16 + marginBottom 12.
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Section-title placeholder (mirrors the uppercase labels: ITEMS, PRICING …)
  sectionTitle: {
    marginBottom: 12,
  },

  // ── Item rows ──
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  itemLeft: {
    flex: 1,
  },

  // ── Pricing rows ──
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  // ── Pickup rows ──
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },

  // Divider — mirrors styles.divider in OrderDetailsScreen
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
});
