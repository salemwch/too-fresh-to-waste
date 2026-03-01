/**
 * PremiumPointsCard
 * Hero card with tier-coloured gradient, avatar, animated points counter,
 * and an animated progress bar toward the next tier.
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Avatar, Icon, Text } from '@/design-system/components/atoms';
import { useAppSelector } from '@/hooks/redux';

import { getTierConfig, getTierProgress, getPointsToNextTier } from '../constants/tiers';
import type { TierName } from '../types/loyalty.types';

import { AnimatedCounter } from './AnimatedCounter';

/** Teal gradient matching the app's --gradient-teal CSS variable */
const HERO_GRADIENT: [string, string] = ['#005251', '#2DB89B'];

interface PremiumPointsCardProps {
  availablePoints: number;
  lifetimePointsEarned: number;
  currentTier: TierName;
}

const PremiumPointsCardComponent: React.FC<PremiumPointsCardProps> = ({
  availablePoints,
  lifetimePointsEarned,
  currentTier,
}) => {
  const { user } = useAppSelector((s) => s.auth);
  const userImageUri = user?.profileImage ?? user?.avatar ?? undefined;

  const tierConfig = getTierConfig(currentTier);
  const progress = getTierProgress(currentTier, lifetimePointsEarned);
  const pointsToNext = getPointsToNextTier(currentTier, lifetimePointsEarned);

  // Animate progress bar width from 0 → progress
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const initials =
    user?.firstName && user?.lastName
      ? `${user.firstName[0]}${user.lastName[0]}`
      : 'U';

  return (
    <LinearGradient
      colors={HERO_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      {/* Top: Avatar + Name + Tier badge */}
      <View style={styles.topRow}>
        <View style={styles.userInfo}>
          <Avatar
            size="xl"
            initials={initials}
            {...(userImageUri !== undefined && { uri: userImageUri })}
            variant="circular"
          />
          <View style={styles.nameColumn}>
            <Text variant="body" size="lg" weight="bold" style={styles.userName}>
              {user?.firstName ?? ''}
            </Text>
            <Text variant="body" size="sm" style={styles.userLastName}>
              {user?.lastName ?? ''}
            </Text>
          </View>
        </View>
        <View style={[styles.tierBadge, { backgroundColor: tierConfig.gradientStart }]}>
          <Icon
            name={tierConfig.icon}
            family="Ionicons"
            size={16}
            color="#FFFFFF"
          />
          <Text
            variant="body"
            size="sm"
            weight="bold"
            style={{ color: '#FFFFFF', marginLeft: 4 }}
          >
            {currentTier}
          </Text>
        </View>
      </View>

      {/* Points */}
      <View style={styles.pointsSection}>
        <AnimatedCounter
          value={availablePoints}
          variant="headline"
          size="xl"
          weight="bold"
          color="#FFFFFF"
        />
        <Text
          variant="body"
          size="sm"
          style={{ color: '#FFFFFF', opacity: 0.8, marginTop: 2 }}
        >
          Available Points
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
                backgroundColor: '#FFFFFF',
              },
            ]}
          />
        </View>
        <Text
          variant="body"
          size="xs"
          style={{ color: '#FFFFFF', opacity: 0.8, marginTop: 6 }}
        >
          {pointsToNext > 0
            ? `${pointsToNext.toLocaleString()} pts to next tier`
            : 'Maximum tier reached'}
        </Text>
      </View>
    </LinearGradient>
  );
};

export const PremiumPointsCard = React.memo(PremiumPointsCardComponent);
PremiumPointsCardComponent.displayName = 'PremiumPointsCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameColumn: {
    marginLeft: 12,
  },
  userName: {
    color: '#FFFFFF',
  },
  userLastName: {
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pointsSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  progressSection: {
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
