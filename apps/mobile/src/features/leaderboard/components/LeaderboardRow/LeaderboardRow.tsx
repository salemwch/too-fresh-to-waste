/**
 * LeaderboardRow — one entry in the ranked list.
 *
 * Memoised: the list re-renders on scroll and on every countdown tick, while an
 * individual row's data changes only when the leaderboard refetches.
 */

import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '../UserAvatar';

import {
  BG_CARD,
  BG_CARD_TOP5,
  BORDER_CARD,
  BORDER_CARD_TOP5,
  BORDER_GOLD,
  CHAMPION_GOLD,
  GOLD_06,
  GOLD_10,
  GOLD_80,
  TEXT_25,
  TEXT_30,
  TEXT_40,
  TEXT_85,
  WHITE_04,
} from '../../constants/palette';
import { PHONE_PRIZE_MAX_RANK } from '../../utils/prizeTiers';

import type { LeaderboardEntry } from '../../types/leaderboard.types';

const AVATAR_SIZE = 36;

const styles = StyleSheet.create({
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
  rowTopRank: {
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
    backgroundColor: WHITE_04,
  },
  rankColTopRank: { backgroundColor: GOLD_10 },
  rankNum: { fontSize: 11, fontWeight: '700', color: TEXT_30 },
  rankNumTopRank: { color: CHAMPION_GOLD },

  nameCol: { flex: 1, minWidth: 0 },
  fullName: { fontSize: 13, fontWeight: '600', color: TEXT_85 },
  fullNameMe: { color: CHAMPION_GOLD, fontWeight: '700' },
  badgeLabel: { fontSize: 10, color: TEXT_25, marginTop: 1 },

  ptsText: { fontSize: 12, fontWeight: '700', color: TEXT_40 },
  ptsTextTopRank: { color: GOLD_80 },
  ptsTextMe: { color: CHAMPION_GOLD },
});

export interface LeaderboardRowProps {
  entry: LeaderboardEntry;
}

const LeaderboardRowComponent: React.FC<LeaderboardRowProps> = ({ entry }) => {
  // Marks the prize-winning ranks. Rank-based only: after a season that fell
  // short the top ranks keep this styling, because it marks position, not a
  // prize entitlement — the tier cards are what state what is actually won.
  const isTopRank = entry.rank <= PHONE_PRIZE_MAX_RANK;

  return (
    <View style={[styles.row, isTopRank && styles.rowTopRank, entry.isCurrentUser && styles.rowMe]}>
      <View style={[styles.rankCol, isTopRank && styles.rankColTopRank]}>
        <Text style={[styles.rankNum, isTopRank && styles.rankNumTopRank]}>{entry.rank}</Text>
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

      <Text
        style={[
          styles.ptsText,
          isTopRank && styles.ptsTextTopRank,
          entry.isCurrentUser && styles.ptsTextMe,
        ]}
      >
        {entry.totalPoints.toLocaleString()} pt
      </Text>
    </View>
  );
};

export const LeaderboardRow = memo(LeaderboardRowComponent);
LeaderboardRow.displayName = 'LeaderboardRow';
