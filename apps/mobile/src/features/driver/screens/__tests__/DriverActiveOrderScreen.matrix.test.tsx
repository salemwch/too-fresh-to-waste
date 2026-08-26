/**
 * Driver active-delivery baselines - captured **before** the MD4 migration.
 *
 * The screen is a two-state machine, and the state is the whole design: before
 * pickup the map aims at the store and the primary action is "Confirm Pickup";
 * after it, the map aims at the customer and the action becomes "Mark as
 * Delivered". Both are baselined, because a migration that only looks right in
 * the state the developer happened to open is the usual way this breaks.
 *
 * This is also the screen carrying the audit's one named raw colour -
 * `pinColor='#FF9800'` on the pickup marker, sitting next to a tokenised
 * `colorTokens.base.info[500]` on the customer marker. The harness tracks
 * `pinColor` as a prop so phase 5 cannot change it unobserved.
 *
 * Dark cases are currently identical to light - see the note in
 * DriverEarningsScreen.matrix.test.tsx.
 */

import React from 'react';

import { matrixSnapshotAsync, FULL_CASES } from '@/test-utils/visualMatrix';
import { makeAssignedOrder, makeOutForDeliveryOrder } from '@/test-utils/fixtures/driver';

import DriverActiveOrderScreen from '../DriverActiveOrderScreen';

import type {
  DriverActiveOrderNavigationProp,
  DriverActiveOrderRouteProp,
} from '@/navigation/types';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Marker: View, PROVIDER_GOOGLE: 'google' };
});

const mockState = {
  order: undefined as ReturnType<typeof makeAssignedOrder> | undefined,
  isLoading: false,
};

jest.mock('../../hooks/useDriverOrders', () => ({
  useActiveOrder: () => ({ data: mockState.order, isLoading: mockState.isLoading }),
  useMarkPickedUp: () => ({ mutate: jest.fn(), isPending: false }),
  useMarkDelivered: () => ({ mutate: jest.fn(), isPending: false }),
  useUnassignOrder: () => ({ mutate: jest.fn(), isPending: false }),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  addListener: () => () => undefined,
} as unknown as DriverActiveOrderNavigationProp;

/* The route param only seeds the first paint; the query is the source of truth.
 * Left empty so each case is driven purely by the mocked query, which is what
 * the screen actually renders from after the first frame. */
const route = {
  key: 'DriverActiveOrder-1',
  name: 'DriverActiveOrder',
  params: { orderId: 'driver-order-1' },
} as unknown as DriverActiveOrderRouteProp;

const screen = () => <DriverActiveOrderScreen navigation={navigation} route={route} />;

const setState = (patch: Partial<typeof mockState>) =>
  Object.assign(mockState, { order: undefined, isLoading: false, ...patch });

describe('DriverActiveOrderScreen', () => {
  describe('recovering the delivery after a restart', () => {
    beforeAll(() => setState({ isLoading: true }));
    matrixSnapshotAsync('loading', screen, FULL_CASES);
  });

  describe('no longer assigned', () => {
    // Reached by the auto-unassign Bull job or an admin action - the driver is
    // left on a screen whose order has gone, and must get a way back.
    beforeAll(() => setState({}));
    matrixSnapshotAsync('unassigned', screen, FULL_CASES);
  });

  describe('assigned, heading to the store', () => {
    beforeAll(() => setState({ order: makeAssignedOrder() }));
    matrixSnapshotAsync('driver-assigned', screen, FULL_CASES);
  });

  describe('collected, en route to the customer', () => {
    beforeAll(() => setState({ order: makeOutForDeliveryOrder() }));
    matrixSnapshotAsync('out-for-delivery', screen, FULL_CASES);
  });

  describe('assigned, no coordinates to map', () => {
    beforeAll(() =>
      setState({
        order: makeAssignedOrder({
          deliveryAddress: { street: '12 Rue du Lac Turkana', city: 'Tunis', postalCode: '1053' },
          establishmentAddress: { street: '4 Avenue Habib Bourguiba', city: 'Tunis' },
        }),
      }),
    );
    matrixSnapshotAsync('no-map', screen, FULL_CASES);
  });
});
