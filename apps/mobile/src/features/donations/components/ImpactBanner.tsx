/**
 * ImpactBanner Component
 * Home screen banner showing community donation impact
 * Enterprise-grade with collapsible animation and error handling
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation } from 'react-native';

import HeartInHandsIcon from '../../../assets/images/RedHeartinHands IconMedicalCareLogo.svg';
import { useDonationStats } from '../hooks/useDonations';

import { SkeletonImpactBanner } from './SkeletonImpactBanner';
interface ImpactBannerProps {
  onExpand?: () => void;
}

/**
 * ✅ BEST PRACTICE: Internal component function for memoization
 * Extracted to enable React.memo() wrapping
 */
const ImpactBannerComponent: React.FC<ImpactBannerProps> = ({ onExpand }) => {
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
  const cause = stats.cause ?? 'Ensuring No One Goes Hungry';

  return (
    <View style={styles.container}>
      <Pressable style={styles.banner} onPress={toggleExpand}>
        {/* Collapsed View */}
        <View style={styles.collapsedContent}>
          <View style={styles.iconContainer}>
            <HeartInHandsIcon width={36} height={36} />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Your Orders Change Lives</Text>
            <Text style={styles.subtitle}>
              {contributorCount} contributors • {totalDonations.toFixed(2)} {currency} raised
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
                <Text style={styles.statLabel}>Total Raised:</Text>
                <Text style={styles.statValue}>
                  {totalDonations.toFixed(2)} {currency}
                </Text>
              </View>

              {/* Contributors */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Contributors:</Text>
                <Text style={styles.statValue}>{contributorCount.toLocaleString()} people</Text>
              </View>

              {/* Meals Funded */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Meals Funded:</Text>
                <Text style={styles.statValue}>{mealCount.toLocaleString()} meals</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <Text style={styles.progressLabel}>
                Next Milestone: {targetAmount} {currency}
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
              <Text style={styles.causeLabel}>Current Cause:</Text>
              <Text style={styles.causeText}>{cause}</Text>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
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
    marginRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  expandIcon: {
    fontSize: 16,
    color: '#005250',
    marginLeft: 8,
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginBottom: 16,
  },
  statsGrid: {
    marginBottom: 16,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#005250',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: '#005250',
    fontWeight: '600',
    textAlign: 'right',
  },
  causeContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  causeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  causeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
});

/**
 * ✅ BEST PRACTICE: Memoized export prevents unnecessary re-renders
 * Component only re-renders when props change (onExpand callback)
 * Internal state changes (isExpanded) don't trigger parent re-renders
 */
ImpactBannerComponent.displayName = 'ImpactBanner';
export const ImpactBanner = React.memo(ImpactBannerComponent);
