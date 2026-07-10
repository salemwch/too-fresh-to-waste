/**
 * VotingLiveDot Component - Unit Tests
 * Tests visibility rules: only render when cycle is ACTIVE or BALLOT_OPEN.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock design-system tokens — VotingLiveDot only uses colorTokens
// ---------------------------------------------------------------------------
jest.mock('@/design-system/tokens/colors', () => ({
  colorTokens: {
    base: {
      primary: { 500: '#1E4448' },
    },
  },
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
import { VotingLiveDot } from '../VotingLiveDot';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('VotingLiveDot', () => {
  beforeEach(() => {
    mockUseActiveVotingCycle.mockReset();
  });

  // 1. Loading → renders null
  it('renders null when loading', () => {
    mockUseActiveVotingCycle.mockReturnValue({ cycle: null, isLoading: true });
    const { toJSON } = render(<VotingLiveDot />);
    expect(toJSON()).toBeNull();
  });

  // 2. No cycle → renders null
  it('renders null when no cycle', () => {
    mockUseActiveVotingCycle.mockReturnValue({ cycle: null, isLoading: false });
    const { toJSON } = render(<VotingLiveDot />);
    expect(toJSON()).toBeNull();
  });

  // 3. COMPLETED status → renders null
  it('renders null when cycle is COMPLETED', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'COMPLETED' },
      isLoading: false,
    });
    const { toJSON } = render(<VotingLiveDot />);
    expect(toJSON()).toBeNull();
  });

  // 4. ACTIVE status → renders dot with correct accessibility label
  it('renders dot when cycle is ACTIVE', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'ACTIVE' },
      isLoading: false,
    });
    const { getByLabelText } = render(<VotingLiveDot />);
    expect(getByLabelText('Voting is active')).toBeTruthy();
  });

  // 5. BALLOT_OPEN status → renders dot
  it('renders dot when cycle is BALLOT_OPEN', () => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status: 'BALLOT_OPEN' },
      isLoading: false,
    });
    const { getByLabelText } = render(<VotingLiveDot />);
    expect(getByLabelText('Voting is active')).toBeTruthy();
  });

  // 6. Non-live statuses → renders null
  it.each(['DRAFT', 'EXPIRED'])('renders null for status "%s"', status => {
    mockUseActiveVotingCycle.mockReturnValue({
      cycle: { _id: 'c1', status },
      isLoading: false,
    });
    const { toJSON } = render(<VotingLiveDot />);
    expect(toJSON()).toBeNull();
  });
});
