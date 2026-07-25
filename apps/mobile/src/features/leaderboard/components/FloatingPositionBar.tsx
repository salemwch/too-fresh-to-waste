import React, { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Platform } from 'react-native';
import FastImage from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOptimizedImageUrl, IMAGE_PRESETS } from '@/utils/imageTransform';

import type { LeaderboardEntry } from '../types/leaderboard.types';

const PRIMARY_DARK = '#1E4448';
const CHAMPION_GOLD = '#c4a25a';

interface FloatingPositionBarProps {
  entry: LeaderboardEntry;
  visible: boolean;
  onPress: () => void;
}

const FloatingPositionBarComponent: React.FC<FloatingPositionBarProps> = ({
  entry,
  visible,
  onPress,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : 100,
      duration: 250,
      easing: visible ? Easing.out(Easing.ease) : Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  const initials = `${entry.firstName[0] ?? '?'}${entry.lastName[0] ?? ''}`.toUpperCase();
  const optimizedUri =
    entry.profileImage != null
      ? (getOptimizedImageUrl(entry.profileImage, IMAGE_PRESETS.avatar) ?? entry.profileImage)
      : null;

  const bottomPad = Math.max(insets.bottom, 12);

  return (
    <Animated.View
      style={[styles.wrapper, { transform: [{ translateY }], paddingBottom: bottomPad }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <Pressable
        style={styles.bar}
        onPress={onPress}
        accessibilityRole='button'
        accessibilityLabel={`Your position: rank ${entry.rank}`}
        accessibilityHint={t('leaderboard.a11yPositionBarHint')}
      >
        {/* Avatar */}
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

        {/* Name + rank */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {entry.firstName} {entry.lastName}
          </Text>
          <Text style={styles.points}>{entry.totalPoints.toLocaleString()} pts</Text>
        </View>

        {/* Rank badge */}
        <View style={styles.rankBadge}>
          <Text style={styles.rankHash}>#</Text>
          <Text style={styles.rankNum}>{entry.rank.toLocaleString()}</Text>
        </View>

        {/* Percentile pill */}
        {entry.percentile != null && (
          <View style={styles.percentilePill}>
            <Text style={styles.percentileTxt}>Top {entry.percentile}%</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export const FloatingPositionBar = memo(FloatingPositionBarComponent);

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY_DARK,
    borderRadius: 16,
    padding: 10,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  points: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  rankBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  rankHash: {
    fontSize: 12,
    fontWeight: '600',
    color: CHAMPION_GOLD,
  },
  rankNum: {
    fontSize: 18,
    fontWeight: '800',
    color: CHAMPION_GOLD,
  },
  percentilePill: {
    backgroundColor: `${CHAMPION_GOLD}25`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  percentileTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: CHAMPION_GOLD,
  },
});
