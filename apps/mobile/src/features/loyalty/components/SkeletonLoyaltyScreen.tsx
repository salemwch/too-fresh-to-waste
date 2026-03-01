/**
 * SkeletonLoyaltyScreen
 * Shimmer loading placeholder for the loyalty screen.
 * Pattern: Animated.loop + LinearGradient translateX (matches SkeletonOfferCard).
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/design-system/providers';

const SkeletonLoyaltyScreenComponent: React.FC = () => {
  const theme = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const Shimmer: React.FC<{ style?: any }> = ({ style }) => (
    <View style={[styles.shimmerBase, { backgroundColor: theme.colors.surfaceVariant }, style]}>
      <Animated.View style={[styles.shimmerGradientWrap, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Hero card placeholder */}
      <Shimmer style={styles.heroCard} />

      {/* Impact stats row */}
      <View style={styles.statsRow}>
        <Shimmer style={styles.statPill} />
        <Shimmer style={styles.statPill} />
        <Shimmer style={styles.statPill} />
      </View>

      {/* How you earn grid */}
      <Shimmer style={styles.sectionTitle} />
      <View style={styles.earnGrid}>
        <Shimmer style={styles.earnCell} />
        <Shimmer style={styles.earnCell} />
        <Shimmer style={styles.earnCell} />
        <Shimmer style={styles.earnCell} />
      </View>

      {/* Badges scroll */}
      <Shimmer style={styles.sectionTitle} />
      <View style={styles.badgesRow}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Shimmer key={i} style={styles.badgeCircle} />
        ))}
      </View>

      {/* Activity list */}
      <Shimmer style={styles.sectionTitle} />
      <Shimmer style={styles.activityRow} />
      <Shimmer style={styles.activityRow} />
      <Shimmer style={styles.activityRow} />
    </View>
  );
};

export const SkeletonLoyaltyScreen = React.memo(SkeletonLoyaltyScreenComponent);
SkeletonLoyaltyScreenComponent.displayName = 'SkeletonLoyaltyScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  shimmerBase: {
    overflow: 'hidden',
    borderRadius: 12,
  },
  shimmerGradientWrap: {
    width: '100%',
    height: '100%',
  },
  shimmerGradient: {
    width: 300,
    height: '100%',
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
