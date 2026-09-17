import React, { memo, useCallback } from 'react';
import { readingGradient } from '@/utils/rtl';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useDonationStats } from '../hooks/useDonations';
import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import {
  HERO_CARD_HEIGHT,
  HERO_CARD_ILLUSTRATION_HEIGHT,
  HERO_CARD_ILLUSTRATION_WIDTH,
  HERO_CARD_OUTER_PADDING_Y,
  HERO_CARD_PADDING,
  HERO_CARD_RADIUS,
} from '@/features/home/utils/heroCard';
import { SkeletonImpactBanner } from './SkeletonImpactBanner';

import saveLivesImg from '../../../assets/images/save-lives.webp';

const { base: sp } = spacingTokens;

const COLORS = {
  gradientStart: '#F7F2EA',
  gradientEnd: '#E8F4E0',
  textPrimary: colorTokens.base.primary[500],
  textSecondary: colorTokens.base.neutral[700],
  success: '#2E7D32',
  chevronBg: '#FFFFFF',
  shadow: '#000',
} as const;

interface ImpactBannerProps {
  onExpand?: () => void;
}

const ImpactBannerComponent: React.FC<ImpactBannerProps> = ({ onExpand }) => {
  const { t } = useTranslation();
  const { data: stats, isLoading, isError } = useDonationStats();

  const handlePress = useCallback(() => {
    onExpand?.();
  }, [onExpand]);

  if (isError || (!isLoading && !stats)) {
    return null;
  }

  if (isLoading || !stats) {
    return <SkeletonImpactBanner />;
  }

  const totalDonations = stats.totalDonations ?? 0;
  const contributorCount = stats.contributorCount ?? 0;
  const currency = stats.currency ?? 'TND';

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole='button'
        accessibilityLabel={t('home.impactTitle')}
        accessibilityHint={t('common.a11yOpensDetailsHint')}
        onPress={handlePress}
      >
        <LinearGradient
          colors={[COLORS.gradientStart, COLORS.gradientEnd]}
          start={readingGradient(0.5, 0.5).start}
          end={readingGradient(0.5, 0.5).end}
          style={styles.card}
          testID='impact-banner-card'
        >
          <Image
            source={saveLivesImg}
            style={styles.illustration}
            accessibilityIgnoresInvertColors
            resizeMode='cover'
          />

          {/*
            Every line is capped: the card is a fixed HERO_CARD_HEIGHT so it
            matches the prize card beside it, and uncapped copy would overflow
            that box rather than grow it. See `utils/heroCard.ts`.

            The 💚 that used to close the title is gone with the cap - the title
            is the one run that legitimately needs two lines, and the emoji
            pushed French onto a third. The hearts illustration beside it
            already carries that note.
          */}
          <View style={styles.textContent}>
            <Text style={styles.title} numberOfLines={2}>
              {t('home.impactTitle')}
            </Text>
            <Text style={styles.amountLine} numberOfLines={1}>
              <Text style={styles.amount}>
                {totalDonations.toFixed(2)} {currency}
              </Text>
              <Text style={styles.amountSuffix}> {t('home.raisedSoFar')}</Text>
            </Text>
            <Text style={styles.contributorLine} numberOfLines={1}>
              {t('home.contributorCount', { count: contributorCount })}
            </Text>
          </View>

          <View style={styles.chevronBtn}>
            {/* <Icon> mirrors directional glyphs itself - see Icon/rtlMirror.ts. */}
            <Icon name='chevron-forward' size={18} color={COLORS.textPrimary} />
          </View>
        </LinearGradient>
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
    borderRadius: HERO_CARD_RADIUS,
    padding: HERO_CARD_PADDING,
    // Fixed, not minHeight: this card and MonthlyBagGoalBanner are swiped
    // between in one row, so any difference reads as a defect. Both take the
    // height from the same constant - change it there, never here.
    height: HERO_CARD_HEIGHT,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  illustration: {
    // Narrowed 90 -> 72: the text column was 120dp wide, which wrapped the
    // amount onto a second line. The illustration is decorative; the amount is
    // the one number this card exists to show.
    width: HERO_CARD_ILLUSTRATION_WIDTH,
    height: HERO_CARD_ILLUSTRATION_HEIGHT,
    borderRadius: 8,
    marginEnd: sp[3],
  },
  textContent: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 4,
  },
  amountLine: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  amount: {
    fontWeight: '700',
    color: COLORS.success,
  },
  amountSuffix: {
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
  contributorLine: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
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
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
});

ImpactBannerComponent.displayName = 'ImpactBanner';
export const ImpactBanner = memo(ImpactBannerComponent);
