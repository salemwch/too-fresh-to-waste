/**
 * CommunityBagGoalBanner Component
 * Collapsible card showing community progress toward a bag-saving goal.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Animated,
  Easing,
  Image,
} from 'react-native';

const surpriseBoxImg = require('../../../assets/images/surprise-box.png');
import { useCommunityBagGoal } from '../hooks/useCommunityBagGoal';

import { colorTokens } from '@/design-system/tokens/colors';

import { SkeletonCommunityBagGoal } from './SkeletonCommunityBagGoal';

interface CommunityBagGoalBannerProps {
  onSaveABag?: () => void;
}

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandSurface: '#E0F2F1',
  surface: '#FFFFFF',
  shadow: '#000',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  textInverse: '#FFFFFF',
} as const;

const PulsingDot = () => {
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return <Animated.View style={[styles.liveDot, { opacity }]} />;
};

const ProgressBar = ({ percentage }: { percentage: number }) => {
  const [widthAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(percentage, 100),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percentage, widthAnim]);

  const animatedWidth = useMemo(
    () =>
      widthAnim.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
        extrapolate: 'clamp',
      }),
    [widthAnim],
  );

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
    </View>
  );
};

const CommunityBagGoalBannerComponent = ({ onSaveABag }: CommunityBagGoalBannerProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: stats, isLoading, isError } = useCommunityBagGoal();

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(previousValue => !previousValue);
  }, []);

  if (isLoading || (stats === undefined && !isError)) {
    return <SkeletonCommunityBagGoal />;
  }

  if (isError || stats === undefined) {
    return null;
  }

  const { currentCount, targetCount, progressPercentage, remaining } = stats;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.banner}
        onPress={toggleExpand}
        accessibilityRole='button'
        accessibilityLabel={`Grand Prize unlocks at: ${currentCount.toLocaleString()} of ${targetCount.toLocaleString()} bags saved`}
        accessibilityHint='Tap to expand for details'
        testID='community-bag-goal-banner'
      >
        <View style={styles.collapsedContent}>
          <View style={styles.iconContainer}>
            <Image source={surpriseBoxImg} style={{ width: 28, height: 28 }} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Grand Prize unlocks at</Text>
              <View style={styles.liveBadge}>
                <PulsingDot />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              {currentCount.toLocaleString()} / {targetCount.toLocaleString()} bags saved
            </Text>
          </View>

          <Text style={styles.expandIcon}>{isExpanded ? '\u25BC' : '\u25B6'}</Text>
        </View>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            <View style={styles.counterRow}>
              <Text style={styles.counterCurrent}>{currentCount.toLocaleString()}</Text>
              <Text style={styles.counterSeparator}> / </Text>
              <Text style={styles.counterTarget}>{targetCount.toLocaleString()}</Text>
            </View>
            <Text style={styles.counterLabel}>Bags Saved</Text>

            <View style={styles.progressContainer}>
              <ProgressBar percentage={progressPercentage} />
              <Text style={styles.remainingText}>{remaining.toLocaleString()} remaining</Text>
            </View>

            {onSaveABag != null && (
              <Pressable
                style={styles.saveButton}
                onPress={onSaveABag}
                accessibilityRole='button'
                accessibilityLabel='Save Food'
                accessibilityHint='Starts the save a bag action'
                testID='community-goal-save-a-bag'
              >
                <Text style={styles.saveButtonText}>Save Food</Text>
              </Pressable>
            )}
          </View>
        )}
      </Pressable>
    </View>
  );
};

CommunityBagGoalBannerComponent.displayName = 'CommunityBagGoalBanner';
export const CommunityBagGoalBanner = memo(CommunityBagGoalBannerComponent);

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
  iconContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandSurface,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.brand,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.brand,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  expandIcon: {
    fontSize: 16,
    color: COLORS.brand,
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  counterCurrent: {
    fontSize: 36,
    fontWeight: '700',
    color: COLORS.brand,
  },
  counterSeparator: {
    fontSize: 20,
    color: COLORS.textMuted,
  },
  counterTarget: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  counterLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.brand,
    borderRadius: 5,
  },
  remainingText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.brand,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textInverse,
  },
});
