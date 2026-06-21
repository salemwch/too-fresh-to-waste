/**
 * VotingResultsView
 * Displays live or final voting results for a community prize cycle.
 *
 * Features:
 *  - Progress bars for each prize (relative weighted-vote share)
 *  - Leading prize highlighted with bold name + primary-color fill bar
 *  - Footer showing "X of Y eligible users voted"
 *  - Polls the results endpoint every 60 s while the ballot is open
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

import { useVotingResults } from '../hooks/useVoting';

// ---------------------------------------------------------------------------
// Color constants (follow VotingCard pattern)
// ---------------------------------------------------------------------------

const TEAL = colorTokens.base.primary[500];
const TEAL_LIGHT = colorTokens.base.primary[50];
const TEXT_PRIMARY = colorTokens.base.neutral[800];
const TEXT_SECONDARY = colorTokens.base.neutral[600];
const BORDER = colorTokens.base.neutral[300];
const TRACK_BG = colorTokens.base.neutral[200];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface VotingResultsViewProps {
  cycleId?: string;
  isBallotOpen: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VotingResultsView: React.FC<VotingResultsViewProps> = ({ cycleId, isBallotOpen }) => {
  const { data, isLoading } = useVotingResults(cycleId, true);

  // Loading state
  if (isLoading || !data) {
    return (
      <View style={styles.container}>
        <Text variant='body' size='sm' style={{ color: TEXT_SECONDARY }}>
          {'Loading results…'}
        </Text>
      </View>
    );
  }

  // Empty state (no votes cast yet)
  if (data.results.length === 0) {
    return (
      <View style={styles.container}>
        <Text variant='body' size='sm' style={{ color: TEXT_SECONDARY }}>
          {'No votes have been cast yet.'}
        </Text>
      </View>
    );
  }

  // Sort results descending by weighted votes so the leader is first
  const sortedResults = [...data.results].sort(
    (a, b) => b.totalWeightedVotes - a.totalWeightedVotes,
  );

  const maxVotes = Math.max(...sortedResults.map(r => r.totalWeightedVotes), 1);

  return (
    <View style={styles.container}>
      {/* Section heading */}
      <Text variant='body' size='md' weight='semibold' style={styles.heading}>
        {isBallotOpen ? 'Live Results' : 'Final Results'}
      </Text>

      {/* Result rows */}
      {sortedResults.map((item, index) => {
        const percentage = (item.totalWeightedVotes / maxVotes) * 100;
        const isLeading = index === 0;

        return (
          <View key={item.prizeId} style={[styles.resultRow, isLeading && styles.resultRowLeading]}>
            {/* Prize name + voter count */}
            <View style={styles.resultHeader}>
              <Text
                variant='body'
                size='sm'
                weight={isLeading ? 'bold' : 'regular'}
                style={{ color: isLeading ? TEAL : TEXT_PRIMARY, flex: 1 }}
                numberOfLines={1}
              >
                {item.name}
              </Text>
              <Text variant='body' size='xs' style={{ color: TEXT_SECONDARY }}>
                {`${item.totalWeightedVotes.toLocaleString()} pts · ${item.voterCount} voters`}
              </Text>
            </View>

            {/* Progress bar */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    // percentage-based width; min 2% so even 0-vote rows are visible
                    width: `${Math.max(percentage, 2)}%` as `${number}%`,
                    backgroundColor: isLeading ? TEAL : BORDER,
                  },
                ]}
              />
            </View>
          </View>
        );
      })}

      {/* Footer */}
      <Text variant='body' size='xs' style={styles.footer}>
        {`${data.totalVoters.toLocaleString()} of ${data.totalEligible.toLocaleString()} eligible users voted`}
      </Text>
    </View>
  );
};

VotingResultsView.displayName = 'VotingResultsView';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  heading: {
    color: TEXT_PRIMARY,
    marginBottom: 14,
  },
  resultRow: {
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  resultRowLeading: {
    backgroundColor: TEAL_LIGHT,
    borderColor: colorTokens.base.primary[200],
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: TRACK_BG,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  footer: {
    color: TEXT_SECONDARY,
    marginTop: 6,
    textAlign: 'center',
  },
});
