/**
 * LeaderboardScreen — Community Milestone Challenge
 *
 * Layout:
 *  1. Greeting header — avatar + "Morning/Afternoon/Evening, [firstName]!"
 *  2. Prize tier strip — highlights the user's current tier
 *  3. Top 5 Champions — avatars + medals, visual pyramid
 *  4. Single unified ranked list:
 *       rank 1–5  → gold left-border   (Smartphone prize)
 *       rank 6–10 → silver left-border (Smart Watch prize)
 *       rank 11+  → neutral
 *  5. PrivacyConsentModal gates participation on first visit
 */

import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { useCommunityBagGoal } from '@/features/home/hooks/useCommunityBagGoal';
import { useUserProfile } from '@/hooks/useUserProfile';
import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';

import { PrivacyConsentModal } from '../components/PrivacyConsentModal';
import { useLeaderboard } from '../hooks/useLeaderboard';

import type { LeaderboardEntry } from '../types/leaderboard.types';
import type { MainStackNavigationProp } from '@/navigation/types';

// ─── Constants ───────────────────────────────────────────────────────────────
const PRIMARY = colorTokens.base.primary[500];
const GOLD = '#F59E0B';
const GOLD_TEXT = '#B45309';
const SILVER = '#9CA3AF';
const SUCCESS = '#22C55E';
const SUCCESS_SOFT = '#F0FDF4';
const SURFACE = '#FFFFFF';
const SURFACE_MUTED = '#F1F5F9';
const BORDER = '#E5E7EB';
const BORDER_SUBTLE = '#F3F4F6';
const TEXT_PRIMARY = '#111827';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const TEXT_MUTED = '#4B5563';
const SHADOW = '#000';
const OVERLAY = 'rgba(0,0,0,0.45)';
const INVERSE_TEXT = '#FFFFFF';
const INVERSE_TEXT_MUTED = 'rgba(255,255,255,0.65)';
const INVERSE_TEXT_SOFT = 'rgba(255,255,255,0.85)';
const INVERSE_SURFACE = 'rgba(255,255,255,0.15)';
const PHONE_MAX = 5; // ranks 1–5 win Smartphone
const WATCH_MAX = 10; // ranks 6–10 win Smart Watch

// ─── Tier helper ─────────────────────────────────────────────────────────────
type RowTier = 'phone' | 'watch' | 'other';

function getRowTier(rank: number): RowTier {
  if (rank <= PHONE_MAX) return 'phone';
  if (rank <= WATCH_MAX) return 'watch';
  return 'other';
}

// ─── Greeting helper ─────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

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

// ─── Top 5 champions ─────────────────────────────────────────────────────────
// Display order: #4 | #2 | #1 | #3 | #5 (visual pyramid, highest in center)
interface Top5Props {
  entries: LeaderboardEntry[];
}

interface SlotConfig {
  entry: LeaderboardEntry;
  size: number;
  bottomPad: number;
  borderColor: string;
  badge: React.ReactNode;
  pillBg: string;
  pillTxt: string;
}

const BRONZE = '#B45309';

const Top5Champions: React.FC<Top5Props> = ({ entries }) => {
  if (entries.length === 0) return null;

  // Build slot configs for each visible rank slot (1–5)
  const slot = (rank: number): SlotConfig | null => {
    const e = entries[rank - 1];
    if (e == null) return null;

    const configs: Record<number, Omit<SlotConfig, 'entry'>> = {
      1: {
        size: 60,
        bottomPad: 0,
        borderColor: GOLD,
        badge: <Text style={styles.crownEmoji}>👑</Text>,
        pillBg: `${GOLD}20`,
        pillTxt: GOLD_TEXT,
      },
      2: {
        size: 50,
        bottomPad: 12,
        borderColor: SILVER,
        badge: <Text style={styles.medalEmoji}>🥈</Text>,
        pillBg: `${SILVER}18`,
        pillTxt: SILVER,
      },
      3: {
        size: 50,
        bottomPad: 12,
        borderColor: BRONZE,
        badge: <Text style={styles.medalEmoji}>🥉</Text>,
        pillBg: `${BRONZE}12`,
        pillTxt: BRONZE,
      },
      4: {
        size: 42,
        bottomPad: 22,
        borderColor: `${GOLD}60`,
        badge: (
          <View style={styles.rankBadge}>
            <Text style={[styles.rankBadgeTxt, { color: GOLD_TEXT }]}>4</Text>
          </View>
        ),
        pillBg: `${GOLD}10`,
        pillTxt: GOLD_TEXT,
      },
      5: {
        size: 42,
        bottomPad: 22,
        borderColor: `${GOLD}60`,
        badge: (
          <View style={styles.rankBadge}>
            <Text style={[styles.rankBadgeTxt, { color: GOLD_TEXT }]}>5</Text>
          </View>
        ),
        pillBg: `${GOLD}10`,
        pillTxt: GOLD_TEXT,
      },
    };

    return { entry: e, ...configs[rank]! };
  };

  // Visual order: 4, 2, 1, 3, 5
  const slots = [slot(4), slot(2), slot(1), slot(3), slot(5)];

  return (
    <View style={styles.top3Wrapper}>
      {slots.map((s, i) => {
        if (s == null) return null;
        const isCenter = i === 2;
        return (
          <View
            key={s.entry.userId}
            style={[styles.top3Item, { paddingBottom: s.bottomPad }, isCenter && styles.top3Center]}
          >
            {s.badge}
            <UserAvatar
              uri={s.entry.profileImage}
              firstName={s.entry.firstName}
              lastName={s.entry.lastName}
              size={s.size}
              borderColor={s.borderColor}
            />
            <Text style={[styles.top3Name, isCenter && styles.top3NameCenter]} numberOfLines={1}>
              {s.entry.firstName}
            </Text>
            <View style={[styles.top3Pill, { backgroundColor: s.pillBg }]}>
              <Text style={[styles.top3PillText, { color: s.pillTxt }]}>
                {s.entry.totalPoints.toLocaleString()} pt
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Single leaderboard row ───────────────────────────────────────────────────
interface RowProps {
  entry: LeaderboardEntry;
}

const LeaderboardRow: React.FC<RowProps> = ({ entry }) => {
  const tier = getRowTier(entry.rank);
  const isPhone = tier === 'phone';
  const isWatch = tier === 'watch';

  const leftColor = isPhone ? GOLD : isWatch ? SILVER : '#F1F5F9';
  const rankColor = isPhone ? GOLD : isWatch ? SILVER : '#9CA3AF';
  const pillBg = isPhone ? `${GOLD}15` : isWatch ? `${SILVER}15` : '#F1F5F9';
  const pillTxt = isPhone ? GOLD_TEXT : isWatch ? '#4B5563' : '#374151';

  return (
    <View style={[styles.row, { borderLeftColor: leftColor }, entry.isCurrentUser && styles.rowMe]}>
      {/* Rank */}
      <View style={styles.rankCol}>
        <Text style={[styles.rankNum, { color: rankColor }]}>{entry.rank}</Text>
      </View>

      {/* Avatar */}
      <UserAvatar
        uri={entry.profileImage}
        firstName={entry.firstName}
        lastName={entry.lastName}
        size={42}
      />

      {/* Name + badge */}
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

      {/* Points pill */}
      <View style={[styles.ptsPill, { backgroundColor: pillBg }]}>
        <Text style={[styles.ptsText, { color: pillTxt }]}>
          {entry.totalPoints.toLocaleString()} pt
        </Text>
      </View>
    </View>
  );
};

// ─── Memoised row (prevents re-renders on new pages loading) ─────────────────
const MemoRow = memo(LeaderboardRow);

// ─── Prize info modal ─────────────────────────────────────────────────────────
interface PrizeModalProps {
  visible: boolean;
  onClose: () => void;
  bagCount: number;
  targetCount: number;
}

const PrizeModal: React.FC<PrizeModalProps> = ({ visible, onClose, bagCount, targetCount }) => {
  const insets = useSafeAreaInsets();
  // Ensure enough breathing room above the device's gesture / nav bar
  const sheetBottomPad = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType='slide'
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalOverlay}
        onPress={onClose}
        accessibilityRole='button'
        accessibilityLabel='Close'
        accessibilityHint='Closes the prize information sheet'
      >
        {/* Inner Pressable stops tap-through closing when tapping inside sheet */}
        <Pressable
          style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}
          accessibilityRole='none'
          onPress={() => undefined}
        >
          <View style={styles.modalHandle} />

          {/* Scrollable content — button intentionally kept outside so it never scrolls away */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalScrollContent}
          >
            <Text style={styles.modalTitle}>How the Grand Prize Works</Text>

            {/* Bag goal progress line */}
            <View style={styles.modalGoalRow}>
              <View style={styles.modalGoalDot} />
              <Text style={styles.modalGoalTxt}>
                Prizes unlock when the community saves{' '}
                <Text style={styles.modalGoalBold}>{targetCount.toLocaleString()} bags</Text>
                {bagCount > 0 && (
                  <>
                    {'  ·  '}
                    <Text style={styles.modalGoalCurrent}>
                      {bagCount.toLocaleString()} saved so far
                    </Text>
                  </>
                )}
              </Text>
            </View>

            <View style={styles.modalDivider} />

            {/* Tier 1 */}
            <View style={styles.modalTier}>
              <View style={[styles.modalTierIcon, { backgroundColor: `${PRIMARY}12` }]}>
                <Text style={styles.modalTierEmoji}>📱</Text>
              </View>
              <View style={styles.modalTierInfo}>
                <Text style={styles.modalTierTitle}>Smartphone</Text>
                <Text style={styles.modalTierRank}>Rank 1 – 5 · 5 winners</Text>
                <Text style={styles.modalTierDesc}>
                  The top 5 point earners each receive a smartphone when the goal is reached.
                </Text>
              </View>
            </View>

            {/* Tier 2 */}
            <View style={styles.modalTier}>
              <View style={[styles.modalTierIcon, { backgroundColor: `${PRIMARY}0C` }]}>
                <Text style={styles.modalTierEmoji}>⌚</Text>
              </View>
              <View style={styles.modalTierInfo}>
                <Text style={styles.modalTierTitle}>Smart Watch</Text>
                <Text style={styles.modalTierRank}>Rank 6 – 10 · 5 winners</Text>
                <Text style={styles.modalTierDesc}>
                  Ranks 6 through 10 each receive a smart watch.
                </Text>
              </View>
            </View>

            {/* Tier 3 */}
            <View style={styles.modalTier}>
              <View style={[styles.modalTierIcon, styles.modalTierIconDiscount]}>
                <Text style={styles.modalTierEmoji}>🎁</Text>
              </View>
              <View style={styles.modalTierInfo}>
                <Text style={styles.modalTierTitle}>15% Discount</Text>
                <Text style={styles.modalTierRank}>Rank 11 and above</Text>
                <Text style={styles.modalTierDesc}>
                  Every other participant earns a 15% discount at any partner business — hotels,
                  restaurants, bakeries and more. You choose where to use it.
                </Text>
              </View>
            </View>

            <View style={styles.modalDivider} />

            <Text style={styles.modalNote}>
              Rankings are based on total loyalty points. Points are awarded each time you save a
              bag.
            </Text>
          </ScrollView>

          {/* Fixed action button — always visible regardless of scroll position */}
          <Pressable
            style={styles.modalBtn}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Got it'
            accessibilityHint='Dismisses the prize information'
          >
            <Text style={styles.modalBtnTxt}>Got it!</Text>
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
  const theme = useTheme();
  const { user, avatarUri } = useUserProfile();
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useLeaderboard();
  const { data: goal } = useCommunityBagGoal();

  const greeting = getGreeting();
  const firstName = user?.firstName ?? '';
  const lastName = user?.lastName ?? '';

  // Flatten all pages into one array
  const allEntries = useMemo(() => data?.pages.flatMap(p => p.entries) ?? [], [data]);

  // Consent gate — default true while loading so modal doesn't flash before data arrives
  const hasSetConsent = data?.pages[0]?.hasSetConsent ?? true;
  const [consentModalVisible, setConsentModalVisible] = useState(false);
  const consentChecked = useRef(false);

  useEffect(() => {
    // Trigger once after data loads; never re-open after the user has acted
    if (!isLoading && !consentChecked.current) {
      consentChecked.current = true;
      if (!hasSetConsent) setConsentModalVisible(true);
    }
  }, [isLoading, hasSetConsent]);

  // Used only for prize-strip tier highlighting
  const userEntry = useMemo(
    () => data?.pages[0]?.currentUserEntry ?? allEntries.find(e => e.isCurrentUser) ?? null,
    [data, allEntries],
  );
  const userTier = userEntry != null ? getRowTier(userEntry.rank) : 'other';

  const [showPrizeModal, setShowPrizeModal] = useState(false);

  const handleRetry = useCallback(() => {
    refetch().catch(() => undefined);
  }, [refetch]);
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage().catch(() => undefined);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const keyExtractor = useCallback((item: (typeof allEntries)[0]) => item.userId, []);

  const renderItem = useCallback(
    ({ item }: { item: (typeof allEntries)[0] }) => <MemoRow entry={item} />,
    [],
  );

  // ── List header — rendered once above the virtualized rows ────────────────
  const ListHeader = useMemo(
    () => (
      <View>
        {/* Greeting + info icon */}
        <View style={styles.greeting}>
          <View style={styles.greetingLeft}>
            <View>
              <UserAvatar
                uri={avatarUri ?? null}
                firstName={firstName}
                lastName={lastName}
                size={52}
              />
              <View style={styles.onlineDot} />
            </View>
            <Text style={styles.greetingText}>
              {greeting},{'\n'}
              <Text style={styles.greetingName}>{firstName}!</Text>
            </Text>
          </View>
          <Pressable
            style={styles.infoBtn}
            onPress={() => setShowPrizeModal(true)}
            accessibilityRole='button'
            accessibilityLabel='Show prize information'
            accessibilityHint='Displays prize details for each leaderboard tier'
          >
            <Icon name='information-circle-outline' family='Ionicons' size={26} color={PRIMARY} />
          </Pressable>
        </View>

        {/* Prize strip — 3 tiles showing what each tier wins */}
        <View style={styles.prizeStrip}>
          {/* Smartphone — rank 1-5 */}
          <View style={[styles.stripTile, userTier === 'phone' && styles.stripTileActive]}>
            <Icon name='phone-portrait-outline' family='Ionicons' size={22} color={GOLD_TEXT} />
            <Text style={styles.stripPrize}>Smartphone</Text>
            <Text style={styles.stripTierTxt}>Rank 1 – 5</Text>
          </View>

          <View style={styles.stripDivider} />

          {/* Smart Watch — rank 6-10 */}
          <View style={[styles.stripTile, userTier === 'watch' && styles.stripTileActive]}>
            <Icon name='watch-outline' family='Ionicons' size={22} color={SILVER} />
            <Text style={styles.stripPrize}>Smart Watch</Text>
            <Text style={styles.stripTierTxt}>Rank 6 – 10</Text>
          </View>

          <View style={styles.stripDivider} />

          {/* 15% discount — everyone else */}
          <View style={[styles.stripTile, userTier === 'other' && styles.stripTileActive]}>
            <Icon name='gift-outline' family='Ionicons' size={22} color={SUCCESS} />
            <Text style={styles.stripPrize}>15% Discount</Text>
            <Text style={styles.stripTierTxt}>Rank 11+</Text>
          </View>
        </View>

        {/* Top 5 */}
        {allEntries.length >= 1 && <Top5Champions entries={allEntries} />}

        {/* Section header */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>All Rankings</Text>
        </View>

        {/* Initial load states */}
        {isLoading && (
          <View style={styles.centerState}>
            <ActivityIndicator size='large' color={PRIMARY} />
          </View>
        )}
        {isError && (
          <Pressable
            style={styles.centerState}
            onPress={handleRetry}
            accessibilityRole='button'
            accessibilityLabel='Retry loading'
            accessibilityHint='Reloads the leaderboard'
          >
            <Icon name='refresh-outline' family='Ionicons' size={28} color='#6B7280' />
            <Text style={styles.errorText}>Tap to retry</Text>
          </Pressable>
        )}
      </View>
    ),
    [
      allEntries,
      isLoading,
      isError,
      firstName,
      lastName,
      avatarUri,
      greeting,
      theme.colors.onSurface,
      handleRetry,
      userTier,
    ],
  );

  // ── List footer — load-more spinner only ─────────────────────────────────
  const ListFooter = useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.loadMoreSpinner}>
        <ActivityIndicator size='small' color={PRIMARY} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <PrivacyConsentModal
        visible={consentModalVisible}
        onConsentSaved={() => setConsentModalVisible(false)}
      />
      <PrizeModal
        visible={showPrizeModal}
        onClose={() => setShowPrizeModal(false)}
        bagCount={goal?.currentCount ?? 0}
        targetCount={goal?.targetCount ?? 10_000}
      />
      <FlashList
        data={allEntries}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        estimatedItemSize={68}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 32 },

  // ── Greeting ──
  greeting: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  greetingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: SUCCESS,
    borderWidth: 2,
    borderColor: SURFACE,
  },
  greetingText: { fontSize: 16, color: TEXT_SECONDARY, fontWeight: '400', lineHeight: 22 },
  greetingName: { fontSize: 20, color: TEXT_PRIMARY, fontWeight: '700' },
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${PRIMARY}0F`,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Prize strip ──
  prizeStrip: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  stripTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 6,
    gap: 3,
  },
  stripTileActive: {
    backgroundColor: `${PRIMARY}09`,
  },
  stripDivider: {
    width: 1,
    backgroundColor: BORDER,
    marginVertical: 12,
  },
  stripPrize: { fontSize: 12, fontWeight: '700', color: TEXT_PRIMARY, textAlign: 'center' },
  stripTierTxt: { fontSize: 10, color: TEXT_TERTIARY, textAlign: 'center' },

  // ── Progress bar (kept — used in user card) ──
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },

  // ── Top 3 ──
  top3Wrapper: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    marginBottom: 24,
    gap: 8,
  },
  top3Item: { alignItems: 'center', flex: 1, gap: 5 },
  top3Center: { paddingBottom: 0 },
  medalEmoji: { fontSize: 18 },
  crownEmoji: { fontSize: 20 },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: `${GOLD}20`,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${GOLD}50`,
  },
  rankBadgeTxt: { fontSize: 11, fontWeight: '700' },
  top3Name: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  top3NameCenter: { fontSize: 14, fontWeight: '700' },
  top3Pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  top3PillText: { fontSize: 11, fontWeight: '600' },

  // ── List ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 3,
    borderTopColor: SURFACE_MUTED,
    borderRightColor: SURFACE_MUTED,
    borderBottomColor: SURFACE_MUTED,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  rowMe: {
    borderTopColor: `${PRIMARY}30`,
    borderRightColor: `${PRIMARY}30`,
    borderBottomColor: `${PRIMARY}30`,
    borderLeftColor: `${PRIMARY}30`,
    backgroundColor: `${PRIMARY}06`,
  },

  rankCol: { width: 22, alignItems: 'center' },
  rankNum: { fontSize: 14, fontWeight: '700' },

  nameCol: { flex: 1 },
  fullName: { fontSize: 14, fontWeight: '500', color: TEXT_PRIMARY },
  fullNameMe: { color: PRIMARY, fontWeight: '600' },
  badgeLabel: { fontSize: 11, color: TEXT_TERTIARY, marginTop: 1 },

  ptsPill: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  ptsText: { fontSize: 12, fontWeight: '600' },
  avatarFallback: {
    backgroundColor: `${PRIMARY}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontWeight: '700',
    color: PRIMARY,
  },

  // ── User card ──
  userCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: PRIMARY,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 6 },
    }),
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  userCardInfo: { flex: 1 },
  userCardName: { fontSize: 15, fontWeight: '600', color: INVERSE_TEXT },
  userCardSub: { fontSize: 13, color: INVERSE_TEXT_MUTED, marginTop: 2 },
  userTierBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INVERSE_SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userTierIcon: { fontSize: 18 },
  userCardMsg: { fontSize: 13, color: INVERSE_TEXT_SOFT, marginBottom: 8 },

  // ── States ──
  centerState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  errorText: { fontSize: 14, color: TEXT_SECONDARY },
  loadMoreSpinner: { alignItems: 'center', paddingVertical: 16 },

  // ── Prize modal ──
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
    // paddingBottom is set dynamically via useSafeAreaInsets
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
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
  modalGoalTxt: { flex: 1, fontSize: 14, color: TEXT_MUTED, lineHeight: 20 },
  modalGoalBold: { fontWeight: '700', color: TEXT_PRIMARY },
  modalGoalCurrent: { color: PRIMARY, fontWeight: '600' },
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
  modalTierIconDiscount: {
    backgroundColor: SUCCESS_SOFT,
  },
  modalTierEmoji: { fontSize: 22 },
  modalTierInfo: { flex: 1 },
  modalTierTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 2 },
  modalTierRank: { fontSize: 12, color: PRIMARY, fontWeight: '600', marginBottom: 4 },
  modalTierDesc: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 19 },
  modalNote: {
    fontSize: 13,
    color: TEXT_TERTIARY,
    lineHeight: 19,
    marginBottom: 24,
  },
  modalBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalBtnTxt: {
    fontSize: 15,
    fontWeight: '700',
    color: INVERSE_TEXT,
  },
});
