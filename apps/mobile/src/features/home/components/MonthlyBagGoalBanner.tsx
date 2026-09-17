import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Image } from 'react-native';

import { useMonthlyBagGoal } from '../hooks/useMonthlyBagGoal';
import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { SkeletonMonthlyBagGoal } from './SkeletonMonthlyBagGoal';
import { spacingTokens } from '@/design-system/tokens/spacing';
import {
  HERO_CARD_HEIGHT,
  HERO_CARD_ILLUSTRATION_HEIGHT,
  HERO_CARD_ILLUSTRATION_WIDTH,
  HERO_CARD_OUTER_PADDING_Y,
  HERO_CARD_PADDING,
  HERO_CARD_RADIUS,
} from '../utils/heroCard';

import boxCardImg from '../../../assets/images/box-card.webp';

const { base: sp } = spacingTokens;

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandDark: colorTokens.base.primary[700],
  green: '#4CAF50',
  white: '#FFFFFF',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: 'rgba(255,255,255,0.75)',
  progressTrack: 'rgba(255,255,255,0.15)',
  chevronBg: '#FFFFFF',
  shadow: '#000',
} as const;

const AnimatedProgressBar = ({
  percentage,
  color,
  trackColor,
}: {
  percentage: number;
  color: string;
  trackColor: string;
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
    <View style={[styles.progressTrack, { backgroundColor: trackColor }]}>
      <Animated.View
        style={[styles.progressFill, { width: animatedWidth, backgroundColor: color }]}
      />
    </View>
  );
};

export interface MonthlyBagGoalBannerProps {
  /**
   * Where the card goes. Required rather than optional: this used to be an
   * empty handler with a "navigate in the future" comment, while the card drew
   * a chevron and announced "Opens more details" to screen readers — so it
   * promised a destination and delivered nothing. Making the prop mandatory
   * means a caller cannot reintroduce that silently.
   */
  onPress: () => void;
}

const MonthlyBagGoalBannerComponent: React.FC<MonthlyBagGoalBannerProps> = ({ onPress }) => {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError } = useMonthlyBagGoal();

  const handlePress = useCallback(() => {
    onPress();
  }, [onPress]);

  if (isLoading || (stats === undefined && !isError)) {
    return <SkeletonMonthlyBagGoal />;
  }

  if (isError || stats === undefined) {
    return null;
  }

  const { currentCount, targetCount, progressPercentage } = stats;
  const seasonName = stats.seasonName ?? t('home.challengeDefault');

  /*
   * Fourth line, added so this card fills the same HERO_CARD_HEIGHT as the
   * impact card beside it. It is real data rather than filler: `remaining` is
   * the only number here that tells the user what THEY can still do.
   *
   * `remaining` can arrive negative once a goal is overshot (the backend keeps
   * counting bags past the target), so the completed copy is gated on <= 0,
   * not === 0. Both branches are one line, so the height holds either way.
   */
  const remainingBags = Math.max(0, stats.remaining ?? 0);
  const remainingLabel =
    remainingBags > 0 ? t('home.bagsToGo', { count: remainingBags }) : t('home.goalReached');

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={handlePress}
        accessibilityRole='button'
        accessibilityLabel={`${seasonName}: ${currentCount} / ${targetCount} - ${remainingLabel}`}
        accessibilityHint={t('common.a11yOpensDetailsHint')}
        testID='community-bag-goal-banner'
      >
        <Image
          source={boxCardImg}
          style={styles.illustration}
          accessibilityIgnoresInvertColors
          resizeMode='contain'
        />

        <View style={styles.textContent}>
          <Text style={styles.title} numberOfLines={1}>
            {seasonName} {'\u{1F389}'}
          </Text>

          <Text style={styles.progressText} numberOfLines={1}>
            <Text style={styles.progressCount}>{currentCount.toLocaleString()}</Text>
            <Text style={styles.progressTotal}>
              {' '}
              / {targetCount.toLocaleString()} {t('common.bags')}
            </Text>
          </Text>

          <AnimatedProgressBar
            percentage={progressPercentage}
            color={COLORS.green}
            trackColor={COLORS.progressTrack}
          />

          <Text style={styles.remainingText} numberOfLines={1}>
            {remainingLabel}
          </Text>
        </View>

        <View style={styles.chevronBtn}>
          {/* <Icon> mirrors directional glyphs itself - see Icon/rtlMirror.ts. */}
          <Icon name='chevron-forward' size={18} color={COLORS.brand} />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: HERO_CARD_OUTER_PADDING_Y,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand,
    borderRadius: HERO_CARD_RADIUS,
    padding: HERO_CARD_PADDING,
    // Fixed, and taken from the same constant as ImpactBanner. The two cards
    // are swiped between in one row, so any difference reads as a defect.
    height: HERO_CARD_HEIGHT,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  illustration: {
    // Same box as ImpactBanner's, so both text columns get the same width.
    width: HERO_CARD_ILLUSTRATION_WIDTH,
    height: HERO_CARD_ILLUSTRATION_HEIGHT,
    marginEnd: sp[3],
    marginStart: -4,
  },
  textContent: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.white,
    lineHeight: 22,
    marginBottom: 6,
  },
  progressText: {
    fontSize: 13,
    lineHeight: 18,
    // 6, not 8: the fourth line below the bar has to fit the same fixed height
    // the impact card uses. See `utils/heroCard.ts` for the line budget.
    marginBottom: 6,
  },
  progressCount: {
    fontWeight: '700',
    color: COLORS.green,
  },
  progressTotal: {
    fontWeight: '400',
    color: COLORS.textOnBrandMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  remainingText: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    color: COLORS.textOnBrandMuted,
  },
  chevronBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.chevronBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginStart: sp.sm,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
});

MonthlyBagGoalBannerComponent.displayName = 'MonthlyBagGoalBanner';
export const MonthlyBagGoalBanner = memo(MonthlyBagGoalBannerComponent);
