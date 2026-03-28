/**
 * SkeletonHomeSearchBar Component
 * Shimmer loading placeholder for HomeSearchBar.
 *
 * Layout:
 * - Search input skeleton (flex: 1)
 * - Filter button skeleton (48x48 circular)
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

interface SkeletonHomeSearchBarProps {
  testID?: string;
}

const SkeletonHomeSearchBarComponent: React.FC<SkeletonHomeSearchBarProps> = ({
  testID = 'skeleton-home-search-bar',
}) => {
  const anim = useShimmerAnimation();

  return (
    <View style={styles.container} testID={testID}>
      {/* Search Input Skeleton */}
      <View style={styles.searchInputWrapper}>
        <ShimmerBlock animValue={anim} style={styles.searchInputSkeleton} />
      </View>

      {/* Filter Button Skeleton */}
      <ShimmerBlock animValue={anim} style={styles.filterButtonSkeleton} />
    </View>
  );
};

SkeletonHomeSearchBarComponent.displayName = 'SkeletonHomeSearchBar';
export const SkeletonHomeSearchBar = React.memo(SkeletonHomeSearchBarComponent);

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
  },
  filterButtonSkeleton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
});
