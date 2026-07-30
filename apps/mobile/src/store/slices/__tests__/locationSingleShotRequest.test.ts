import { configureStore } from '@reduxjs/toolkit';
import Geolocation from '@react-native-community/geolocation';
import { request } from 'react-native-permissions';

import { getLastKnownLocation } from '@/native/LastKnownLocation';
import { resetInFlightPositionRequestForTests } from '@/services/location/getCurrentPositionOnce';

import locationReducer, { requestLocationAsync } from '../locationSlice';

/**
 * `requestLocationAsync` must issue exactly ONE getCurrentPosition call.
 *
 * PlayServicesLocationManager stores the single-shot LocationCallback in one
 * shared instance field and, inside the callback, unregisters via that field
 * instead of via `this`. Two overlapping calls register two callbacks against
 * that one slot: the first delivery nulls the field, the second calls
 * removeLocationUpdates(null), and Play Services throws
 * `NullPointerException: Listener must not be null` on the main thread. The
 * process dies, the task disappears, and Android surfaces whatever was behind
 * it — for a Play Store install, the Play Store itself.
 *
 * That crash shipped in release 70. It was reachable only on a fresh install:
 * both calls first await getLastLocation(), so once Play Services holds a fix
 * newer than `maximumAge` both return early without registering anything. Tap
 * the button the instant the prompt appears on a first run and there is no such
 * fix, both register, and the first GPS report kills the app.
 *
 * The first assertion below is the whole point of this file. If someone
 * reintroduces a "fast tier plus accurate tier" pair — in parallel or in
 * sequence, which is equally unsafe because this path ignores `timeout` and
 * cannot cancel a pending request — it fails.
 */

jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: {
    ANDROID: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
    IOS: { LOCATION_WHEN_IN_USE: 'ios.permission.LOCATION_WHEN_IN_USE' },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  },
}));

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    getCurrentPosition: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('@/native/LastKnownLocation', () => ({
  getLastKnownLocation: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRequest = request as jest.MockedFunction<typeof request>;
const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.MockedFunction<
  typeof Geolocation.getCurrentPosition
>;
const mockGetLastKnownLocation = getLastKnownLocation as jest.MockedFunction<
  typeof getLastKnownLocation
>;

type SuccessFn = Parameters<typeof Geolocation.getCurrentPosition>[0];
type ErrorFn = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;

const makeStore = () => configureStore({ reducer: { location: locationReducer } });

const position = (latitude: number, longitude: number, accuracy = 12) =>
  ({ coords: { latitude, longitude, accuracy } }) as unknown as Parameters<SuccessFn>[0];

/** Grants permission and reports no usable native cache — the fresh-install state. */
const arrangeFreshInstall = (): void => {
  mockRequest.mockResolvedValue('granted' as Awaited<ReturnType<typeof request>>);
  mockGetLastKnownLocation.mockResolvedValue(null);
};

/** Captures the callbacks handed to the single getCurrentPosition call. */
const captureCallbacks = (): { success: () => SuccessFn; error: () => ErrorFn } => ({
  success: () => mockGetCurrentPosition.mock.calls[0]?.[0] as SuccessFn,
  error: () => mockGetCurrentPosition.mock.calls[0]?.[1] as ErrorFn,
});

describe('requestLocationAsync issues a single position request', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // getCurrentPositionOnce keeps its in-flight request in module scope, because
    // the native constraint it guards is process-wide. Tests that leave a
    // request pending would otherwise have the next test JOIN it instead of
    // issuing its own call.
    resetInFlightPositionRequestForTests();
  });

  it('calls getCurrentPosition exactly once', async () => {
    arrangeFreshInstall();
    // Never calls back: the thunk stays pending, which is exactly the window in
    // which the old code had two callbacks registered at the same time.
    mockGetCurrentPosition.mockImplementation(() => undefined);
    const store = makeStore();

    void store.dispatch(requestLocationAsync());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('does not request a position at all when the native cache is fresh', async () => {
    mockRequest.mockResolvedValue('granted' as Awaited<ReturnType<typeof request>>);
    mockGetLastKnownLocation.mockResolvedValue({
      latitude: 35.7667,
      longitude: 10.6004,
      accuracy: 20,
      timestamp: Date.now(),
    });
    const store = makeStore();

    const action = await store.dispatch(requestLocationAsync());

    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(requestLocationAsync.fulfilled.match(action)).toBe(true);
  });

  it('does not request a position when permission is refused', async () => {
    mockRequest.mockResolvedValue('denied' as Awaited<ReturnType<typeof request>>);
    const store = makeStore();

    await store.dispatch(requestLocationAsync());

    // Asking the fused provider without permission throws SecurityException in
    // the native module, so the guard has to come first.
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
    expect(store.getState().location.permissionStatus).toBe('denied');
  });

  it('resolves with the reported coordinates', async () => {
    arrangeFreshInstall();
    const cb = captureCallbacks();
    mockGetCurrentPosition.mockImplementation(() => undefined);
    const store = makeStore();

    const pending = store.dispatch(requestLocationAsync());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    cb.success()(position(36.8065, 10.1815));
    await pending;

    expect(store.getState().location.coordinates).toEqual({
      latitude: 36.8065,
      longitude: 10.1815,
    });
    expect(store.getState().location.source).toBe('gps');
  });

  it('surfaces a human-readable message when the provider fails', async () => {
    arrangeFreshInstall();
    const cb = captureCallbacks();
    mockGetCurrentPosition.mockImplementation(() => undefined);
    const store = makeStore();

    const pending = store.dispatch(requestLocationAsync());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    cb.error()({ code: 3, message: 'GPS_UNAVAILABLE' } as Parameters<ErrorFn>[0]);
    await pending;

    // The native message must never reach the UI.
    const { error } = store.getState().location;
    expect(error).toBe('GPS signal not found. Please try again or search for your city.');
    expect(error).not.toContain('GPS_UNAVAILABLE');
  });

  it('ignores a second delivery for the same request', async () => {
    arrangeFreshInstall();
    const cb = captureCallbacks();
    mockGetCurrentPosition.mockImplementation(() => undefined);
    const store = makeStore();

    const pending = store.dispatch(requestLocationAsync());
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    cb.success()(position(36.8065, 10.1815));
    await pending;

    // Play Services delivered twice is what caused the crash in the first
    // place. A late second delivery, or a late error, must be inert rather
    // than re-settling the thunk or wiping the coordinates we already stored.
    cb.success()(position(0, 0));
    cb.error()({ code: 1, message: 'late failure' } as Parameters<ErrorFn>[0]);

    expect(store.getState().location.coordinates).toEqual({
      latitude: 36.8065,
      longitude: 10.1815,
    });
    expect(store.getState().location.error).toBeNull();
  });
});

describe('requestLocationAsync timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // getCurrentPositionOnce keeps its in-flight request in module scope, because
    // the native constraint it guards is process-wide. Tests that leave a
    // request pending would otherwise have the next test JOIN it instead of
    // issuing its own call.
    resetInFlightPositionRequestForTests();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives up rather than hanging forever when no fix ever arrives', async () => {
    arrangeFreshInstall();
    mockGetCurrentPosition.mockImplementation(() => undefined);
    const store = makeStore();

    const pending = store.dispatch(requestLocationAsync());
    // Let the permission + native-cache awaits drain before the timer matters.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    jest.advanceTimersByTime(30_000);
    const action = await pending;

    // The Play Services path ignores the `timeout` option entirely, so without
    // a JS-side timer the user sits on a spinner indefinitely — indoors, that
    // is the normal case, not an edge case.
    expect(requestLocationAsync.rejected.match(action)).toBe(true);
    expect(store.getState().location.isLoading).toBe(false);
    expect(store.getState().location.error).toBe(
      'GPS signal not found. Please try again or search for your city.',
    );
  });
});
