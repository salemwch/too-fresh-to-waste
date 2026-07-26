/**
 * LeaderboardScreen — Grand Prize Community Challenge
 *
 * Layout (dark premium theme):
 *  Block 1: "Grand Prize" header + countdown timer (days:hrs:mins:secs)
 *  Block 2: Prize cards (Smartphone / Discount) with "winning" indicator
 *  Block 3: Top 5 podium (order: 5, 3, 1, 2, 4 — natural rise-and-fall)
 *  Block 4: Clean ranked list
 */

import { FlashList, type ViewToken } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';

import { SkeletonLeaderboardScreen } from '../components/SkeletonLeaderboardScreen';

import { Icon } from '@/design-system/components/atoms';
import { useCommunityBagGoal } from '@/features/home/hooks/useCommunityBagGoal';
import { useUserProfile } from '@/hooks/useUserProfile';

import { DiscountClaimModal } from '../components/DiscountClaimModal';
import { FloatingPositionBar } from '../components/FloatingPositionBar';
import { NeighborhoodSection } from '../components/NeighborhoodSection';
import { PrivacyConsentModal } from '../components/PrivacyConsentModal';
import { WinnerCelebrationModal } from '../components/WinnerCelebrationModal';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { ChallengeHeader } from '../components/ChallengeHeader';
import { PodiumTop5 } from '../components/PodiumTop5';
import { PrizeTierCards } from '../components/PrizeTierCards';
import { PrizeInfoModal } from '../components/PrizeInfoModal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNeighborhood } from '../hooks/useNeighborhood';
import { usePrizeClaimStatus, useClaimSmartphone, useClaimDiscount } from '../hooks/usePrizeClaim';
import {
  BG_DARK,
  CHAMPION_GOLD,
  GOLD_06,
  GOLD_15,
  TEXT_25,
  TEXT_40,
  TEXT_85,
} from '../constants/palette';
import { getRowTier } from '../utils/prizeTiers';

import type { LeaderboardEntry } from '../types/leaderboard.types';
import type { MainStackNavigationProp } from '@/navigation/types';

// ─── Main screen ─────────────────────────────────────────────────────────────
interface Props {
  navigation: MainStackNavigationProp;
}

export const LeaderboardScreen: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { user } = useUserProfile();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLeaderboard();
  const { data: goal } = useCommunityBagGoal();

  const challengeEnded = goal?.endDate ? new Date(goal.endDate).getTime() <= Date.now() : false;
  const { data: claimStatus } = usePrizeClaimStatus(challengeEnded);
  const claimSmartphone = useClaimSmartphone();
  const claimDiscount = useClaimDiscount();

  const firstName = user?.firstName ?? '';

  const allEntries = useMemo(() => data?.pages.flatMap(p => p.entries) ?? [], [data]);

  // Consent gate
  const hasSetConsent = data?.pages[0]?.hasSetConsent ?? true;
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const consentChecked = useRef(false);

  useEffect(() => {
    if (!isLoading && !consentChecked.current) {
      consentChecked.current = true;
      if (!hasSetConsent) setConsentModalVisible(true);
    }
  }, [isLoading, hasSetConsent]);

  const userEntry = useMemo(
    () => data?.pages[0]?.currentUserEntry ?? allEntries.find(e => e.isCurrentUser) ?? null,
    [data, allEntries],
  );
  const userTier = userEntry != null ? getRowTier(userEntry.rank) : 'discount';

  const [showPrizeModal, setShowPrizeModal] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);

  const [debugWinner, setDebugWinner] = useState(false);
  const [debugWinnerClaimed, setDebugWinnerClaimed] = useState(false);
  const [debugDiscount, setDebugDiscount] = useState(false);
  const [debugDiscountClaimed, setDebugDiscountClaimed] = useState(false);
  const prizeModalShown = useRef(false);

  useEffect(() => {
    if (!challengeEnded || !claimStatus || prizeModalShown.current) return;
    if (claimStatus.hasClaimed) return;
    prizeModalShown.current = true;
    if (claimStatus.eligiblePrizeType === 'smartphone') {
      setShowWinnerModal(true);
    } else if (claimStatus.eligiblePrizeType === 'discount') {
      setShowDiscountModal(true);
    }
  }, [challengeEnded, claimStatus]);

  const smartphoneClaimed = (claimStatus?.hasClaimed ?? false) || claimSmartphone.isSuccess;
  const discountClaimed = (claimStatus?.hasClaimed ?? false) || claimDiscount.isSuccess;
  const smartphoneClaimData = claimStatus?.claim ?? claimSmartphone.data ?? null;
  const discountClaimData = claimStatus?.claim ?? claimDiscount.data ?? null;

  // Countdown
  const openPrizeModal = useCallback(() => setShowPrizeModal(true), []);
  const closePrizeModal = useCallback(() => setShowPrizeModal(false), []);

  const handleRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);
  const handleViewMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => undefined);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Floating position bar + neighborhood
  const flashListRef = useRef<FlashList<LeaderboardEntry>>(null);
  const [userRowVisible, setUserRowVisible] = useState(false);
  const [showNeighborhood, setShowNeighborhood] = useState(false);
  const viewabilityReported = useRef(false);

  const userIsInList = useMemo(() => allEntries.some(e => e.isCurrentUser), [allEntries]);
  const showFloatingBar =
    userEntry != null && !userRowVisible && !isLoading && viewabilityReported.current;

  const userRankWithin200 = userEntry != null && userEntry.rank <= 200;
  const neighborhoodEnabled = showNeighborhood && !userRankWithin200;
  const { data: neighborhoodData, isLoading: neighborhoodLoading } =
    useNeighborhood(neighborhoodEnabled);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      viewabilityReported.current = true;
      const isVisible = viewableItems.some(token => (token.item as LeaderboardEntry).isCurrentUser);
      setUserRowVisible(isVisible);
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 50 }).current;

  const handleFloatingBarPress = useCallback(() => {
    if (userRankWithin200 && userIsInList) {
      const idx = allEntries.findIndex(e => e.isCurrentUser);
      if (idx >= 0) flashListRef.current?.scrollToIndex({ index: idx, animated: true });
    } else {
      setShowNeighborhood(prev => !prev);
    }
  }, [userRankWithin200, userIsInList, allEntries]);

  const keyExtractor = useCallback((item: LeaderboardEntry) => item.userId, []);
  const renderItem = useCallback(
    ({ item }: { item: LeaderboardEntry }) => <LeaderboardRow entry={item} />,
    [],
  );

  // ── List header ────────────────────────────────────────────────────────────
  const ListHeader = useMemo(
    () => (
      <View>
        <ChallengeHeader endDate={goal?.endDate} onInfoPress={openPrizeModal} />

        <PrizeTierCards userTier={userTier} />

        {/* Block 3: Podium */}
        {allEntries.length >= 2 && <PodiumTop5 entries={allEntries} />}

        {/* Section header for list */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Rankings</Text>
          <Text style={styles.listMeta}>
            {data?.pages[0]?.total ?? allEntries.length} participants
          </Text>
        </View>

        {/* Error state */}
        {isError && (
          <Pressable style={styles.centerState} onPress={handleRetry} accessibilityRole='button'>
            <Icon name='refresh-outline' family='Ionicons' size={28} color={TEXT_40} />
            <Text style={styles.errorText}>{t('leaderboard.tapToRetry')}</Text>
          </Pressable>
        )}
      </View>
    ),
    [allEntries, goal?.endDate, isError, handleRetry, userTier, data, t, openPrizeModal],
  );

  // ── List footer ────────────────────────────────────────────────────────────
  const ListFooter = useMemo(() => {
    const parts: React.ReactNode[] = [];

    if (isFetchingNextPage) {
      parts.push(
        <View key='spinner' style={styles.loadMoreSpinner}>
          <ActivityIndicator size='small' color={CHAMPION_GOLD} />
        </View>,
      );
    } else if (hasNextPage) {
      parts.push(
        <Pressable
          key='viewmore'
          style={styles.viewMoreBtn}
          onPress={handleViewMore}
          accessibilityRole='button'
        >
          <Text style={styles.viewMoreTxt}>{t('leaderboard.viewMore')}</Text>
          <Icon name='chevron-down-outline' family='Ionicons' size={16} color={CHAMPION_GOLD} />
        </Pressable>,
      );
    }

    if (showNeighborhood && !userRankWithin200) {
      parts.push(
        <NeighborhoodSection
          key='neighborhood'
          entries={neighborhoodData?.entries ?? []}
          isLoading={neighborhoodLoading}
        />,
      );
    }

    if (parts.length === 0) return null;
    return <>{parts}</>;
  }, [
    isFetchingNextPage,
    hasNextPage,
    handleViewMore,
    showNeighborhood,
    userRankWithin200,
    neighborhoodData,
    neighborhoodLoading,
    t,
  ]);

  return (
    <View style={styles.container}>
      <PrivacyConsentModal
        visible={consentModalVisible}
        onConsentSaved={() => setConsentModalVisible(false)}
      />
      <PrizeInfoModal
        visible={showPrizeModal}
        onClose={closePrizeModal}
        daysLeft={
          goal?.endDate
            ? Math.max(0, Math.ceil((new Date(goal.endDate).getTime() - Date.now()) / 86_400_000))
            : null
        }
      />
      <WinnerCelebrationModal
        visible={showWinnerModal}
        onClose={() => setShowWinnerModal(false)}
        rank={claimStatus?.rank ?? 0}
        hasClaimed={smartphoneClaimed}
        claimData={smartphoneClaimData}
        onClaim={() => claimSmartphone.mutate()}
        isClaiming={claimSmartphone.isPending}
        error={claimSmartphone.error instanceof Error ? claimSmartphone.error.message : null}
        firstName={firstName}
      />
      <DiscountClaimModal
        visible={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        rank={claimStatus?.rank ?? 0}
        hasClaimed={discountClaimed}
        claimData={discountClaimData}
        onClaim={(establishmentId: string) => claimDiscount.mutate(establishmentId)}
        isClaiming={claimDiscount.isPending}
        error={claimDiscount.error instanceof Error ? claimDiscount.error.message : null}
        firstName={firstName}
      />
      {__DEV__ && (
        <>
          <WinnerCelebrationModal
            visible={debugWinner}
            onClose={() => {
              setDebugWinner(false);
              setDebugWinnerClaimed(false);
            }}
            rank={2}
            hasClaimed={debugWinnerClaimed}
            claimData={
              debugWinnerClaimed
                ? {
                    id: 'debug',
                    userId: 'debug',
                    prizeType: 'smartphone' as never,
                    status: 'pending' as never,
                    rank: 2,
                    totalPoints: 4200,
                    cycleNumber: 1,
                    createdAt: new Date().toISOString(),
                  }
                : null
            }
            onClaim={() => setDebugWinnerClaimed(true)}
            isClaiming={false}
            error={null}
            firstName={firstName || 'Salem'}
          />
          <DiscountClaimModal
            visible={debugDiscount}
            onClose={() => {
              setDebugDiscount(false);
              setDebugDiscountClaimed(false);
            }}
            rank={8}
            hasClaimed={debugDiscountClaimed}
            claimData={
              debugDiscountClaimed
                ? {
                    id: 'debug',
                    userId: 'debug',
                    prizeType: 'discount' as never,
                    status: 'pending' as never,
                    rank: 8,
                    totalPoints: 1200,
                    cycleNumber: 1,
                    establishmentName: 'Selected Business',
                    createdAt: new Date().toISOString(),
                  }
                : null
            }
            onClaim={() => setDebugDiscountClaimed(true)}
            isClaiming={false}
            error={null}
            firstName={firstName || 'Salem'}
          />
        </>
      )}
      <FlashList
        ref={flashListRef}
        data={allEntries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={56}
        ListHeaderComponent={isLoading ? undefined : ListHeader}
        ListFooterComponent={isLoading ? undefined : ListFooter}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={userIsInList ? onViewableItemsChanged : undefined}
        viewabilityConfig={userIsInList ? viewabilityConfig : undefined}
      />
      {isLoading && (
        <View style={styles.skeletonOverlay}>
          <SkeletonLeaderboardScreen />
        </View>
      )}
      {showFloatingBar && userEntry != null && (
        <FloatingPositionBar
          entry={userEntry}
          visible={showFloatingBar}
          onPress={handleFloatingBarPress}
        />
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_DARK },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_DARK,
  },
  listContent: { paddingBottom: 80 },

  // ── Block 4: List ──
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  listTitle: { fontSize: 15, fontWeight: '700', color: TEXT_85 },
  listMeta: { fontSize: 10, color: TEXT_25, fontWeight: '500' },

  // ── States ──
  centerState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  errorText: { fontSize: 14, color: TEXT_40 },
  loadMoreSpinner: { alignItems: 'center', paddingVertical: 16 },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    gap: 6,
    backgroundColor: GOLD_06,
    borderWidth: 1,
    borderColor: GOLD_15,
  },
  viewMoreTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: CHAMPION_GOLD,
  },
});
