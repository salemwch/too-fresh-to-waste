import { memo } from 'react';
import { View, StyleSheet } from 'react-native';

import { colorTokens } from '@/design-system/tokens/colors';
import { ShimmerBlock, useShimmerAnimation } from '@/design-system/components/atoms/ShimmerBlock';
import { spacingTokens } from '@/design-system/tokens/spacing';
import {
  HERO_CARD_HEIGHT,
  HERO_CARD_OUTER_PADDING_Y,
  HERO_CARD_PADDING,
  HERO_CARD_RADIUS,
} from '../utils/heroCard';

const { base: sp } = spacingTokens;

interface SkeletonMonthlyBagGoalProps {
  testID?: string;
}

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandDark: colorTokens.base.primary[700],
  brandSurface: 'rgba(255,255,255,0.15)',
} as const;

const SkeletonMonthlyBagGoalComponent = ({
  testID = 'skeleton-community-bag-goal',
}: SkeletonMonthlyBagGoalProps) => {
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

SkeletonMonthlyBagGoalComponent.displayName = 'SkeletonMonthlyBagGoal';
export const SkeletonMonthlyBagGoal = memo(SkeletonMonthlyBagGoalComponent);

const styles = StyleSheet.create({
  container: {
    // 8 -> HERO_CARD_OUTER_PADDING_Y (4): the skeleton used to be 8dp taller
    // than the card it stands in for, so the row nudged down on load.
    paddingVertical: HERO_CARD_OUTER_PADDING_Y,
  },
  card: {
    backgroundColor: COLORS.brand,
    borderRadius: HERO_CARD_RADIUS,
    padding: HERO_CARD_PADDING,
    // Same constant as MonthlyBagGoalBanner.card - see `utils/heroCard.ts`.
    height: HERO_CARD_HEIGHT,
    justifyContent: 'center',
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
    height: 34,
    borderRadius: 12,
    marginEnd: sp[3],
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
    marginStart: 8,
  },
});
