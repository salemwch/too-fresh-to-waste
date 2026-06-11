/**
 * CommunityBagGoalBanner Component
 * Collapsible card showing community progress toward a bag-saving goal.
 */

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  brandLight: colorTokens.base.primary[400],
  brandDark: colorTokens.base.primary[700],
  brandSurface: 'rgba(255,255,255,0.15)',
  brandSurfaceSolid: 'rgba(255,255,255,0.20)',
  surface: '#FFFFFF',
  shadow: '#000',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: 'rgba(255,255,255,0.75)',
  progressTrack: 'rgba(255,255,255,0.25)',
  progressFill: '#4ADE80',
  chipBg: 'rgba(255,255,255,0.18)',
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
  const { t } = useTranslation();
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
  const seasonName = stats.seasonName ?? t('home.challengeDefault');
  const rewardPoints = stats.rewardPoints ?? 0;
  const participantCount = stats.participantCount ?? 0;

  const daysLeft = stats.endDate
    ? Math.max(0, Math.ceil((new Date(stats.endDate).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.banner}
        onPress={toggleExpand}
        accessibilityRole='button'
        accessibilityLabel={`${seasonName}: ${currentCount} of ${targetCount} bags`}
        accessibilityHint={t('home.expandDetails')}
        testID='community-bag-goal-banner'
      >
        <View style={styles.collapsedContent}>
          <View style={styles.iconContainer}>
            <Image source={surpriseBoxImg} style={{ width: 28, height: 28 }} />
          </View>

          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>{seasonName}</Text>
              <View style={styles.liveBadge}>
                <PulsingDot />
                <Text style={styles.liveText}>{t('home.live')}</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              {t('home.challengeProgress', {
                current: currentCount.toLocaleString(),
                target: targetCount.toLocaleString(),
              })}
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
            <Text style={styles.counterLabel}>{t('home.bagsSavedLabel')}</Text>

            <View style={styles.progressContainer}>
              <ProgressBar percentage={progressPercentage} />
              <Text style={styles.remainingText}>
                {t('home.remainingCount', { count: remaining })}
              </Text>
            </View>

            <View style={styles.chipRow}>
              {rewardPoints > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {t('home.challengeReward', { points: rewardPoints })}
                  </Text>
                </View>
              )}
              {participantCount > 0 && (
                <View style={styles.chip}>
                  <Text style={styles.chipText}>
                    {t('home.challengeParticipants', { count: participantCount })}
                  </Text>
                </View>
              )}
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {daysLeft !== null
                    ? t('home.challengeDaysLeft', { count: daysLeft })
                    : t('home.challengeNoDeadline')}
                </Text>
              </View>
            </View>

            {onSaveABag != null && (
              <Pressable
                style={styles.saveButton}
                onPress={onSaveABag}
                accessibilityRole='button'
                accessibilityLabel={t('home.saveFood')}
                testID='community-goal-save-a-bag'
              >
                <Text style={styles.saveButtonText}>{t('home.saveFood')}</Text>
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
    backgroundColor: COLORS.brand,
    borderRadius: 20,
    padding: 16,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.brandSurface,
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
    fontWeight: '700',
    color: COLORS.textOnBrand,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brandSurfaceSolid,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.progressFill,
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textOnBrand,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textOnBrandMuted,
  },
  expandIcon: {
    fontSize: 16,
    color: COLORS.textOnBrandMuted,
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.brandSurface,
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
    color: COLORS.textOnBrand,
  },
  counterSeparator: {
    fontSize: 20,
    color: COLORS.textOnBrandMuted,
  },
  counterTarget: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.textOnBrandMuted,
  },
  counterLabel: {
    textAlign: 'center',
    fontSize: 14,
    color: COLORS.textOnBrandMuted,
    marginBottom: 16,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    height: 10,
    backgroundColor: COLORS.progressTrack,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.progressFill,
    borderRadius: 5,
  },
  remainingText: {
    fontSize: 12,
    color: COLORS.textOnBrandMuted,
    textAlign: 'right',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    backgroundColor: COLORS.chipBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textOnBrand,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.brand,
  },
});
