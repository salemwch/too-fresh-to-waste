/**
 * SkeletonCommunityBagGoal Component
 * Shimmer loading placeholder matching collapsed CommunityBagGoalBanner dimensions.
 * Pattern: mirrors SkeletonImpactBanner.tsx exactly.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface SkeletonCommunityBagGoalProps {
  testID?: string;
}

const SkeletonCommunityBagGoalComponent: React.FC<SkeletonCommunityBagGoalProps> = ({
  testID = 'skeleton-community-bag-goal',
}) => {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

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

  const translateX = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const Shimmer: React.FC<{ style?: any }> = ({ style: shimmerStyle }) => (
    <View style={[styles.shimmerContainer, shimmerStyle]}>
      <Animated.View style={[styles.shimmerGradientWrapper, { transform: [{ translateX }] }]}>
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
          <Shimmer style={styles.iconSkeleton} />
          <View style={styles.textContainer}>
            <Shimmer style={styles.titleSkeleton} />
            <Shimmer style={styles.subtitleSkeleton} />
          </View>
          <Shimmer style={styles.expandIconSkeleton} />
        </View>
      </View>
    </View>
  );
};

SkeletonCommunityBagGoalComponent.displayName = 'SkeletonCommunityBagGoal';
export const SkeletonCommunityBagGoal = React.memo(SkeletonCommunityBagGoalComponent);

const styles = StyleSheet.create({
  container: {
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
