/**
 * Settings while the dark rollout gate is CLOSED - the shipped configuration.
 *
 * Dark mode is implemented app-wide but has only ever been verified on a device
 * across the four screens reachable without a login. Until the authenticated
 * surfaces have been checked, the entry point is hidden rather than the code
 * removed. See providers/themeRollout.ts for the reasoning and the steps to
 * reopen it.
 *
 * What is pinned here is the *absence* of the control, which is a weaker claim
 * than it looks and needs stating carefully: an assertion that something is not
 * on screen passes just as happily when the screen failed to render at all. So
 * every absence check below is paired with a positive assertion that the rest
 * of Settings did render.
 *
 * The open-gate behaviour is covered in SettingsScreen.appearance.enabled.test.tsx.
 * The provider-level lock - which is what actually protects a user who already
 * saved a dark preference - is covered in providers/__tests__/themeRollout.test.ts.
 */

import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';

import { DARK_MODE_ENABLED, ThemeProvider, useTheme } from '@/design-system/providers';

import { SettingsScreen } from '../SettingsScreen';

jest.mock('../../services/notificationPreferencesService', () => ({
  notificationPreferencesService: {
    getPreferences: jest.fn().mockResolvedValue({
      pushEnabled: true,
      favoriteStoreOffers: true,
    }),
    updatePreferences: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('react-native-restart', () => ({ restart: jest.fn() }));

const SchemeProbe: React.FC = () => {
  const { colorScheme, mode } = useTheme();
  return (
    <>
      <Text testID='probe-scheme'>{colorScheme}</Text>
      <Text testID='probe-mode'>{mode}</Text>
    </>
  );
};

const renderSettings = () =>
  render(
    <ThemeProvider defaultTheme='light' lockToLight={!DARK_MODE_ENABLED}>
      <SchemeProbe />
      <SettingsScreen {...({} as React.ComponentProps<typeof SettingsScreen>)} />
    </ThemeProvider>,
  );

describe('the appearance control while the gate is closed', () => {
  it('is not rendered', () => {
    renderSettings();

    // Paired with a positive check, so this cannot pass because Settings blew
    // up and rendered nothing at all.
    expect(screen.getByTestId('probe-scheme')).toBeTruthy();

    expect(screen.queryByTestId('theme-option-light')).toBeNull();
    expect(screen.queryByTestId('theme-option-dark')).toBeNull();
    expect(screen.queryByTestId('theme-option-auto')).toBeNull();
  });

  it('leaves no orphaned Appearance heading behind it', () => {
    renderSettings();
    // The heading and its description are inside the gated card; if only the
    // pills had been removed this would catch the empty section.
    expect(screen.queryByText('Appearance')).toBeNull();
  });

  it('does not take the rest of Settings with it', () => {
    renderSettings();
    // The language control sits directly above the appearance card and shares
    // its markup, so it is the thing most likely to be caught by a bad edit.
    expect(screen.getByText('English')).toBeTruthy();
  });

  it('renders light, and reports light', () => {
    renderSettings();
    expect(screen.getByTestId('probe-scheme').props['children']).toBe('light');
    expect(screen.getByTestId('probe-mode').props['children']).toBe('light');
  });
});

describe('the staged rollout guard', () => {
  /*
   * Source assertions, not behaviour tests, and labelled as such. They exist
   * because the risk is a one-word edit in a file no test renders: mounting
   * App.tsx with `auto` and no lock ships an unverified dark theme to everyone
   * whose phone is set to dark.
   */
  const readApp = (): string => {
    const { readFileSync } = jest.requireActual('fs');
    const { join } = jest.requireActual('path');
    // __tests__ -> screens -> profile -> features -> src
    return readFileSync(join(__dirname, '..', '..', '..', '..', 'App.tsx'), 'utf8');
  };

  it('still mounts the app with light as the default theme', () => {
    const app = readApp();

    // Guards against the guard silently passing if App.tsx ever moves.
    expect(app).toContain('ThemeProvider');
    expect(app).toContain("defaultTheme='light'");
    expect(app).not.toContain("defaultTheme='auto'");
  });

  it('still passes the rollout lock, so a saved dark preference cannot surface', () => {
    // The default alone is not enough: the provider adopts whatever is in
    // AsyncStorage a moment after mount, which is how dark would come back.
    expect(readApp()).toContain('lockToLight={!DARK_MODE_ENABLED}');
  });
});
