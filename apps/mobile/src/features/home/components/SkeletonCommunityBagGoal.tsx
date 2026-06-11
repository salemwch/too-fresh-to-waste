import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';
import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';

interface SkeletonCommunityBagGoalProps {
  testID?: string;
}

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandDark: colorTokens.base.primary[700],
  brandSurface: 'rgba(255,255,255,0.15)',
} as const;

const SkeletonCommunityBagGoalComponent = ({
  testID = 'skeleton-community-bag-goal',
}: SkeletonCommunityBagGoalProps) => {
  const anim = useShimmerAnimation();

  return (
    <View style={styles.container} testID={testID}>
      <View style={styles.card}>
        <View style={styles.collapsedRow}>
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
  card: {
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSkeleton: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
