/**
 * AppState narrowing.
 *
 * React Native 0.87 types AppState.currentState as `?string`; it is null until
 * the native module reports. authSessionMiddleware stored it as AppStateStatus
 * and called `.match` on it, which throws on null. These cases pin the
 * conversion every caller now goes through.
 */

import { AppState } from 'react-native';

import { isAppStateStatus, readAppState, toAppStateStatus } from '../appState';

describe('toAppStateStatus', () => {
  it.each(['active', 'background', 'inactive', 'unknown', 'extension'] as const)(
    'keeps the known status %s',
    status => {
      expect(toAppStateStatus(status)).toBe(status);
    },
  );

  it.each([
    ['null (native module has not reported yet)', null],
    ['undefined', undefined],
    ['an empty string', ''],
    ['an unrecognised value', 'suspended'],
  ])('returns null for %s', (_label, input) => {
    expect(toAppStateStatus(input)).toBeNull();
  });
});

describe('isAppStateStatus', () => {
  it('is case-sensitive, matching what React Native emits', () => {
    expect(isAppStateStatus('Active')).toBe(false);
    expect(isAppStateStatus('active')).toBe(true);
  });
});

describe('readAppState', () => {
  const original = Object.getOwnPropertyDescriptor(AppState, 'currentState');

  afterEach(() => {
    if (original) Object.defineProperty(AppState, 'currentState', original);
  });

  const setCurrentState = (value: string | null | undefined): void => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => value });
  };

  it('returns null while React Native has not reported a state', () => {
    setCurrentState(null);
    expect(readAppState()).toBeNull();
  });

  it('returns the reported state once available', () => {
    setCurrentState('background');
    expect(readAppState()).toBe('background');
  });
});
