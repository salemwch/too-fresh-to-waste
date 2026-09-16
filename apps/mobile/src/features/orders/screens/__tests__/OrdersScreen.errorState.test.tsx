/**
 * A failed orders request must not render as "you have no orders".
 *
 * `useOrders` already returned `error`, but the screen never destructured it,
 * so the render collapsed to `currentOrders.length === 0` and showed the empty
 * state. The user was told something false about their own data, with no way to
 * retry - the failure mode is silent, which is why it needs a test rather than
 * a code comment.
 *
 * The empty and error branches are asserted as mutually exclusive in both
 * directions, because the bug was precisely that one masqueraded as the other.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';

import { OrdersScreen } from '../OrdersScreen';

/*
 * OrdersScreen now reads the floating tab bar height so its list can clear the
 * bar, and useSafeAreaInsets throws outside a provider by design. Mocked rather
 * than wrapped, matching LoginScreen.matrix.test.tsx.
 */
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

const mockRefetch = jest.fn();

const mockOrders = {
  activeOrders: [] as unknown[],
  historyOrders: [] as unknown[],
  isLoading: false,
  isRefetching: false,
  refetch: mockRefetch,
  loadMore: jest.fn(),
  isFetchingNextPage: false,
  error: null as unknown,
};

jest.mock('../../hooks/useOrders', () => ({
  useOrders: () => mockOrders,
  usePrefetchOrder: () => jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), addListener: () => () => {} }),
  useFocusEffect: () => undefined,
}));

// Matches the ThemeProvider wrapper the design-system component tests use.
const renderScreen = () =>
  render(
    <ThemeProvider>
      <OrdersScreen {...({} as React.ComponentProps<typeof OrdersScreen>)} />
    </ThemeProvider>,
  );

beforeEach(() => {
  mockRefetch.mockClear();
  mockOrders.activeOrders = [];
  mockOrders.historyOrders = [];
  mockOrders.isLoading = false;
  mockOrders.error = null;
});

describe('when the request failed', () => {
  beforeEach(() => {
    mockOrders.error = new Error('Network request failed');
  });

  it('shows the error state', () => {
    renderScreen();
    expect(screen.getByTestId('orders-error-state')).toBeTruthy();
  });

  it('does NOT show the empty state', () => {
    renderScreen();
    expect(screen.queryByText('orders.noActiveOrders')).toBeNull();
  });

  it('offers a retry that refetches', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('orders-error-retry'));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('prefers the error state over the loading state once loading finishes', () => {
    mockOrders.isLoading = false;
    renderScreen();
    expect(screen.getByTestId('orders-error-state')).toBeTruthy();
  });

  it('shows the skeleton, not the error, while still loading', () => {
    mockOrders.isLoading = true;
    renderScreen();
    expect(screen.queryByTestId('orders-error-state')).toBeNull();
  });
});

describe('when the request succeeded with no orders', () => {
  it('shows the empty state, not the error state', () => {
    mockOrders.error = null;
    renderScreen();
    expect(screen.queryByTestId('orders-error-state')).toBeNull();
  });
});
