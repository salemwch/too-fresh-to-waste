/**
 * VotingCard — Voting Prize Tests
 * Tests the "Claim Your Prize" CTA and DiscountClaimModal integration
 * in the Victory Lap branch (COMPLETED cycle, winner announced ≤ 7 days).
 */

import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mock design-system atoms — avoids ThemeProvider dependency
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
// Mock VoteBottomSheet — not used in Victory Lap state
// ---------------------------------------------------------------------------
jest.mock('./VoteBottomSheet', () => ({
  VoteBottomSheet: () => null,
}));

// ---------------------------------------------------------------------------
// Mock useAppSelector — returns firstName for the logged-in user
// ---------------------------------------------------------------------------
jest.mock('@/hooks/redux', () => ({
  useAppSelector: () => 'Salem',
}));

// ---------------------------------------------------------------------------
// Mock useActiveVotingCycle — COMPLETED cycle within Victory Lap window
// ---------------------------------------------------------------------------
jest.mock('../hooks/useVoting', () => ({
  useActiveVotingCycle: () => ({
    cycle: {
      _id: 'c1',
      name: 'Eco 3',
      status: 'COMPLETED',
      prizes: [{ _id: 'p1', name: 'Smart Garden' }],
      recipientCount: 5,
      winner: {
        prizeId: 'p1',
        name: 'Smart Garden',
        announcedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
      },
      ballotClosesAt: null,
      communityGoalProgress: 0,
      communityGoalTarget: 100,
      minimumBags: 50,
    },
    eligibility: null,
    myVote: { prizeId: 'p1', pointsSnapshot: 100, votedAt: new Date().toISOString() },
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Mock prize hooks — winner who has not claimed
// Variable is prefixed with 'mock' per Jest requirement for mock factory scope.
// ---------------------------------------------------------------------------
const mockClaimMutate = jest.fn();
jest.mock('../hooks/useVotingPrize', () => ({
  useVotingPrizeStatus: () => ({
    data: {
      isWinner: true,
      rank: 2,
      recipientCount: 5,
      cycleId: 'c1',
      cycleName: 'Eco 3',
      prizeName: 'Smart Garden',
      hasClaimed: false,
      voucherCode: null,
      establishmentName: null,
      status: null,
    },
  }),
  useClaimVotingPrize: () => ({ mutate: mockClaimMutate, isPending: false, error: null }),
  votingPrizeToClaimData: () => null,
}));

// ---------------------------------------------------------------------------
// Mock DiscountClaimModal — lightweight stand-in that renders its title text
// so we can assert it opened, without pulling in Modal / SafeAreaContext /
// TanStack Query dependencies.
// ---------------------------------------------------------------------------
jest.mock('@/features/leaderboard/components/DiscountClaimModal', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');

  const MockDiscountClaimModal = ({
    visible,
    hasClaimed,
  }: {
    visible: boolean;
    onClose: () => void;
    rank: number;
    hasClaimed: boolean;
    claimData: unknown;
    onClaim: (id: string) => void;
    isClaiming: boolean;
    error: string | null;
    firstName: string;
  }) => {
    if (!visible) return null;
    return mockReact.createElement(
      mockRN.View,
      { testID: 'discount-claim-modal' },
      mockReact.createElement(
        mockRN.Text,
        null,
        hasClaimed ? 'Your Discount Voucher' : 'Choose a Business',
      ),
    );
  };

  return { DiscountClaimModal: MockDiscountClaimModal };
});

// ---------------------------------------------------------------------------
// Import component under test AFTER all mocks
// ---------------------------------------------------------------------------
import { VotingCard } from './VotingCard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VotingCard — voting prize', () => {
  beforeEach(() => {
    mockClaimMutate.mockReset();
  });

  it('shows a Claim Your Prize CTA for a winner who has not claimed', () => {
    render(<VotingCard />);
    expect(screen.getByText('Claim Your Prize')).toBeTruthy();
  });

  it('opens the discount modal when the CTA is pressed', () => {
    render(<VotingCard />);
    fireEvent.press(screen.getByText('Claim Your Prize'));
    expect(screen.getByText('Choose a Business')).toBeTruthy();
  });

  it('does not render the modal before the CTA is pressed', () => {
    render(<VotingCard />);
    expect(screen.queryByTestId('discount-claim-modal')).toBeNull();
  });

  it('does not show the Claim CTA for a non-winner', () => {
    jest
      .spyOn(
        jest.requireMock('../hooks/useVotingPrize') as {
          useVotingPrizeStatus: () => { data: object };
        },
        'useVotingPrizeStatus',
      )
      .mockReturnValueOnce({
        data: {
          isWinner: false,
          rank: null,
          recipientCount: 5,
          cycleId: 'c1',
          cycleName: 'Eco 3',
          prizeName: null,
          hasClaimed: false,
          voucherCode: null,
          establishmentName: null,
          status: null,
        },
      });
    render(<VotingCard />);
    expect(screen.queryByText('Claim Your Prize')).toBeNull();
    expect(screen.queryByText('View Your Voucher')).toBeNull();
  });
});
