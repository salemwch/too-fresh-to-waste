/**
 * VotingCard
 * Community voting card with glassmorphism design — transparent background,
 * animated neon green border glow.
 *
 * States:
 *   ACTIVE            → community challenge progress bar
 *   BALLOT_OPEN + can vote    → "Vote Now" CTA + countdown
 *   BALLOT_OPEN + voted       → checkmark + voted prize name
 *   BALLOT_OPEN + not eligible → locked + "Save X more bags"
 *   COMPLETED (≤7 days)       → Victory Lap: gold glow + confetti
 *   COMPLETED (>7 days)       → Anticipation Hook: teaser card
 *   no cycle / loading        → null
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type DimensionValue,
} from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';
import { useAppSelector } from '@/hooks/redux';

import { useActiveVotingCycle } from '../hooks/useVoting';
import {
  useClaimVotingPrize,
  useVotingPrizeStatus,
  votingPrizeToClaimData,
} from '../hooks/useVotingPrize';

import { DiscountClaimModal } from '@/features/leaderboard/components/DiscountClaimModal';
import { VoteBottomSheet } from './VoteBottomSheet';

// Colors from design system
const PRIMARY_500 = colorTokens.base.primary[500];
const PRIMARY_300 = colorTokens.base.primary[300];
const PRIMARY_200 = colorTokens.base.primary[200];
const PRIMARY_50 = colorTokens.base.primary[50];
const ACCENT_500 = colorTokens.base.accent[500];
const SUCCESS = colorTokens.base.success[500];
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#64748B';
const GOLD = '#B8860B';
const GOLD_BORDER = '#FFD700';

const MS_PER_DAY = 86_400_000;
const VICTORY_LAP_DAYS = 7;

// ── Helpers ──

function getCountdown(ballotClosesAt: string | null): string {
  if (!ballotClosesAt) return '';
  const diff = new Date(ballotClosesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closing soon…';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m left`;
}

function getDaysSinceAnnounced(announcedAt: string | null | undefined): number {
  if (!announcedAt) return Infinity;
  return (Date.now() - new Date(announcedAt).getTime()) / MS_PER_DAY;
}

// ── Animated Border Wrapper ──

interface GlowCardProps {
  children: React.ReactNode;
  variant: 'neon' | 'neon-slow' | 'gold' | 'gold-slow' | 'static';
}

const GlowCard: React.FC<GlowCardProps> = ({ children, variant }) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (variant === 'static') return;

    const duration =
      variant === 'neon' ? 3000 : variant === 'neon-slow' ? 6000 : variant === 'gold' ? 3000 : 6000;

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [glowAnim, variant]);

  const isGold = variant === 'gold' || variant === 'gold-slow';
  const baseColor = isGold ? GOLD_BORDER : PRIMARY_300;
  const shadowColor = isGold ? GOLD_BORDER : PRIMARY_200;

  const borderOpacity =
    variant === 'static'
      ? 0.3
      : glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: isGold
            ? variant === 'gold-slow'
              ? [0.3, 0.6]
              : [0.4, 0.9]
            : variant === 'neon-slow'
              ? [0.4, 0.7]
              : [0.6, 1.0],
        });

  const shadowOpacity =
    variant === 'static'
      ? 0.1
      : glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.15, 0.4],
        });

  return (
    <Animated.View
      style={[
        styles.card,
        Platform.OS === 'ios' && {
          shadowColor: shadowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: shadowOpacity as unknown as number,
          shadowRadius: 15,
        },
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.cardBorderOverlay,
          { borderColor: baseColor, opacity: borderOpacity as unknown as number },
        ]}
      />
      {children}
    </Animated.View>
  );
};

// ── Confetti Particle ──

const ConfettiParticle: React.FC<{ emoji: string; delay: number; left: DimensionValue }> = ({
  emoji,
  delay,
  left,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [anim, delay]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [60, -30] });
  const opacity = anim.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 1, 0.6, 0],
  });
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '25deg'] });

  return (
    <Animated.Text
      style={[
        styles.confetti,
        {
          left,
          transform: [{ translateY }, { rotate }],
          opacity,
        },
      ]}
    >
      {emoji}
    </Animated.Text>
  );
};

// ── Main Component ──

export const VotingCard: React.FC = () => {
  const { cycle, eligibility, myVote, isLoading } = useActiveVotingCycle();
  const [showVoteSheet, setShowVoteSheet] = useState(false);
  const [showPrizeModal, setShowPrizeModal] = useState(false);

  // Prize hooks — must be declared before any early return (rules-of-hooks).
  // isCompletedCycle uses optional chaining so it's safe when cycle is null.
  const isCompletedCycle = cycle?.status === 'COMPLETED';
  const { data: votingPrize } = useVotingPrizeStatus(isCompletedCycle);
  const claimVotingPrize = useClaimVotingPrize();
  const firstName = useAppSelector(state => state.auth.user?.firstName ?? '');

  if (isLoading || !cycle) return null;
  if (cycle.status === 'ARCHIVED' || cycle.status === 'EXPIRED') return null;

  // ── Phase determination ──
  const isCompleted = cycle.status === 'COMPLETED';
  const isBallotOpen = cycle.status === 'BALLOT_OPEN';
  const isTallying = cycle.status === 'TALLYING';
  const daysSinceAnnounced = isCompleted ? getDaysSinceAnnounced(cycle.winner?.announcedAt) : 0;
  const isVictoryLap = isCompleted && cycle.winner && daysSinceAnnounced <= VICTORY_LAP_DAYS;
  const isAnticipationHook = isCompleted && !isVictoryLap;

  // ── Victory Lap ──
  if (isVictoryLap) {
    const isPrizeWinner = votingPrize?.isWinner === true;
    const prizeClaimed = votingPrize?.hasClaimed === true;
    const claimData = votingPrize ? votingPrizeToClaimData(votingPrize) : null;

    return (
      <View style={styles.container}>
        <Text
          variant='body'
          size='xs'
          weight='semibold'
          style={[styles.sectionLabel, { color: GOLD }]}
        >
          COMMUNITY CHAMPION
        </Text>
        <GlowCard variant='gold'>
          <View style={styles.confettiContainer} pointerEvents='none'>
            <ConfettiParticle emoji='🎉' delay={0} left='15%' />
            <ConfettiParticle emoji='✨' delay={1200} left='45%' />
            <ConfettiParticle emoji='🎊' delay={2500} left='70%' />
            <ConfettiParticle emoji='✨' delay={3800} left='88%' />
          </View>
          <View style={styles.iconRow}>
            <Text style={styles.emoji}>🏆</Text>
            <Text
              variant='body'
              size='md'
              weight='bold'
              style={[styles.headingText, { color: GOLD }]}
            >
              The Community Has Spoken!
            </Text>
          </View>
          <Text variant='body' size='sm' style={styles.subText}>
            {cycle.winner?.name ?? 'Winner announced!'} won the Eco-Championship!
          </Text>

          {isPrizeWinner && (
            <Pressable
              style={({ pressed }) => [styles.voteButton, pressed && styles.voteButtonPressed]}
              onPress={() => setShowPrizeModal(true)}
              accessibilityRole='button'
              accessibilityLabel={prizeClaimed ? 'View Your Voucher' : 'Claim Your Prize'}
            >
              <Text variant='body' size='sm' weight='bold' style={styles.voteButtonText}>
                {prizeClaimed ? 'View Your Voucher' : 'Claim Your Prize'}
              </Text>
            </Pressable>
          )}
        </GlowCard>

        {isPrizeWinner && (
          <DiscountClaimModal
            visible={showPrizeModal}
            onClose={() => setShowPrizeModal(false)}
            rank={votingPrize?.rank ?? 0}
            hasClaimed={prizeClaimed}
            claimData={claimData}
            onClaim={establishmentId => claimVotingPrize.mutate(establishmentId)}
            isClaiming={claimVotingPrize.isPending}
            error={claimVotingPrize.error != null ? claimVotingPrize.error.message : null}
            firstName={firstName}
          />
        )}
      </View>
    );
  }

  // ── Anticipation Hook ──
  if (isAnticipationHook) {
    return (
      <View style={styles.container}>
        <Text
          variant='body'
          size='xs'
          weight='semibold'
          style={[styles.sectionLabel, { color: GOLD }]}
        >
          COMING SOON
        </Text>
        <GlowCard variant='gold-slow'>
          <View style={styles.iconRow}>
            <Text style={styles.emoji}>🏆</Text>
            <Text
              variant='body'
              size='sm'
              weight='bold'
              style={[styles.headingText, { color: TEXT_PRIMARY }]}
            >
              Next community championship vote coming soon
            </Text>
          </View>
          <Text variant='body' size='xs' style={[styles.subtleText, { color: TEXT_SECONDARY }]}>
            Keep your login streaks alive and save surplus boxes to maximize your voting power!
          </Text>
        </GlowCard>
      </View>
    );
  }

  // ── Ballot Open: Voted ──
  if (isBallotOpen && myVote) {
    const votedPrizeName = cycle.prizes.find(p => p._id === myVote.prizeId)?.name ?? 'Your choice';
    return (
      <View style={styles.container}>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <GlowCard variant='neon-slow'>
          <View style={styles.iconRow}>
            <Icon name='checkmark-circle' family='Ionicons' size={22} color={SUCCESS} />
            <Text
              variant='body'
              size='md'
              weight='bold'
              style={[styles.headingText, { color: SUCCESS }]}
            >
              You Voted!
            </Text>
          </View>
          <Text variant='body' size='sm' style={styles.subText}>
            {votedPrizeName}
          </Text>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {getCountdown(cycle.ballotClosesAt)}
          </Text>
        </GlowCard>
      </View>
    );
  }

  // ── Ballot Open: Vote Now ──
  if (isBallotOpen && eligibility?.canVote) {
    return (
      <View style={styles.container}>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <GlowCard variant='neon'>
          <View style={styles.iconRow}>
            <Text style={styles.emoji}>🏆</Text>
            <Text
              variant='body'
              size='md'
              weight='bold'
              style={[styles.headingText, { color: PRIMARY_500 }]}
            >
              Voting is Live!
            </Text>
          </View>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {getCountdown(cycle.ballotClosesAt)}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.voteButton, pressed && styles.voteButtonPressed]}
            onPress={() => setShowVoteSheet(true)}
            accessibilityRole='button'
            accessibilityLabel='Vote Now'
          >
            <Text variant='body' size='sm' weight='bold' style={styles.voteButtonText}>
              Vote Now
            </Text>
          </Pressable>
        </GlowCard>

        {showVoteSheet && (
          <VoteBottomSheet
            visible={showVoteSheet}
            onClose={() => setShowVoteSheet(false)}
            prizes={cycle.prizes}
            pointsSnapshot={eligibility.pointsSnapshot}
          />
        )}
      </View>
    );
  }

  // ── Ballot Open: Not Eligible ──
  if (isBallotOpen) {
    const needed =
      (eligibility?.requiredBags ?? cycle.minimumBags) - (eligibility?.userBagsInCycle ?? 0);
    return (
      <View style={styles.container}>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <GlowCard variant='static'>
          <View style={styles.iconRow}>
            <Icon name='lock-closed-outline' family='Ionicons' size={22} color={TEXT_SECONDARY} />
            <Text
              variant='body'
              size='md'
              weight='bold'
              style={[styles.headingText, { color: TEXT_SECONDARY }]}
            >
              Voting is Live!
            </Text>
          </View>
          <Text variant='body' size='sm' style={styles.subText}>
            {`Save ${needed} more bag${needed !== 1 ? 's' : ''} to participate`}
          </Text>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {getCountdown(cycle.ballotClosesAt)}
          </Text>
        </GlowCard>
      </View>
    );
  }

  // ── Tallying ──
  if (isTallying) {
    const votedPrizeName = myVote
      ? (cycle.prizes.find(p => p._id === myVote.prizeId)?.name ?? 'Your choice')
      : null;
    return (
      <View style={styles.container}>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <GlowCard variant='neon-slow'>
          <View style={styles.iconRow}>
            <Text style={styles.emoji}>⏳</Text>
            <Text variant='body' size='md' weight='bold' style={styles.headingText}>
              Votes are being counted…
            </Text>
          </View>
          {votedPrizeName !== null && (
            <Text variant='body' size='sm' style={styles.subText}>
              {`You voted for ${votedPrizeName}`}
            </Text>
          )}
          <Text variant='body' size='xs' style={styles.subtleText}>
            Results will be announced soon
          </Text>
        </GlowCard>
      </View>
    );
  }

  // ── ACTIVE: Community Challenge ──
  const progress = cycle.communityGoalProgress;
  const target = cycle.communityGoalTarget;
  const ratio = target > 0 ? Math.min(progress / target, 1) : 0;
  const pct = Math.round(ratio * 100);
  const userBags = eligibility?.userBagsInCycle ?? 0;
  const requiredBags = eligibility?.requiredBags ?? cycle.minimumBags;
  const isEligibleAlready = userBags >= requiredBags;

  return (
    <View style={styles.container}>
      <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
        COMMUNITY CHALLENGE
      </Text>
      <GlowCard variant='neon'>
        <View style={styles.iconRow}>
          <Text style={styles.emoji}>🌍</Text>
          <Text
            variant='body'
            size='md'
            weight='bold'
            style={[styles.headingText, { color: PRIMARY_500 }]}
          >
            {cycle.name}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          {/* eslint-disable-next-line react-native/no-inline-styles */}
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text variant='body' size='xs' style={styles.subtleText}>
          {`${progress.toLocaleString()} / ${target.toLocaleString()} bags — ${pct}%`}
        </Text>
        {!isEligibleAlready && (
          <Text variant='body' size='xs' style={styles.eligibilityHint}>
            {`Save ${requiredBags - userBags} more bag${requiredBags - userBags !== 1 ? 's' : ''} to unlock voting`}
          </Text>
        )}
      </GlowCard>
    </View>
  );
};

VotingCard.displayName = 'VotingCard';

// ── Styles ──

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: PRIMARY_300,
    letterSpacing: 1.5,
    marginBottom: 10,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cardBorderOverlay: {
    borderRadius: 16,
    borderWidth: 1.5,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emoji: {
    fontSize: 22,
  },
  headingText: {
    color: TEXT_PRIMARY,
    flex: 1,
  },
  subText: {
    color: TEXT_PRIMARY,
    marginTop: 4,
  },
  subtleText: {
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: 4,
  },
  eligibilityHint: {
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Progress bar
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY_50,
    overflow: 'hidden',
    marginTop: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: PRIMARY_300,
  },
  // Vote button
  voteButton: {
    backgroundColor: ACCENT_500,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 12,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT_500,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  voteButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  voteButtonText: {
    color: '#FFFFFF',
  },
  // Confetti
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  confetti: {
    position: 'absolute',
    fontSize: 16,
    bottom: 0,
  },
});
