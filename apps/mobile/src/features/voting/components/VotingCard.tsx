/**
 * VotingCard
 * Community voting status card shown on the LoyaltyScreen.
 *
 * States (driven by cycle.status + eligibility + myVote):
 *   ACTIVE            → community challenge progress + user's bag count toward eligibility
 *   BALLOT_OPEN + canVote       → "Vote Now" CTA + countdown timer
 *   BALLOT_OPEN + already voted → checkmark + voted prize name
 *   BALLOT_OPEN + not eligible  → "Need X bags to participate"
 *   COMPLETED + winner          → winner announcement
 *   no cycle / loading          → returns null (no render)
 */

import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

import { useActiveVotingCycle } from '../hooks/useVoting';

import { VoteBottomSheet } from './VoteBottomSheet';

// ---------------------------------------------------------------------------
// Color constants — follow the same pattern as ImpactStatsRow / StreakCard
// ---------------------------------------------------------------------------

const TEAL = colorTokens.base.primary[500];
const SURFACE = '#FFFFFF';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#64748B';
const BORDER = '#E5E7EB';
const SUCCESS = colorTokens.base.success[500];
const SUCCESS_BG = colorTokens.base.success[50];
const TEAL_BG = colorTokens.base.primary[50];
const SHADOW = '#000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCountdown(ballotClosesAt: string | null): string {
  if (!ballotClosesAt) return '';
  const diff = new Date(ballotClosesAt).getTime() - Date.now();
  if (diff <= 0) return 'Closing soon…';
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m left`;
}

// ---------------------------------------------------------------------------
// VotingCard
// ---------------------------------------------------------------------------

export const VotingCard: React.FC = () => {
  const { cycle, eligibility, myVote, isLoading } = useActiveVotingCycle();
  const [showVoteSheet, setShowVoteSheet] = useState(false);

  // Nothing to show while loading or when there is no active cycle
  if (isLoading || !cycle) return null;

  // ------------------------------------------------------------------
  // Render helpers for each state
  // ------------------------------------------------------------------

  const renderCompleted = () => (
    <>
      <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
        COMMUNITY PRIZE WINNER
      </Text>
      <View style={styles.card}>
        <View style={styles.iconRow}>
          <Icon name='trophy' family='Ionicons' size={22} color={TEAL} />
          <Text variant='body' size='md' weight='semibold' style={styles.headingText}>
            {cycle.winner?.name ?? 'Winner announced!'}
          </Text>
        </View>
      </View>
    </>
  );

  const renderVoted = () => {
    const votedPrizeName = cycle.prizes.find(p => p._id === myVote?.prizeId)?.name ?? 'Your choice';
    return (
      <>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <View style={[styles.card, { backgroundColor: SUCCESS_BG, borderColor: SUCCESS }]}>
          <View style={styles.iconRow}>
            <Icon name='checkmark-circle' family='Ionicons' size={22} color={SUCCESS} />
            <Text
              variant='body'
              size='md'
              weight='semibold'
              style={[styles.headingText, { color: SUCCESS }]}
            >
              {'You voted!'}
            </Text>
          </View>
          <Text variant='body' size='sm' style={styles.subText}>
            {votedPrizeName}
          </Text>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {getCountdown(cycle.ballotClosesAt)}
          </Text>
        </View>
      </>
    );
  };

  const renderVoteNow = () => (
    <>
      <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
        COMMUNITY VOTE
      </Text>
      <View style={[styles.card, { backgroundColor: TEAL_BG, borderColor: TEAL }]}>
        <View style={styles.iconRow}>
          <Icon name='podium-outline' family='Ionicons' size={22} color={TEAL} />
          <Text
            variant='body'
            size='md'
            weight='semibold'
            style={[styles.headingText, { color: TEAL }]}
          >
            {'Voting is live!'}
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
          accessibilityHint='Opens the prize selection sheet to cast your vote'
        >
          <Text variant='body' size='sm' weight='semibold' style={styles.voteButtonText}>
            {'Vote Now'}
          </Text>
        </Pressable>
      </View>
    </>
  );

  const renderNotEligible = () => {
    const needed =
      (eligibility?.requiredBags ?? cycle.minimumBags) - (eligibility?.userBagsInCycle ?? 0);
    return (
      <>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY VOTE
        </Text>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Icon name='lock-closed-outline' family='Ionicons' size={22} color={TEXT_SECONDARY} />
            <Text variant='body' size='md' weight='semibold' style={styles.headingText}>
              {'Voting is live!'}
            </Text>
          </View>
          <Text variant='body' size='sm' style={styles.subText}>
            {`Save ${needed} more bag${needed !== 1 ? 's' : ''} to participate`}
          </Text>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {getCountdown(cycle.ballotClosesAt)}
          </Text>
        </View>
      </>
    );
  };

  const renderActive = () => {
    const progress = cycle.communityGoalProgress;
    const target = cycle.communityGoalTarget;
    const ratio = target > 0 ? Math.min(progress / target, 1) : 0;
    const pct = Math.round(ratio * 100);
    const userBags = eligibility?.userBagsInCycle ?? 0;
    const requiredBags = eligibility?.requiredBags ?? cycle.minimumBags;
    const isEligibleAlready = userBags >= requiredBags;

    return (
      <>
        <Text variant='body' size='xs' weight='semibold' style={styles.sectionLabel}>
          COMMUNITY CHALLENGE
        </Text>
        <View style={styles.card}>
          <View style={styles.iconRow}>
            <Icon name='people-outline' family='Ionicons' size={22} color={TEAL} />
            <Text
              variant='body'
              size='md'
              weight='semibold'
              style={[styles.headingText, { color: TEAL }]}
            >
              {cycle.name}
            </Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              // eslint-disable-next-line react-native/no-inline-styles
              style={[styles.progressFill, { width: `${pct}%` }]}
            />
          </View>
          <Text variant='body' size='xs' style={styles.subtleText}>
            {`${progress.toLocaleString()} / ${target.toLocaleString()} bags — ${pct}%`}
          </Text>

          {/* User eligibility hint */}
          {!isEligibleAlready && (
            <Text variant='body' size='xs' style={styles.eligibilityHint}>
              {`Save ${requiredBags - userBags} more bag${requiredBags - userBags !== 1 ? 's' : ''} to unlock voting`}
            </Text>
          )}
        </View>
      </>
    );
  };

  // ------------------------------------------------------------------
  // Route to correct state renderer
  // ------------------------------------------------------------------

  let content: React.ReactNode;

  if (cycle.status === 'COMPLETED' && cycle.winner) {
    content = renderCompleted();
  } else if (cycle.status === 'BALLOT_OPEN') {
    if (myVote) {
      content = renderVoted();
    } else if (eligibility?.canVote) {
      content = renderVoteNow();
    } else {
      content = renderNotEligible();
    }
  } else {
    // ACTIVE (or any other non-terminal status)
    content = renderActive();
  }

  return (
    <>
      <View style={styles.container}>{content}</View>

      {showVoteSheet && cycle.status === 'BALLOT_OPEN' && eligibility?.canVote && (
        <VoteBottomSheet
          visible={showVoteSheet}
          onClose={() => setShowVoteSheet(false)}
          prizes={cycle.prizes}
          pointsSnapshot={eligibility.pointsSnapshot}
        />
      )}
    </>
  );
};

VotingCard.displayName = 'VotingCard';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionLabel: {
    color: TEXT_SECONDARY,
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: SHADOW,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headingText: {
    color: TEXT_PRIMARY,
    flex: 1,
  },
  subText: {
    color: TEXT_SECONDARY,
  },
  subtleText: {
    color: TEXT_SECONDARY,
    fontStyle: 'italic',
  },
  eligibilityHint: {
    color: TEXT_SECONDARY,
  },
  // Progress bar
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: BORDER,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: TEAL,
  },
  // Vote button
  voteButton: {
    backgroundColor: TEAL,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  voteButtonPressed: {
    opacity: 0.8,
  },
  voteButtonText: {
    color: '#FFFFFF',
  },
});
