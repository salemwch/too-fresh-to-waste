/**
 * SkeletonImpactBanner Component
 * Shimmer loading placeholder for ImpactBanner (collapsed state).
 */

import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

interface SkeletonImpactBannerProps {
  testID?: string;
}

const COLORS = {
  surface: '#FFFFFF',
  shadow: '#000',
} as const;

const SkeletonImpactBannerComponent = ({
  testID = 'skeleton-impact-banner',
}: SkeletonImpactBannerProps) => {
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

SkeletonImpactBannerComponent.displayName = 'SkeletonImpactBanner';
export const SkeletonImpactBanner = memo(SkeletonImpactBannerComponent);

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
    marginEnd: sp[3],
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
    marginStart: 8,
  },
});
