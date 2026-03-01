/**
 * SkeletonImpactBanner Component
 * Professional shimmer loading placeholder for ImpactBanner (collapsed state)
 *
 * Features:
 * - Smooth shimmer animation matching SkeletonOfferCard pattern
 * - Matches collapsed ImpactBanner dimensions exactly
 * - Performance optimized with React.memo
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface SkeletonImpactBannerProps {
  /**
   * Test ID for testing
   */
  testID?: string;
}

/**
 * SkeletonImpactBanner - Shimmer loading placeholder for collapsed banner
 */
const SkeletonImpactBannerComponent: React.FC<SkeletonImpactBannerProps> = ({
  testID = 'skeleton-impact-banner',
}) => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  // Shimmer animation loop
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [shimmerAnimation]);

  // Shimmer gradient translation
  const translateX = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  /**
   * Shimmer effect component
   */
  const Shimmer: React.FC<{ style?: any }> = ({ style: shimmerStyle }) => (
    <View style={[styles.shimmerContainer, shimmerStyle]}>
      <Animated.View
        style={[
          styles.shimmerGradientWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        <LinearGradient
          colors={['#E5E7EB', '#F3F4F6', '#E5E7EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.banner}>
        <View style={styles.collapsedContent}>
          {/* Icon placeholder */}
          <Shimmer style={styles.iconSkeleton} />

          {/* Text container */}
          <View style={styles.textContainer}>
            {/* Title skeleton */}
            <Shimmer style={styles.titleSkeleton} />
            {/* Subtitle skeleton */}
            <Shimmer style={styles.subtitleSkeleton} />
          </View>

          {/* Expand icon placeholder */}
          <Shimmer style={styles.expandIconSkeleton} />
        </View>
      </View>
    </View>
  );
};

// Export memoized component
SkeletonImpactBannerComponent.displayName = 'SkeletonImpactBanner';
export const SkeletonImpactBanner = React.memo(SkeletonImpactBannerComponent);

// ==================== Styles ====================
const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSkeleton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleSkeleton: {
    width: '60%',
    height: 18,
    borderRadius: 4,
    marginBottom: 6,
  },
  subtitleSkeleton: {
    width: '80%',
    height: 14,
    borderRadius: 4,
  },
  expandIconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  // Shimmer effect styles
  shimmerContainer: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  shimmerGradientWrapper: {
    width: '100%',
    height: '100%',
  },
  shimmerGradient: {
    width: 300,
    height: '100%',
  },
});
