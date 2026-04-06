/**
 * ShimmerBlock — Reusable shimmer loading placeholder (LinearGradient variant).
 *
 * Replaces the duplicated Shimmer inner-component found in every skeleton file.
 * Pair with useShimmerAnimation('gradient') hook for the Animated.Value.
 *
 * @example
 * ```tsx
 * const anim = useShimmerAnimation();
 * <ShimmerBlock animValue={anim} width={120} height={16} borderRadius={4} />
 * ```
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { ViewStyle, DimensionValue } from 'react-native';

const DEFAULT_COLORS: [string, string, string] = ['#E5E7EB', '#F3F4F6', '#E5E7EB'];

interface ShimmerBlockProps {
  animValue: Animated.Value;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  /** Gradient colors [base, highlight, base]. Defaults to neutral gray. */
  colors?: [string, string, string];
}

export const ShimmerBlock: React.FC<ShimmerBlockProps> = ({
  animValue,
  width,
  height,
  borderRadius = 8,
  style,
  colors = DEFAULT_COLORS,
}) => {
  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[styles.container, { width, height, borderRadius, backgroundColor: colors[0] }, style]}
    >
      <Animated.View style={[styles.gradientWrapper, { transform: [{ translateX }] }]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  gradientWrapper: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    width: 300,
    height: '100%',
  },
});
