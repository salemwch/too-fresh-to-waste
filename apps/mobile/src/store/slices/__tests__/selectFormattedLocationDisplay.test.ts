/**
 * The location header selector returns data, not copy. Text built inside a
 * memoised selector keeps the language it was first built in, because the
 * memo only recomputes on location state - so after a language switch the
 * header would stay in the old language. useLocation turns this data into
 * translated text.
 */
import { selectFormattedLocationDisplay, type LocationState } from '../locationSlice';

// The slice imports native location modules that Jest cannot load.
jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: { ANDROID: {}, IOS: {} },
  RESULTS: {},
}));
jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: { setRNConfiguration: jest.fn(), getCurrentPosition: jest.fn() },
}));
jest.mock('@/native/LastKnownLocation', () => ({ getLastKnownLocation: jest.fn() }));
jest.mock('@/utils/logger', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const COORDS = { latitude: 36.8065, longitude: 10.1815 };

const stateWith = (overrides: Partial<LocationState>): { location: LocationState } => ({
  location: {
    coordinates: null,
    source: null,
    manualLocationName: null,
    gpsLocationName: null,
    ...overrides,
  } as LocationState,
});

describe('selectFormattedLocationDisplay', () => {
  it('is unset when there are no coordinates', () => {
    expect(selectFormattedLocationDisplay(stateWith({}))).toEqual({ kind: 'unset' });
  });

  it('names a GPS location once reverse geocoding has a name', () => {
    const state = stateWith({ coordinates: COORDS, source: 'gps', gpsLocationName: ' Tunis ' });

    expect(selectFormattedLocationDisplay(state)).toEqual({ kind: 'named', name: 'Tunis' });
  });

  it('falls back to "current location" while a GPS fix has no name yet', () => {
    const state = stateWith({ coordinates: COORDS, source: 'gps', gpsLocationName: null });

    expect(selectFormattedLocationDisplay(state)).toEqual({ kind: 'currentLocation' });
  });

  it('names a manually chosen location', () => {
    const state = stateWith({
      coordinates: COORDS,
      source: 'manual',
      manualLocationName: 'Sousse',
    });

    expect(selectFormattedLocationDisplay(state)).toEqual({ kind: 'named', name: 'Sousse' });
  });

  it('cuts names longer than 20 characters', () => {
    const state = stateWith({
      coordinates: COORDS,
      source: 'manual',
      manualLocationName: 'La Marsa, Gouvernorat de Tunis',
    });

    expect(selectFormattedLocationDisplay(state)).toEqual({
      kind: 'named',
      name: 'La Marsa, Gouvernora...',
    });
  });

  it('is unset when coordinates exist without any name (rehydration race)', () => {
    const state = stateWith({ coordinates: COORDS, source: 'manual', manualLocationName: '  ' });

    expect(selectFormattedLocationDisplay(state)).toEqual({ kind: 'unset' });
  });

  it('never returns display copy', () => {
    // Guards against a regression to building text in the selector.
    for (const overrides of [{}, { coordinates: COORDS, source: 'gps' as const }]) {
      expect(typeof selectFormattedLocationDisplay(stateWith(overrides))).toBe('object');
    }
  });
});
