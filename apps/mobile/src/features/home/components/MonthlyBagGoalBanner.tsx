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

import { useMonthlyBagGoal } from '../hooks/useMonthlyBagGoal';

import { colorTokens } from '@/design-system/tokens/colors';

import { SkeletonMonthlyBagGoal } from './SkeletonMonthlyBagGoal';
import surpriseBoxImg from '../../../assets/images/surprise-box.png';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandDark: colorTokens.base.primary[700],
  amber: colorTokens.base.secondary[500],
  green: '#4ADE80',
  white: '#FFFFFF',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: 'rgba(255,255,255,0.4)',
  textOnBrandSoft: 'rgba(255,255,255,0.8)',
  textOnBrandDim: 'rgba(255,255,255,0.35)',
  brandSurface: 'rgba(255,255,255,0.15)',
  progressTrackPrize: 'rgba(255,255,255,0.10)',
  progressTrackChallenge: 'rgba(255,255,255,0.08)',
  challengeSurface: 'rgba(255,255,255,0.06)',
  challengeBorder: 'rgba(255,255,255,0.06)',
} as const;

const AnimatedProgressBar = ({
  percentage,
  color,
  trackColor,
  height = 4,
}: {
  percentage: number;
  color: string;
  trackColor: string;
  height?: number;
}) => {
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
    <View style={[styles.progressTrack, { backgroundColor: trackColor, height }]}>
      <Animated.View
        style={[styles.progressFill, { width: animatedWidth, backgroundColor: color }]}
      />
    </View>
  );
};

const MonthlyBagGoalBannerComponent = () => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: stats, isLoading, isError } = useMonthlyBagGoal();

  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
  }, []);

  if (isLoading || (stats === undefined && !isError)) {
    return <SkeletonMonthlyBagGoal />;
  }

  if (isError || stats === undefined) {
    return null;
  }

  const { currentCount, targetCount, progressPercentage } = stats;
  const seasonName = stats.seasonName ?? t('home.challengeDefault');

  const daysLeft = stats.endDate
    ? Math.max(0, Math.ceil((new Date(stats.endDate).getTime() - Date.now()) / 86_400_000))
    : null;

  const daysLeftPercentage = stats.endDate
    ? Math.max(0, Math.min(100, 100 - ((daysLeft ?? 0) / 180) * 100))
    : 0;

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={toggleExpand}
        accessibilityRole='button'
        accessibilityLabel={`${seasonName}: ${t('home.challengeProgress', { current: currentCount.toLocaleString(), target: targetCount.toLocaleString() })}`}
        accessibilityHint={t('home.expandDetails')}
        testID='community-bag-goal-banner'
      >
        {/* ── Collapsed: compact summary row ── */}
        <View style={styles.collapsedRow}>
          <View style={styles.iconContainer}>
            <Image source={surpriseBoxImg} style={styles.icon} accessibilityIgnoresInvertColors />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.collapsedTitle} numberOfLines={1}>
              {seasonName}
            </Text>
            <Text style={styles.collapsedSubtitle} numberOfLines={1}>
              {t('home.challengeProgress', {
                current: currentCount.toLocaleString(),
                target: targetCount.toLocaleString(),
              })}
            </Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </View>

        {/* ── Expanded: full Design B layout ── */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            {/* Prize Drop Hero */}
            {daysLeft !== null && (
              <View style={styles.prizeSection}>
                <View style={styles.eyebrow}>
                  <View style={styles.eyebrowDot} />
                  <Text style={styles.eyebrowText}>{t('home.prizeDropLabel')}</Text>
                </View>

                <View style={styles.heroRow}>
                  <Text style={styles.heroNumber}>{daysLeft}</Text>
                  <Text style={styles.heroUnit}>{t('home.daysRemaining')}</Text>
                </View>

                <Text style={styles.heroSubtitle}>{t('home.prizeDropSubtitle')}</Text>

                <AnimatedProgressBar
                  percentage={daysLeftPercentage}
                  color={COLORS.amber}
                  trackColor={COLORS.progressTrackPrize}
                />
              </View>
            )}

            {/* Monthly Challenge Panel */}
            <View style={styles.challengePanel}>
              <View style={styles.challengeTop}>
                <Text style={styles.challengeName} numberOfLines={1}>
                  {seasonName}
                </Text>
                <Text style={styles.challengeCount}>
                  {currentCount.toLocaleString()}
                  <Text style={styles.challengeCountMuted}> / {targetCount.toLocaleString()}</Text>
                </Text>
              </View>

              <AnimatedProgressBar
                percentage={progressPercentage}
                color={COLORS.green}
                trackColor={COLORS.progressTrackChallenge}
                height={6}
              />

              <Text style={styles.rewardText}>
                {t('home.rewardCalloutNoPrize').replace('⚡ ', '')}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
};

MonthlyBagGoalBannerComponent.displayName = 'MonthlyBagGoalBanner';
export const MonthlyBagGoalBanner = memo(MonthlyBagGoalBannerComponent);

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

  // ── Collapsed row ──
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginEnd: sp[3],
  },
  icon: {
    width: 28,
    height: 28,
  },
  textContainer: {
    flex: 1,
  },
  collapsedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textOnBrand,
    marginBottom: 2,
  },
  collapsedSubtitle: {
    fontSize: 13,
    color: COLORS.textOnBrandMuted,
  },
  expandIcon: {
    fontSize: 16,
    color: COLORS.textOnBrandMuted,
    marginStart: 8,
  },

  // ── Expanded content ──
  expandedContent: {
    marginTop: sp[3],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.brandSurface,
    marginBottom: 16,
  },

  // ── Prize Drop ──
  prizeSection: {
    marginBottom: 24,
  },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: sp[3],
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.amber,
  },
  eyebrowText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.amber,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroNumber: {
    fontSize: 52,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -3,
    lineHeight: 52,
  },
  heroUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textOnBrandMuted,
    paddingBottom: 8,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textOnBrandDim,
    marginBottom: 14,
  },

  // ── Progress bars ──
  progressTrack: {
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // ── Challenge Panel ──
  challengePanel: {
    padding: 16,
    backgroundColor: COLORS.challengeSurface,
    borderWidth: 1,
    borderColor: COLORS.challengeBorder,
    borderRadius: 12,
  },
  challengeTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: sp[3],
  },
  challengeName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textOnBrandSoft,
  },
  challengeCount: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
    marginStart: 8,
  },
  challengeCountMuted: {
    fontWeight: '500',
    color: COLORS.textOnBrandDim,
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textOnBrandDim,
    marginTop: 8,
  },
});
