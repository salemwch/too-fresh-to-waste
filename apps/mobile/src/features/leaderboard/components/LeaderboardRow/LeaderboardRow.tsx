/**
 * LeaderboardRow — one entry in the ranked list.
 *
 * Memoised: the list re-renders on scroll and on every countdown tick, while an
 * individual row's data changes only when the leaderboard refetches.
 *
 * Ranks 1-3 carry the podium's own metals — gold, silver, bronze — taken from
 * the same palette constants the podium uses, so the two cannot drift into
 * disagreeing about who is second. A number alone never communicated that the
 * top three are the ones who actually win; the colour, plus the rule the screen
 * draws under rank 3, is what does.
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '../UserAvatar';

import {
  BG_GOLD_CARD,
  BORDER_CARD_LIGHT,
  BRONZE,
  BRONZE_BORDER,
  BRONZE_TINT,
  CHAMPION_GOLD,
  GOLD_45,
  GOLD_INK,
  SILVER,
  SILVER_BORDER,
  SILVER_TINT,
  SURFACE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_TERTIARY,
} from '../../constants/palette';
import { DEFAULT_PRIZE_RANKS } from '../../utils/prizeTiers';

import type { LeaderboardEntry } from '../../types/leaderboard.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp, radius } = spacingTokens;

const AVATAR_SIZE = 36;

/**
 * Place → its metal. Only the three winning places appear here; everything else
 * falls through to the neutral row, which is the point.
 */
const MEDAL: Record<number, { chip: string; bg: string; border: string }> = {
  1: { chip: CHAMPION_GOLD, bg: BG_GOLD_CARD, border: GOLD_45 },
  2: { chip: SILVER, bg: SILVER_TINT, border: SILVER_BORDER },
  3: { chip: BRONZE, bg: BRONZE_TINT, border: BRONZE_BORDER },
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    marginHorizontal: sp[5],
    marginBottom: sp.sm,
    borderRadius: radius.lg,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER_CARD_LIGHT,
  },
  /** The viewer's own row, whatever their rank. */
  rowMe: { borderColor: GOLD_45, borderWidth: 1.5 },

  rankChip: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BORDER_CARD_LIGHT,
  },
  rankNum: { fontSize: 12, fontWeight: '800', color: TEXT_MUTED },
  rankNumMedal: { color: SURFACE },

  nameCol: { flex: 1, minWidth: 0 },
  fullName: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  /**
   * Finding yourself in a long list is the row's second job. The border alone
   * is too quiet for that at a glance, so the name carries the accent too.
   */
  fullNameMe: { fontWeight: '800', color: GOLD_INK },
  badgeLabel: { fontSize: 12, color: TEXT_TERTIARY, marginTop: 1 },

  ptsText: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY },
  ptsTextChampion: { color: CHAMPION_GOLD },
});

export interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  /** How many top ranks win the grand prize this season. */
  prizeRanks?: number;
}

const LeaderboardRowComponent: React.FC<LeaderboardRowProps> = ({
  entry,
  prizeRanks = DEFAULT_PRIZE_RANKS,
}) => {
  // Rank-based only: after a season that fell short the top ranks keep this
  // styling, because it marks position, not a prize entitlement — the tier
  // cards are what state what is actually won.
  const medal = entry.rank <= prizeRanks ? MEDAL[entry.rank] : undefined;

  return (
    <View
      style={[
        styles.row,
        medal != null && { backgroundColor: medal.bg, borderColor: medal.border },
        entry.isCurrentUser && styles.rowMe,
      ]}
    >
      <View style={[styles.rankChip, medal != null && { backgroundColor: medal.chip }]}>
        <Text style={[styles.rankNum, medal != null && styles.rankNumMedal]}>{entry.rank}</Text>
      </View>

      <UserAvatar
        uri={entry.profileImage}
        firstName={entry.firstName}
        lastName={entry.lastName}
        size={AVATAR_SIZE}
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

      <Text style={[styles.ptsText, entry.rank === 1 && styles.ptsTextChampion]}>
        {entry.totalPoints.toLocaleString()} pt
      </Text>
    </View>
  );
};

export const LeaderboardRow = memo(LeaderboardRowComponent);
LeaderboardRow.displayName = 'LeaderboardRow';
