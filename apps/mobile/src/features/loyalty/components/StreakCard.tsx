/**
 * StreakCard
 * Login streak + Purchase streak with gradient animated progress bars.
 *
 * Progress bar gradients:
 *   Teal:  hsl(179,100%,16%) → hsl(174,62%,47%)  ≈ #005251 → #2DB89B
 *   Gold:  hsl(43,96%,56%)   → hsl(36,75%,43%)   ≈ #F5C518 → #BF7E1E
 *
 * Backend constants:
 *   Login:    10 days, +2 pts/day, max 20 pts/month
 *   Purchase: 15 bags in 15 days, +10 pts bonus
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text } from '@/design-system/components/atoms';

import type { GamificationStats } from '../types/loyalty.types';

interface StreakCardProps {
  gamification: GamificationStats;
}

// ---------------------------------------------------------------------------
// Gradient configs
// ---------------------------------------------------------------------------

const TEAL_GRADIENT: [string, string] = ['#005251', '#2DB89B'];
const GOLD_GRADIENT: [string, string] = ['#F5C518', '#BF7E1E'];
const BAR_BG = '#E5E7EB'; // neutral grey

// ---------------------------------------------------------------------------
// StreakRow
// ---------------------------------------------------------------------------

interface StreakRowProps {
  emoji: string;
  title: string;
  valueBadge: string;
  valueBadgeColor: string;
  current: number;
  target: number;
  gradientColors: [string, string];
  progressLabel: string;
  detailsLabel: string;
}

const StreakRow: React.FC<StreakRowProps> = ({
  emoji,
  title,
  valueBadge,
  valueBadgeColor,
  current,
  target,
  gradientColors,
  progressLabel,
  detailsLabel,
}) => {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const ratio = target > 0 ? Math.min(current / target, 1) : 0;

  useEffect(() => {
    progressAnim.setValue(0);
    Animated.timing(progressAnim, {
      toValue: ratio,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [ratio, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.streakRow}>
      {/* Header */}
      <View style={styles.streakHeader}>
        <View style={styles.titleRow}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text variant="body" size="md" weight="semibold" style={styles.title}>
            {title}
          </Text>
        </View>
        <Text variant="body" size="sm" weight="bold" style={{ color: valueBadgeColor }}>
          {valueBadge}
        </Text>
      </View>

      {/* Gradient progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFillWrap, { width: progressWidth }]}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.progressGradient}
          />
        </Animated.View>
      </View>

      {/* Footer */}
      <View style={styles.streakFooter}>
        <Text variant="body" size="xs" color="secondary">
          {progressLabel}
        </Text>
        <Text variant="body" size="xs" color="secondary">
          {detailsLabel}
        </Text>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// StreakCard
// ---------------------------------------------------------------------------

const StreakCardComponent: React.FC<StreakCardProps> = ({ gamification }) => {
  const { loginStreak, purchaseStreak } = gamification;

  const loginPointsUsed = loginStreak.pointsEarnedThisMonth;
  const loginMaxPts = loginStreak.maxPointsPerMonth;

  return (
    <View style={styles.container}>
      <Text variant="body" size="xs" weight="semibold" style={styles.sectionLabel}>
        ACTIVE STREAKS
      </Text>

      <View style={styles.card}>
        {/* Login Streak */}
        <StreakRow
          emoji={'\uD83D\uDD25'}
          title="Login Streak"
          valueBadge={`${loginStreak.currentStreak} day${loginStreak.currentStreak !== 1 ? 's' : ''}`}
          valueBadgeColor="#005250"
          current={loginStreak.currentStreak}
          target={loginStreak.daysRequired}
          gradientColors={TEAL_GRADIENT}
          progressLabel={`${loginStreak.currentStreak}/${loginStreak.daysRequired}`}
          detailsLabel={`+2 pts/day \u2022 ${loginPointsUsed}/${loginMaxPts} pts month`}
        />

        <View style={styles.divider} />

        {/* Purchase Streak */}
        <StreakRow
          emoji={'\uD83D\uDECD\uFE0F'}
          title="Purchase Streak"
          valueBadge={`${purchaseStreak.bagsThisPeriod} bag${purchaseStreak.bagsThisPeriod !== 1 ? 's' : ''}`}
          valueBadgeColor="#BF7E1E"
          current={purchaseStreak.bagsThisPeriod}
          target={purchaseStreak.bagsRequired}
          gradientColors={GOLD_GRADIENT}
          progressLabel={`${purchaseStreak.bagsThisPeriod}/${purchaseStreak.bagsRequired}`}
          detailsLabel={`${purchaseStreak.daysRemaining} days left \u2022 +10 pts bonus`}
        />
      </View>
    </View>
  );
};

export const StreakCard = React.memo(StreakCardComponent);
StreakCardComponent.displayName = 'StreakCard';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: '#64748B',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  streakRow: {
    paddingVertical: 4,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 18,
    marginRight: 8,
  },
  title: {
    color: '#1F2937',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: BAR_BG,
  },
  progressFillWrap: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressGradient: {
    flex: 1,
  },
  streakFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
});
