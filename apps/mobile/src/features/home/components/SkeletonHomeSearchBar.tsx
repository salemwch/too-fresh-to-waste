/**
 * SkeletonHomeSearchBar Component
 * Professional shimmer loading placeholder for HomeSearchBar
 *
 * Features:
 * - Smooth shimmer animation matching SkeletonOfferCard style
 * - Matches HomeSearchBar dimensions exactly (search input + filter button)
 * - Performance optimized with React.memo
 * - Displays while offers are loading on initial render
 *
 * Layout:
 * - Search input skeleton (flex: 1)
 * - Filter button skeleton (48x48 circular)
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '@/design-system/providers';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonHomeSearchBarProps {
  /**
   * Test ID for testing
   */
  testID?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * SkeletonHomeSearchBar - Shimmer loading placeholder for search bar
 *
 * @example
 * ```typescript
 * <SkeletonHomeSearchBar />
 * ```
 */
const SkeletonHomeSearchBarComponent: React.FC<SkeletonHomeSearchBarProps> = ({
  testID = 'skeleton-home-search-bar',
}) => {
  const theme = useTheme();
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  // Shimmer animation loop (matches SkeletonOfferCard)
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
   * Reusable shimmer wrapper for skeleton elements
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
          colors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* Search Input Skeleton */}
      <View style={styles.searchInputWrapper}>
        <Shimmer style={[styles.searchInputSkeleton, { backgroundColor: theme.colors.surfaceVariant }]} />
      </View>

      {/* Filter Button Skeleton */}
      <View style={[styles.filterButtonSkeleton, { backgroundColor: theme.colors.surfaceVariant }]}>
        <Shimmer style={styles.filterButtonInner} />
      </View>
    </View>
  );
};

// Export memoized component
SkeletonHomeSearchBarComponent.displayName = 'SkeletonHomeSearchBar';
export const SkeletonHomeSearchBar = React.memo(SkeletonHomeSearchBarComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  searchInputWrapper: {
    flex: 1,
  },
  searchInputSkeleton: {
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  filterButtonSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
  },
  filterButtonInner: {
    width: '100%',
    height: '100%',
  },
  // Shimmer effect styles
  shimmerContainer: {
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
