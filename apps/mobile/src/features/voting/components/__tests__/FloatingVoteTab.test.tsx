/**
 * FloatingVoteTab Component - Unit Tests
 * Tests the collapsed pill, expand-on-first-tap, and navigate-on-second-tap behaviour.
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
  return { Text: MockText };
});

// Mock color tokens
jest.mock('@/design-system/tokens/colors', () => ({
  colorTokens: {
    base: {
      primary: { 500: '#1E4448' },
    },
  },
}));

// ---------------------------------------------------------------------------
// Mock safe-area-context
// ---------------------------------------------------------------------------
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// ---------------------------------------------------------------------------
// Mock voting hook
// ---------------------------------------------------------------------------
const mockUseActiveVotingCycle = jest.fn();
jest.mock('../../hooks/useVoting', () => ({
  useActiveVotingCycle: () => mockUseActiveVotingCycle(),
}));

// ---------------------------------------------------------------------------
// Import component under test AFTER mocks
// ---------------------------------------------------------------------------
import { FloatingVoteTab } from '../FloatingVoteTab';
import type { HomeScreenNavigationProp } from '@/navigation/types';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------
const mockNavigate = jest.fn();
const mockNavigation = { navigate: mockNavigate } as unknown as HomeScreenNavigationProp;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FloatingVoteTab', () => {
  beforeEach(() => {
    mockUseActiveVotingCycle.mockReset();
    mockNavigate.mockReset();
  });

  // 1. Loading → renders null
  it('renders null when loading', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: true,
    });
    const { toJSON } = render(<FloatingVoteTab navigation={mockNavigation} />);
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
    const { toJSON } = render(<FloatingVoteTab navigation={mockNavigation} />);
    expect(toJSON()).toBeNull();
  });

  // 3. Cycle is ACTIVE (not BALLOT_OPEN) → renders null
  it('renders null when cycle not BALLOT_OPEN', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'ACTIVE' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { toJSON } = render(<FloatingVoteTab navigation={mockNavigation} />);
    expect(toJSON()).toBeNull();
  });

  // 4. BALLOT_OPEN but canVote false → renders null
  it('renders null when user cannot vote', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: false },
      myVote: null,
      isLoading: false,
    });
    const { toJSON } = render(<FloatingVoteTab navigation={mockNavigation} />);
    expect(toJSON()).toBeNull();
  });

  // 5. BALLOT_OPEN + canVote but already voted → renders null
  it('renders null when user already voted', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: { prizeId: 'p1', pointsSnapshot: 1000, votedAt: '2026-06-01T00:00:00Z' },
      isLoading: false,
    });
    const { toJSON } = render(<FloatingVoteTab navigation={mockNavigation} />);
    expect(toJSON()).toBeNull();
  });

  // 6. BALLOT_OPEN + canVote + no vote → renders collapsed pill with trophy
  it('renders collapsed pill when BALLOT_OPEN + canVote + no vote', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { getByText } = render(<FloatingVoteTab navigation={mockNavigation} />);
    // Trophy emoji is rendered as Text in the collapsed state
    expect(getByText('🏆')).toBeTruthy();
  });

  // 7. First tap → expands to show text
  it('expands on first tap to show "Voting Is Live! Vote Now"', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { getByText, queryByText } = render(<FloatingVoteTab navigation={mockNavigation} />);

    // Expanded text not visible before tap
    expect(queryByText('Voting Is Live! Vote Now')).toBeNull();

    // First tap
    fireEvent.press(getByText('🏆'));

    // Now expanded text is visible
    expect(getByText('Voting Is Live! Vote Now')).toBeTruthy();
  });

  // 8. Second tap → navigates to Loyalty
  it('navigates to Loyalty on second tap', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { getByText } = render(<FloatingVoteTab navigation={mockNavigation} />);

    // First tap — expand
    fireEvent.press(getByText('🏆'));
    // Second tap — navigate (press the whole pill; trophy is still rendered)
    fireEvent.press(getByText('🏆'));

    expect(mockNavigate).toHaveBeenCalledWith('Loyalty');
  });

  // 9. First tap only → does NOT navigate
  it('does not navigate on first tap', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { getByText } = render(<FloatingVoteTab navigation={mockNavigation} />);

    // First tap only
    fireEvent.press(getByText('🏆'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // 10. After second tap, expanded text is still visible
  it('stays expanded after second tap', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    const { getByText } = render(<FloatingVoteTab navigation={mockNavigation} />);

    // Expand
    fireEvent.press(getByText('🏆'));
    // Navigate
    fireEvent.press(getByText('🏆'));

    // Expanded text still visible
    expect(getByText('Voting Is Live! Vote Now')).toBeTruthy();
  });
});
