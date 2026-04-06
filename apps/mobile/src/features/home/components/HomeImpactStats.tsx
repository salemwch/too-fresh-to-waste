/**
 * HomeImpactStats Component
 * User impact statistics display (meals saved, money saved, CO2 reduced)
 *
 * Responsibilities:
 * - Display user impact metrics from backend API
 * - Show loading skeleton during data fetch
 * - Hide section if user has no impact yet
 * - Calculate CO2 reduction from meals saved
 * - Accessibility for stats
 *
 * Features:
 * - Real-time data from donations API
 * - Automatic hiding for new users (no impact yet)
 * - CO2 calculation: 2.5kg per meal saved (industry standard)
 * - Loading state with skeleton UI
 */

import { memo, useMemo } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';

import { Text, Card } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useUserDonationStats } from '@/features/donations/hooks/useDonations';

import type { RootState } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/**
 * CO2 reduction per meal saved (in kg)
 * Industry standard: Each meal saved prevents 2.5kg CO2 emissions
 * Source: https://www.wrap.org.uk/resources/report/food-surplus-and-waste-uk-key-facts
 */
const CO2_PER_MEAL_KG = 2.5;

// ============================================================================
// Types
// ============================================================================

/**
 * Processed impact stats for display
 */
interface ImpactStats {
  mealsSaved: number;
  moneySaved: number;
  co2Reduced: number;
  currency: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * HomeImpactStats Component
 *
 * Features:
 * - Displays 3 metrics: meals saved, money saved, CO2 reduced
 * - Real-time data from donations API
 * - Accessibility support with proper labels
 * - Color-coded metrics (primary, success, warning)
 * - Loading skeleton during data fetch
 * - Automatic hiding for users with no impact
 *
 * Performance:
 * - Memoized with React.memo
 * - Cached API data (5min staleTime via TanStack Query)
 * - Only renders if user is authenticated
 *
 * @example
 * ```typescript
 * <HomeImpactStats userId={userId} />
 * ```
 */
const HomeImpactStatsComponent = () => {
  const theme = useTheme();
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  // ============================================================================
  // Data Fetching
  // ============================================================================

  /**
   * Fetch user donation stats from backend
   * Only enabled if user is authenticated
   */
  const { data: donationStats, isLoading, error } = useUserDonationStats(isAuthenticated);

  // ============================================================================
  // Computed Stats
  // ============================================================================

  /**
   * Calculate display stats from backend data
   * - Meals saved: direct from backend (mealsContributed)
   * - Money saved: direct from backend (totalDonated)
   * - CO2 reduced: calculated (meals * 2.5kg per meal)
   */
  const stats = useMemo<ImpactStats | null>(() => {
    if (!donationStats) return null;

    const mealsSaved = donationStats.mealsContributed || 0;
    const moneySaved = donationStats.totalDonated || 0;
    const co2Reduced = Math.round(mealsSaved * CO2_PER_MEAL_KG * 10) / 10; // Round to 1 decimal

    return {
      mealsSaved,
      moneySaved,
      co2Reduced,
      currency: donationStats.currency || 'TND',
    };
  }, [donationStats]);

  // ============================================================================
  // Early Returns
  // ============================================================================

  // Don't show for unauthenticated users
  if (!isAuthenticated) {
    return null;
  }

  // Show loading skeleton
  if (isLoading) {
    return (
      <Card style={styles.impactCard} testID='impact-stats-card-loading'>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={theme.colors.primary} />
          <Text variant='body' size='sm' color='secondary' style={styles.loadingText}>
            Loading your impact...
          </Text>
        </View>
      </Card>
    );
  }

  // Hide on error or no data
  if (error || !stats) {
    return null;
  }

  // Hide if user has no impact yet (new user)
  if (stats.mealsSaved === 0 && stats.moneySaved === 0) {
    return null;
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card style={styles.impactCard} testID='impact-stats-card'>
      {/* Section Title */}
      <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
        Your Impact
      </Text>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Meals Saved */}
        <View
          style={styles.statItem}
          accessibilityLabel={`Meals saved: ${stats.mealsSaved}`}
          accessibilityHint='Total number of meals you have contributed through donations'
        >
          <Text variant='headline' size='lg' weight='bold' color='primary'>
            {stats.mealsSaved.toLocaleString()}
          </Text>
          <Text variant='body' size='sm' color='secondary'>
            Meals Saved
          </Text>
        </View>

        {/* Money Donated */}
        <View
          style={styles.statItem}
          accessibilityLabel={`Money donated: ${stats.moneySaved} ${stats.currency}`}
          accessibilityHint='Total amount you have donated to support meals'
        >
          <Text variant='headline' size='lg' weight='bold' color='success'>
            {stats.moneySaved.toLocaleString()} {stats.currency}
          </Text>
          <Text variant='body' size='sm' color='secondary'>
            Donated
          </Text>
        </View>

        {/* CO2 Reduced */}
        <View
          style={styles.statItem}
          accessibilityLabel={`CO2 reduced: ${stats.co2Reduced} kilograms`}
          accessibilityHint='Carbon dioxide emissions prevented by your contributions'
        >
          <Text variant='headline' size='lg' weight='bold' style={{ color: theme.colors.warning }}>
            {stats.co2Reduced.toLocaleString()}kg
          </Text>
          <Text variant='body' size='sm' color='secondary'>
            CO₂ Reduced
          </Text>
        </View>
      </View>
    </Card>
  );
};

HomeImpactStatsComponent.displayName = 'HomeImpactStats';

export const HomeImpactStats = memo(HomeImpactStatsComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  impactCard: {
    padding: 20,
    marginHorizontal: 10,
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 12,
  },
});
