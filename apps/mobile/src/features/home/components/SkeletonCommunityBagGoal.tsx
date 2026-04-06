/**
 * SkeletonCommunityBagGoal Component
 * Shimmer loading placeholder matching collapsed CommunityBagGoalBanner dimensions.
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

interface SkeletonCommunityBagGoalProps {
  testID?: string;
}

const COLORS = {
  surface: '#FFFFFF',
  shadow: '#000',
} as const;

const SkeletonCommunityBagGoalComponent = ({
  testID = 'skeleton-community-bag-goal',
}: SkeletonCommunityBagGoalProps) => {
  const anim = useShimmerAnimation();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.banner}>
        <View style={styles.collapsedContent}>
          <ShimmerBlock animValue={anim} style={styles.iconSkeleton} />
          <View style={styles.textContainer}>
            <ShimmerBlock animValue={anim} style={styles.titleSkeleton} />
            <ShimmerBlock animValue={anim} style={styles.subtitleSkeleton} />
          </View>
          <ShimmerBlock animValue={anim} style={styles.expandIconSkeleton} />
        </View>
      </View>
    </View>
  );
};

SkeletonCommunityBagGoalComponent.displayName = 'SkeletonCommunityBagGoal';
export const SkeletonCommunityBagGoal = memo(SkeletonCommunityBagGoalComponent);

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.shadow,
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
    width: '55%',
    height: 18,
    borderRadius: 4,
    marginBottom: 6,
  },
  subtitleSkeleton: {
    width: '75%',
    height: 14,
    borderRadius: 4,
  },
  expandIconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
});
