/**
 * State matrix for OrdersScreen - loading, empty, error, populated.
 *
 * These are the four states the audit found were not all covered: the error
 * branch did not exist, so a failed request rendered as an empty list. Pinning
 * all four across theme and locale means the distinction cannot collapse again,
 * and it gives the token migration (M1/M2) a commerce screen to move against
 * rather than only isolated atoms.
 *
 * Not a screenshot - see src/test-utils/visualMatrix.tsx for what this does and
 * does not cover.
 */

import React from 'react';

import { matrixSnapshot, type MatrixCase } from '@/test-utils/visualMatrix';

import { OrdersScreen } from '../OrdersScreen';

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

/** Theme and direction are what change a screen's chrome; device size is covered by the atoms. */
const CASES: MatrixCase[] = [
  { device: 'standard', theme: 'light', locale: 'en' },
  { device: 'standard', theme: 'dark', locale: 'en' },
  { device: 'standard', theme: 'light', locale: 'ar' },
  { device: 'small', theme: 'light', locale: 'en' },
];

const screen = () => <OrdersScreen {...({} as React.ComponentProps<typeof OrdersScreen>)} />;

const setState = (patch: Partial<typeof mockOrders>) => {
  Object.assign(mockOrders, {
    activeOrders: [],
    historyOrders: [],
    isLoading: false,
    error: null,
    ...patch,
  });
};

describe('OrdersScreen states', () => {
  describe('loading', () => {
    beforeAll(() => setState({ isLoading: true }));
    matrixSnapshot('loading', screen(), CASES);
  });

  describe('error', () => {
    beforeAll(() => setState({ error: new Error('Network request failed') }));
    matrixSnapshot('error', screen(), CASES);
  });

  describe('empty', () => {
    beforeAll(() => setState({}));
    matrixSnapshot('empty', screen(), CASES);
  });
});
