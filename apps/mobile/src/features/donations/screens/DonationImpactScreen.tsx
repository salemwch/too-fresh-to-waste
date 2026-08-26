import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, ScrollView } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { textAlignEnd } from '@/utils/rtl';

import { useDonationStats } from '../hooks/useDonations';

import type { DonationGoalCategory } from '@foodwaste/shared';
import { spacingTokens } from '@/design-system/tokens/spacing';

import { colorTokens } from '@/design-system/tokens/colors';

const { base: sp } = spacingTokens;

const CATEGORY_CONFIG: Record<
  DonationGoalCategory,
  { icon: string; label: string; color: string }
> = {
  TSHIRTS: { icon: 'shirt-outline', label: 'T-Shirts', color: '#E88D67' },
  PANTS: { icon: 'accessibility-outline', label: 'Pants', color: '#7B8CDE' },
  SHOES: { icon: 'footsteps-outline', label: 'Shoes', color: '#6BBF8A' },
  CHILDREN_STUDIES: { icon: 'book-outline', label: "Children's Studies", color: '#D4A259' },
  MEDICINE: { icon: 'medkit-outline', label: 'Medicine', color: '#E07B7B' },
};

const WHITE = '#FFFFFF';
const WHITE_90 = 'rgba(255,255,255,0.9)';
const WHITE_60 = 'rgba(255,255,255,0.6)';
const WHITE_20 = 'rgba(255,255,255,0.20)';

function CategoryRow({
  icon,
  label,
  color,
  percent,
  totalItems,
  targetCount,
  itemPrice,
  isActive,
}: {
  icon: string;
  label: string;
  color: string;
  percent: number;
  totalItems: number;
  targetCount: number;
  itemPrice: number;
  isActive: boolean;
}) {
  return (
    <View style={[styles.categoryRow, isActive && styles.categoryRowActive]}>
      <View style={[styles.categoryIcon, { backgroundColor: color }]}>
        <Icon name={icon} family='Ionicons' size={18} color={WHITE} />
      </View>
      <View style={styles.categoryInfo}>
        <View style={styles.categoryLabelRow}>
          <View style={styles.categoryNameRow}>
            <Text variant='body' size='sm' weight='semibold' style={styles.categoryLabel}>
              {label}
            </Text>
            {isActive && (
              <View style={styles.activePill}>
                <Text variant='body' size='xs' weight='bold' style={styles.activePillText}>
                  ACTIVE
                </Text>
              </View>
            )}
          </View>
          <Text variant='body' size='xs' style={styles.categoryCount}>
            {totalItems} / {targetCount} · {itemPrice} TND each
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(percent, 100)}%`, backgroundColor: color },
            ]}
          />
        </View>
        <Text variant='body' size='xs' style={styles.percentText}>
          {percent.toFixed(1)}%
        </Text>
      </View>
    </View>
  );
}

export const DonationImpactScreen: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { data: stats, isLoading } = useDonationStats();

  if (isLoading || !stats) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loadingContainer}>
          <Text variant='body' size='sm' color='secondary'>
            Loading impact data...
          </Text>
        </View>
      </View>
    );
  }

  const progress = stats.categoryProgress ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero banner */}
        <LinearGradient
          colors={['#E8756A', '#D4547A', '#B8488E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <Icon name='heart' family='Ionicons' size={32} color={WHITE_90} />
          <Text style={styles.heroTitle}>{t('donations.togetherWeGive')}</Text>
          <Text style={styles.heroSubtitle}>{t('donations.everyOrderContributes')}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalDonations.toFixed(2)}</Text>
              <Text style={styles.statLabel}>
                {t('donations.tndRaised', { currency: t('common.currency') })}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.mealCount}</Text>
              <Text style={styles.statLabel}>{t('donations.mealsFunded')}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.contributorCount}</Text>
              <Text style={styles.statLabel}>{t('donations.contributors')}</Text>
            </View>
          </View>

          {/* Overall progress */}
          <View style={styles.overallProgress}>
            <View style={styles.overallProgressHeader}>
              <Text style={styles.overallProgressLabel}>{t('donations.overallProgress')}</Text>
              <Text style={styles.overallProgressPercent}>
                {stats.progressPercentage.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.overallProgressTrack}>
              <View
                style={[
                  styles.overallProgressFill,
                  { width: `${Math.min(stats.progressPercentage, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.overallProgressSub}>
              {t('donations.goalProgress', {
                current: stats.totalDonations.toFixed(2),
                target: stats.targetAmount,
                currency: t('common.currency'),
              })}
            </Text>
          </View>
        </LinearGradient>

        {/* Categories section */}
        <View style={styles.categoriesSection}>
          <Text
            variant='title'
            size='md'
            weight='semibold'
            style={[styles.headerTitleSpacing, { color: theme.colors.onBackground }]}
          >
            {t('donations.donationCategories')}
          </Text>
          <Text
            variant='body'
            size='xs'
            style={[styles.headerSubtitleSpacing, { color: theme.colors.onSurfaceVariant }]}
          >
            {t('donations.fundsAllocated')}
          </Text>

          <View style={styles.categoriesList}>
            {Object.entries(CATEGORY_CONFIG).map(([key, config]) => {
              const snap = progress.find(p => p.category === key);
              return (
                <CategoryRow
                  key={key}
                  icon={config.icon}
                  label={config.label}
                  color={config.color}
                  percent={snap?.percent ?? 0}
                  totalItems={snap?.totalItems ?? 0}
                  targetCount={snap?.targetCount ?? 0}
                  itemPrice={snap?.itemPrice ?? 0}
                  isActive={stats.activeGoalCategory === key}
                />
              );
            })}
          </View>
        </View>

        {/* Cause card */}
        <View style={[styles.causeCard, { backgroundColor: theme.colors.surfaceVariant }]}>
          <Icon
            name='ribbon-outline'
            family='Ionicons'
            size={20}
            color={theme.colors.onSurfaceVariant}
          />
          <View style={styles.causeTextContainer}>
            <Text variant='body' size='xs' color='secondary'>
              Current Campaign
            </Text>
            <Text variant='body' size='sm' weight='semibold'>
              {stats.cause}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  headerSubtitleSpacing: { marginBottom: 16 },
  headerTitleSpacing: { marginBottom: 4 },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBanner: {
    paddingHorizontal: sp[5],
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: WHITE,
    marginTop: sp[3],
    lineHeight: 32,
  },
  heroSubtitle: {
    fontSize: 14,
    color: WHITE_60,
    marginTop: 4,
    marginBottom: sp[5],
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: sp[5],
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: WHITE,
  },
  statLabel: {
    fontSize: 11,
    color: WHITE_60,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: WHITE_20,
  },
  overallProgress: {
    width: '100%',
    backgroundColor: WHITE_20,
    borderRadius: 12,
    padding: 14,
  },
  overallProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  overallProgressLabel: {
    fontSize: 12,
    color: WHITE_90,
    fontWeight: '600',
  },
  overallProgressPercent: {
    fontSize: 12,
    color: WHITE,
    fontWeight: '700',
  },
  overallProgressTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    backgroundColor: WHITE,
    borderRadius: 4,
  },
  overallProgressSub: {
    fontSize: 11,
    color: WHITE_60,
    marginTop: 6,
    textAlign: textAlignEnd(),
  },
  categoriesSection: {
    padding: 16,
  },
  categoriesList: {
    gap: sp[3],
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    padding: sp[3],
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  categoryRowActive: {
    backgroundColor: 'rgba(232,117,106,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232,117,106,0.2)',
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryLabel: {
    color: colorTokens.base.neutral[900],
  },
  activePill: {
    backgroundColor: '#E8756A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activePillText: {
    color: WHITE,
    fontSize: 9,
  },
  categoryCount: {
    color: colorTokens.base.neutral[700],
  },
  progressTrack: {
    height: 6,
    backgroundColor: colorTokens.base.neutral[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentText: {
    color: colorTokens.base.neutral[700],
    marginTop: 3,
    textAlign: textAlignEnd(),
  },
  causeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp[3],
    marginHorizontal: 16,
    padding: 14,
    borderRadius: 12,
  },
  causeTextContainer: {
    flex: 1,
  },
});
