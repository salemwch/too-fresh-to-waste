/**
 * The geolocation fixture must be inert outside the dev verification
 * environment, and must not disturb the production GPS contract inside it.
 *
 * Two properties:
 *
 *   1. **Isolation** - the same three gates as the rest of `src/dev`. A release
 *      build must get an unpatched module back.
 *   2. **Fidelity** - it behaves like the real `watchPosition` contract the
 *      driver screen depends on: an id it can clear, a first fix without
 *      waiting, repeat fixes, and a clean restore that leaves no timers.
 *
 * The leaked-timer case is the one worth being explicit about: the driver
 * screen clears its watch on unmount, and a fixture that ignored `clearWatch`
 * would keep firing `setState` into an unmounted component - which presents as
 * a React warning that looks like an app bug rather than a fixture bug.
 */

import {
  devPosition,
  resetDevGeolocationForTests,
  seedDevGeolocationIfEnabled,
  type PatchableGeolocation,
} from '../devGeolocation';
import { DEV_LOCATION } from '../devLocation';

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { ENABLE_DEV_AUTH: 'true' },
  Config: { ENABLE_DEV_AUTH: 'true' },
}));

jest.mock('@/config/environment', () => ({
  environment: {
    api: { baseUrl: 'http://localhost:8787/api/v1' },
    debug: { logLevel: 'error', enableNetworkLogging: false },
    isProduction: false,
    shouldEnableDebugging: false,
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/* The real module is never imported here - the default parameter is overridden
 * with a fake in every test - but the import in devGeolocation.ts still
 * resolves, so it needs a stub. */
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { watchPosition: jest.fn(), clearWatch: jest.fn(), getCurrentPosition: jest.fn() },
}));

/* devLocation pulls in the location slice, which reaches native modules. */
jest.mock('@/store/slices/locationSlice', () => ({
  setManualLocation: (payload: unknown) => ({ type: 'location/setManualLocation', payload }),
}));

const ORIGINAL_WATCH = jest.fn(() => 999);
const ORIGINAL_CLEAR = jest.fn();
const ORIGINAL_GET = jest.fn();

const makeTarget = (): PatchableGeolocation => ({
  watchPosition: ORIGINAL_WATCH as unknown as PatchableGeolocation['watchPosition'],
  clearWatch: ORIGINAL_CLEAR,
  getCurrentPosition: ORIGINAL_GET as unknown as PatchableGeolocation['getCurrentPosition'],
});

beforeEach(() => {
  jest.useFakeTimers();
  resetDevGeolocationForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('devPosition - the fixture fix', () => {
  it('reports the same coordinates the rest of the dev environment uses', () => {
    // If these drift, the map, the offer distances and the driver screen stop
    // describing the same place, and nothing fails - it just looks wrong.
    expect(devPosition().coords.latitude).toBe(DEV_LOCATION.coordinates.latitude);
    expect(devPosition().coords.longitude).toBe(DEV_LOCATION.coordinates.longitude);
  });

  it('has the GeolocationResponse shape the screen destructures', () => {
    const p = devPosition();
    expect(p).toHaveProperty('timestamp');
    expect(Object.keys(p.coords).sort()).toEqual(
      [
        'accuracy',
        'altitude',
        'altitudeAccuracy',
        'heading',
        'latitude',
        'longitude',
        'speed',
      ].sort(),
    );
  });
});

describe('fidelity to the watchPosition contract', () => {
  it('delivers a first fix immediately, without waiting an interval', () => {
    // The screen renders "Acquiring GPS signal" until the first fix. Waiting
    // 10s for it would look like the bug this fixture exists to remove.
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);

    const success = jest.fn();
    target.watchPosition(success);

    expect(success).toHaveBeenCalledTimes(1);
  });

  it('keeps emitting like a real watch', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    const success = jest.fn();
    target.watchPosition(success);

    jest.advanceTimersByTime(30_000);

    expect(success.mock.calls.length).toBeGreaterThan(1);
  });

  it('returns an id that clearWatch actually stops', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    const success = jest.fn();
    const id = target.watchPosition(success);
    success.mockClear();

    target.clearWatch(id);
    jest.advanceTimersByTime(60_000);

    // A fixture that ignored clearWatch would setState into an unmounted
    // component and produce a React warning that reads like an app defect.
    expect(success).not.toHaveBeenCalled();
  });

  it('gives each watch its own id', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    expect(target.watchPosition(jest.fn())).not.toBe(target.watchPosition(jest.fn()));
  });

  it('answers getCurrentPosition too', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    const success = jest.fn();
    target.getCurrentPosition(success);
    expect(success).toHaveBeenCalledWith(
      expect.objectContaining({ coords: expect.objectContaining({ latitude: 36.8065 }) }),
    );
  });

  it('tolerates clearing an id it never issued', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    expect(() => {
      target.clearWatch(4242);
    }).not.toThrow();
  });
});

describe('restore', () => {
  it('puts the original methods back', () => {
    const target = makeTarget();
    const stop = seedDevGeolocationIfEnabled(target);
    expect(target.watchPosition).not.toBe(ORIGINAL_WATCH);

    stop();

    expect(target.watchPosition).toBe(ORIGINAL_WATCH);
    expect(target.clearWatch).toBe(ORIGINAL_CLEAR);
    expect(target.getCurrentPosition).toBe(ORIGINAL_GET);
  });

  it('leaves no timer running after restore', () => {
    const target = makeTarget();
    const stop = seedDevGeolocationIfEnabled(target);
    const success = jest.fn();
    target.watchPosition(success);
    success.mockClear();

    stop();
    jest.advanceTimersByTime(60_000);

    expect(success).not.toHaveBeenCalled();
  });

  it('is idempotent - a second seed does not wrap the wrapper', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    const patched = target.watchPosition;

    seedDevGeolocationIfEnabled(target);

    // Wrapping twice would make the originals unrecoverable.
    expect(target.watchPosition).toBe(patched);
  });

  it('restores the true originals even after two seed calls', () => {
    const target = makeTarget();
    seedDevGeolocationIfEnabled(target);
    const stop = seedDevGeolocationIfEnabled(target);

    stop();

    expect(target.watchPosition).toBe(ORIGINAL_WATCH);
  });
});

describe('production isolation', () => {
  const globalRef = globalThis as unknown as { __DEV__: boolean };

  afterEach(() => {
    globalRef.__DEV__ = true;
  });

  it('does not patch anything in a release build', () => {
    globalRef.__DEV__ = false;
    const target = makeTarget();

    seedDevGeolocationIfEnabled(target);

    // The real GPS contract is left exactly as shipped.
    expect(target.watchPosition).toBe(ORIGINAL_WATCH);
    expect(target.clearWatch).toBe(ORIGINAL_CLEAR);
    expect(target.getCurrentPosition).toBe(ORIGINAL_GET);
  });

  it('returns a safe no-op when blocked', () => {
    globalRef.__DEV__ = false;
    const target = makeTarget();
    const stop = seedDevGeolocationIfEnabled(target);
    expect(() => {
      stop();
    }).not.toThrow();
    expect(target.watchPosition).toBe(ORIGINAL_WATCH);
  });
});
