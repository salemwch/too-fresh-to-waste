import Geolocation from '@react-native-community/geolocation';

import {
  getCurrentPositionOnce,
  resetInFlightPositionRequestForTests,
  type PositionFixError,
} from '../getCurrentPositionOnce';

/**
 * These tests protect a native invariant, not a UX nicety.
 *
 * PlayServicesLocationManager keeps the single-shot LocationCallback in ONE
 * shared instance field and unregisters via that field rather than via `this`.
 * Two overlapping single-shot requests therefore register two callbacks against
 * one slot: the first delivery nulls the field, the second calls
 * removeLocationUpdates(null), and Play Services throws
 * `NullPointerException: Listener must not be null` on the main thread. The
 * process dies immediately — no catch block anywhere in JS can save it.
 *
 * That crash shipped in release 70. So "only one native call is ever in flight"
 * is the single assertion that matters here; everything else exists to make
 * sure the guard cannot dead-end and strand the app with no location at all.
 */

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

const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.MockedFunction<
  typeof Geolocation.getCurrentPosition
>;

type SuccessFn = Parameters<typeof Geolocation.getCurrentPosition>[0];
type ErrorFn = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[1]>;
type OptionsArg = NonNullable<Parameters<typeof Geolocation.getCurrentPosition>[2]>;

const position = (latitude: number, longitude: number, accuracy = 12) =>
  ({ coords: { latitude, longitude, accuracy } }) as unknown as Parameters<SuccessFn>[0];

const nativeError = (code: number, message: string) =>
  ({ code, message }) as Parameters<ErrorFn>[0];

/** Callbacks and options handed to the Nth native call (0-indexed). */
const callArgs = (n: number) => ({
  success: mockGetCurrentPosition.mock.calls[n]?.[0] as SuccessFn,
  error: mockGetCurrentPosition.mock.calls[n]?.[1] as ErrorFn,
  options: mockGetCurrentPosition.mock.calls[n]?.[2] as OptionsArg,
});

describe('getCurrentPositionOnce', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetInFlightPositionRequestForTests();
    // Never calls back unless a test drives the captured callback, so requests
    // stay in flight and overlap on purpose.
    mockGetCurrentPosition.mockImplementation(() => undefined);
  });

  it('issues one native request for two concurrent callers', async () => {
    const first = getCurrentPositionOnce();
    const second = getCurrentPositionOnce();

    // This is the crash condition. Two native calls here means the process dies
    // as soon as Play Services delivers a fix.
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

    callArgs(0).success(position(36.8065, 10.1815));
    await expect(first).resolves.toBeDefined();
    await expect(second).resolves.toBeDefined();
  });

  it('gives every joined caller the same fix', async () => {
    const first = getCurrentPositionOnce();
    const second = getCurrentPositionOnce();
    const third = getCurrentPositionOnce();

    callArgs(0).success(position(36.8065, 10.1815, 8));

    const expected = { latitude: 36.8065, longitude: 10.1815, accuracy: 8 };
    await expect(first).resolves.toEqual(expected);
    await expect(second).resolves.toEqual(expected);
    await expect(third).resolves.toEqual(expected);
  });

  it('gives every joined caller the same failure', async () => {
    const first = getCurrentPositionOnce();
    const second = getCurrentPositionOnce();

    callArgs(0).error(nativeError(2, 'position unavailable'));

    // A joined caller must not be left hanging when the request it joined
    // fails, and must see a reason it can branch on.
    await expect(first).rejects.toMatchObject({ code: 2 });
    await expect(second).rejects.toMatchObject({ code: 2 });
  });

  it("ignores the joining caller's options, using the first caller's", async () => {
    const first = getCurrentPositionOnce({ enableHighAccuracy: true, timeoutMs: 30_000 });
    const second = getCurrentPositionOnce({ enableHighAccuracy: false, timeoutMs: 1_000 });

    // Documented trade-off: a joined caller gets a fix acquired under someone
    // else's settings. Asserted so the behaviour is a decision, not a surprise.
    expect(callArgs(0).options.enableHighAccuracy).toBe(true);
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(1);

    callArgs(0).success(position(1, 2));
    await first;
    await second;
  });

  it('allows a new native request once the previous one has resolved', async () => {
    const first = getCurrentPositionOnce();
    callArgs(0).success(position(36.8, 10.1));
    await first;

    // Not awaited: this second request is never completed by the mock, so
    // awaiting it would hang. Only the fact that it reached the native layer
    // matters here.
    void getCurrentPositionOnce().catch(() => undefined);
    await Promise.resolve();

    // The guard is scoped to in-flight requests only. A permanent lock would
    // mean the app never gets a position again after the first one.
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('allows a new native request after the previous one failed', async () => {
    const first = getCurrentPositionOnce();
    callArgs(0).error(nativeError(3, 'timeout'));
    await expect(first).rejects.toMatchObject({ code: 3 });

    void getCurrentPositionOnce().catch(() => undefined);
    await Promise.resolve();

    // Leaking the in-flight slot on the failure path would dead-end every
    // future location request in the app — the driver heartbeat included.
    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('is inert when the native layer delivers twice', async () => {
    const first = getCurrentPositionOnce();

    callArgs(0).success(position(36.8065, 10.1815));
    await expect(first).resolves.toMatchObject({ latitude: 36.8065 });

    // Double delivery is the exact native behaviour behind the release-70
    // crash. A second delivery, or a late error, must not re-settle a promise
    // that already resolved.
    expect(() => {
      callArgs(0).success(position(0, 0));
      callArgs(0).error(nativeError(1, 'late'));
    }).not.toThrow();

    await expect(first).resolves.toMatchObject({ latitude: 36.8065 });
  });

  it('rejects with a native-shaped error, never a raw Error', async () => {
    const pending = getCurrentPositionOnce();
    callArgs(0).error(nativeError(1, 'permission denied'));

    // Callers branch on `code`; an Error instance would force instanceof
    // checks and lose the code entirely.
    const failure: unknown = await pending.catch((e: unknown) => e);
    expect(failure).not.toBeInstanceOf(Error);
    expect(failure as PositionFixError).toEqual({ code: 1, message: 'permission denied' });
  });
});

describe('getCurrentPositionOnce timeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetInFlightPositionRequestForTests();
    mockGetCurrentPosition.mockImplementation(() => undefined);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects with code 3 when no fix ever arrives', async () => {
    const pending = getCurrentPositionOnce({ timeoutMs: 15_000 });

    jest.advanceTimersByTime(15_000);

    // The Play Services path ignores its own `timeout` option, so without this
    // the caller waits forever — indoors that is the normal case.
    await expect(pending).rejects.toMatchObject({ code: 3 });
  });

  it('releases the in-flight slot after a timeout', async () => {
    const pending = getCurrentPositionOnce({ timeoutMs: 15_000 });
    jest.advanceTimersByTime(15_000);
    await expect(pending).rejects.toMatchObject({ code: 3 });

    void getCurrentPositionOnce({ timeoutMs: 15_000 }).catch(() => undefined);
    await Promise.resolve();

    expect(mockGetCurrentPosition).toHaveBeenCalledTimes(2);
  });

  it('does not fire the timeout after a fix has arrived', async () => {
    const pending = getCurrentPositionOnce({ timeoutMs: 15_000 });

    callArgs(0).success(position(36.8, 10.1));
    await expect(pending).resolves.toMatchObject({ latitude: 36.8 });

    // An uncleared timer would reject an already-resolved promise — harmless
    // here, but it would also keep the JS timer alive and, in a heartbeat that
    // runs every 30s, accumulate one stray timer per tick.
    expect(() => jest.advanceTimersByTime(60_000)).not.toThrow();
    await expect(pending).resolves.toMatchObject({ latitude: 36.8 });
  });
});
