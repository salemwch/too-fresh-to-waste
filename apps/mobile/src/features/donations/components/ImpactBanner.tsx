/**
 * ImpactBanner Component
 * Home screen banner showing community donation impact
 * Enterprise-grade with collapsible animation and error handling
 */

import React, { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Image } from 'react-native';

import { useDonationStats } from '../hooks/useDonations';

import { colorTokens } from '@/design-system/tokens/colors';

import { textAlignEnd } from '@/utils/rtl';

import { SkeletonImpactBanner } from './SkeletonImpactBanner';
import heartInHandsImg from '../../../assets/images/heart-in-hands.png';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;
interface ImpactBannerProps {
  onExpand?: () => void;
}

const COLORS = {
  background: '#FFFFFF',
  shadow: '#000',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  brand: colorTokens.base.primary[500],
  border: '#E5E7EB',
  surfaceMuted: '#F3F4F6',
} as const;

/**
 * ✅ BEST PRACTICE: Internal component function for memoization
 * Extracted to enable React.memo() wrapping
 */
const ImpactBannerComponent: React.FC<ImpactBannerProps> = ({ onExpand }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: stats, isLoading, isError } = useDonationStats();

  // ✅ BEST PRACTICE: Memoize callback to prevent unnecessary re-renders
  const toggleExpand = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(prev => !prev);
    if (!isExpanded && onExpand) {
      onExpand();
    }
  }, [isExpanded, onExpand]);

  // Don't render if there's an error or no data
  if (isError || (!isLoading && !stats)) {
    return null;
  }

  // Loading state - Show skeleton in collapsed state
  if (isLoading || !stats) {
    return <SkeletonImpactBanner />;
  }

  // Safe accessors with fallbacks for undefined values
  const totalDonations = stats.totalDonations ?? 0;
  const contributorCount = stats.contributorCount ?? 0;
  const mealCount = stats.mealCount ?? 0;
  const progressPercentage = stats.progressPercentage ?? 0;
  const targetAmount = stats.targetAmount ?? 0;
  const currency = stats.currency ?? 'TND';
  const cause = stats.cause ?? t('home.defaultCause');

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole='button' style={styles.banner} onPress={toggleExpand}>
        {/* Collapsed View */}
        <View style={styles.collapsedContent}>
          <View style={styles.iconContainer}>
            <Image source={heartInHandsImg} style={styles.icon} accessibilityIgnoresInvertColors />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>{t('home.impactTitle')}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {t('home.impactSubtitle', {
                contributors: contributorCount,
                amount: totalDonations.toFixed(2),
                currency,
              })}
            </Text>
          </View>
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        </View>

        {/* Expanded View */}
        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />

            {/* Stats Grid */}
            <View style={styles.statsGrid}>
              {/* Total Raised */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('home.totalRaised')}</Text>
                <Text style={styles.statValue}>
                  {totalDonations.toFixed(2)} {currency}
                </Text>
              </View>

              {/* Contributors */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('home.contributors')}</Text>
                <Text style={styles.statValue}>
                  {t('home.peopleCount', { count: contributorCount })}
                </Text>
              </View>

              {/* Meals Funded */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('home.mealsFunded')}</Text>
                <Text style={styles.statValue}>{t('home.mealsCount', { count: mealCount })}</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>
                {t('home.nextMilestone', { amount: targetAmount, currency })}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${Math.min(progressPercentage, 100)}%` }]}
                />
              </View>
              <Text style={styles.progressPercent}>{progressPercentage.toFixed(0)}%</Text>
            </View>

            {/* Cause */}
            <View style={styles.causeContainer}>
              <Text style={styles.causeLabel}>{t('home.currentCause')}</Text>
              <Text style={styles.causeText} numberOfLines={2}>
                {cause}
              </Text>
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  banner: {
    backgroundColor: COLORS.background,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    marginEnd: sp[3],
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    width: 28,
    height: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  expandIcon: {
    fontSize: 16,
    color: COLORS.brand,
    marginStart: 8,
  },
  expandedContent: {
    marginTop: sp[3],
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  statsGrid: {
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp[3],
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.brand,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: COLORS.brand,
    fontWeight: '600',
    textAlign: textAlignEnd(),
  },
  causeContainer: {
    backgroundColor: COLORS.surfaceMuted,
    borderRadius: 8,
    padding: sp[3],
  },
  causeLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  causeText: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textPrimary,
  },
});

/**
 * ✅ BEST PRACTICE: Memoized export prevents unnecessary re-renders
 * Component only re-renders when props change (onExpand callback)
 * Internal state changes (isExpanded) don't trigger parent re-renders
 */
ImpactBannerComponent.displayName = 'ImpactBanner';
export const ImpactBanner = memo(ImpactBannerComponent);
