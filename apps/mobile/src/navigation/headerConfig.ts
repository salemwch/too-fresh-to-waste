import React from 'react';
import { Platform, TouchableOpacity, View, Text as RNText } from 'react-native';

import { Icon } from '@/design-system/components/atoms';
import type { ThemeContextValue } from '@/design-system/types';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// ─────────────────────────────────────────────────────────────────────────────
// Vertical padding constants
//
// With statusBarTranslucent: true the header background extends behind the
// system status bar (~24dp on Android). paddingTop must exceed the status bar
// height so content renders in the VISIBLE header area (below the bar).
// Both title and back button share these values → same baseline.
// ─────────────────────────────────────────────────────────────────────────────
export const HEADER_TITLE_PADDING_TOP = Platform.OS === 'android' ? 40 : 30;
export const HEADER_TITLE_PADDING_BOTTOM = Platform.OS === 'android' ? 16 : 13;

// Kept for external consumers that imported the old constant name.
export const HEADER_TOP_BREATHING_ROOM = HEADER_TITLE_PADDING_TOP;

// ─────────────────────────────────────────────────────────────────────────────
// Header Title factory
// ─────────────────────────────────────────────────────────────────────────────

const createHeaderTitle = (
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  defaultColor: string,
) => {
  const HeaderTitle = ({ children, tintColor }: { children: string; tintColor?: string }) =>
    React.createElement(
      View,
      {
        style: {
          paddingTop: HEADER_TITLE_PADDING_TOP,
          paddingBottom: HEADER_TITLE_PADDING_BOTTOM,
          justifyContent: 'center',
        },
      },
      React.createElement(
        RNText,
        {
          style: {
            fontFamily,
            fontSize,
            fontWeight: fontWeight as
              | 'normal'
              | 'bold'
              | '100'
              | '200'
              | '300'
              | '400'
              | '500'
              | '600'
              | '700'
              | '800'
              | '900',
            color: tintColor ?? defaultColor,
          },
          numberOfLines: 1,
        },
        children,
      ),
    );
  HeaderTitle.displayName = 'HeaderTitle';
  return HeaderTitle;
};

// ─────────────────────────────────────────────────────────────────────────────
// Header Back Button
//
// NativeStack renders its header OUTSIDE the screen's React context tree, so
// useNavigation() inside a headerLeft component resolves to the Tab navigator
// (which has no back stack) rather than the NativeStack — causing the
// "GO_BACK not handled" error.
//
// The correct approach: accept a `navigation` argument captured from the
// `screenOptions={({ navigation }) => ...}` callback, where it is guaranteed
// to be the NativeStack navigator's navigation object.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a headerLeft render function that calls navigation.goBack() on press.
 *
 * Usage in a Stack.Navigator:
 * ```tsx
 * screenOptions={({ navigation }) => ({
 *   ...getDefaultScreenOptions(theme),
 *   headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
 * })}
 * ```
 */
export const makeHeaderBackButton =
  (navigation: { goBack: () => void }, defaultColor: string) =>
  ({ canGoBack, tintColor }: { canGoBack?: boolean; tintColor?: string }) => {
    if (!canGoBack) return null;

    return React.createElement(
      TouchableOpacity,
      {
        onPress: () => navigation.goBack(),
        style: {
          paddingTop: HEADER_TITLE_PADDING_TOP,
          paddingBottom: HEADER_TITLE_PADDING_BOTTOM,
          paddingLeft: Platform.OS === 'android' ? 8 : 4,
          paddingRight: 8,
          justifyContent: 'center',
        },
        hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
        accessibilityRole: 'button',
        accessibilityLabel: 'Go back',
      },
      React.createElement(Icon, {
        name: 'chevron-back',
        family: 'Ionicons',
        size: 26,
        color: tintColor ?? defaultColor,
      }),
    );
  };

// ─────────────────────────────────────────────────────────────────────────────
// Screen option factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default screen options for NativeStack navigators.
 *
 * headerLeft is intentionally omitted here — pass it via the screenOptions
 * callback so the correct NativeStack navigation object is used:
 *
 * ```tsx
 * screenOptions={({ navigation }) => ({
 *   ...getDefaultScreenOptions(theme),
 *   headerLeft: makeHeaderBackButton(navigation, theme.colors.onSurface),
 * })}
 * ```
 */
export const getDefaultScreenOptions = (
  theme: ThemeContextValue,
): NativeStackNavigationOptions => ({
  headerStyle: {
    backgroundColor: theme.colors.surface,
  },
  headerTintColor: theme.colors.onSurface,
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily.primary,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight?.bold ?? '700',
  },
  headerShadowVisible: false,
  animation: 'slide_from_right',
  statusBarTranslucent: true,
  headerTitle: createHeaderTitle(
    theme.typography.fontFamily.primary,
    theme.typography.fontSize.xl,
    theme.typography.fontWeight?.bold ?? '700',
    theme.colors.onSurface,
  ),
});

/**
 * Modal screen options for NativeStack navigators.
 */
export const getModalScreenOptions = (theme: ThemeContextValue): NativeStackNavigationOptions => ({
  ...getDefaultScreenOptions(theme),
  presentation: 'modal',
  animation: 'slide_from_bottom',
});

/**
 * Auth screen options.
 * Slightly smaller title (lg instead of xl), semibold instead of bold.
 */
export const getAuthScreenOptions = (theme: ThemeContextValue): NativeStackNavigationOptions => ({
  headerStyle: {
    backgroundColor: theme.colors.surface,
  },
  headerTintColor: theme.colors.onSurface,
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight?.semibold ?? '600',
  },
  headerShadowVisible: false,
  animation: 'slide_from_right',
  statusBarTranslucent: true,
  headerTitle: createHeaderTitle(
    theme.typography.fontFamily.primary,
    theme.typography.fontSize.lg,
    theme.typography.fontWeight?.semibold ?? '600',
    theme.colors.onSurface,
  ),
  // Auth screens always have a back button provided by AuthStack directly.
});
