/**
 * The Settings appearance control, with the dark rollout gate forced OPEN.
 *
 * The gate ships closed (see providers/themeRollout.ts), so none of this is
 * reachable by a user today. It is still tested, and that is the point: dark
 * mode is paused pending device verification, not withdrawn. Without this file
 * the control would sit unexercised until someone flips the flag and finds out
 * in production whether it still works.
 *
 * The closed-gate behaviour - the control being absent, and a saved dark
 * preference not stranding anyone - lives in SettingsScreen.appearance.test.tsx
 * and providers/__tests__/themeRollout.test.tsx.
 *
 * Two things are pinned here:
 *
 * 1. Dark and auto are genuinely selectable, and selecting one changes the
 *    rendered theme rather than only the label.
 * 2. **auto is offered but is not the default.** Making it the default would
 *    move a large share of users onto a theme that has been verified on four
 *    screens, so it fails here.
 */
import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ThemeProvider, useTheme } from '@/design-system/providers';

/* The gate is a module constant read at render time, so overriding it here is
 * enough to exercise the open path. requireActual keeps ThemeProvider and
 * useTheme real - only the flag is replaced. */
jest.mock('@/design-system/providers', () => ({
  ...jest.requireActual('@/design-system/providers'),
  DARK_MODE_ENABLED: true,
}));

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

/**
 * Reports the resolved theme, so a tap is checked against what the provider
 * actually produced rather than against the button's own selected state.
 */
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
    <ThemeProvider defaultTheme='light'>
      <SchemeProbe />
      <SettingsScreen {...({} as React.ComponentProps<typeof SettingsScreen>)} />
    </ThemeProvider>,
  );

describe('the appearance control', () => {
  it('offers exactly light, dark and automatic', () => {
    renderSettings();
    expect(screen.getByTestId('theme-option-light')).toBeTruthy();
    expect(screen.getByTestId('theme-option-dark')).toBeTruthy();
    expect(screen.getByTestId('theme-option-auto')).toBeTruthy();
  });

  it('labels them from the translation file, not from hardcoded strings', () => {
    renderSettings();
    // The suite runs a real i18n instance over the real en.json, so a missing
    // or renamed key surfaces here rather than as a raw key on screen.
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(screen.getByText('Automatic')).toBeTruthy();
  });

  it('marks the current mode as selected and the others as not', () => {
    renderSettings();
    expect(screen.getByTestId('theme-option-light').props['accessibilityState'].selected).toBe(
      true,
    );
    expect(screen.getByTestId('theme-option-dark').props['accessibilityState'].selected).toBe(
      false,
    );
    expect(screen.getByTestId('theme-option-auto').props['accessibilityState'].selected).toBe(
      false,
    );
  });

  it('exposes each option as a radio for screen readers', () => {
    renderSettings();
    for (const mode of ['light', 'dark', 'auto']) {
      expect(screen.getByTestId(`theme-option-${mode}`).props['accessibilityRole']).toBe('radio');
    }
  });
});

describe('choosing a mode', () => {
  it('makes dark reachable - the defect MD3 was raised for', () => {
    renderSettings();
    expect(screen.getByTestId('probe-scheme').props['children']).toBe('light');

    fireEvent.press(screen.getByTestId('theme-option-dark'));

    expect(screen.getByTestId('probe-scheme').props['children']).toBe('dark');
  });

  it('moves the selected state to the chosen option', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('theme-option-dark'));

    expect(screen.getByTestId('theme-option-dark').props['accessibilityState'].selected).toBe(true);
    expect(screen.getByTestId('theme-option-light').props['accessibilityState'].selected).toBe(
      false,
    );
  });

  it('can select automatic', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('theme-option-auto'));
    expect(screen.getByTestId('probe-mode').props['children']).toBe('auto');
  });

  it('can go back to light after choosing dark', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('theme-option-dark'));
    fireEvent.press(screen.getByTestId('theme-option-light'));

    // One tap out is what makes this safe to ship ahead of the device audit.
    expect(screen.getByTestId('probe-scheme').props['children']).toBe('light');
  });

  it('is idempotent - re-pressing the current mode changes nothing', () => {
    renderSettings();
    fireEvent.press(screen.getByTestId('theme-option-light'));
    fireEvent.press(screen.getByTestId('theme-option-light'));

    expect(screen.getByTestId('probe-mode').props['children']).toBe('light');
    expect(screen.getByTestId('theme-option-light').props['accessibilityState'].selected).toBe(
      true,
    );
  });
});
