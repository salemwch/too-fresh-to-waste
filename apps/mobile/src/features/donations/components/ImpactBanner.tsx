import React, { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Image, I18nManager } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { useDonationStats } from '../hooks/useDonations';
import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';
import { mirrorIconName } from '@/design-system/components/atoms/Icon/rtlMirror';
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
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.card}
        >
          <Image
            source={saveLivesImg}
            style={styles.illustration}
            accessibilityIgnoresInvertColors
            resizeMode='cover'
          />

          <View style={styles.textContent}>
            <Text style={styles.title}>
              {t('home.impactTitle')} {'\u{1F49A}'}
            </Text>
            <Text style={styles.amountLine}>
              <Text style={styles.amount}>
                {totalDonations.toFixed(2)} {currency}
              </Text>
              <Text style={styles.amountSuffix}> {t('home.raisedSoFar')}</Text>
            </Text>
            <Text style={styles.contributorLine}>
              {t('home.contributorCount', { count: contributorCount })} {'·'}{' '}
              <Text style={styles.cta}>{t('home.beTheNext')}</Text>
            </Text>
          </View>

          <View style={styles.chevronBtn}>
            <Icon
              name={mirrorIconName('chevron-forward', I18nManager.isRTL) as 'chevron-forward'}
              size={18}
              color={COLORS.textPrimary}
            />
          </View>
        </LinearGradient>
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
    borderRadius: 16,
    padding: sp.md,
    // Height reduced 120 -> 96 on 2026-09-14; width is untouched.
    minHeight: 96,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  illustration: {
    width: 90,
    height: 62,
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
  cta: {
    color: COLORS.success,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
