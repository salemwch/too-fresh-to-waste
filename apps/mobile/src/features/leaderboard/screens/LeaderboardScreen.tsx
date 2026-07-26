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
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Modal,
  ScrollView,
} from 'react-native';

import { SkeletonLeaderboardScreen } from '../components/SkeletonLeaderboardScreen';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { useCommunityBagGoal } from '@/features/home/hooks/useCommunityBagGoal';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';

import { DiscountClaimModal } from '../components/DiscountClaimModal';
import { FloatingPositionBar } from '../components/FloatingPositionBar';
import { NeighborhoodSection } from '../components/NeighborhoodSection';
import { PrivacyConsentModal } from '../components/PrivacyConsentModal';
import { WinnerCelebrationModal } from '../components/WinnerCelebrationModal';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { useNeighborhood } from '../hooks/useNeighborhood';
import { usePrizeClaimStatus, useClaimSmartphone, useClaimDiscount } from '../hooks/usePrizeClaim';
import { getCountdown } from '../utils/countdown';
import { PHONE_PRIZE_MAX_RANK, getRowTier } from '../utils/prizeTiers';

import type { LeaderboardEntry } from '../types/leaderboard.types';
import type { MainStackNavigationProp } from '@/navigation/types';

// ─── Dark Premium Palette ────────────────────────────────────────────────────
const PRIMARY = colorTokens.base.primary[500];
const CHAMPION_GOLD = '#c4a25a';
const GOLD_15 = 'rgba(196,162,90,0.15)';
const GOLD_10 = 'rgba(196,162,90,0.1)';
const GOLD_06 = 'rgba(196,162,90,0.06)';
const GOLD_04 = 'rgba(196,162,90,0.04)';

const BG_DARK = '#0a1e20';
const BG_CARD = 'rgba(255,255,255,0.02)';
const BG_CARD_TOP5 = 'rgba(196,162,90,0.02)';
const BORDER_CARD = 'rgba(255,255,255,0.035)';
const BORDER_CARD_TOP5 = 'rgba(196,162,90,0.06)';
const BORDER_GOLD = 'rgba(196,162,90,0.3)';

const TEXT_WHITE = '#ffffff';
const TEXT_85 = 'rgba(255,255,255,0.85)';
const TEXT_60 = 'rgba(255,255,255,0.6)';
const TEXT_40 = 'rgba(255,255,255,0.4)';
const TEXT_30 = 'rgba(255,255,255,0.3)';
const TEXT_25 = 'rgba(255,255,255,0.25)';

const OVERLAY = 'rgba(0,0,0,0.45)';
const SURFACE = '#FFFFFF';
const BORDER_SUBTLE = '#F3F4F6';
const TEXT_PRIMARY = '#0F2628';
const TEXT_SECONDARY = '#4B6264';
const TEXT_TERTIARY = '#8FA6A9';

// ─── Reusable avatar ─────────────────────────────────────────────────────────
interface AvatarProps {
  uri: string | null;
  firstName: string;
  lastName: string;
  size: number;
  borderColor?: string;
}

const UserAvatar: React.FC<AvatarProps> = ({ uri, firstName, lastName, size, borderColor }) => {
  const radius = size / 2;
  const initials = `${firstName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();
  const ringStyle = borderColor != null ? { borderWidth: 2.5, borderColor } : undefined;
  const avatarFrameStyle = { width: size, height: size, borderRadius: radius };
  const avatarInitialsStyle = { fontSize: size * 0.35 };

  if (uri != null) {
    const optimizedUri = getOptimizedImageUrl(uri, IMAGE_PRESETS.avatar) ?? uri;
    return (
      <FastImage
        source={{ uri: optimizedUri, priority: FastImage.priority.normal }}
        style={[avatarFrameStyle, ringStyle]}
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, avatarFrameStyle, ringStyle]}>
      <Text style={[styles.avatarInitials, avatarInitialsStyle]}>{initials}</Text>
    </View>
  );
};

// ─── Top 5 Podium (order: 5, 3, 1, 2, 4) ───────────────────────────────────
interface Top5Props {
  entries: LeaderboardEntry[];
}

const Top5Champions: React.FC<Top5Props> = ({ entries }) => {
  if (entries.length < 2) return null;

  const getEntry = (rank: number) => entries[rank - 1];
  const order = [5, 3, 1, 2, 4];

  return (
    <View style={styles.podiumBlock}>
      {order.map(rank => {
        const e = getEntry(rank);
        if (e == null) return <View key={rank} style={styles.podiumItem} />;

        const isChampion = rank === 1;
        const isMedal = rank === 2 || rank === 3;
        const avatarSize = isChampion ? 68 : isMedal ? 52 : 42;
        const borderColor = isChampion
          ? CHAMPION_GOLD
          : isMedal
            ? 'rgba(196,162,90,0.35)'
            : 'rgba(255,255,255,0.08)';

        return (
          <View key={e.userId} style={[styles.podiumItem, isChampion && styles.podiumItemChampion]}>
            {/* Top icon: crown for #1, medals for #2/#3, number for #4/#5 */}
            {isChampion && <Text style={styles.podiumCrown}>👑</Text>}
            {rank === 2 && <Text style={styles.podiumMedal}>🥈</Text>}
            {rank === 3 && <Text style={styles.podiumMedal}>🥉</Text>}
            {rank >= 4 && (
              <View style={styles.podiumNumBadge}>
                <Text style={styles.podiumNumText}>{rank}</Text>
              </View>
            )}

            <UserAvatar
              uri={e.profileImage}
              firstName={e.firstName}
              lastName={e.lastName}
              size={avatarSize}
              borderColor={borderColor}
            />

            <Text
              style={[styles.podiumName, isChampion && styles.podiumNameChampion]}
              numberOfLines={1}
            >
              {e.firstName}
            </Text>
            <Text style={[styles.podiumPts, isChampion && styles.podiumPtsChampion]}>
              {e.totalPoints.toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

// ─── Single leaderboard row ──────────────────────────────────────────────────
interface RowProps {
  entry: LeaderboardEntry;
}

const LeaderboardRow: React.FC<RowProps> = ({ entry }) => {
  const isTop5 = entry.rank <= PHONE_PRIZE_MAX_RANK;

  return (
    <View style={[styles.row, isTop5 && styles.rowTop5, entry.isCurrentUser && styles.rowMe]}>
      <View style={[styles.rankCol, isTop5 && styles.rankColTop5]}>
        <Text style={[styles.rankNum, isTop5 && styles.rankNumTop5]}>{entry.rank}</Text>
      </View>

      <UserAvatar
        uri={entry.profileImage}
        firstName={entry.firstName}
        lastName={entry.lastName}
        size={36}
      />

      <View style={styles.nameCol}>
        <Text style={[styles.fullName, entry.isCurrentUser && styles.fullNameMe]} numberOfLines={1}>
          {entry.firstName} {entry.lastName}
        </Text>
        {entry.currentBadge != null && (
          <Text style={styles.badgeLabel} numberOfLines={1}>
            {entry.currentBadge}
          </Text>
        )}
      </View>

      <Text
        style={[
          styles.ptsText,
          isTop5 && styles.ptsTextTop5,
          entry.isCurrentUser && styles.ptsTextMe,
        ]}
      >
        {entry.totalPoints.toLocaleString()} pt
      </Text>
    </View>
  );
};

const MemoRow = memo(LeaderboardRow);

// ─── Prize info modal ────────────────────────────────────────────────────────
interface PrizeModalProps {
  visible: boolean;
  onClose: () => void;
  daysLeft: number | null;
}

const PrizeModal: React.FC<PrizeModalProps> = ({ visible, onClose, daysLeft }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, 24);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose} accessible={false}>
        <Pressable
          accessible={false}
          style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}
          onPress={() => undefined}
        >
          <View style={styles.modalHandle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            <Text style={styles.modalTitle}>{t('leaderboard.howGrandPrizeWorks')}</Text>

            <View style={styles.modalGoalRow}>
              <View style={styles.modalGoalDot} />
              <Text style={styles.modalGoalTxt}>
                {daysLeft != null && daysLeft > 0 ? (
                  <>
                    Prizes unlock in{' '}
                    <Text style={styles.modalGoalBold}>
                      {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.modalGoalBold}>{t('leaderboard.prizeDropLive')}</Text>
                )}
              </Text>
            </View>

            <View style={styles.modalDivider} />

            <View style={styles.modalTier}>
              <View style={[styles.modalTierIcon, { backgroundColor: `${PRIMARY}12` }]}>
                <Text style={styles.modalTierEmoji}>📱</Text>
              </View>
              <View style={styles.modalTierInfo}>
                <Text style={styles.modalTierTitle}>Smartphone</Text>
                <Text style={styles.modalTierRank}>Top 5 · 5 winners</Text>
                <Text style={styles.modalTierDesc}>
                  The top 5 point earners each win a smartphone when the challenge ends.
                </Text>
              </View>
            </View>

            <View style={styles.modalTier}>
              <View style={[styles.modalTierIcon, styles.modalTierIconDiscount]}>
                <Text style={styles.modalTierEmoji}>🎁</Text>
              </View>
              <View style={styles.modalTierInfo}>
                <Text style={styles.modalTierTitle}>10% Discount</Text>
                <Text style={styles.modalTierRank}>Rank 6 and above</Text>
                <Text style={styles.modalTierDesc}>
                  Every other participant earns a 10% discount at a partner business of their
                  choice.
                </Text>
              </View>
            </View>

            <View style={styles.modalDivider} />
            <Text style={styles.modalNote}>
              Rankings are based on total loyalty points. Points are awarded each time you save a
              bag.
            </Text>
          </ScrollView>

          <Pressable style={styles.modalBtn} onPress={onClose} accessibilityRole='button'>
            <Text style={styles.modalBtnTxt}>{t('leaderboard.gotItExclaim')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

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
    ({ item }: { item: LeaderboardEntry }) => <MemoRow entry={item} />,
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
        {allEntries.length >= 2 && <Top5Champions entries={allEntries} />}

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
      <PrizeModal
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

  // ── Block 3: Podium ──
  podiumBlock: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 6,
  },
  podiumItem: {
    flex: 1,
    maxWidth: 72,
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  podiumItemChampion: { marginBottom: 16 },
  podiumCrown: {
    fontSize: 18,
    ...Platform.select({
      ios: {
        shadowColor: CHAMPION_GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.4,
        shadowRadius: 4,
      },
      android: {},
    }),
  },
  podiumMedal: { fontSize: 16 },
  podiumNumBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  podiumNumText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_40,
  },
  podiumName: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_60,
    maxWidth: 62,
    textAlign: 'center',
  },
  podiumNameChampion: { color: CHAMPION_GOLD, fontSize: 11, fontWeight: '700' },
  podiumPts: { fontSize: 9, color: TEXT_25, fontWeight: '500' },
  podiumPtsChampion: { color: 'rgba(196,162,90,0.6)' },

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

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 5,
    borderRadius: 12,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: BORDER_CARD,
  },
  rowTop5: {
    backgroundColor: BG_CARD_TOP5,
    borderColor: BORDER_CARD_TOP5,
  },
  rowMe: {
    borderColor: BORDER_GOLD,
    backgroundColor: GOLD_06,
  },

  rankCol: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rankColTop5: { backgroundColor: GOLD_10 },
  rankNum: { fontSize: 11, fontWeight: '700', color: TEXT_30 },
  rankNumTop5: { color: CHAMPION_GOLD },

  nameCol: { flex: 1, minWidth: 0 },
  fullName: { fontSize: 13, fontWeight: '600', color: TEXT_85 },
  fullNameMe: { color: CHAMPION_GOLD, fontWeight: '700' },
  badgeLabel: { fontSize: 10, color: TEXT_25, marginTop: 1 },

  ptsText: { fontSize: 12, fontWeight: '700', color: TEXT_40 },
  ptsTextTop5: { color: 'rgba(196,162,90,0.8)' },
  ptsTextMe: { color: CHAMPION_GOLD },

  avatarFallback: {
    backgroundColor: 'rgba(196,162,90,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontWeight: '700',
    color: CHAMPION_GOLD,
  },

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

  // ── Prize modal (keeps light theme for readability) ──
  modalOverlay: {
    flex: 1,
    backgroundColor: OVERLAY,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '85%',
  },
  modalScrollContent: { paddingBottom: 16 },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E8EEEF',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 12,
  },
  modalGoalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  modalGoalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    marginTop: 6,
  },
  modalGoalTxt: { flex: 1, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20 },
  modalGoalBold: { fontWeight: '700', color: TEXT_PRIMARY },
  modalDivider: {
    height: 1,
    backgroundColor: BORDER_SUBTLE,
    marginVertical: 16,
  },
  modalTier: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  modalTierIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTierIconDiscount: { backgroundColor: '#F0FDF4' },
  modalTierEmoji: { fontSize: 22 },
  modalTierInfo: { flex: 1 },
  modalTierTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 2 },
  modalTierRank: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginBottom: 4 },
  modalTierDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 19 },
  modalNote: { fontSize: 13, color: TEXT_TERTIARY, lineHeight: 19, marginBottom: 12 },
  modalBtn: {
    backgroundColor: BG_DARK,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalBtnTxt: { fontSize: 15, fontWeight: '700', color: TEXT_WHITE },
});
