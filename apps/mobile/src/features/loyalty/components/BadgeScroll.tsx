/**
 * BadgeScroll
 * Horizontal FlatList of badges: earned (colour) + locked (gray).
 */

import React, { memo, useCallback, useMemo } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';

import { BADGE_METADATA, ALL_BADGE_TYPES, type BadgeMetadata } from '../constants/badges';

import type { Badge, BadgeType } from '../types/loyalty.types';

interface BadgeScrollProps {
  earnedBadges: Badge[];
}

interface BadgeItem {
  meta: BadgeMetadata;
  earned: boolean;
  earnedAt?: string;
}

const BADGE_ITEM_WIDTH = 90;
const LOCKED_BADGE_BACKGROUND = '#F1F5F9';
const LOCKED_BADGE_BORDER = '#E2E8F0';
const LOCKED_ICON_COLOR = '#CBD5E1';
const LOCKED_TEXT_COLOR = '#94A3B8';
const SURFACE = '#FFFFFF';

const BadgeCell: React.FC<{ item: BadgeItem }> = ({ item }) => {
  const iconCircleStyle = {
    backgroundColor: item.earned ? item.meta.bgColor : LOCKED_BADGE_BACKGROUND,
    borderColor: item.earned ? item.meta.color : LOCKED_BADGE_BORDER,
  };
  const badgeIconColor = item.earned ? item.meta.color : LOCKED_ICON_COLOR;

  return (
    <View style={styles.badgeCell}>
      <View style={[styles.iconCircle, iconCircleStyle]}>
        <Icon
          name={item.meta.icon}
          family={item.meta.iconFamily}
          size={28}
          color={badgeIconColor}
        />
        {!item.earned && (
          <View style={styles.lockOverlay}>
            <Icon name='lock-closed' family='Ionicons' size={12} color={LOCKED_TEXT_COLOR} />
          </View>
        )}
      </View>
      <Text
        variant='body'
        size='xs'
        weight={item.earned ? 'semibold' : 'regular'}
        style={[styles.badgeTitle, !item.earned && styles.lockedText]}
        numberOfLines={2}
      >
        {item.meta.title}
      </Text>
    </View>
  );
};

const BadgeScrollComponent: React.FC<BadgeScrollProps> = ({ earnedBadges }) => {
  const earnedSet = useMemo(() => {
    const set = new Set<string>();
    earnedBadges.forEach(b => set.add(b.type));
    return set;
  }, [earnedBadges]);

  const items: BadgeItem[] = useMemo(() => {
    const earnedMap = new Map<string, Badge>();
    earnedBadges.forEach(b => earnedMap.set(b.type, b));

    return ALL_BADGE_TYPES.map((type: BadgeType) => {
      const earnedAt = earnedMap.get(type)?.earnedAt;
      return {
        meta: BADGE_METADATA[type],
        earned: earnedSet.has(type),
        ...(earnedAt !== undefined && { earnedAt }),
      };
    });
  }, [earnedBadges, earnedSet]);

  // Sort: earned first, then locked
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => (a.earned === b.earned ? 0 : a.earned ? -1 : 1)),
    [items],
  );

  const renderBadgeItem = useCallback(
    ({ item }: { item: BadgeItem }) => <BadgeCell item={item} />,
    [],
  );

  const earnedCount = earnedBadges.length;
  const totalCount = ALL_BADGE_TYPES.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text variant='title' size='md' weight='semibold'>
          Badges
        </Text>
        <Text variant='body' size='sm' color='secondary'>
          {earnedCount}/{totalCount}
        </Text>
      </View>
      <FlatList
        data={sortedItems}
        keyExtractor={item => item.meta.type}
        renderItem={renderBadgeItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        getItemLayout={(_, index) => ({
          length: BADGE_ITEM_WIDTH + 8,
          offset: (BADGE_ITEM_WIDTH + 8) * index,
          index,
        })}
      />
    </View>
  );
};

export const BadgeScroll = memo(BadgeScrollComponent);
BadgeScrollComponent.displayName = 'BadgeScroll';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  listContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  badgeCell: {
    width: BADGE_ITEM_WIDTH,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 6,
  },
  lockOverlay: {
    position: 'absolute',
    bottom: -2,
    insetInlineEnd: -2,
    backgroundColor: SURFACE,
    borderRadius: 10,
    padding: 2,
  },
  badgeTitle: {
    textAlign: 'center',
    lineHeight: 14,
  },
  lockedText: {
    color: LOCKED_TEXT_COLOR,
  },
});
