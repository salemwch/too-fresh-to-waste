import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';

import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';

import type { LeaderboardNeighborhoodEntry } from '../types/leaderboard.types';
import { colorTokens } from '@/design-system/tokens/colors';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

const PRIMARY_DARK = colorTokens.base.primary[500];
const CHAMPION_GOLD = '#c4a25a';
const SURFACE = '#FFFFFF';
const SURFACE_MUTED = '#F4F7F7';
const TEXT_DARK = '#0F2628';
const TEXT_MUTED = '#4B6264';
const TEXT_LIGHT = '#8FA6A9';
const BORDER = '#E8EEEF';

interface NeighborhoodSectionProps {
  entries: LeaderboardNeighborhoodEntry[];
  isLoading: boolean;
}

const NeighborhoodRow: React.FC<{ entry: LeaderboardNeighborhoodEntry }> = ({ entry }) => {
  const isAnchor = entry.isAnchor;
  const initials = `${entry.firstName?.[0] ?? '?'}${entry.lastName?.[0] ?? ''}`.toUpperCase();
  const optimizedUri =
    entry.profileImage != null
      ? (getOptimizedImageUrl(entry.profileImage, IMAGE_PRESETS.avatar) ?? entry.profileImage)
      : null;

  return (
    <View style={[styles.row, isAnchor && styles.rowAnchor]}>
      <View style={[styles.rankCol, isAnchor && styles.rankColAnchor]}>
        <Text style={[styles.rankNum, isAnchor && styles.rankNumAnchor]}>{entry.rank}</Text>
      </View>

      {optimizedUri != null ? (
        <FastImage
          source={{ uri: optimizedUri, priority: FastImage.priority.normal }}
          style={styles.avatar}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
      )}

      <View style={styles.nameCol}>
        <Text style={[styles.name, isAnchor && styles.nameAnchor]} numberOfLines={1}>
          {entry.firstName} {entry.lastName}
        </Text>
        {entry.currentBadge != null && (
          <Text style={styles.badge} numberOfLines={1}>
            {entry.currentBadge}
          </Text>
        )}
      </View>

      <View style={[styles.ptsPill, isAnchor && styles.ptsPillAnchor]}>
        <Text style={[styles.ptsText, isAnchor && styles.ptsTextAnchor]}>
          {(entry.totalPoints ?? 0).toLocaleString()} pt
        </Text>
      </View>
    </View>
  );
};

const MemoNeighborhoodRow = memo(NeighborhoodRow);

const NeighborhoodSectionComponent: React.FC<NeighborhoodSectionProps> = ({
  entries,
  isLoading,
}) => {
  const { t } = useTranslation();
  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size='small' color={PRIMARY_DARK} />
      </View>
    );
  }

  if (entries.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.divider} />
      <Text style={styles.header}>{t('leaderboard.yourNeighborhood')}</Text>
      <Text style={styles.subtitle}>{t('leaderboard.nearbyCompetitors')}</Text>
      {entries.map(entry => (
        <MemoNeighborhoodRow key={entry.userId} entry={entry} />
      ))}
    </View>
  );
};

export const NeighborhoodSection = memo(NeighborhoodSectionComponent);

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingHorizontal: sp[5],
    paddingBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: TEXT_LIGHT,
    marginBottom: 14,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: SURFACE,
    borderRadius: 14,
    padding: sp[3],
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  rowAnchor: {
    borderColor: CHAMPION_GOLD,
    borderWidth: 1.5,
    backgroundColor: `${CHAMPION_GOLD}08`,
  },
  rankCol: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${PRIMARY_DARK}08`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankColAnchor: {
    backgroundColor: `${CHAMPION_GOLD}20`,
  },
  rankNum: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_LIGHT,
  },
  rankNumAnchor: {
    color: CHAMPION_GOLD,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: `${PRIMARY_DARK}18`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: PRIMARY_DARK,
  },
  nameCol: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_DARK,
  },
  nameAnchor: {
    fontWeight: '600',
    color: PRIMARY_DARK,
  },
  badge: {
    fontSize: 11,
    color: TEXT_LIGHT,
    marginTop: 1,
  },
  ptsPill: {
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: SURFACE_MUTED,
  },
  ptsPillAnchor: {
    backgroundColor: `${CHAMPION_GOLD}15`,
  },
  ptsText: {
    fontSize: 12,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  ptsTextAnchor: {
    color: CHAMPION_GOLD,
  },
});
