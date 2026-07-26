/**
 * FloatingVoteTab Component - Unit Tests
 */

import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
  // Referenced lazily: jest hoists this factory above the `const mockDispatch`
  // declaration, and the factory runs during the import of FloatingVoteTab —
  // at which point mockDispatch is still in the temporal dead zone. Capturing
  // it directly bound `undefined` and made navigationRef.dispatch uncallable.
  navigationRef: {
    dispatch: (...args: unknown[]) => mockDispatch(...args),
    isReady: () => true,
  },
}));

// FloatingVoteTab calls useFocusEffect, which requires a NavigationContainer.
// These tests render the component in isolation, so stub the hook.
//
// The empty dep array is deliberate: real useFocusEffect runs the callback when
// the screen GAINS focus and its cleanup when the screen LOSES focus — not on
// every re-render. Re-subscribing on each render would fire the cleanup (which
// collapses the tab) mid-interaction and break the expand/collapse assertions.
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual<typeof import('@react-navigation/native')>(
    '@react-navigation/native',
  );
  const mockReact = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    useFocusEffect: (callback: () => undefined | (() => void)) => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      mockReact.useEffect(() => callback(), []);
    },
  };
});

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

  it('collapses when close button (✕) is pressed', async () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText, queryByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆')); // expand
    expect(getByText('Voting Is Live! Vote Now')).toBeTruthy();

    fireEvent.press(getByText('✕')); // close

    // collapse() only calls setExpanded(false) from the Animated completion
    // callback (~220ms), so the text is still mounted on the next tick.
    // Asserting synchronously here is what made this test fail.
    await waitFor(() => {
      expect(queryByText('Voting Is Live! Vote Now')).toBeNull();
    });
  });

  it('does not navigate when close button is pressed', () => {
    mockUseActiveVotingCycle.mockReturnValue(BALLOT_OPEN);
    const { getByText } = render(<FloatingVoteTab />);
    fireEvent.press(getByText('🏆'));
    fireEvent.press(getByText('✕'));
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
