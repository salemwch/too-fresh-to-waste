import { configureStore } from '@reduxjs/toolkit';
import { request } from 'react-native-permissions';

import locationReducer, { requestLocationAsync } from '../locationSlice';

/**
 * The location permission request must be single-flight.
 *
 * Four screens dispatch this thunk — the home banner, the first-run setup
 * modal, the home location picker and search — and none of them knew about
 * the others. Two firing close together called the native `request()` twice,
 * and a second runtime-permission Activity launching while the first is still
 * starting is a window conflict: on some devices Android pushes the task to
 * the background, which users read as the app closing itself.
 *
 * Guarding here rather than in each screen is the point of these tests: a
 * per-caller flag has to be repeated correctly everywhere, and the screen
 * that forgets brings the bug back.
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

jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockRequest = request as jest.MockedFunction<typeof request>;

const makeStore = () => configureStore({ reducer: { location: locationReducer } });

describe('requestLocationAsync single-flight guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks the OS once when two screens request at the same moment', async () => {
    // Permission never resolves during the test: both dispatches overlap, which
    // is precisely the window the old code left open.
    mockRequest.mockReturnValue(new Promise(() => {}) as ReturnType<typeof request>);
    const store = makeStore();

    void store.dispatch(requestLocationAsync());
    void store.dispatch(requestLocationAsync());
    await Promise.resolve();

    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects the duplicate with ConditionError rather than a location failure', async () => {
    mockRequest.mockReturnValue(new Promise(() => {}) as ReturnType<typeof request>);
    const store = makeStore();

    void store.dispatch(requestLocationAsync());
    // Keep the dispatch promise itself — `.unwrap()` lives on it, not on the
    // action it resolves to, and useLocation calls it exactly this way.
    const duplicatePromise = store.dispatch(requestLocationAsync());
    const duplicate = await duplicatePromise;

    // The caller must be able to tell "someone else is already asking" apart
    // from "we asked and it failed" — otherwise it shows the user an error
    // for a request the app itself deduplicated. `.rejected.match` narrows the
    // action union, so `meta.condition` is read off the rejected branch rather
    // than asserted through a cast.
    expect(requestLocationAsync.rejected.match(duplicate)).toBe(true);
    if (requestLocationAsync.rejected.match(duplicate)) {
      expect(duplicate.meta.condition).toBe(true);
    }
    await expect(duplicatePromise.unwrap()).rejects.toMatchObject({
      name: 'ConditionError',
    });
  });

  it('leaves the winning request untouched — dedupe must not cancel it', async () => {
    let settle: ((v: string) => void) | undefined;
    mockRequest.mockReturnValue(
      new Promise<string>(resolve => {
        settle = resolve;
      }) as ReturnType<typeof request>,
    );
    const store = makeStore();

    const first = store.dispatch(requestLocationAsync());
    void store.dispatch(requestLocationAsync());

    expect(store.getState().location.isLoading).toBe(true);
    settle?.('denied');
    await first;

    // Dropping the duplicate must not abort the in-flight request; the flow
    // that owns it still has to reach a terminal state.
    expect(store.getState().location.isLoading).toBe(false);
  });

  it('allows a fresh request once the previous one has settled', async () => {
    mockRequest.mockResolvedValue('denied' as Awaited<ReturnType<typeof request>>);
    const store = makeStore();

    await store.dispatch(requestLocationAsync());
    await store.dispatch(requestLocationAsync());

    // The guard is scoped to in-flight requests only. A user who denies and
    // taps again must be able to retry.
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('re-arms after a request that threw', async () => {
    mockRequest.mockRejectedValueOnce(new Error('native module exploded'));
    const store = makeStore();

    await store.dispatch(requestLocationAsync());
    expect(store.getState().location.isLoading).toBe(false);

    mockRequest.mockResolvedValueOnce('denied' as Awaited<ReturnType<typeof request>>);
    await store.dispatch(requestLocationAsync());

    // A thrown request that left isLoading stuck would dead-end every future
    // location request in the app.
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
