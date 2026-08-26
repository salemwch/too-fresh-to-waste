/**
 * ThemeProvider - the mechanism MD3 depends on.
 *
 * Before phase 2 of the mobile migration, dark mode was **unreachable**. Not
 * merely un-toggleable: `App.tsx` mounted `defaultTheme='light'` rather than
 * `auto`, the provider only ever adopted a saved mode from AsyncStorage, and
 * nothing in the app called `setTheme`, so the key was never written and the
 * read always returned null. The dark ramp, the `auto` branch and the
 * persistence were all dead code.
 *
 * Settings now calls `setTheme`, which makes every branch below live. They are
 * pinned here because each one had never executed in production and so had
 * never been shown to work.
 *
 * Cases covered: nothing saved / saved light / saved dark / saved `auto` /
 * saved garbage / read throws / write throws / system dark / system light /
 * system null / toggle from each scheme / persistence on every change.
 */

import React from 'react';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, screen, act } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '../ThemeProvider';

import type { ThemeMode } from '../../types';

const mockUseColorScheme = jest.fn<'light' | 'dark' | null, []>();
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: () => mockUseColorScheme(),
}));

/** Surfaces the bits of context under test, plus a handle to drive setTheme. */
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
  // The provider loads from storage in an effect; let it settle so assertions
  // describe the state a user would actually see rather than the first frame.
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

const mode = () => screen.getByTestId('mode').props['children'];
const scheme = () => screen.getByTestId('scheme').props['children'];

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  mockUseColorScheme.mockReturnValue('light');
});

describe('when nothing has been saved', () => {
  it('uses the default it was mounted with', async () => {
    await renderProvider({ defaultTheme: 'light' });
    expect(mode()).toBe('light');
    expect(scheme()).toBe('light');
  });

  it('defaults to light when no defaultTheme is given at all', async () => {
    await renderProvider();
    expect(mode()).toBe('light');
  });

  it('does not write anything to storage just by mounting', async () => {
    await renderProvider();
    // A mount that persisted would make "nothing ever wrote the key" false and
    // silently change what a returning user sees.
    expect(await AsyncStorage.getItem('@foodwaste/theme')).toBeNull();
  });
});

describe('when a mode was saved previously', () => {
  it.each<ThemeMode>(['light', 'dark', 'auto'])('adopts the saved %s mode', async saved => {
    await AsyncStorage.setItem('@foodwaste/theme', saved);
    await renderProvider({ defaultTheme: 'light' });
    expect(mode()).toBe(saved);
  });

  it('renders dark colours for a saved dark mode, not just a dark label', async () => {
    await AsyncStorage.setItem('@foodwaste/theme', 'dark');
    await renderProvider({ defaultTheme: 'light' });
    const dark = screen.getByTestId('background').props['children'];

    screen.unmount();
    await AsyncStorage.setItem('@foodwaste/theme', 'light');
    await renderProvider({ defaultTheme: 'light' });

    // Asserting the values differ, rather than a literal hex, so the test
    // survives a token change but still fails if dark stops resolving.
    expect(dark).not.toBe(screen.getByTestId('background').props['children']);
  });

  it('ignores a value that is not a known mode', async () => {
    await AsyncStorage.setItem('@foodwaste/theme', 'chartreuse');
    await renderProvider({ defaultTheme: 'light' });
    expect(mode()).toBe('light');
  });

  it('ignores an empty string', async () => {
    await AsyncStorage.setItem('@foodwaste/theme', '');
    await renderProvider({ defaultTheme: 'light' });
    expect(mode()).toBe('light');
  });

  it('reads the custom storage key when one is given', async () => {
    await AsyncStorage.setItem('custom-key', 'dark');
    await renderProvider({ defaultTheme: 'light', storageKey: 'custom-key' });
    expect(mode()).toBe('dark');
  });
});

describe('when storage is unavailable', () => {
  it('falls back to the default rather than crashing on a failed read', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disk full'));
    await renderProvider({ defaultTheme: 'light' });
    // The user keeps a usable app; they lose only their saved preference.
    expect(mode()).toBe('light');
  });

  it('still applies the change in memory when the write fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await renderProvider({ defaultTheme: 'light' });

    await act(async () => {
      setThemeRef('dark');
      await Promise.resolve();
    });

    // Failing to persist must not also fail to switch - otherwise tapping
    // "Dark" appears to do nothing at all.
    expect(mode()).toBe('dark');
  });
});

describe('auto mode', () => {
  it.each<['light' | 'dark']>([['light'], ['dark']])(
    'follows the system when it reports %s',
    async system => {
      mockUseColorScheme.mockReturnValue(system);
      await AsyncStorage.setItem('@foodwaste/theme', 'auto');
      await renderProvider({ defaultTheme: 'light' });
      expect(mode()).toBe('auto');
      expect(scheme()).toBe(system);
    },
  );

  it('falls back to light when the system reports nothing', async () => {
    mockUseColorScheme.mockReturnValue(null);
    await AsyncStorage.setItem('@foodwaste/theme', 'auto');
    await renderProvider({ defaultTheme: 'light' });
    expect(scheme()).toBe('light');
  });

  it('does not follow the system while the mode is an explicit one', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await renderProvider({ defaultTheme: 'light' });
    // This is the behaviour that keeps the staged rollout safe: a user on a
    // dark phone still gets light until they opt in.
    expect(scheme()).toBe('light');
  });
});

describe('setTheme', () => {
  it.each<ThemeMode>(['dark', 'auto', 'light'])('switches to %s and persists it', async next => {
    await renderProvider({ defaultTheme: 'light' });

    await act(async () => {
      setThemeRef(next);
      await Promise.resolve();
    });

    expect(mode()).toBe(next);
    expect(await AsyncStorage.getItem('@foodwaste/theme')).toBe(next);
  });

  it('persists to the custom storage key when one is given', async () => {
    await renderProvider({ defaultTheme: 'light', storageKey: 'custom-key' });

    await act(async () => {
      setThemeRef('dark');
      await Promise.resolve();
    });

    expect(await AsyncStorage.getItem('custom-key')).toBe('dark');
    expect(await AsyncStorage.getItem('@foodwaste/theme')).toBeNull();
  });

  it('makes dark reachable at runtime - the thing MD3 was blocked on', async () => {
    await renderProvider({ defaultTheme: 'light' });
    expect(scheme()).toBe('light');

    await act(async () => {
      setThemeRef('dark');
      await Promise.resolve();
    });

    expect(scheme()).toBe('dark');
  });
});

describe('toggleTheme', () => {
  it('goes light to dark', async () => {
    await renderProvider({ defaultTheme: 'light' });
    await act(async () => {
      toggleRef();
      await Promise.resolve();
    });
    expect(scheme()).toBe('dark');
  });

  it('goes dark to light', async () => {
    await AsyncStorage.setItem('@foodwaste/theme', 'dark');
    await renderProvider({ defaultTheme: 'light' });
    await act(async () => {
      toggleRef();
      await Promise.resolve();
    });
    expect(scheme()).toBe('light');
  });

  it('resolves auto to its concrete opposite rather than staying auto', async () => {
    mockUseColorScheme.mockReturnValue('dark');
    await AsyncStorage.setItem('@foodwaste/theme', 'auto');
    await renderProvider({ defaultTheme: 'light' });

    await act(async () => {
      toggleRef();
      await Promise.resolve();
    });

    // Toggling from auto has to commit to something; it reads the *resolved*
    // scheme, so a user on a dark phone toggles into light.
    expect(mode()).toBe('light');
  });
});

describe('useTheme outside a provider', () => {
  it('throws rather than returning undefined colours', () => {
    const Bare: React.FC = () => {
      useTheme();
      return null;
    };
    // Silence the expected React error boundary logging for this one case.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Bare />)).toThrow('useTheme must be used within a ThemeProvider');
    spy.mockRestore();
  });
});
