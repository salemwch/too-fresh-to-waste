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

// Mock prize hooks — default to non-winner so they are transparent for
// non-prize tests; the prize test file uses its own overrides.
jest.mock('../../hooks/useVotingPrize', () => ({
  useVotingPrizeStatus: () => ({ data: undefined }),
  useClaimVotingPrize: () => ({ mutate: jest.fn(), isPending: false, error: null }),
  votingPrizeToClaimData: () => null,
}));

// VotingCard reads identity through useCurrentUser (only firstName is used).
// Mocking the hook rather than providing a QueryClientProvider keeps this a
// unit test: no real /auth/me request, and apiClient → i18n → mmkv stays out
// of the module graph. A null user exercises the anonymous fallback ('').
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null, isRefreshing: false, isFresh: true }),
}));

// Mock DiscountClaimModal — only rendered when isPrizeWinner, so a no-op
// stub keeps the rest of the test suite fast and dependency-free.
jest.mock('@/features/leaderboard/components/DiscountClaimModal', () => ({
  DiscountClaimModal: () => null,
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

  // ── Edge Cases & Weak Points ──

  // 15. Countdown shows "Closing soon…" when ballotClosesAt is in the past
  it('shows "Closing soon…" when ballot has already closed', () => {
    const past = new Date(Date.now() - 60_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: past,
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Closing soon…')).toBeTruthy();
  });

  // 16. Singular bag — "Save 1 more bag" not "bags"
  it('uses singular "bag" when only 1 bag needed (ACTIVE)', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 100, communityGoalTarget: 30000 }),
      eligibility: makeEligibility({ userBagsInCycle: 49, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Save 1 more bag to unlock voting')).toBeTruthy();
  });

  // 17. Singular bag — "Save 1 more bag" in BALLOT_OPEN not eligible
  it('uses singular "bag" when only 1 bag needed (BALLOT_OPEN)', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      eligibility: makeEligibility({ canVote: false, userBagsInCycle: 49, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Save 1 more bag to participate')).toBeTruthy();
  });

  // 18. Voted prize not found in prizes array — fallback to "Your choice"
  it('shows "Your choice" when voted prize ID not found in prizes', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
        prizes: [
          {
            _id: 'p1',
            name: 'Eco Phone',
            description: 'Phone',
            imageUrl: '',
            category: 'tech',
            value: '500 TND',
          },
        ],
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60 }),
      myVote: { prizeId: 'nonexistent', pointsSnapshot: 1000, votedAt: '2026-06-01T00:00:00Z' },
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Your choice')).toBeTruthy();
  });

  // 19. Countdown with null ballotClosesAt renders empty string (no crash)
  it('renders no countdown text when ballotClosesAt is null', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: null,
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60 }),
      myVote: null,
      isLoading: false,
    });

    const { queryByText } = render(<VotingCard />);
    expect(queryByText(/left/)).toBeNull();
    expect(queryByText('Closing soon…')).toBeNull();
  });

  // 20. Victory Lap renders confetti emoji
  it('renders confetti emoji in Victory Lap', () => {
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
    expect(getByText('🎉')).toBeTruthy();
    expect(getByText('🎊')).toBeTruthy();
  });

  // 21. Victory Lap exactly at day 7 boundary (edge)
  //
  // Time is frozen here on purpose. The component computes
  // `(Date.now() - announcedAt) / MS_PER_DAY <= 7`, so a timestamp built from a
  // live `Date.now()` is already >7 days old by the time render runs — this test
  // could only pass if setup and render landed in the same millisecond, which
  // made it fail depending on machine speed. Freezing the clock makes the
  // boundary exact and the assertion meaningful.
  it('renders Victory Lap at exactly 7 days since announcement', () => {
    jest.useFakeTimers();
    const now = new Date('2026-07-25T12:00:00.000Z');
    jest.setSystemTime(now);

    const exactlySevenDays = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: {
          prizeId: 'p1',
          name: 'Eco Phone',
          totalWeightedVotes: 500,
          voterCount: 100,
          announcedAt: exactlySevenDays,
        },
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('The Community Has Spoken!')).toBeTruthy();

    jest.useRealTimers();
  });

  // 22. Victory Lap at day 7 + 1ms → Anticipation Hook
  it('renders Anticipation Hook just past 7 days', () => {
    const justPastSeven = new Date(Date.now() - 7 * 86_400_000 - 1000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: {
          prizeId: 'p1',
          name: 'Eco Phone',
          totalWeightedVotes: 500,
          voterCount: 100,
          announcedAt: justPastSeven,
        },
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Next community championship vote coming soon')).toBeTruthy();
  });

  // 23. ACTIVE with progress exceeding target (clamped to 100%)
  it('clamps progress to 100% when progress exceeds target', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({ communityGoalProgress: 35000, communityGoalTarget: 30000 }),
      eligibility: makeEligibility({ userBagsInCycle: 60, requiredBags: 50 }),
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('35,000 / 30,000 bags — 100%')).toBeTruthy();
  });

  // 24. BALLOT_OPEN + canVote: bottom sheet not shown before pressing Vote Now
  it('does not render bottom sheet before pressing Vote Now', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
      }),
      eligibility: makeEligibility({ canVote: true, userBagsInCycle: 60, pointsSnapshot: 1200 }),
      myVote: null,
      isLoading: false,
    });

    const { queryByTestId } = render(<VotingCard />);
    expect(queryByTestId('vote-bottom-sheet')).toBeNull();
  });

  // 25. Victory Lap section label shows "COMMUNITY CHAMPION"
  it('shows COMMUNITY CHAMPION section label in Victory Lap', () => {
    const announcedAt = new Date(Date.now() - 1 * 86_400_000).toISOString();

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
    expect(getByText('COMMUNITY CHAMPION')).toBeTruthy();
  });

  // 26. Anticipation Hook section label shows "COMING SOON"
  it('shows COMING SOON section label in Anticipation Hook', () => {
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
    expect(getByText('COMING SOON')).toBeTruthy();
  });

  // 27. Anticipation Hook renders motivational subtext
  it('shows motivational subtext in Anticipation Hook', () => {
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
    expect(
      getByText(
        'Keep your login streaks alive and save surplus boxes to maximize your voting power!',
      ),
    ).toBeTruthy();
  });

  // 28. Eligibility null fallback uses cycle.minimumBags
  it('falls back to cycle.minimumBags when eligibility is null (ACTIVE)', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        communityGoalProgress: 100,
        communityGoalTarget: 30000,
        minimumBags: 50,
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    // With null eligibility: userBags=0, requiredBags=50 (from minimumBags)
    expect(getByText('Save 50 more bags to unlock voting')).toBeTruthy();
  });

  // 29. BALLOT_OPEN with null eligibility shows not-eligible state
  it('renders not eligible when eligibility is null in BALLOT_OPEN', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'BALLOT_OPEN',
        ballotClosesAt: new Date(Date.now() + 3_600_000).toISOString(),
        minimumBags: 50,
      }),
      eligibility: null,
      myVote: null,
      isLoading: false,
    });

    const { getByText } = render(<VotingCard />);
    expect(getByText('Save 50 more bags to participate')).toBeTruthy();
  });

  // 30. Winner name null-coalesce fallback in Victory Lap
  it('shows "Winner announced!" fallback when winner name is nullish', () => {
    const announcedAt = new Date(Date.now() - 2 * 86_400_000).toISOString();

    mockUseActiveVotingCycle.mockReturnValue({
      cycle: makeCycle({
        status: 'COMPLETED',
        winner: {
          prizeId: 'p1',
          name: null as unknown as string,
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
    expect(getByText(/Winner announced!/)).toBeTruthy();
  });
});
