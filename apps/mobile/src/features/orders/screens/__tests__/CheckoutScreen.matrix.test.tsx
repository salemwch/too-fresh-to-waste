/**
 * Checkout baselines - captured **before** the MD2 palette migration.
 *
 * Checkout is the only screen in the app where a design regression costs money
 * directly: a price that loses contrast, a disabled fulfilment option that stops
 * reading as disabled, a validation banner that turns the same colour as the
 * surface behind it. It also carries its own style module
 * (`CheckoutScreen.styles.ts`) with four exported colour constants, which is
 * exactly the shape phase 4 rewrites.
 *
 * The variants baselined here are the ones that change what the user is asked to
 * pay or agree to - fulfilment mode, payment method, distance gate, phone
 * verification - not every permutation of the form.
 *
 * Not a screenshot - see src/test-utils/visualMatrix.tsx for the boundary.
 */

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { matrixSnapshotAsync, renderCaseAsync, FULL_CASES } from '@/test-utils/visualMatrix';
import { makeOffer } from '@/test-utils/fixtures/offer';

import { CheckoutScreen } from '../CheckoutScreen';

import type { MainStackParamList } from '@/navigation/types';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

jest.mock('react-native-maps', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Marker: View, PROVIDER_GOOGLE: 'google' };
});

const mockState = {
  offer: makeOffer() as ReturnType<typeof makeOffer> | undefined,
  isLoadingOffer: false,
  onlinePayment: true,
  phoneVerified: true,
  /* Tunis city centre, ~0 km from the fixture establishment - inside the 5 km
   * delivery gate. `null` models a user with no stored location at all. */
  coordinates: { latitude: 36.8008, longitude: 10.1817 } as {
    latitude: number;
    longitude: number;
  } | null,
};

/* React Query is NOT mocked.
 *
 * Overriding `useQuery` alone leaves `useMutation` unprovided, and
 * OrderSuccessModal - which CheckoutScreen renders unconditionally - calls it.
 * Mocking at the service boundary instead keeps the real query wiring in the
 * baseline, which is the part that decides whether the skeleton or the form is
 * on screen. */
jest.mock('@/features/offers/services/offersService', () => ({
  offersService: {
    getOfferById: jest.fn(async () => {
      if (mockState.isLoadingOffer) return new Promise(() => undefined);
      if (!mockState.offer) throw new Error('offer not found');
      return mockState.offer;
    }),
  },
}));

/* Mocked at `react-redux` rather than at the `@/hooks` barrel: the barrel's
 * real module pulls in react-redux's ESM build, which jest does not transform,
 * and mocking the barrel without `requireActual` would break every other hook
 * the tree imports from it.
 *
 * `isPhoneVerified` lives on `state.auth.user`, not on `state.auth` -
 * `selectIsPhoneVerified` reads `state.auth.user?.isPhoneVerified ?? false`, so
 * a top-level flag here would have silently rendered every case unverified. */
jest.mock('react-redux', () => {
  /* Built per call, not once at factory time: `setState` mutates `mockState`
   * between describes, and a state object captured when the module was mocked
   * would pin `phoneVerified` at its initial value - rendering the "phone not
   * verified" case as verified, with a green baseline to match. */
  const buildState = () => ({
    auth: {
      user: {
        userId: 'user-1',
        firstName: 'Amine',
        phoneNumber: '+21620123456',
        isPhoneVerified: mockState.phoneVerified,
      },
      isAuthenticated: true,
      isLoading: false,
      error: null,
    },
  });
  const useSelector = (selector: (s: unknown) => unknown) => selector(buildState());
  const useDispatch = () => jest.fn();
  /* `src/hooks/redux.ts` builds its typed hooks with `.withTypes<T>()`, which
   * react-redux 9 attaches to the hook function itself - so the mock has to
   * carry it or the module throws at import time. */
  useSelector.withTypes = () => useSelector;
  useDispatch.withTypes = () => useDispatch;
  return { useDispatch, useSelector };
});

/* CheckoutScreen pulls in getCurrentPositionOnce, whose module body touches the
 * native Geolocation interface at import time. Stubbed rather than exercised -
 * this spec is about the rendered surface, and the position path has its own
 * tests under services/location. */
jest.mock('@/services/location/getCurrentPositionOnce', () => ({
  getCurrentPositionOnce: jest.fn(async () => ({ latitude: 36.8008, longitude: 10.1817 })),
}));

jest.mock('@/hooks/useLocation', () => ({
  useLocation: () => ({ coordinates: mockState.coordinates }),
}));

jest.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ onlinePayment: mockState.onlinePayment }),
}));

jest.mock('@/hooks/usePressGuard', () => ({
  usePressGuard: (fn: () => void) => ({ guardedPress: fn, isGuarded: false }),
}));

/* The full return shape, not a convenient subset: CheckoutScreen reads
 * `phoneVerificationModal.isVisible` unguarded during render, so a partial mock
 * crashes the screen rather than degrading. */
jest.mock('../../hooks/useCreateOrder', () => ({
  useCreateOrder: () => ({
    createOrder: jest.fn(),
    isLoading: false,
    error: null,
    phoneVerificationModal: {
      isVisible: false,
      requiresPhoneSetup: false,
      requiresPhoneVerification: false,
    },
    openPhoneSetupModal: jest.fn(),
    closePhoneVerificationModal: jest.fn(),
  }),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  addListener: () => () => undefined,
  setOptions: jest.fn(),
} as unknown as NativeStackNavigationProp<MainStackParamList, 'Checkout'>;

const route = {
  key: 'Checkout-1',
  name: 'Checkout',
  params: { offerId: 'offer-1', quantity: 2 },
} as unknown as RouteProp<MainStackParamList, 'Checkout'>;

/* A fresh client per case: react-query caches by key, and a shared client would
 * carry the first case's offer into the "offer gone" case. `retry: false` makes
 * a rejected fetch settle on the first flush rather than backing off. */
const screen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>
      <CheckoutScreen navigation={navigation} route={route} />
    </QueryClientProvider>
  );
};

const setState = (patch: Partial<typeof mockState>) =>
  Object.assign(mockState, {
    offer: makeOffer(),
    isLoadingOffer: false,
    onlinePayment: true,
    phoneVerified: true,
    coordinates: { latitude: 36.8008, longitude: 10.1817 },
    ...patch,
  });

describe('CheckoutScreen', () => {
  describe('loading the offer', () => {
    // Renders SkeletonCheckoutScreen, which is its own animated component - the
    // skeleton's dimensions are a design contract too, since a mismatch with the
    // real layout is what makes a load flash.
    beforeAll(() => setState({ isLoadingOffer: true, offer: undefined }));
    matrixSnapshotAsync('loading', screen, FULL_CASES);
  });

  describe('offer gone', () => {
    // Sold out or withdrawn between listing and checkout.
    beforeAll(() => setState({ offer: undefined }));
    matrixSnapshotAsync('offer-not-found', screen, FULL_CASES);
  });

  describe('pickup, cash, online payment available', () => {
    beforeAll(() => setState({}));
    matrixSnapshotAsync('default-pickup-cash', screen, FULL_CASES);
  });

  describe('online payment disabled by the server flag', () => {
    // useFeatureFlags is server-gated, so this is a state real users see.
    beforeAll(() => setState({ onlinePayment: false }));
    matrixSnapshotAsync('online-payment-off', screen, FULL_CASES);
  });

  describe('phone not verified', () => {
    // Gates order creation behind the verification modal.
    beforeAll(() => setState({ phoneVerified: false }));
    matrixSnapshotAsync('phone-unverified', screen, FULL_CASES);
  });

  describe('establishment outside the delivery zone', () => {
    // MAX_DELIVERY_KM is a hard backend gate; the screen must disable delivery
    // proactively rather than let the request fail. Sousse is ~120 km away.
    beforeAll(() => setState({ coordinates: { latitude: 35.8256, longitude: 10.6084 } }));
    matrixSnapshotAsync('outside-delivery-zone', screen, FULL_CASES);
  });

  describe('no stored user location', () => {
    // First run, before the location chooser has been answered.
    beforeAll(() => setState({ coordinates: null }));
    matrixSnapshotAsync('no-user-location', screen, FULL_CASES);
  });
});

/**
 * Guards on the baselines above.
 *
 * The snapshots are only worth their bytes if each case is in the state its name
 * claims. The first version of this spec captured `SkeletonCheckoutScreen` for
 * all seven states and passed - the React Query fetch had not settled, every
 * baseline was byte-identical, and nothing said so.
 *
 * These assertions are what make that impossible to repeat: they name the
 * element that only exists in one branch, so a screen stuck on the skeleton
 * fails here rather than being recorded as the design.
 */
describe('state gates', () => {
  const CASE = { device: 'standard', theme: 'light', locale: 'en' } as const;

  it('the loading case is the skeleton, not the form or the error', async () => {
    setState({ isLoadingOffer: true, offer: undefined });
    const { result } = await renderCaseAsync(screen(), CASE);
    expect(result.queryByText('Offer Not Found')).toBeNull();
    expect(result.queryByText('Subtotal')).toBeNull();
  });

  it('the offer-gone case renders the not-found branch', async () => {
    setState({ offer: undefined });
    const { result } = await renderCaseAsync(screen(), CASE);
    expect(result.getByText('Offer Not Found')).toBeTruthy();
  });

  it('the populated cases render the order form', async () => {
    setState({});
    const { result } = await renderCaseAsync(screen(), CASE);
    expect(result.getByText('Subtotal')).toBeTruthy();
    expect(result.queryByText('Offer Not Found')).toBeNull();
  });

  it('an unverified phone does not change the resting screen', async () => {
    // Verification gates submission, not render - so this baseline is expected
    // to match `default-pickup-cash`. Asserted rather than assumed, because an
    // identical pair otherwise looks like the capture bug above.
    setState({});
    const verified = await renderCaseAsync(screen(), CASE);
    setState({ phoneVerified: false });
    const unverified = await renderCaseAsync(screen(), CASE);
    expect(unverified.styles).toEqual(verified.styles);
  });

  it('a user with no stored location still sees delivery offered', async () => {
    // `isOutsideDeliveryZone` returns false when userCoords is null, so the
    // delivery option is not disabled proactively. Recorded as behaviour: it is
    // why `no-user-location` matches `default-pickup-cash`.
    setState({});
    const located = await renderCaseAsync(screen(), CASE);
    setState({ coordinates: null });
    const unlocated = await renderCaseAsync(screen(), CASE);
    expect(unlocated.styles).toEqual(located.styles);
  });

  it('an establishment outside the delivery zone does change the screen', async () => {
    setState({});
    const inside = await renderCaseAsync(screen(), CASE);
    setState({ coordinates: { latitude: 35.8256, longitude: 10.6084 } });
    const outside = await renderCaseAsync(screen(), CASE);
    expect(outside.styles).not.toEqual(inside.styles);
  });
});
