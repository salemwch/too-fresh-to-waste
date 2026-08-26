/**
 * Driver earnings baselines - captured **before** the MD4 migration.
 *
 * There was no test of any kind under `features/driver` before this file. The
 * flow is 2,500 lines across four screens, it handles money, and phase 5 will
 * rewrite its type scale and make it theme-aware - so the baselines are the
 * only thing standing between that rewrite and a silent regression.
 *
 * NOTE ON THE DARK CASES. This screen reads `colorTokens.light.*` directly, so
 * its dark baselines are currently identical to its light ones. That is not a
 * flaw in the fixture - it *is* the MD4/M4 finding, recorded as a value. After
 * phase 5 the dark entries must diverge; if they still match, the theme work
 * did not land.
 *
 * Not a screenshot - see src/test-utils/visualMatrix.tsx for the boundary.
 */

import React from 'react';

import { matrixSnapshot, FULL_CASES } from '@/test-utils/visualMatrix';
import { makeDeliveredOrder, makeEarnings } from '@/test-utils/fixtures/driver';

import DriverEarningsScreen from '../DriverEarningsScreen';

/* FlashList renders nothing under the test renderer without an explicit size;
 * the plain FlatList shim keeps the rows in the captured tree, which is where
 * the history card's type and colour live. */
jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual('react-native');
  return { FlashList: FlatList };
});

const mockState = {
  earnings: undefined as ReturnType<typeof makeEarnings> | undefined,
  earningsLoading: false,
  historyLoading: false,
  orders: [] as ReturnType<typeof makeDeliveredOrder>[],
};

jest.mock('../../hooks/useDriverOrders', () => ({
  useDriverEarnings: () => ({
    data: mockState.earnings,
    isLoading: mockState.earningsLoading,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useDriverOrderHistory: () => ({
    data: { orders: mockState.orders, total: mockState.orders.length, page: 1, limit: 20 },
    isLoading: mockState.historyLoading,
    refetch: jest.fn(),
    isRefetching: false,
  }),
}));

const setState = (patch: Partial<typeof mockState>) =>
  Object.assign(mockState, {
    earnings: makeEarnings(),
    earningsLoading: false,
    historyLoading: false,
    orders: [],
    ...patch,
  });

describe('DriverEarningsScreen', () => {
  describe('loading', () => {
    beforeAll(() => setState({ earningsLoading: true }));
    matrixSnapshot('loading', <DriverEarningsScreen />, FULL_CASES);
  });

  describe('no earnings record yet', () => {
    // A driver who has never delivered. Distinct from an empty history: the
    // summary itself is absent, so the screen takes its own early return.
    beforeAll(() => setState({ earnings: undefined }));
    matrixSnapshot('no-earnings', <DriverEarningsScreen />, FULL_CASES);
  });

  describe('earnings with empty history', () => {
    beforeAll(() => setState({}));
    matrixSnapshot('empty-history', <DriverEarningsScreen />, FULL_CASES);
  });

  describe('earnings with deliveries', () => {
    beforeAll(() =>
      setState({
        orders: [
          makeDeliveredOrder(),
          makeDeliveredOrder({ _id: 'driver-order-done-2', orderNumber: 'ORD-5488' }),
        ],
      }),
    );
    matrixSnapshot('populated', <DriverEarningsScreen />, FULL_CASES);
  });
});
