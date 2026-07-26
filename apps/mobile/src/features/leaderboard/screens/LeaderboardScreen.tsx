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
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';

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
import { PodiumTop5 } from '../components/PodiumTop5';
import { PrizeInfoModal } from '../components/PrizeInfoModal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNeighborhood } from '../hooks/useNeighborhood';
import { usePrizeClaimStatus, useClaimSmartphone, useClaimDiscount } from '../hooks/usePrizeClaim';
import {
  BG_CARD,
  BG_DARK,
  BORDER_CARD,
  BORDER_GOLD,
  CHAMPION_GOLD,
  GOLD_04,
  GOLD_06,
  GOLD_10,
  GOLD_15,
  TEXT_25,
  TEXT_30,
  TEXT_40,
  TEXT_85,
  TEXT_WHITE,
} from '../constants/palette';
import { getCountdown } from '../utils/countdown';
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
  const [countdown, setCountdown] = useState(getCountdown(goal?.endDate));
  useEffect(() => {
    if (!goal?.endDate) return;
    setCountdown(getCountdown(goal.endDate));
    const interval = setInterval(() => setCountdown(getCountdown(goal.endDate)), 1000);
    return () => clearInterval(interval);
  }, [goal?.endDate]);

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
        {/* Block 1: Header + Countdown */}
        <View style={styles.headerBlock}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>{t('leaderboard.grandPrize')}</Text>
              <Text style={styles.headerSubtitle}>{t('leaderboard.communityMilestone')}</Text>
            </View>
            <Pressable
              style={styles.infoBtn}
              onPress={() => setShowPrizeModal(true)}
              accessibilityRole='button'
              accessibilityLabel={t('leaderboard.a11yShowPrizeInfo')}
              accessibilityHint={t('common.a11yOpensDetailsHint')}
            >
              <Icon name='information-circle-outline' family='Ionicons' size={22} color={TEXT_40} />
            </Pressable>
          </View>

          {countdown != null && (
            <View style={styles.countdownRow}>
              <View style={styles.cdSegment}>
                <Text style={styles.cdNum}>{countdown.days}</Text>
                <Text style={styles.cdLabel}>DAYS</Text>
              </View>
              <Text style={styles.cdColon}>:</Text>
              <View style={styles.cdSegment}>
                <Text style={styles.cdNum}>{countdown.hours}</Text>
                <Text style={styles.cdLabel}>HOURS</Text>
              </View>
              <Text style={styles.cdColon}>:</Text>
              <View style={styles.cdSegment}>
                <Text style={styles.cdNum}>{countdown.mins}</Text>
                <Text style={styles.cdLabel}>MINS</Text>
              </View>
              <Text style={styles.cdColon}>:</Text>
              <View style={styles.cdSegment}>
                <Text style={styles.cdNum}>{countdown.secs}</Text>
                <Text style={styles.cdLabel}>SECS</Text>
              </View>
            </View>
          )}

          {goal?.endDate && (
            <Text style={styles.endDate}>
              Ends{' '}
              <Text style={styles.endDateBold}>
                {new Date(goal.endDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </Text>
          )}
        </View>

        {/* Block 2: Prize Cards */}
        <View style={styles.prizesBlock}>
          <View style={[styles.prizeCard, userTier === 'phone' && styles.prizeCardWinning]}>
            {userTier === 'phone' && <Text style={styles.prizeYouBadge}>✓ You</Text>}
            <Text style={styles.prizeIcon}>📱</Text>
            <Text style={[styles.prizeName, userTier === 'phone' && styles.prizeNameGold]}>
              Smartphone
            </Text>
            <Text style={styles.prizeTier}>Top 5 Winners</Text>
          </View>
          <View style={[styles.prizeCard, userTier === 'discount' && styles.prizeCardWinning]}>
            {userTier === 'discount' && <Text style={styles.prizeYouBadge}>✓ You</Text>}
            <Text style={styles.prizeIcon}>🎁</Text>
            <Text style={[styles.prizeName, userTier === 'discount' && styles.prizeNameGold]}>
              10% Discount
            </Text>
            <Text style={styles.prizeTier}>Rank 6+</Text>
          </View>
        </View>

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
    [allEntries, countdown, goal?.endDate, isError, handleRetry, userTier, data, t],
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
        onClose={() => setShowPrizeModal(false)}
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

  // ── Block 1: Header ──
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: TEXT_WHITE,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    color: TEXT_30,
    fontWeight: '500',
    marginTop: 3,
  },
  infoBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Countdown
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cdSegment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(196,162,90,0.12)',
  },
  cdNum: {
    fontSize: 24,
    fontWeight: '800',
    color: CHAMPION_GOLD,
    letterSpacing: -0.5,
  },
  cdLabel: {
    fontSize: 8,
    color: TEXT_30,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 3,
  },
  cdColon: {
    fontSize: 20,
    color: 'rgba(196,162,90,0.25)',
    fontWeight: '800',
    paddingBottom: 10,
  },
  endDate: {
    textAlign: 'center',
    marginTop: 10,
    fontSize: 10,
    color: TEXT_25,
    fontWeight: '500',
  },
  endDateBold: { color: TEXT_40 },

  // ── Block 2: Prizes ──
  prizesBlock: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  prizeCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_CARD,
  },
  prizeCardWinning: {
    borderColor: BORDER_GOLD,
    backgroundColor: GOLD_04,
    ...Platform.select({
      ios: {
        shadowColor: CHAMPION_GOLD,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  prizeYouBadge: {
    position: 'absolute',
    top: 6,
    insetInlineEnd: 8,
    fontSize: 8,
    fontWeight: '700',
    color: CHAMPION_GOLD,
    backgroundColor: GOLD_10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  prizeIcon: { fontSize: 24, marginBottom: 6 },
  prizeName: { fontSize: 12, fontWeight: '700', color: TEXT_WHITE },
  prizeNameGold: { color: CHAMPION_GOLD },
  prizeTier: { fontSize: 9, color: TEXT_30, marginTop: 3, fontWeight: '600' },

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
