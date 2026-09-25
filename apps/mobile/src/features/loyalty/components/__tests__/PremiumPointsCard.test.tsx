/**
 * PremiumPointsCard Component - Unit Tests
 * Tests the voting star animation presence, visibility, and reset behavior.
 */

import { render } from '@testing-library/react-native';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
jest.mock('@/design-system/components/atoms', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MockText = ({ children, style }: { children?: unknown; style?: any }) =>
    mockReact.createElement(mockRN.Text, { style }, children as React.ReactNode);
  const MockIcon = () => mockReact.createElement(mockRN.View, null);
  const MockAvatar = () => mockReact.createElement(mockRN.View, { testID: 'avatar' });
  return { Text: MockText, Icon: MockIcon, Avatar: MockAvatar };
});

jest.mock('@/design-system/providers', () => ({
  useTheme: () => ({
    colors: { primary: '#1E4448', surface: '#FFFFFF', onSurfaceVariant: '#888' },
  }),
}));

// The card reads identity through useCurrentUser, not Redux directly. Mocking
// the hook (rather than wrapping in a QueryClientProvider) keeps this a unit
// test of the card: no real /auth/me, and none of apiClient → i18n → mmkv is
// pulled into the module graph just to render a name.
jest.mock('@/features/auth/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({
    user: {
      firstName: 'John',
      lastName: 'Doe',
      profileImage: null,
      avatar: null,
    },
    isRefreshing: false,
    isFresh: true,
  }),
}));

jest.mock('../../constants/tiers', () => ({
  getTierConfig: () => ({
    name: 'Silver',
    gradientStart: '#C0C0C0',
    gradientEnd: '#E0E0E0',
    textColor: '#333',
    minPoints: 500,
    multiplier: 1.5,
    icon: 'star',
  }),
  getTierProgress: () => 0.6,
  getPointsToNextTier: () => 200,
}));

jest.mock('../AnimatedCounter', () => {
  const mockReact = jest.requireActual<typeof import('react')>('react');
  const mockRN = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    AnimatedCounter: ({ value }: { value: number }) =>
      mockReact.createElement(mockRN.Text, { testID: 'animated-counter' }, String(value)),
  };
});

// ---------------------------------------------------------------------------
// Import component after mocks
// ---------------------------------------------------------------------------
import { PremiumPointsCard } from '../PremiumPointsCard';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('PremiumPointsCard', () => {
  const defaultProps = {
    availablePoints: 1500,
    lifetimePointsEarned: 3000,
    currentTier: 'Silver' as const,
  };

  it('renders card with points and tier', () => {
    const { getByText, getByTestId } = render(<PremiumPointsCard {...defaultProps} />);

    expect(getByTestId('animated-counter')).toBeTruthy();
    expect(getByText('Available points')).toBeTruthy();
    expect(getByText('Silver')).toBeTruthy();
  });

  it('renders user name from the current-user hook', () => {
    const { getByText } = render(<PremiumPointsCard {...defaultProps} />);
    expect(getByText('John')).toBeTruthy();
    expect(getByText('Doe')).toBeTruthy();
  });

  it('shows progress caption with points to next tier', () => {
    const { getByText } = render(<PremiumPointsCard {...defaultProps} />);
    expect(getByText('200 pts to next tier')).toBeTruthy();
  });

  // ── Voting Star Tests ──

  it('does NOT show star when votingLive is false', () => {
    const { queryByText } = render(<PremiumPointsCard {...defaultProps} votingLive={false} />);
    expect(queryByText('⭐')).toBeNull();
  });

  it('does NOT show star when votingLive is undefined', () => {
    const { queryByText } = render(<PremiumPointsCard {...defaultProps} />);
    expect(queryByText('⭐')).toBeNull();
  });

  it('shows star when votingLive is true', () => {
    const { getByText } = render(<PremiumPointsCard {...defaultProps} votingLive={true} />);
    expect(getByText('⭐')).toBeTruthy();
  });

  it('hides star when votingLive changes from true to false', () => {
    const { rerender, queryByText } = render(
      <PremiumPointsCard {...defaultProps} votingLive={true} />,
    );

    expect(queryByText('⭐')).toBeTruthy();

    rerender(<PremiumPointsCard {...defaultProps} votingLive={false} />);

    expect(queryByText('⭐')).toBeNull();
  });

  it('shows star again when votingLive changes from false to true', () => {
    const { rerender, queryByText, getByText } = render(
      <PremiumPointsCard {...defaultProps} votingLive={false} />,
    );

    expect(queryByText('⭐')).toBeNull();

    rerender(<PremiumPointsCard {...defaultProps} votingLive={true} />);

    expect(getByText('⭐')).toBeTruthy();
  });
});
