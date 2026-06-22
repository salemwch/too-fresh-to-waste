/**
 * VotingCard Component - Unit Tests
 * Tests all 8 display states: loading, no-cycle, ACTIVE (with/without eligibility hint),
 * BALLOT_OPEN (canVote / voted / not-eligible), COMPLETED Victory Lap, COMPLETED Anticipation Hook.
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock design-system atoms — avoids ThemeProvider dependency
// Variable names must be prefixed with 'mock' to be allowed in jest.mock factories
// ---------------------------------------------------------------------------
jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockText = ({ children, style }: { children?: unknown; style?: any }) =>
    mockReact.createElement(mockRN.Text, { style }, children as React.ReactNode);
  const MockIcon = () => mockReact.createElement(mockRN.View, null);
  return { Text: MockText, Icon: MockIcon };
});

// Mock color tokens
jest.mock('@/design-system/tokens/colors', () => ({
  colorTokens: {
    base: {
      primary: {
        50: '#F0F9FF',
        200: '#A5F3FC',
        300: '#67E8F9',
        500: '#1E4448',
      },
      accent: { 500: '#F55449' },
      success: { 500: '#2E7D32' },
      neutral: {
        0: '#FFFFFF',
        50: '#F9FAFB',
        200: '#E5E7EB',
        300: '#D1D5DB',
        600: '#4B5563',
        800: '#1F2937',
        1000: '#000000',
      },
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock voting hook + VoteBottomSheet
// ---------------------------------------------------------------------------
const mockUseActiveVotingCycle = jest.fn();
jest.mock('../../hooks/useVoting', () => ({
  useActiveVotingCycle: () => mockUseActiveVotingCycle(),
  useVoteMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../VoteBottomSheet', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  const MockVoteBottomSheet = ({ visible }: { visible: boolean }) =>
    visible
      ? mockReact.createElement(mockRN.View, {
          testID: 'vote-bottom-sheet',
          accessibilityLabel: 'VoteBottomSheet',
        })
      : null;
  return { VoteBottomSheet: MockVoteBottomSheet };
});

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------
import { VotingCard } from '../VotingCard';

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------
function makeCycle(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'c1',
    name: 'Summer Eco Championship',
    status: 'ACTIVE',
    cycleStartDate: '2026-01-01T00:00:00Z',
    cycleEndDate: '2026-07-01T00:00:00Z',
    communityGoalTarget: 30000,
    communityGoalProgress: 0,
    ballotOpensAt: null,
    ballotClosesAt: null,
    prizes: [
      {
        _id: 'p1',
        name: 'Eco Phone',
        description: 'A sustainable phone',
        imageUrl: '',
        category: 'tech',
        value: '500 TND',
      },
    ],
    winner: null,
    recipientCount: 5,
    minimumBags: 50,
    ...overrides,
  };
}

function makeEligibility(overrides: Record<string, unknown> = {}) {
  return {
    canVote: false,
    userBagsInCycle: 0,
    requiredBags: 50,
    pointsSnapshot: 1000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VotingCard', () => {
  beforeEach(() => {
    mockUseActiveVotingCycle.mockReset();
  });

  // 1. Loading → renders null
  it('renders null when loading', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: true,
    });

    const { toJSON } = render(<VotingCard />);
    expect(toJSON()).toBeNull();
  });

  // 2. No cycle → renders null
  it('renders null when no cycle', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { toJSON } = render(<VotingCard />);
    expect(toJSON()).toBeNull();
  });

  // 3. ACTIVE state with progress
  it('renders ACTIVE state with progress bar and progress text', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 20400, communityGoalTarget: 30000 }),
      eligibility: makeEligibility({ userBagsInCycle: 60, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Summer Eco Championship')).toBeTruthy();
    // 20400/30000 = 68%
    expect(getByText('20,400 / 30,000 bags — 68%')).toBeTruthy();
  });

  // 4. ACTIVE state — eligibility hint when NOT enough bags
  it('renders ACTIVE state with eligibility hint when not enough bags', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 5000, communityGoalTarget: 30000 }),
      eligibility: makeEligibility({ userBagsInCycle: 10, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    // 50 - 10 = 40 more bags needed
    expect(getByText('Save 40 more bags to unlock voting')).toBeTruthy();
  });

  // 5. ACTIVE state — NO eligibility hint when already eligible
  it('renders ACTIVE state without eligibility hint when eligible', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 5000, communityGoalTarget: 30000 }),
      eligibility: makeEligibility({ userBagsInCycle: 60, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { queryByText } = render(<VotingCard />);
    expect(queryByText(/Save.*more bag.*to unlock voting/)).toBeNull();
  });

  // 6. BALLOT_OPEN + canVote, no vote yet → "Voting is Live!" + "Vote Now" button
  it('renders BALLOT_OPEN + canVote state with Vote Now button', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60, pointsSnapshot: 1200 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Voting is Live!')).toBeTruthy();
    expect(getByText('Vote Now')).toBeTruthy();
  });

  // 7. Vote Now button opens bottom sheet
  it('Vote Now button opens bottom sheet on press', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60, pointsSnapshot: 1200 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText, getByTestId } = render(<VotingCard />);

    // Sheet not visible initially (VoteBottomSheet returns null when visible=false)
    // Press "Vote Now"
    fireEvent.press(getByText('Vote Now'));

    // VoteBottomSheet now rendered with visible=true
    expect(getByTestId('vote-bottom-sheet')).toBeTruthy();
  });

  // 8. BALLOT_OPEN + already voted
  it('renders BALLOT_OPEN + voted state showing prize name', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
        prizes: [
          {
            _id: 'p1',
            name: 'Eco Phone',
            description: 'Sustainable phone',
            imageUrl: '',
            category: 'tech',
            value: '500 TND',
          },
        ],
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60 }),
      myVote: { prizeId: 'p1', pointsSnapshot: 1000, votedAt: '2026-06-01T00:00:00Z' },
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('You Voted!')).toBeTruthy();
    expect(getByText('Eco Phone')).toBeTruthy();
  });

  // 9. BALLOT_OPEN + not eligible
  it('renders BALLOT_OPEN + not eligible state showing bags needed', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      eligibility: makeEligibility({ canVote: false, userBagsInCycle: 5, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    // 50 - 5 = 45 more bags needed
    expect(getByText('Save 45 more bags to participate')).toBeTruthy();
  });

  // 10. COMPLETED — Victory Lap (winner announced ≤ 7 days ago)
  it('renders Victory Lap when COMPLETED within 7 days', () => {
    const announcedAt = new Date(Date.now() - 2 * 86_400_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: {
          prizeId: 'p1',
          name: 'Eco Phone',
          totalWeightedVotes: 500,
          voterCount: 100,
          announcedAt,
        },
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('The Community Has Spoken!')).toBeTruthy();
    expect(getByText(/Eco Phone/)).toBeTruthy();
  });

  // 11. COMPLETED — Anticipation Hook (winner announced > 7 days ago)
  it('renders Anticipation Hook when COMPLETED beyond 7 days', () => {
    const announcedAt = new Date(Date.now() - 10 * 86_400_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: {
          prizeId: 'p1',
          name: 'Eco Phone',
          totalWeightedVotes: 500,
          voterCount: 100,
          announcedAt,
        },
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Next community championship vote coming soon')).toBeTruthy();
  });

  // 12. COMPLETED — Anticipation Hook when winner is null
  it('renders Anticipation Hook when COMPLETED without winner', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: null,
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Next community championship vote coming soon')).toBeTruthy();
  });

  // 13. Zero community goal target — no division error, shows 0%
  it('handles zero community goal target without crash', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 0, communityGoalTarget: 0 }),
      eligibility: makeEligibility({ userBagsInCycle: 60, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('0 / 0 bags — 0%')).toBeTruthy();
  });

  // 14. Countdown format — ballot closes in ~24 hours
  it('shows countdown in correct format when ballot closes in future', () => {
    const future = new Date(Date.now() + 24 * 3_600_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: future,
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    // The component renders "Xh Ym left" — check for 'h' and 'm left' pattern
    const countdownEl = getByText(/\d+h \d+m left/);
    expect(countdownEl).toBeTruthy();
  });
});
