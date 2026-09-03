import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
  Image,
  I18nManager,
} from 'react-native';

import { useMonthlyBagGoal } from '../hooks/useMonthlyBagGoal';
import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { mirrorIconName } from '@/design-system/components/atoms/Icon/rtlMirror';
import { SkeletonMonthlyBagGoal } from './SkeletonMonthlyBagGoal';
import { spacingTokens } from '@/design-system/tokens/spacing';

import boxCardImg from '../../../assets/images/box-card.webp';

const { base: sp } = spacingTokens;

const COLORS = {
  brand: colorTokens.base.primary[500],
  brandDark: colorTokens.base.primary[700],
  green: '#4CAF50',
  white: '#FFFFFF',
  textOnBrand: '#FFFFFF',
  textOnBrandMuted: 'rgba(255,255,255,0.75)',
  liveBadgeBg: 'rgba(255,255,255,0.12)',
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

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.card}
        onPress={handlePress}
        accessibilityRole='button'
        accessibilityLabel={`${seasonName}: ${currentCount} / ${targetCount}`}
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
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{t('home.prizeDropLabel')}</Text>
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {seasonName} {'\u{1F389}'}
          </Text>

          <Text style={styles.progressText}>
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
        </View>

        <View style={styles.chevronBtn}>
          <Icon
            name={mirrorIconName('chevron-forward', I18nManager.isRTL) as 'chevron-forward'}
            size={18}
            color={COLORS.brand}
          />
        </View>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.brand,
    borderRadius: 16,
    padding: sp.md,
    minHeight: 130,
    shadowColor: COLORS.brandDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  illustration: {
    width: 90,
    height: 90,
    marginEnd: sp[3],
    marginStart: -4,
  },
  textContent: {
    flex: 1,
    minWidth: 0,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.liveBadgeBg,
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.green,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: COLORS.white,
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
    marginBottom: 8,
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
