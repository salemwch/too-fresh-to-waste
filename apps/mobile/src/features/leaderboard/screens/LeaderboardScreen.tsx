/**
 * LeaderboardScreen — Grand Prize Community Challenge
 *
 * Layout (cream ground, dark hero):
 *  Block 1: Grand Prize hero card — trophy, countdown, end date
 *  Block 2: Prize tier cards (grand prize / discount) with "your tier" marker
 *  Block 3: Top 3 podium (order: 3, 1, 2 — champion centre)
 *  Block 4: Ranked list, the winning band named above it and a rule beneath
 *           the last winning place
 *
 * The screen was a dark surface until the 2026-09-02 redesign. The two dark
 * cards that remain — the hero and the countdown inside it — are the reason
 * `constants/palette.ts` still carries its dark-ground values.
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { PodiumTop3 } from '../components/PodiumTop3';
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
  BG_CREAM,
  CHAMPION_GOLD,
  DIVIDER,
  GOLD_06,
  GOLD_15,
  GOLD_INK,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '../constants/palette';
import { DEFAULT_PRIZE_RANKS, getRowTier } from '../utils/prizeTiers';

import type { LeaderboardEntry, LeaderboardNeighborhoodEntry } from '../types/leaderboard.types';
import type { MainStackNavigationProp } from '@/navigation/types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/**
 * Frozen empty fallback. An inline empty array would hand
 * LeaderboardListFooter a new identity every render and defeat its memo.
 */
const NO_ENTRIES: LeaderboardNeighborhoodEntry[] = [];

// ─── Main screen ─────────────────────────────────────────────────────────────
interface Props {
  navigation: MainStackNavigationProp;
}

export const LeaderboardScreen: React.FC<Props> = ({ navigation }) => {
  const { t, i18n } = useTranslation();
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
  const grandPrize = useMemo(
    () => getGrandPrizePresentation(activeCycle, i18n.language),
    [activeCycle, i18n.language],
  );
  const ballotPrizes = useMemo(
    () => getBallotPrizeRows(activeCycle, i18n.language),
    [activeCycle, i18n.language],
  );

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

  /*
   * The info button lives in the navigation header rather than in the hero
   * card, because the trophy now occupies the card's top-right corner where it
   * used to sit. The header is already rendered for this screen and already
   * follows the theme, so this is the button's natural home.
   */
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          style={styles.headerBtn}
          hitSlop={8}
          onPress={openPrizeModal}
          accessibilityRole='button'
          accessibilityLabel={t('leaderboard.a11yShowPrizeInfo')}
          accessibilityHint={t('common.a11yOpensDetailsHint')}
          testID='leaderboard-info-button'
        >
          <Icon
            name='information-circle-outline'
            family='Ionicons'
            size={24}
            color={TEXT_PRIMARY}
          />
        </Pressable>
      ),
    });
  }, [navigation, openPrizeModal, t]);

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
    ({ item }: { item: LeaderboardEntry }) => (
      <>
        {/*
         * The rule that says where winning stops. Drawn before the first row
         * that wins nothing, so it reads as a boundary rather than a heading,
         * and it names what the ranks below it do get — the medals alone say
         * "these three are special" without saying what the others receive.
         */}
        {item.rank === prizeRanks + 1 && (
          <View style={styles.cutline}>
            <View style={styles.cutlineRule} />
            <Text style={styles.cutlineText}>
              {t('leaderboard.discountBand', { rank: item.rank })}
            </Text>
            <View style={styles.cutlineRule} />
          </View>
        )}
        <LeaderboardRow entry={item} prizeRanks={prizeRanks} />
      </>
    ),
    // prizeRanks is the season's real winner count, so the medals and the rule
    // follow it rather than the module default.
    [prizeRanks, t],
  );

  // ── List header ────────────────────────────────────────────────────────────
  const ListHeader = useMemo(
    () => (
      <View>
        <ChallengeHeader endDate={goal?.endDate} />

        <PrizeTierCards userTier={userTier} prizeRanks={prizeRanks} grandPrize={grandPrize} />

        {/* Block 3: Podium */}
        {allEntries.length >= 2 && <PodiumTop3 entries={allEntries} />}

        {/* Section header for list */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{t('leaderboard.rankings')}</Text>
          <Text style={styles.listMeta}>
            {t('leaderboard.participantCount', {
              count: data?.pages[0]?.total ?? allEntries.length,
            })}
          </Text>
        </View>

        {/* Names the winning band before the first row, so the medals below
            are read as a prize tier rather than as decoration. */}
        {allEntries.length > 0 && (
          <Text style={styles.winBand}>{t('leaderboard.winningBand', { count: prizeRanks })}</Text>
        )}

        {/* Error state */}
        {isError && (
          <Pressable style={styles.centerState} onPress={handleRetry} accessibilityRole='button'>
            <Icon name='refresh-outline' family='Ionicons' size={28} color={TEXT_MUTED} />
            <Text style={styles.errorText}>{t('leaderboard.tapToRetry')}</Text>
          </Pressable>
        )}
      </View>
    ),
    [allEntries, goal?.endDate, isError, handleRetry, userTier, prizeRanks, grandPrize, data, t],
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
  container: { flex: 1, backgroundColor: BG_CREAM },
  skeletonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG_CREAM,
  },
  listContent: { paddingBottom: 80 },
  /**
   * A full 44x44 box rather than a smaller one propped up by hitSlop. The
   * button this replaces was 36x36 + hitSlop, which met the target only because
   * of the slop; sizing the box itself means the visual and the tappable area
   * are the same thing.
   */
  headerBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sp.sm,
  },

  // ── Block 4: List ──
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sp[5],
    marginBottom: sp[3],
    marginTop: sp.xs,
  },
  listTitle: { fontSize: 20, fontWeight: '800', color: TEXT_PRIMARY },
  listMeta: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },

  winBand: {
    paddingHorizontal: sp[5],
    marginBottom: sp.sm,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: GOLD_INK,
  },
  cutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sp.sm,
    paddingHorizontal: sp[5],
    marginTop: sp.xs,
    marginBottom: 10,
  },
  cutlineRule: { flex: 1, height: 1, backgroundColor: DIVIDER },
  cutlineText: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },

  // ── States ──
  centerState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  errorText: { fontSize: 14, color: TEXT_MUTED },
  loadMoreSpinner: { alignItems: 'center', paddingVertical: 16 },
  viewMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: sp[3],
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
