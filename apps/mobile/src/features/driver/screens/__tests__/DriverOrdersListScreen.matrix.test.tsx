/**
 * Driver order-list baselines - captured **before** the MD4 migration.
 *
 * This screen has nine render gates, and the first two are reached only through
 * an awaited permission check - so every case here goes through
 * `matrixSnapshotAsync`. A synchronous render pins the "Starting up" spinner as
 * the baseline for all nine, which looks like coverage and is not.
 *
 * The permission-denied and GPS-error gates matter disproportionately: the
 * BlueStacks rig pre-grants location (see `.claude/rules/mobile.md` #14), so
 * they cannot be reached by hand on the usual emulator at all. These baselines
 * are the only place they are exercised.
 *
 * Dark cases are currently identical to light - see the note in
 * DriverEarningsScreen.matrix.test.tsx. That divergence is phase 5's acceptance
 * criterion, not a fixture bug.
 */

import React from 'react';

import { matrixSnapshotAsync, FULL_CASES } from '@/test-utils/visualMatrix';
import {
  DRIVER_COORDS,
  makeAssignedOrder,
  makeDriverOrder,
  makeDriverProfile,
} from '@/test-utils/fixtures/driver';

import DriverOrdersListScreen from '../DriverOrdersListScreen';

import type { DriverOrdersListNavigationProp } from '@/navigation/types';

jest.mock('@shopify/flash-list', () => {
  const { FlatList } = jest.requireActual('react-native');
  return { FlashList: FlatList };
});

const mockState = {
  permission: 'granted' as string,
  coords: DRIVER_COORDS as { lat: number; lng: number } | null,
  profile: makeDriverProfile() as ReturnType<typeof makeDriverProfile> | undefined,
  profileLoading: false,
  profileError: false,
  activeOrder: undefined as ReturnType<typeof makeAssignedOrder> | undefined,
  orders: [] as ReturnType<typeof makeDriverOrder>[],
  ordersLoading: false,
  ordersError: false,
};

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
  },
  RESULTS: {
    GRANTED: 'granted',
    LIMITED: 'limited',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  check: jest.fn(async () => mockState.permission),
  request: jest.fn(async () => mockState.permission),
  openSettings: jest.fn(),
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    // Fires synchronously so the position is in state by the first flush; the
    // real watcher is a subscription, and the baseline wants its settled result.
    watchPosition: (onSuccess: (p: unknown) => void, onError: () => void) => {
      if (mockState.coords === null) onError();
      else
        onSuccess({ coords: { latitude: mockState.coords.lat, longitude: mockState.coords.lng } });
      return 1;
    },
    clearWatch: jest.fn(),
  },
}));

jest.mock('../../hooks/useLocationHeartbeat', () => ({ useLocationHeartbeat: () => undefined }));

jest.mock('../../hooks/useDriverOrders', () => ({
  useDriverProfile: () => ({
    data: mockState.profile,
    isLoading: mockState.profileLoading,
    isError: mockState.profileError,
    refetch: jest.fn(),
  }),
  useSetOnlineStatus: () => ({ mutate: jest.fn(), isPending: false }),
  useActiveOrder: () => ({ data: mockState.activeOrder }),
  useAvailableOrders: () => ({
    data: mockState.orders,
    isLoading: mockState.ordersLoading,
    isRefetching: false,
    isError: mockState.ordersError,
    refetch: jest.fn(),
  }),
}));

const navigation = {
  navigate: jest.fn(),
  addListener: () => () => undefined,
} as unknown as DriverOrdersListNavigationProp;

const screen = () => <DriverOrdersListScreen navigation={navigation} />;

const setState = (patch: Partial<typeof mockState>) =>
  Object.assign(mockState, {
    permission: 'granted',
    coords: DRIVER_COORDS,
    profile: makeDriverProfile(),
    profileLoading: false,
    profileError: false,
    activeOrder: undefined,
    orders: [],
    ordersLoading: false,
    ordersError: false,
    ...patch,
  });

describe('DriverOrdersListScreen', () => {
  describe('location permission denied', () => {
    beforeAll(() => setState({ permission: 'denied' }));
    matrixSnapshotAsync('permission-denied', screen, FULL_CASES);
  });

  describe('location permission blocked', () => {
    // Distinct from denied: this one routes to system settings rather than a retry.
    beforeAll(() => setState({ permission: 'blocked' }));
    matrixSnapshotAsync('permission-blocked', screen, FULL_CASES);
  });

  describe('driver profile loading', () => {
    beforeAll(() => setState({ profileLoading: true, profile: undefined }));
    matrixSnapshotAsync('profile-loading', screen, FULL_CASES);
  });

  describe('driver profile failed', () => {
    beforeAll(() => setState({ profileError: true, profile: undefined }));
    matrixSnapshotAsync('profile-error', screen, FULL_CASES);
  });

  describe('offline', () => {
    beforeAll(() => setState({ profile: makeDriverProfile({ isOnline: false }) }));
    matrixSnapshotAsync('offline', screen, FULL_CASES);
  });

  describe('online but no GPS fix', () => {
    beforeAll(() => setState({ coords: null }));
    matrixSnapshotAsync('no-gps-fix', screen, FULL_CASES);
  });

  describe('resuming an active delivery', () => {
    // The app-restart recovery path: an assigned order pre-empts the pool.
    beforeAll(() => setState({ activeOrder: makeAssignedOrder() }));
    matrixSnapshotAsync('active-order-banner', screen, FULL_CASES);
  });

  describe('online, pool empty', () => {
    beforeAll(() => setState({}));
    matrixSnapshotAsync('empty-pool', screen, FULL_CASES);
  });

  describe('online, orders available', () => {
    beforeAll(() =>
      setState({
        orders: [
          makeDriverOrder(),
          makeDriverOrder({ _id: 'driver-order-2', orderNumber: 'ORD-5511', driverEarnings: 3 }),
        ],
      }),
    );
    matrixSnapshotAsync('populated', screen, FULL_CASES);
  });
});
