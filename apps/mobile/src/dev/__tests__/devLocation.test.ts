/**
 * The dev location fixture must reuse the real path, and must not be reachable
 * in a shipped build.
 *
 * Two properties matter here and they are tested separately:
 *
 *   1. **Isolation** - the same three gates as the session seeder. Covered by
 *      the shared `devSessionBlockedReason`, exercised again through this
 *      entry point so a future refactor cannot quietly drop the check.
 *   2. **Fidelity** - it dispatches the slice's own `setManualLocation` with
 *      the slice's own payload shape, after rehydration, and never overwrites
 *      a location that is already there.
 *
 * The rehydration ordering is the subtle one. redux-persist replaces the slice
 * wholesale when REHYDRATE lands, so a seed dispatched too early is silently
 * discarded - it looks exactly like the seeder never ran. That is asserted
 * directly rather than assumed.
 */

import { setManualLocation } from '@/store/slices/locationSlice';

import { DEV_LOCATION, seedDevLocationIfEnabled, type SeedableStore } from '../devLocation';

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: { ENABLE_DEV_AUTH: 'true' },
  Config: { ENABLE_DEV_AUTH: 'true' },
}));

jest.mock('@/config/environment', () => ({
  environment: {
    api: { baseUrl: 'http://localhost:8787/api/v1' },
    // The Logger reads these at module load; a partial stub throws on import.
    debug: { logLevel: 'error', enableNetworkLogging: false },
    isProduction: false,
    shouldEnableDebugging: false,
  },
}));

jest.mock('@/utils/logger', () => ({
  Logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

/*
 * The native modules the location slice imports for its GPS thunks. Only these
 * are mocked - the slice itself is deliberately NOT, because the property under
 * test is that this fixture dispatches the slice's own real action creator with
 * the slice's own real payload shape. Mocking the slice would make that
 * assertion circular.
 */
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    // The slice calls setRNConfiguration at module scope, so this has to be
    // present or the import throws before any test runs.
    setRNConfiguration: jest.fn(),
    getCurrentPosition: jest.fn(),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
    stopObserving: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('react-native-permissions', () => ({
  check: jest.fn(),
  request: jest.fn(),
  PERMISSIONS: { ANDROID: {}, IOS: {} },
  RESULTS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

jest.mock('@/native/LastKnownLocation', () => ({
  getLastKnownLocation: jest.fn(),
}));

interface FakeState {
  location?: { coordinates: unknown };
  _persist?: { rehydrated?: boolean };
}

/** A store that behaves like the real one for the three methods used. */
const makeStore = (initial: FakeState) => {
  let state = initial;
  const listeners = new Set<() => void>();
  const dispatched: unknown[] = [];

  const store: SeedableStore & {
    dispatched: unknown[];
    listenerCount: () => number;
    setState: (next: FakeState) => void;
  } = {
    getState: () => state,
    dispatch: action => {
      dispatched.push(action);
      return action;
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatched,
    listenerCount: () => listeners.size,
    setState: next => {
      state = next;
      listeners.forEach(l => {
        l();
      });
    },
  };
  return store;
};

const REHYDRATED_EMPTY: FakeState = {
  location: { coordinates: null },
  _persist: { rehydrated: true },
};

describe('seedDevLocationIfEnabled - fidelity to the real path', () => {
  it('dispatches the slice own setManualLocation action', () => {
    const store = makeStore(REHYDRATED_EMPTY);
    seedDevLocationIfEnabled(store);

    expect(store.dispatched).toHaveLength(1);
    // Compared against the action creator rather than a hand-written type
    // string, so a rename in the slice fails here instead of drifting.
    expect(store.dispatched[0]).toEqual(
      setManualLocation({
        coordinates: { ...DEV_LOCATION.coordinates },
        name: DEV_LOCATION.name,
      }),
    );
  });

  it('sends coordinates in the LocationCoordinates shape', () => {
    const store = makeStore(REHYDRATED_EMPTY);
    seedDevLocationIfEnabled(store);

    const action = store.dispatched[0] as ReturnType<typeof setManualLocation>;
    expect(Object.keys(action.payload.coordinates).sort()).toEqual(['latitude', 'longitude']);
    expect(typeof action.payload.coordinates.latitude).toBe('number');
    expect(typeof action.payload.coordinates.longitude).toBe('number');
  });

  it('seeds coordinates that are actually in Tunisia', () => {
    // Guards against a transposed lat/lng, which would put the fixture in the
    // Indian Ocean and quietly produce an empty offer list rather than an error.
    const { latitude, longitude } = DEV_LOCATION.coordinates;
    expect(latitude).toBeGreaterThan(30);
    expect(latitude).toBeLessThan(38);
    expect(longitude).toBeGreaterThan(7);
    expect(longitude).toBeLessThan(12);
  });
});

describe('seedDevLocationIfEnabled - rehydration ordering', () => {
  it('does not dispatch before rehydration completes', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    seedDevLocationIfEnabled(store);

    // Seeding here would be silently overwritten when REHYDRATE lands.
    expect(store.dispatched).toHaveLength(0);
  });

  it('dispatches once rehydration lands', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    seedDevLocationIfEnabled(store);
    expect(store.dispatched).toHaveLength(0);

    store.setState(REHYDRATED_EMPTY);

    expect(store.dispatched).toHaveLength(1);
  });

  it('stops listening once it has seeded', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    seedDevLocationIfEnabled(store);
    expect(store.listenerCount()).toBe(1);

    store.setState(REHYDRATED_EMPTY);

    expect(store.listenerCount()).toBe(0);
  });

  it('dispatches only once even if the store keeps emitting', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    seedDevLocationIfEnabled(store);

    store.setState(REHYDRATED_EMPTY);
    store.setState(REHYDRATED_EMPTY);
    store.setState(REHYDRATED_EMPTY);

    expect(store.dispatched).toHaveLength(1);
  });

  it('survives a store that throws from getState', () => {
    const store = makeStore(REHYDRATED_EMPTY);
    store.getState = () => {
      throw new Error('store not ready');
    };
    // A dev convenience must never break the boot path.
    expect(() => seedDevLocationIfEnabled(store)).not.toThrow();
    expect(store.dispatched).toHaveLength(0);
  });
});

describe('seedDevLocationIfEnabled - it does not stomp a real choice', () => {
  it('leaves an existing location alone', () => {
    const store = makeStore({
      location: { coordinates: { latitude: 48.8566, longitude: 2.3522 } },
      _persist: { rehydrated: true },
    });
    seedDevLocationIfEnabled(store);

    expect(store.dispatched).toHaveLength(0);
  });

  it('does not keep listening after finding an existing location', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    seedDevLocationIfEnabled(store);

    store.setState({
      location: { coordinates: { latitude: 48.8566, longitude: 2.3522 } },
      _persist: { rehydrated: true },
    });

    expect(store.dispatched).toHaveLength(0);
    expect(store.listenerCount()).toBe(0);
  });
});

describe('seedDevLocationIfEnabled - the unsubscribe it returns', () => {
  it('detaches the listener so a caller can cancel', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    const stop = seedDevLocationIfEnabled(store);
    expect(store.listenerCount()).toBe(1);

    stop();

    expect(store.listenerCount()).toBe(0);
    store.setState(REHYDRATED_EMPTY);
    expect(store.dispatched).toHaveLength(0);
  });

  it('is safe to call twice', () => {
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });
    const stop = seedDevLocationIfEnabled(store);
    stop();
    expect(() => {
      stop();
    }).not.toThrow();
  });
});

describe('seedDevLocationIfEnabled - production isolation', () => {
  /*
   * `__DEV__` is a global in the RN runtime and true under Jest, so it is
   * toggled directly here. Gate 2 and gate 3 are covered exhaustively in
   * devSession.test.ts against the shared predicate; what this file adds is
   * that *this* entry point actually consults it.
   */
  const globalRef = globalThis as unknown as { __DEV__: boolean };

  afterEach(() => {
    globalRef.__DEV__ = true;
  });

  it('does nothing in a release build', () => {
    globalRef.__DEV__ = false;
    const store = makeStore(REHYDRATED_EMPTY);

    seedDevLocationIfEnabled(store);

    expect(store.dispatched).toHaveLength(0);
    expect(store.listenerCount()).toBe(0);
  });

  it('does not even subscribe in a release build', () => {
    globalRef.__DEV__ = false;
    const store = makeStore({
      location: { coordinates: null },
      _persist: { rehydrated: false },
    });

    seedDevLocationIfEnabled(store);
    store.setState(REHYDRATED_EMPTY);

    // No listener means no way for it to fire later either.
    expect(store.dispatched).toHaveLength(0);
  });
});

describe('the fixture does not touch location authorization', () => {
  it('never dispatches anything that changes permission state', () => {
    const store = makeStore(REHYDRATED_EMPTY);
    seedDevLocationIfEnabled(store);

    const types = store.dispatched.map(a => (a as { type: string }).type);
    // Seeding a *location* must not imply seeding a *permission*. The
    // production GPS authorization path has to stay exactly as it is.
    expect(types).toEqual(['location/setManualLocation']);
    expect(types.some(t => /permission/iu.test(t))).toBe(false);
  });
});
