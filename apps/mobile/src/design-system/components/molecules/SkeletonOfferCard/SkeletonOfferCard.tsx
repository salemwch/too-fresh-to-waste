/**
 * SkeletonOfferCard Component
 * Professional shimmer loading placeholder for OfferCard
 *
 * Features:
 * - Smooth shimmer animation (Facebook/LinkedIn style)
 * - Matches OfferCard dimensions exactly
 * - Configurable aspect ratio and orientation
 * - Reusable across all offer loading states
 * - Performance optimized with React.memo
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useTheme } from '../../../providers';
import { Card } from '../../atoms/Card';

interface SkeletonOfferCardProps {
  /**
   * Image aspect ratio (matches OfferCard)
   * @default 4/3 (1.333)
   */
  imageAspectRatio?: number;

  /**
   * Card orientation
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal';

  /**
   * Custom style for the card container
   */
  style?: any;

  /**
   * Test ID for testing
   */
  testID?: string;
}

/**
 * SkeletonOfferCard - Shimmer loading placeholder
 */
const SkeletonOfferCardComponent: React.FC<SkeletonOfferCardProps> = ({
  imageAspectRatio = 4 / 3,
  orientation = 'vertical',
  style,
  testID = 'skeleton-offer-card',
}) => {
  const theme = useTheme();
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

  const styles = createStyles(theme, orientation, imageAspectRatio);

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
          colors={[theme.colors.surfaceVariant, theme.colors.surface, theme.colors.surfaceVariant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.shimmerGradient}
        />
      </Animated.View>
    </View>
  );

  return (
    <Card variant='elevated' style={[styles.card, style]} testID={testID}>
      {/* Image Skeleton */}
      <View style={styles.imageContainer}>
        <Shimmer style={styles.imageSkeleton} />

        {/* Top left badge placeholder */}
        <View style={styles.topLeftBadge}>
          <Shimmer style={styles.badgeSkeleton} />
        </View>

        {/* Top right rating badge placeholder */}
        <View style={styles.topRightBadge}>
          <Shimmer style={styles.ratingBadgeSkeleton} />
        </View>

        {/* Bottom left logo placeholder */}
        <View style={styles.logoPlaceholder}>
          <Shimmer style={styles.logoSkeleton} />
        </View>
      </View>

      {/* Content Skeleton */}
      <View style={styles.content}>
        {/* Establishment name row */}
        <View style={styles.establishmentRow}>
          <Shimmer style={styles.establishmentNameSkeleton} />
          <Shimmer style={styles.heartSkeleton} />
        </View>

        {/* Title */}
        <Shimmer style={styles.titleSkeleton} />

        {/* Pickup time row */}
        <View style={styles.pickupTimeRow}>
          <Shimmer style={styles.pickupTimeSkeleton} />
          <Shimmer style={styles.distanceSkeleton} />
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          <Shimmer style={styles.priceSkeleton} />
        </View>
      </View>
    </Card>
  );
};

// Export memoized component
export const SkeletonOfferCard = React.memo(SkeletonOfferCardComponent);
SkeletonOfferCardComponent.displayName = 'SkeletonOfferCard';

// ==================== Styles ====================
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
    // Shimmer effect styles
    shimmerContainer: {
      backgroundColor: theme.colors.surfaceVariant,
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
};
