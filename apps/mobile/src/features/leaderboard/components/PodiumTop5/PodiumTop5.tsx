/**
 * PodiumTop5 — the top five, arranged as a podium.
 *
 * Rendered in visual order 5-3-1-2-4 so the champion sits centre with the
 * runners-up stepping down either side. Rank still comes from the entry itself;
 * only the layout order is rearranged.
 */

import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { UserAvatar } from '../UserAvatar';

import {
  CHAMPION_GOLD,
  GOLD_35,
  GOLD_60,
  TEXT_25,
  TEXT_40,
  TEXT_60,
  WHITE_08,
  WHITE_10,
} from '../../constants/palette';

import type { LeaderboardEntry } from '../../types/leaderboard.types';

/** Visual left-to-right order, not ranking order. */
const PODIUM_ORDER = [5, 3, 1, 2, 4] as const;

/** Below two entries there is no podium to show — the list covers it. */
const MIN_ENTRIES = 2;

const AVATAR_SIZE_CHAMPION = 68;
const AVATAR_SIZE_MEDAL = 52;
const AVATAR_SIZE_REST = 42;

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 6,
  },
  item: {
    flex: 1,
    maxWidth: 72,
    alignItems: 'center',
    gap: 5,
    marginBottom: 6,
  },
  itemChampion: { marginBottom: 16 },
  crown: {
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
  medal: { fontSize: 16 },
  numBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: WHITE_08,
    borderWidth: 1.5,
    borderColor: WHITE_10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numText: {
    fontSize: 10,
    fontWeight: '800',
    color: TEXT_40,
  },
  name: {
    fontSize: 10,
    fontWeight: '600',
    color: TEXT_60,
    maxWidth: 62,
    textAlign: 'center',
  },
  nameChampion: { color: CHAMPION_GOLD, fontSize: 11, fontWeight: '700' },
  pts: { fontSize: 9, color: TEXT_25, fontWeight: '500' },
  ptsChampion: { color: GOLD_60 },
});

export interface PodiumTop5Props {
  entries: LeaderboardEntry[];
}

export const PodiumTop5: React.FC<PodiumTop5Props> = ({ entries }) => {
  if (entries.length < MIN_ENTRIES) return null;

  return (
    <View style={styles.block}>
      {PODIUM_ORDER.map(rank => {
        const entry = entries[rank - 1];
        // Fewer than five players: hold the slot so the podium stays centred.
        if (entry == null) return <View key={rank} style={styles.item} />;

        const isChampion = rank === 1;
        const isMedal = rank === 2 || rank === 3;

        const avatarSize = isChampion
          ? AVATAR_SIZE_CHAMPION
          : isMedal
            ? AVATAR_SIZE_MEDAL
            : AVATAR_SIZE_REST;
        const borderColor = isChampion ? CHAMPION_GOLD : isMedal ? GOLD_35 : WHITE_08;

        return (
          <View key={entry.userId} style={[styles.item, isChampion && styles.itemChampion]}>
            {/* Crown for #1, medals for #2/#3, a numbered badge for #4/#5. */}
            {isChampion && <Text style={styles.crown}>👑</Text>}
            {rank === 2 && <Text style={styles.medal}>🥈</Text>}
            {rank === 3 && <Text style={styles.medal}>🥉</Text>}
            {rank >= 4 && (
              <View style={styles.numBadge}>
                <Text style={styles.numText}>{rank}</Text>
              </View>
            )}

            <UserAvatar
              uri={entry.profileImage}
              firstName={entry.firstName}
              lastName={entry.lastName}
              size={avatarSize}
              borderColor={borderColor}
            />

            <Text style={[styles.name, isChampion && styles.nameChampion]} numberOfLines={1}>
              {entry.firstName}
            </Text>
            <Text style={[styles.pts, isChampion && styles.ptsChampion]}>
              {entry.totalPoints.toLocaleString()}
            </Text>
          </View>
        );
      })}
    </View>
  );
};
