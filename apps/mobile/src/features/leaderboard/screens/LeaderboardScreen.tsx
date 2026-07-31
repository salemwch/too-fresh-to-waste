/**
 * LeaderboardScreen — Grand Prize Community Challenge
 *
 * Layout (dark premium theme):
 *  Block 1: "Grand Prize" header + countdown timer (days:hrs:mins:secs)
 *  Block 2: Prize cards (Smartphone / Discount) with "winning" indicator
 *  Block 3: Top 5 podium (order: 5, 3, 1, 2, 4 — natural rise-and-fall)
 *  Block 4: Clean ranked list
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable } from 'react-native';

import { SkeletonLeaderboardScreen } from '../components/SkeletonLeaderboardScreen';

import { Icon } from '@/design-system/components/atoms';
import { useMonthlyBagGoal } from '@/features/home/hooks/useMonthlyBagGoal';
import { useUserProfile } from '@/hooks/useUserProfile';

import { DiscountClaimModal } from '../components/DiscountClaimModal';
import { FloatingPositionBar } from '../components/FloatingPositionBar';
import { LeaderboardListFooter } from '../components/LeaderboardListFooter';
import { PrivacyConsentModal } from '../components/PrivacyConsentModal';
import { WinnerCelebrationModal } from '../components/WinnerCelebrationModal';
import { LeaderboardRow } from '../components/LeaderboardRow';
import { ChallengeHeader } from '../components/ChallengeHeader';
import { PodiumTop5 } from '../components/PodiumTop5';
import { PrizeTierCards } from '../components/PrizeTierCards';
import { PrizeInfoModal } from '../components/PrizeInfoModal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useUserRowTracking } from '../hooks/useUserRowTracking';
import { usePrizeClaimStatus, useClaimDiscount } from '../hooks/usePrizeClaim';
import {
  useVotingPrizeStatus,
  useClaimVotingPrize,
  votingPrizeToClaimData,
} from '@/features/voting/hooks/useVotingPrize';
import { useActiveVotingCycle } from '@/features/voting/hooks/useVoting';
import { getBallotPrizeRows, getGrandPrizePresentation } from '../utils/prizePresentation';
import {
  BG_DARK,
  CHAMPION_GOLD,
  GOLD_06,
  GOLD_15,
  TEXT_25,
  TEXT_40,
  TEXT_85,
} from '../constants/palette';
import { DEFAULT_PRIZE_RANKS, getRowTier } from '../utils/prizeTiers';

import type { LeaderboardEntry, LeaderboardNeighborhoodEntry } from '../types/leaderboard.types';
import type { MainStackNavigationProp } from '@/navigation/types';

/**
 * Frozen empty fallback. An inline empty array would hand
 * LeaderboardListFooter a new identity every render and defeat its memo.
 */
const NO_ENTRIES: LeaderboardNeighborhoodEntry[] = [];

// ─── Main screen ─────────────────────────────────────────────────────────────
interface Props {
  navigation: MainStackNavigationProp;
}

export const LeaderboardScreen: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { user } = useUserProfile();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLeaderboard();
  const { data: goal } = useMonthlyBagGoal();

  const challengeEnded = goal?.endDate ? new Date(goal.endDate).getTime() <= Date.now() : false;
  const { data: claimStatus } = usePrizeClaimStatus(challengeEnded);
  /*
   * Names the prize the community voted for, so the celebration says "Electric
   * Scooter" rather than assuming a phone. Gated on the challenge having ended
   * — there is no prize to name before then, and this must not add a request
   * to the normal leaderboard load.
   */
  const { data: votingPrize } = useVotingPrizeStatus(challengeEnded);
  // The single grand-prize path, shared with the voting card. The leaderboard
  // used to POST /loyalty/prize-claim/smartphone, so a top-ranked user could
  // claim the same season twice — once from each screen.
  const claimGrandPrize = useClaimVotingPrize();
  const claimDiscount = useClaimDiscount();

  /**
   * The season's ballot: which prize it elected, and everything that was on it.
   *
   * Not gated on `challengeEnded` like the claim status above, because the tier
   * card and the info modal have to be right for the whole season — someone
   * asking what they can win on day two is exactly who this is for. The cycle is
   * already fetched by the voting screen, so React Query serves it from cache.
   */
  const { cycle: activeCycle } = useActiveVotingCycle();
  const grandPrize = useMemo(() => getGrandPrizePresentation(activeCycle), [activeCycle]);
  const ballotPrizes = useMemo(() => getBallotPrizeRows(activeCycle), [activeCycle]);

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
  /*
   * `targetReached` only arrives once the challenge has ended, so before then
   * assume the goal will be met — the top ranks should see the phone tier they
   * are playing for. After a season that fell short there is no phone to win,
   * and the tier cards must stop promising one.
   */
  const userTier =
    userEntry != null
      ? getRowTier(
          userEntry.rank,
          claimStatus?.recipientCount ?? DEFAULT_PRIZE_RANKS,
          claimStatus?.targetReached ?? true,
        )
      : 'discount';

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
    /*
     * Both values mean "you are in the top ranks". `smartphone` is the legacy
     * spelling still returned by the bag-goal endpoint; `grand_prize` is what
     * the voting path writes. Accepting both keeps the modal working while the
     * two prize paths are consolidated.
     */
    if (
      claimStatus.eligiblePrizeType === 'grand_prize' ||
      // Legacy spelling, still on claims written before the paths merged.
      claimStatus.eligiblePrizeType === 'smartphone'
    ) {
      setShowWinnerModal(true);
    } else if (claimStatus.eligiblePrizeType === 'discount') {
      setShowDiscountModal(true);
    }
  }, [challengeEnded, claimStatus]);

  const prizeRanks = claimStatus?.recipientCount ?? DEFAULT_PRIZE_RANKS;
  const grandPrizeClaimed = (claimStatus?.hasClaimed ?? false) || claimGrandPrize.isSuccess;
  const discountClaimed = (claimStatus?.hasClaimed ?? false) || claimDiscount.isSuccess;
  /*
   * The voting endpoint returns a prize *status*, not a claim record. The same
   * helper the voting card uses maps it into the shape the modal expects.
   */
  const grandPrizeClaimData =
    claimStatus?.claim ??
    (claimGrandPrize.data ? votingPrizeToClaimData(claimGrandPrize.data) : null);
  const discountClaimData = claimStatus?.claim ?? claimDiscount.data ?? null;

  const openPrizeModal = useCallback(() => setShowPrizeModal(true), []);
  const closePrizeModal = useCallback(() => setShowPrizeModal(false), []);

  const handleRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);
  const handleViewMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => undefined);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const {
    listRef,
    showFloatingBar,
    userIsInList,
    neighborhoodEnabled,
    neighborhoodEntries,
    neighborhoodLoading,
    onViewableItemsChanged,
    viewabilityConfig,
    handleFloatingBarPress,
  } = useUserRowTracking({ allEntries, userEntry, isLoading });

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

        <PrizeTierCards userTier={userTier} prizeRanks={prizeRanks} grandPrize={grandPrize} />

        {/* Block 3: Podium */}
        {allEntries.length >= 2 && <PodiumTop5 entries={allEntries} />}

        {/* Section header for list */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{t('leaderboard.rankings')}</Text>
          <Text style={styles.listMeta}>
            {t('leaderboard.participantCount', {
              count: data?.pages[0]?.total ?? allEntries.length,
            })}
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
    [
      allEntries,
      goal?.endDate,
      isError,
      handleRetry,
      userTier,
      prizeRanks,
      grandPrize,
      data,
      t,
      openPrizeModal,
    ],
  );

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
        prizeRanks={prizeRanks}
        grandPrize={grandPrize}
        ballotPrizes={ballotPrizes}
      />
      <WinnerCelebrationModal
        visible={showWinnerModal}
        onClose={() => setShowWinnerModal(false)}
        rank={claimStatus?.rank ?? 0}
        hasClaimed={grandPrizeClaimed}
        claimData={grandPrizeClaimData}
        prizeName={votingPrize?.prizeName ?? null}
        onClaim={() => claimGrandPrize.mutate()}
        isClaiming={claimGrandPrize.isPending}
        error={claimGrandPrize.error instanceof Error ? claimGrandPrize.error.message : null}
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
        ref={listRef}
        data={allEntries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={56}
        ListHeaderComponent={isLoading ? undefined : ListHeader}
        ListFooterComponent={
          isLoading ? undefined : (
            <LeaderboardListFooter
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage === true}
              onViewMore={handleViewMore}
              showNeighborhood={neighborhoodEnabled}
              neighborhoodEntries={neighborhoodEntries?.entries ?? NO_ENTRIES}
              neighborhoodLoading={neighborhoodLoading}
            />
          )
        }
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
