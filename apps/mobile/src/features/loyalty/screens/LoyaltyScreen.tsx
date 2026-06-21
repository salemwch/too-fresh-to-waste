/**
 * LoyaltyScreen
 * Premium points & rewards screen composing all loyalty components.
 *
 * Data flow:
 *   useLoyalty → loyaltyService.getAccount + getGamification
 *   useLoginStreak → fire-and-forget login streak recording on mount
 */

import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import { BadgeScroll } from '../components/BadgeScroll';
import { HowYouEarnGrid } from '../components/HowYouEarnGrid';
import { ImpactStatsRow } from '../components/ImpactStatsRow';
import { PremiumPointsCard } from '../components/PremiumPointsCard';
import { RecentActivityList } from '../components/RecentActivityList';
import { SkeletonLoyaltyScreen } from '../components/SkeletonLoyaltyScreen';
import { StreakCard } from '../components/StreakCard';
import { useLoginStreak } from '../hooks/useLoginStreak';
import { useLoyalty } from '../hooks/useLoyalty';
import { ReferralBottomSheet } from '../components/ReferralBottomSheet';
import { VotingCard } from '../../voting/components/VotingCard';

export const LoyaltyScreen: React.FC = () => {
  const theme = useTheme();
  const { account, gamification, isLoading, isRefetching, error, refetch } = useLoyalty();

  // Fire-and-forget: record daily login streak
  useLoginStreak();

  const [referralSheetVisible, setReferralSheetVisible] = useState(false);

  const handleReferPress = useCallback(() => {
    setReferralSheetVisible(true);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Loading state
  if (isLoading && !account) {
    return <SkeletonLoyaltyScreen />;
  }

  // Error state
  if (error && !account) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: theme.colors.background }]}>
        <Icon name='alert-circle-outline' family='Ionicons' size={48} color={theme.colors.error} />
        <Text variant='body' size='md' color='secondary' style={styles.errorText}>
          {'Failed to load loyalty data'}
        </Text>
        <Text
          variant='body'
          size='sm'
          color='primary'
          style={styles.retryText}
          onPress={() => void refetch()}
        >
          Tap to retry
        </Text>
      </View>
    );
  }

  if (!account) return null;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void handleRefresh()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Hero Card */}
        <PremiumPointsCard
          availablePoints={account.availablePoints}
          lifetimePointsEarned={account.lifetimePointsEarned}
          currentTier={account.currentTier}
        />

        {/* Impact Stats — uses totalBagsSaved; falls back to totalOrdersCount for legacy accounts */}
        <ImpactStatsRow totalBagsSaved={account.totalBagsSaved || account.totalOrdersCount} />

        {/* Voting Card — shows only when an active cycle exists */}
        <VotingCard />

        {/* How You Earn */}
        <HowYouEarnGrid onReferPress={handleReferPress} />

        {/* Active Streaks */}
        {gamification && <StreakCard gamification={gamification} />}

        {/* Badges */}
        <BadgeScroll earnedBadges={account.badges} />

        {/* Recent Activity */}
        <RecentActivityList transactions={account.pointsHistory} />
      </ScrollView>
      <ReferralBottomSheet
        visible={referralSheetVisible}
        onClose={() => setReferralSheetVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    textAlign: 'center',
  },
  retryText: {
    marginTop: 8,
  },
});
