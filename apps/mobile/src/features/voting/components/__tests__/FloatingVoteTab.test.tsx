/**
 * FloatingVoteTab Component - Unit Tests
 */

import { render, fireEvent } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockText = ({ children, style }: { children?: unknown; style?: any }) =>
    mockReact.createElement(mockRN.Text, { style }, children as React.ReactNode);
  return { Text: MockText };
});

jest.mock('@/design-system/tokens/colors', () => ({
  colorTokens: { base: { primary: { 500: '#1E4448' } } },
}));

const mockDispatch = jest.fn();
jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: { dispatch: mockDispatch, isReady: () => true },
}));

const mockUseActiveVotingCycle = jest.fn();
jest.mock('../../hooks/useVoting', () => ({
  useActiveVotingCycle: () => mockUseActiveVotingCycle(),
}));

import { FloatingVoteTab } from '../FloatingVoteTab';

const BALLOT_OPEN = {
  cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
  eligibility: { canVote: true },
  myVote: null,
  isLoading: false,
};

describe('FloatingVoteTab', () => {
  beforeEach(() => {
    mockUseActiveVotingCycle.mockReset();
    mockDispatch.mockReset();
  });

  // Visibility conditions
  it('renders null when loading', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: true,
    });
    expect(render(<FloatingVoteTab />).toJSON()).toBeNull();
  });

  it('renders null when no active cycle', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: false,
    });
    expect(render(<FloatingVoteTab />).toJSON()).toBeNull();
  });

  it('renders null when cycle is not BALLOT_OPEN', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { status: 'ACTIVE' },
      eligibility: { canVote: true },
      myVote: null,
      isLoading: false,
    });
    expect(render(<FloatingVoteTab />).toJSON()).toBeNull();
  });

  it('renders null when user cannot vote', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { status: 'BALLOT_OPEN' },
      eligibility: { canVote: false },
      myVote: null,
      isLoading: false,
    });
    expect(render(<FloatingVoteTab />).toJSON()).toBeNull();
  });

  it('renders null when user already voted', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { status: 'BALLOT_OPEN' },
      eligibility: { canVote: true },
      myVote: { prizeId: 'p1' },
      isLoading: false,
    });
    expect(render(<FloatingVoteTab />).toJSON()).toBeNull();
  });

  it('renders pill when forceVisible overrides voting state', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: null,
      eligibility: null,
      myVote: null,
      isLoading: true,
    });
    expect(render(<FloatingVoteTab forceVisible />).getByText('🏆')).toBeTruthy();
  });

  // Expand / collapse
  it('shows trophy collapsed initially', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText, queryByText } = render(<FloatingVoteTab />);
    expect(getByText('🏆')).toBeTruthy();
    expect(queryByText('Voting Is Live! Vote Now')).toBeNull();
  });

  it('expands on first tap showing full text', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆'));
    expect(getByText('Voting Is Live! Vote Now')).toBeTruthy();
  });

  it('navigates to Loyalty on second tap (pill press)', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆')); // expand
    fireEvent.press(getByText('🏆')); // navigate
    expect(mockDispatch).toHaveBeenCalledTimes(1);
  });

  it('does not navigate on first tap', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆'));
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('collapses when close button (✕) is pressed', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText, queryByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆')); // expand
    expect(getByText('Voting Is Live! Vote Now')).toBeTruthy();
    fireEvent.press(getByText('✕')); // close
    expect(queryByText('Voting Is Live! Vote Now')).toBeNull();
  });

  it('does not navigate when close button is pressed', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆'));
    fireEvent.press(getByText('✕'));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
