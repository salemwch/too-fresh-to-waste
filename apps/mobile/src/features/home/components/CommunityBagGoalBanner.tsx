/**
 * CommunityBagGoalBanner Component
 * Collapsible card showing community progress toward a bag-saving goal.
 * Receives real-time WebSocket updates via useCommunityBagGoal hook.
 *
 * Pattern: mirrors ImpactBanner.tsx (collapsible, React.memo, LayoutAnimation).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Animated,
  Easing,
} from 'react-native';
import SurpriseBoxIcon from '../../../assets/images/surprise-box.svg';
import { useCommunityBagGoal } from '../hooks/useCommunityBagGoal';
import { SkeletonCommunityBagGoal } from './SkeletonCommunityBagGoal';

interface CommunityBagGoalBannerProps {
  /** Callback to scroll HomeScreen FlatList to the offers section */
  onSaveABag?: () => void;
}

const PRIMARY = '#005250';
const PRIMARY_LIGHT = '#E0F2F1';

/**
 * Pulsing green dot for the LIVE badge
 */
const PulsingDot: React.FC = () => {
  const opacity = useRef(new Animated.Value(1)).current;

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

/**
 * Animated progress bar that smoothly transitions width.
 */
const ProgressBar: React.FC<{ percentage: number }> = ({ percentage }) => {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.min(percentage, 100),
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation requires JS driver
    }).start();
  }, [percentage, widthAnim]);

  const animatedWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressFill, { width: animatedWidth }]} />
    </View>
  );
};

const CommunityBagGoalBannerComponent: React.FC<CommunityBagGoalBannerProps> = ({
  onSaveABag,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: stats, isLoading, isError } = useCommunityBagGoal();

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  // Loading → skeleton
  if (isLoading || (!stats && !isError)) {
    return <SkeletonCommunityBagGoal />;
  }

  // Error or no data → hide
  if (isError || !stats) {
    return null;
  }

  const { currentCount, targetCount, progressPercentage, remaining } = stats;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.banner}
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityLabel={`Grand Prize unlocks at: ${currentCount.toLocaleString()} of ${targetCount.toLocaleString()} bags saved`}
        accessibilityHint="Tap to expand for details"
        testID="community-bag-goal-banner"
      >
        {/* ── Collapsed row ── */}
        <View style={styles.collapsedContent}>
          <View style={styles.iconContainer}>
            <SurpriseBoxIcon width={28} height={28} />
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

        {/* ── Expanded content ── */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            {/* Large counter */}
            <View style={styles.counterRow}>
              <Text style={styles.counterCurrent}>{currentCount.toLocaleString()}</Text>
              <Text style={styles.counterSeparator}> / </Text>
              <Text style={styles.counterTarget}>{targetCount.toLocaleString()}</Text>
            </View>
            <Text style={styles.counterLabel}>Bags Saved</Text>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <ProgressBar percentage={progressPercentage} />
              <Text style={styles.remainingText}>
                {remaining.toLocaleString()} remaining
              </Text>
            </View>

            {/* Save Food button */}
            {onSaveABag != null && (
              <Pressable
                style={styles.saveButton}
                onPress={onSaveABag}
                accessibilityRole="button"
                accessibilityLabel="Save Food"
                testID="community-goal-save-a-bag"
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
export const CommunityBagGoalBanner = React.memo(CommunityBagGoalBannerComponent);
;

// ============================================================================
// Styles
// ============================================================================

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

  // ── Collapsed ──
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
    color: '#1F2937',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_LIGHT,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  expandIcon: {
    fontSize: 16,
    color: PRIMARY,
    marginLeft: 8,
  },

  // ── Expanded ──
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
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
    color: PRIMARY,
  },
  counterSeparator: {
    fontSize: 20,
    color: '#9CA3AF',
  },
  counterTarget: {
    fontSize: 20,
    fontWeight: '500',
    color: '#6B7280',
  },
  counterLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },

  // ── Progress bar ──
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 5,
  },
  remainingText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'right',
  },

  // ── Save Food button ──
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
