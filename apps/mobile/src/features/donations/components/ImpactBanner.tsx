/**
 * ImpactBanner Component
 * Home screen banner showing community donation impact
 * Enterprise-grade with collapsible animation and error handling
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
} from 'react-native';

import { useDonationStats } from '../hooks/useDonations';
interface ImpactBannerProps {
  onExpand?: () => void;
}

export const ImpactBanner: React.FC<ImpactBannerProps> = ({ onExpand }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: stats, isLoading, isError } = useDonationStats();

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
    if (!isExpanded && onExpand) {
      onExpand();
    }
  };

  // Don't render if there's an error or no data
  if (isError || (!isLoading && !stats)) {
    return null;
  }

  // Loading state
  if (isLoading || !stats) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='small' color='#10B981' />
          <Text style={styles.loadingText}>Loading impact stats...</Text>
        </View>
      </View>
    );
  }

  // Safe accessors with fallbacks for undefined values
  const totalDonations = stats.totalDonations ?? 0;
  const mealCount = stats.mealCount ?? 0;
  const contributorCount = stats.contributorCount ?? 0;
  const progressPercentage = stats.progressPercentage ?? 0;
  const targetAmount = stats.targetAmount ?? 0;
  const currency = stats.currency ?? 'TND';
  const cause = stats.cause ?? 'Community Support';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.banner} onPress={toggleExpand} activeOpacity={0.8}>
        {/* Collapsed View */}
        <View style={styles.collapsedContent}>
          <Text style={styles.icon}>🌍</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Our Community Impact</Text>
            <Text style={styles.subtitle}>
              {totalDonations.toFixed(0)} {currency} raised • {mealCount} meals
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

              {/* Meals Funded */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Meals Funded:</Text>
                <Text style={styles.statValue}>{mealCount} 🍽️</Text>
              </View>

              {/* Contributors */}
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Contributors:</Text>
                <Text style={styles.statValue}>{contributorCount.toLocaleString()} people</Text>
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
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  collapsedContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
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
    color: '#10B981',
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
    backgroundColor: '#10B981',
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: '#10B981',
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
