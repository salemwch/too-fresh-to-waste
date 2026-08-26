/**
 * Driver order-detail baselines - captured **before** the MD4 migration.
 *
 * This screen and DriverActiveOrderScreen are the two that render a map, and
 * the map is where the audit's one named raw colour lives (`pinColor='#FF9800'`,
 * on the sibling screen). `pinColor` is a prop rather than style, so the harness
 * tracks it explicitly - without that, phase 5 could change every marker on the
 * driver flow with these baselines still green.
 *
 * Dark cases are currently identical to light - see the note in
 * DriverEarningsScreen.matrix.test.tsx.
 */

import React from 'react';

import { matrixSnapshotAsync, FULL_CASES } from '@/test-utils/visualMatrix';
import { DRIVER_COORDS, makeDriverOrder } from '@/test-utils/fixtures/driver';

import DriverOrderDetailScreen from '../DriverOrderDetailScreen';

import type {
  DriverOrderDetailNavigationProp,
  DriverOrderDetailRouteProp,
} from '@/navigation/types';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: View,
    Marker: View,
    PROVIDER_GOOGLE: 'google',
  };
});

const mockState = {
  fix: DRIVER_COORDS as { lat: number; lng: number } | null,
  orders: [] as ReturnType<typeof makeDriverOrder>[],
  ordersLoading: false,
};

jest.mock('@/services/location/getCurrentPositionOnce', () => ({
  getCurrentPositionOnce: jest.fn(async () => {
    if (mockState.fix === null) throw new Error('no fix');
    return { latitude: mockState.fix.lat, longitude: mockState.fix.lng };
  }),
}));

jest.mock('../../hooks/useDriverOrders', () => ({
  useAvailableOrders: () => ({ data: mockState.orders, isLoading: mockState.ordersLoading }),
  useAcceptOrder: () => ({ mutate: jest.fn(), isPending: false }),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: () => () => undefined,
} as unknown as DriverOrderDetailNavigationProp;

const route = {
  key: 'DriverOrderDetail-1',
  name: 'DriverOrderDetail',
  params: { orderId: 'driver-order-1' },
} as unknown as DriverOrderDetailRouteProp;

const screen = () => <DriverOrderDetailScreen navigation={navigation} route={route} />;

const setState = (patch: Partial<typeof mockState>) =>
  Object.assign(mockState, {
    fix: DRIVER_COORDS,
    orders: [],
    ordersLoading: false,
    ...patch,
  });

describe('DriverOrderDetailScreen', () => {
  describe('waiting for a GPS fix', () => {
    beforeAll(() => setState({ ordersLoading: true }));
    matrixSnapshotAsync('loading', screen, FULL_CASES);
  });

  describe('order already taken', () => {
    // The lost-the-race path: the pool no longer contains this id.
    beforeAll(() => setState({}));
    matrixSnapshotAsync('not-found', screen, FULL_CASES);
  });

  describe('order available to accept', () => {
    beforeAll(() => setState({ orders: [makeDriverOrder()] }));
    matrixSnapshotAsync('available', screen, FULL_CASES);
  });

  describe('order available, no coordinates to map', () => {
    // The map block is conditional; without coordinates the screen must still
    // render its detail cards rather than collapsing.
    beforeAll(() =>
      setState({
        orders: [
          makeDriverOrder({
            deliveryAddress: { street: '12 Rue du Lac Turkana', city: 'Tunis', postalCode: '1053' },
            establishmentAddress: { street: '4 Avenue Habib Bourguiba', city: 'Tunis' },
          }),
        ],
      }),
    );
    matrixSnapshotAsync('available-no-map', screen, FULL_CASES);
  });
});
