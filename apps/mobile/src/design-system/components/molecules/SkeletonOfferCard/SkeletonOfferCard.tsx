/**
 * SkeletonOfferCard Component
 * Professional shimmer loading placeholder for OfferCard.
 *
 * Uses shared ShimmerBlock + useShimmerAnimation from design-system atoms.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { useTheme } from '../../../providers';
import { Card } from '../../atoms/Card';
import { ShimmerBlock, useShimmerAnimation } from '../../atoms/ShimmerBlock';

interface SkeletonOfferCardProps {
  imageAspectRatio?: number;
  orientation?: 'vertical' | 'horizontal';
  style?: any;
  testID?: string;
}

const SkeletonOfferCardComponent: React.FC<SkeletonOfferCardProps> = ({
  imageAspectRatio = 4 / 3,
  orientation = 'vertical',
  style,
  testID = 'skeleton-offer-card',
}) => {
  const theme = useTheme();
  const anim = useShimmerAnimation();
  const colors: [string, string, string] = [
    theme.colors.surfaceVariant,
    theme.colors.surface,
    theme.colors.surfaceVariant,
  ];

  const dynamicStyles = createStyles(theme, orientation, imageAspectRatio);

  return (
    <Card variant='elevated' style={[dynamicStyles.card, style]} testID={testID}>
      {/* Image Skeleton */}
      <View style={dynamicStyles.imageContainer}>
        <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.imageSkeleton} />

        {/* Top left badge placeholder */}
        <View style={dynamicStyles.topLeftBadge}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.badgeSkeleton} />
        </View>

        {/* Top right rating badge placeholder */}
        <View style={dynamicStyles.topRightBadge}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.ratingBadgeSkeleton} />
        </View>

        {/* Bottom left logo placeholder */}
        <View style={dynamicStyles.logoPlaceholder}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.logoSkeleton} />
        </View>
      </View>

      {/* Content Skeleton */}
      <View style={dynamicStyles.content}>
        <View style={dynamicStyles.establishmentRow}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.establishmentNameSkeleton} />
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.heartSkeleton} />
        </View>

        <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.titleSkeleton} />

        <View style={dynamicStyles.pickupTimeRow}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.pickupTimeSkeleton} />
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.distanceSkeleton} />
        </View>

        <View style={dynamicStyles.priceRow}>
          <ShimmerBlock animValue={anim} colors={colors} style={dynamicStyles.priceSkeleton} />
        </View>
      </View>
    </Card>
  );
};

export const SkeletonOfferCard = React.memo(SkeletonOfferCardComponent);
SkeletonOfferCardComponent.displayName = 'SkeletonOfferCard';

const createStyles = (
  theme: ReturnType<typeof useTheme>,
  orientation: 'vertical' | 'horizontal',
  imageAspectRatio: number,
) => {
  const isHorizontal = orientation === 'horizontal';

  return StyleSheet.create({
    card: {
      flexDirection: isHorizontal ? 'row' : 'column',
      minWidth: isHorizontal ? 300 : 280,
      maxWidth: isHorizontal ? 400 : 320,
      borderRadius: 20,
      overflow: 'hidden',
      padding: 5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.12,
      shadowRadius: 8,
      elevation: 5,
    },
    imageContainer: {
      position: 'relative',
      width: isHorizontal ? 120 : '100%',
      aspectRatio: isHorizontal ? 1 : imageAspectRatio,
      backgroundColor: theme.colors.surfaceVariant,
      borderRadius: 10,
      overflow: 'hidden',
    },
    imageSkeleton: {
      width: '100%',
      height: '100%',
    },
    topLeftBadge: {
      position: 'absolute',
      top: theme.spacing.base.sm,
      left: theme.spacing.base.sm,
    },
    badgeSkeleton: {
      width: 50,
      height: 20,
      borderRadius: theme.spacing.radius.sm,
    },
    topRightBadge: {
      position: 'absolute',
      top: theme.spacing.base.sm,
      right: theme.spacing.base.sm,
    },
    ratingBadgeSkeleton: {
      width: 40,
      height: 20,
      borderRadius: theme.spacing.radius.sm,
    },
    logoPlaceholder: {
      position: 'absolute',
      bottom: theme.spacing.base.sm,
      left: theme.spacing.base.sm,
    },
    logoSkeleton: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    content: {
      flex: 1,
      padding: 10,
    },
    establishmentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 6,
      gap: theme.spacing.base.xs,
    },
    establishmentNameSkeleton: {
      flex: 1,
      height: 18,
      borderRadius: 4,
    },
    heartSkeleton: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    titleSkeleton: {
      width: '60%',
      height: 14,
      borderRadius: 4,
      marginBottom: 6,
    },
    pickupTimeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    pickupTimeSkeleton: {
      width: 120,
      height: 14,
      borderRadius: 4,
    },
    distanceSkeleton: {
      width: 40,
      height: 14,
      borderRadius: 4,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.outline,
    },
    priceSkeleton: {
      width: 60,
      height: 18,
      borderRadius: 4,
    },
  });
};
