/**
 * PodiumTop3 — the three prize-winning places, arranged as a podium.
 *
 * Rendered in visual order 3-1-2 so the champion sits centre with the runners-up
 * stepping down either side. Rank still comes from the entry itself; only the
 * layout order is rearranged.
 *
 * Was PodiumTop5. The season awards the grand prize to three places, so showing
 * five put two people on a podium who win nothing — the podium contradicted the
 * tier card directly beside it. Ranks 4 and 5 are still in the list below,
 * under the rule that marks where winning stops.
 *
 * The metals are shared with LeaderboardRow through the palette, so the podium
 * and the list cannot drift into disagreeing about who is second.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '../UserAvatar';

import {
  BG_CREAM,
  BG_PODIUM,
  BG_PODIUM_FIRST,
  BRONZE,
  CHAMPION_GOLD,
  SILVER,
  TEXT_MUTED,
  TEXT_PRIMARY,
  SURFACE,
} from '../../constants/palette';

import type { LeaderboardEntry } from '../../types/leaderboard.types';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp, radius } = spacingTokens;

/** Visual left-to-right order, not ranking order. */
const PODIUM_ORDER = [3, 1, 2] as const;

/** Below two entries there is no podium to show — the list covers it. */
const MIN_ENTRIES = 2;

const AVATAR_CHAMPION = 88;
const AVATAR_RUNNER_UP = 64;

/** Chip colour per place; also the row tint source in LeaderboardRow. */
const MEDAL_COLOR: Record<number, string> = {
  1: CHAMPION_GOLD,
  2: SILVER,
  3: BRONZE,
};

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: sp.md,
    paddingTop: sp.lg,
    gap: 6,
  },
  item: { flex: 1, alignItems: 'center' },
  crown: {
    fontSize: 26,
    lineHeight: 28,
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
  medal: { fontSize: 20, lineHeight: 24 },
  /** Cream gap between the avatar and its gold ring, so the ring reads as a ring. */
  championRing: {
    padding: 3,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: CHAMPION_GOLD,
    backgroundColor: BG_CREAM,
  },
  chip: {
    marginTop: -14,
    width: 30,
    height: 30,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: BG_CREAM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '800', color: SURFACE },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginTop: 6,
    textAlign: 'center',
  },
  pts: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },
  ptsChampion: { fontSize: 20, fontWeight: '800', color: CHAMPION_GOLD, letterSpacing: -0.3 },
  block3: {
    width: '100%',
    marginTop: 10,
    backgroundColor: BG_PODIUM,
    borderStartStartRadius: radius.lg,
    borderStartEndRadius: radius.lg,
    height: 46,
  },
  blockChampion: { backgroundColor: BG_PODIUM_FIRST, height: 74 },
});

export interface PodiumTop3Props {
  entries: LeaderboardEntry[];
}

export const PodiumTop3: React.FC<PodiumTop3Props> = ({ entries }) => {
  if (entries.length < MIN_ENTRIES) return null;

  return (
    <View style={styles.block}>
      {PODIUM_ORDER.map(rank => {
        const entry = entries[rank - 1];
        // Fewer than three players: hold the slot so the podium stays centred.
        if (entry == null) return <View key={rank} style={styles.item} />;

        const isChampion = rank === 1;
        const avatar = (
          <UserAvatar
            uri={entry.profileImage}
            firstName={entry.firstName}
            lastName={entry.lastName}
            size={isChampion ? AVATAR_CHAMPION : AVATAR_RUNNER_UP}
          />
        );

        return (
          <View key={entry.userId} style={styles.item}>
            {isChampion ? (
              <Text style={styles.crown}>👑</Text>
            ) : (
              <Text style={styles.medal}>{rank === 2 ? '🥈' : '🥉'}</Text>
            )}

            {isChampion ? <View style={styles.championRing}>{avatar}</View> : avatar}

            <View style={[styles.chip, { backgroundColor: MEDAL_COLOR[rank] }]}>
              <Text style={styles.chipText}>{rank}</Text>
            </View>

            <Text style={styles.name} numberOfLines={1}>
              {entry.firstName}
            </Text>
            <Text style={isChampion ? styles.ptsChampion : styles.pts}>
              {(entry.totalPoints ?? 0).toLocaleString()}
            </Text>

            <View style={[styles.block3, isChampion && styles.blockChampion]} />
          </View>
        );
      })}
    </View>
  );
};
