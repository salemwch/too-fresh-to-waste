/**
 * PremiumPointsCard
 * Hero card with tier-coloured gradient, avatar, animated points counter,
 * and an animated progress bar toward the next tier.
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Avatar, Icon, Text } from '@/design-system/components/atoms';

import { getTierConfig, getTierProgress, getPointsToNextTier } from '../constants/tiers';

import { AnimatedCounter } from './AnimatedCounter';

import type { TierName } from '../types/loyalty.types';
import { useCurrentUser } from '@/features/auth/hooks/useCurrentUser';
import { spacingTokens } from '@/design-system/tokens/spacing';

const { base: sp } = spacingTokens;

/** Teal gradient matching the app's --gradient-teal CSS variable */
const HERO_GRADIENT: [string, string] = ['#005251', '#2DB89B'];
const INVERSE_TEXT = '#FFFFFF';
const INVERSE_TEXT_MUTED = 'rgba(255,255,255,0.75)';
const INVERSE_TRACK = 'rgba(255,255,255,0.25)';
const SHADOW = '#000';

interface PremiumPointsCardProps {
  availablePoints: number;
  lifetimePointsEarned: number;
  currentTier: TierName;
  votingLive?: boolean;
}

const PremiumPointsCardComponent: React.FC<PremiumPointsCardProps> = ({
  availablePoints,
  lifetimePointsEarned,
  currentTier,
  votingLive,
}) => {
  const { user } = useCurrentUser();
  const userImageUri = user?.profileImage ?? user?.avatar ?? undefined;

  const tierConfig = getTierConfig(currentTier);
  const progress = getTierProgress(currentTier, lifetimePointsEarned);
  const pointsToNext = getPointsToNextTier(currentTier, lifetimePointsEarned);

  // Animate progress bar width from 0 → progress
  const [progressAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // Sparkle animation for the voting star
  const [starRotate] = useState(() => new Animated.Value(0));
  const [starScale] = useState(() => new Animated.Value(1));
  const [starOpacity] = useState(() => new Animated.Value(0.7));

  useEffect(() => {
    if (!votingLive) {
      starRotate.setValue(0);
      starScale.setValue(1);
      starOpacity.setValue(0.7);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(starRotate, { toValue: 15, duration: 500, useNativeDriver: true }),
          Animated.timing(starScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(starOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(starRotate, { toValue: -15, duration: 500, useNativeDriver: true }),
          Animated.timing(starScale, { toValue: 1.2, duration: 500, useNativeDriver: true }),
          Animated.timing(starOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(starRotate, { toValue: 0, duration: 500, useNativeDriver: true }),
          Animated.timing(starScale, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(starOpacity, { toValue: 0.7, duration: 500, useNativeDriver: true }),
        ]),
        Animated.delay(2500),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [votingLive, starRotate, starScale, starOpacity]);

  const starRotateInterp = starRotate.interpolate({
    inputRange: [-15, 0, 15],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  const progressWidth = useMemo(
    () =>
      progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
      }),
    [progressAnim],
  );
  const tierBadgeStyle = { backgroundColor: tierConfig.gradientStart };
  const progressFillStyle = { width: progressWidth };

  const initials =
    user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : 'U';

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
            size='xl'
            initials={initials}
            {...(userImageUri !== undefined && { uri: userImageUri })}
            variant='circular'
          />
          <View style={styles.nameColumn}>
            <Text variant='body' size='lg' weight='bold' style={styles.userName}>
              {user?.firstName ?? ''}
            </Text>
            <Text variant='body' size='sm' style={styles.userLastName}>
              {user?.lastName ?? ''}
            </Text>
          </View>
        </View>
        <View style={[styles.tierBadge, tierBadgeStyle]}>
          <Icon name={tierConfig.icon} family='Ionicons' size={16} color={INVERSE_TEXT} />
          <Text variant='body' size='sm' weight='bold' style={styles.tierBadgeText}>
            {currentTier}
          </Text>
          {votingLive && (
            <Animated.Text
              style={[
                styles.starIcon,
                {
                  transform: [{ rotate: starRotateInterp }, { scale: starScale }],
                  opacity: starOpacity,
                },
              ]}
            >
              ⭐
            </Animated.Text>
          )}
        </View>
      </View>

      {/* Points */}
      <View style={styles.pointsSection}>
        <AnimatedCounter
          value={availablePoints}
          variant='headline'
          size='xl'
          weight='bold'
          color={INVERSE_TEXT}
        />
        <Text variant='body' size='sm' style={styles.pointsSubtitle}>
          Available Points
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[styles.progressFill, styles.progressFillSurface, progressFillStyle]}
          />
        </View>
        <Text variant='body' size='xs' style={styles.progressCaption}>
          {pointsToNext > 0
            ? `${pointsToNext.toLocaleString()} pts to next tier`
            : 'Maximum tier reached'}
        </Text>
      </View>
    </LinearGradient>
  );
};

export const PremiumPointsCard = memo(PremiumPointsCardComponent);
PremiumPointsCardComponent.displayName = 'PremiumPointsCard';

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: SHADOW,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sp[5],
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameColumn: {
    marginStart: sp[3],
  },
  userName: {
    color: INVERSE_TEXT,
  },
  userLastName: {
    color: INVERSE_TEXT_MUTED,
    marginTop: 1,
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: sp[3],
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierBadgeText: {
    color: INVERSE_TEXT,
    marginStart: 4,
  },
  starIcon: {
    position: 'absolute',
    top: -8,
    insetInlineEnd: -8,
    fontSize: 14,
  },
  pointsSection: {
    alignItems: 'center',
    marginBottom: sp[5],
  },
  pointsSubtitle: {
    color: INVERSE_TEXT,
    opacity: 0.8,
    marginTop: 2,
  },
  progressSection: {
    alignItems: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: INVERSE_TRACK,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFillSurface: {
    backgroundColor: INVERSE_TEXT,
  },
  progressCaption: {
    color: INVERSE_TEXT,
    opacity: 0.8,
    marginTop: 6,
  },
});
