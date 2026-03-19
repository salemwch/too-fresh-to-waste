/**
 * SkeletonBox — Reusable skeleton placeholder (opacity-pulse variant).
 *
 * Replaces the duplicated SkeletonBox inner-component found in
 * SkeletonCheckoutScreen, SkeletonOrderDetailsScreen, SkeletonEditProfileScreen,
 * SkeletonPhoneVerificationModal, and SkeletonOrderSuccessModal.
 *
 * Pair with useShimmerAnimation('pulse') hook for the Animated.Value.
 *
 * @example
 * ```tsx
 * const anim = useShimmerAnimation('pulse');
 * <SkeletonBox animValue={anim} width={120} height={16} />
 * ```
 */

import React from 'react';
import { Animated } from 'react-native';

import type { ViewStyle, DimensionValue } from 'react-native';

export interface SkeletonBoxProps {
  animValue: Animated.Value;
  width: DimensionValue;
  height: number;
  borderRadius?: number;
  style?: ViewStyle;
  color?: string;
}

export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  animValue,
  width,
  height,
  borderRadius = 8,
  style,
  color = '#E2E8F0',
}) => {
  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: color,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
};
