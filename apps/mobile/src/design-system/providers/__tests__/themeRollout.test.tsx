/**
 * The dark-mode rollout lock.
 *
 * WHAT THIS PROTECTS
 * ------------------
 * Hiding the Settings control is not enough to make the app light-only. The
 * control is the only *writer*, but the provider still *reads* whatever is
 * already in AsyncStorage - so anyone who selected dark while it was available
 * (every device this migration was verified on, for a start) would keep getting
 * dark with no remaining way to change it. That is the stranding case, and it
 * is what `lockToLight` exists for.
 *
 * Every test here has a negative control mounted with the same inputs and no
 * lock. Without those, a bug that made dark unreachable for some unrelated
 * reason would let this whole file pass while proving nothing.
 */

import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, act } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../ThemeProvider';
import { DARK_MODE_ENABLED } from '../themeRollout';

import type { ThemeMode } from '../../types';

const mockUseColorScheme = jest.fn<'light' | 'dark' | null, []>();
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockUseColorScheme(),
}));

let setThemeRef: (mode: ThemeMode) => void = () => undefined;
let toggleRef: () => void = () => undefined;

const Probe: React.FC = () => {
  const theme = useTheme();
  setThemeRef = theme.setTheme;
  toggleRef = theme.toggleTheme;
  return (
    <>
      <Text testID='mode'>{theme.mode}</Text>
      <Text testID='scheme'>{theme.colorScheme}</Text>
      <Text testID='background'>{String(theme.colors.background)}</Text>
    </>
  );
};

const renderProvider = async (props: Partial<React.ComponentProps<typeof ThemeProvider>> = {}) => {
  const result = render(
    <ThemeProvider {...props}>
      <Probe />
    </ThemeProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

const mode = () => screen.getByTestId('mode').props['children'];
const scheme = () => screen.getByTestId('scheme').props['children'];
const background = () => screen.getByTestId('background').props['children'];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockUseColorScheme.mockReturnValue('light');
});

describe('the shipped rollout flag', () => {
  /*
   * A value assertion, and deliberately a brittle one. Flipping the flag must
   * be a conscious act that makes someone read providers/themeRollout.ts, where
   * the preconditions for turning it on are written down - not a one-word edit
   * that sails through CI.
   */
  it('is off, so dark mode is not reachable by a user', () => {
    expect(DARK_MODE_ENABLED).toBe(false);
  });
});

describe('lockToLight, with a dark preference already saved', () => {
  beforeEach(async () => {
    await AsyncStorage.setItem('@foodwaste/theme', 'dark');
  });

  it('renders light anyway - the user is not stranded in a theme they cannot leave', async () => {
    await renderProvider({ lockToLight: true });
    expect(scheme()).toBe('light');
  });

  it('reports light as the mode too, so the context matches what is on screen', async () => {
    await renderProvider({ lockToLight: true });
    // A consumer branching on `mode` (the Settings pills, for one) would
    // otherwise show "Dark" selected above a light screen.
    expect(mode()).toBe('light');
  });

  it('serves light colour tokens, not merely a light label', async () => {
    await renderProvider({ lockToLight: true });
    const locked = background();

    screen.unmount();
    await renderProvider({ lockToLight: false });

    // Compares the two renders rather than naming a hex value, so this survives
    // a token change but still fails the moment the lock stops biting.
    expect(locked).not.toBe(background());
  });

  it('without the lock the same saved preference gives dark - the control', async () => {
    await renderProvider({ lockToLight: false });
    expect(scheme()).toBe('dark');
  });
});

describe('lockToLight, with auto and a dark system', () => {
  beforeEach(async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await AsyncStorage.setItem('@foodwaste/theme', 'auto');
  });

  it('ignores the system setting', async () => {
    await renderProvider({ lockToLight: true });
    expect(scheme()).toBe('light');
  });

  it('without the lock it follows the system - the control', async () => {
    await renderProvider({ lockToLight: false });
    expect(scheme()).toBe('dark');
  });
});

describe('lockToLight, mounted with a dark default', () => {
  it('overrides even an explicit defaultTheme prop', async () => {
    // Covers the ordering: the lock is applied after resolution, so nothing a
    // caller passes can get underneath it.
    await renderProvider({ defaultTheme: 'dark', lockToLight: true });
    expect(scheme()).toBe('light');
  });
});

describe('the saved preference while locked', () => {
  it('is preserved in storage, so unlocking restores the user choice', async () => {
    await renderProvider({ lockToLight: true });

    await act(async () => {
      setThemeRef('dark');
    });

    // Still light on screen...
    expect(scheme()).toBe('light');
    // ...but the choice was not thrown away.
    expect(await AsyncStorage.getItem('@foodwaste/theme')).toBe('dark');
  });

  it('toggling keys off the preference, not off the clamped value', async () => {
    await AsyncStorage.setItem('@foodwaste/theme', 'dark');
    await renderProvider({ lockToLight: true });

    await act(async () => {
      toggleRef();
    });

    // Had toggle read the clamped scheme it would always see 'light' and write
    // 'dark' every single time, permanently overwriting the saved choice.
    expect(await AsyncStorage.getItem('@foodwaste/theme')).toBe('light');
  });
});

describe('with the lock absent', () => {
  it('defaults to unlocked, so the visual matrix still captures dark baselines', async () => {
    // The matrix mounts ThemeProvider with no lock prop. If the default ever
    // became `true`, ~390 dark snapshots would quietly re-record as light.
    await renderProvider({ defaultTheme: 'dark' });
    expect(scheme()).toBe('dark');
  });
});
