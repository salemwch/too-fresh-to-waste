/**
 * LoginScreen baselines - added after the device audit found D3.
 *
 * The screen had no baseline at all, which is why `<Text color='secondary'>`
 * rendering as platform-default black survived every gate: the Text atom passed
 * the literal string `'secondary'` to React Native as a colour, RN dropped the
 * unparseable value, and the text fell back to black. Readable on a light card,
 * invisible on a dark one.
 *
 * 158 call sites across the app used that prop. Nothing had a baseline that
 * rendered one, so nothing could have caught it.
 */

import React from 'react';

import { matrixSnapshot, FULL_CASES } from '@/test-utils/visualMatrix';

import { LoginScreen } from '../LoginScreen';

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn(), hasPlayServices: jest.fn(), signIn: jest.fn() },
  statusCodes: {},
  GoogleSigninButton: () => null,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), addListener: () => () => {} }),
  useFocusEffect: () => undefined,
  useRoute: () => ({ params: {} }),
}));

jest.mock('react-redux', () => {
  const useSelector = (selector: (s: unknown) => unknown) =>
    selector({ auth: { user: null, isAuthenticated: false, isLoading: false, error: null } });
  const useDispatch = () => jest.fn();
  useSelector.withTypes = () => useSelector;
  useDispatch.withTypes = () => useDispatch;
  return { useDispatch, useSelector };
});

describe('LoginScreen', () => {
  matrixSnapshot(
    'resting',
    <LoginScreen {...({} as React.ComponentProps<typeof LoginScreen>)} />,
    FULL_CASES,
  );
});
