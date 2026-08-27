import { createElement } from 'react';
import { Platform, TouchableOpacity, View, Text as RNText } from 'react-native';

import { Icon } from '@/design-system/components/atoms';

import { AppHeader } from './components/AppHeader';

import type { ThemeContextValue } from '@/design-system/types';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// ─────────────────────────────────────────────────────────────────────────────
// Header Title factory
//
// Creates the styled Text component passed to options.headerTitle.
// AppHeader reads options.headerTitle and renders it inside its own layout,
// so the font/color styling here is preserved exactly.
// ─────────────────────────────────────────────────────────────────────────────

const createHeaderTitle = (
  fontFamily: string,
  fontSize: number,
  fontWeight: string,
  defaultColor: string,
) => {
  const HeaderTitle = ({ children, tintColor }: { children: string; tintColor?: string }) =>
    createElement(
      View,
      {
        style: {
          flex: 1,
          justifyContent: 'center',
        },
      },
      createElement(
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
// Kept for backward compatibility. AppHeader handles back navigation
// internally via the `navigation` prop from NativeStackHeaderProps.
// Stacks that pass headerLeft: makeHeaderBackButton(...) still work because
// AppHeader reads options.headerLeft and calls it with { canGoBack, tintColor }.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a headerLeft render function that calls navigation.goBack() on press.
 *
 * NOTE: AppHeader already provides a default back button. Only use this if you
 * need to customise the back button icon or style on a specific screen.
 */
export const makeHeaderBackButton = (navigation: { goBack: () => void }, defaultColor: string) => {
  const HeaderBackButton = ({
    canGoBack,
    tintColor,
  }: {
    canGoBack?: boolean;
    tintColor?: string;
  }) => {
    if (canGoBack !== true) return null;

    return createElement(
      TouchableOpacity,
      {
        onPress: () => navigation.goBack(),
        style: {
          paddingStart: Platform.OS === 'android' ? 8 : 4,
          paddingEnd: 8,
          justifyContent: 'center',
          alignSelf: 'center',
        },
        hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
        accessibilityRole: 'button',
        accessibilityLabel: 'Go back',
      },
      createElement(Icon, {
        name: 'chevron-back',
        family: 'Ionicons',
        size: 26,
        color: tintColor ?? defaultColor,
      }),
    );
  };

  HeaderBackButton.displayName = 'HeaderBackButton';
  return HeaderBackButton;
};

// ─────────────────────────────────────────────────────────────────────────────
// Status bar
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Status-bar icon style for a screen, derived from the theme.
 *
 * react-native-screens applies this **per screen**, and it wins over the global
 * `<StatusBar>` rendered in App.tsx. So making that global one theme-aware was
 * necessary and not sufficient: both option factories below pinned `'dark'`,
 * which means *dark icons*, and dark icons on the dark theme's ground are
 * exactly what the device showed.
 *
 * The value names follow the react-native-screens convention and describe the
 * content, not the background: `'dark'` = dark icons for a light background,
 * `'light'` = light icons for a dark one.
 *
 * Welcome and the two Onboarding screens set `'light'` at their own call sites
 * in AuthStack and are deliberately untouched - they paint the brand ground in
 * *both* themes, so their icons must stay light either way.
 */
const statusBarStyleFor = (theme: ThemeContextValue): 'light' | 'dark' =>
  theme.colorScheme === 'dark' ? 'light' : 'dark';

// ─────────────────────────────────────────────────────────────────────────────
// Screen option factories
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Default screen options for NativeStack navigators.
 *
 * Sets `header` to the JS-based AppHeader which uses useSafeAreaInsets().top
 * to position content below the status bar. This bypasses the native
 * CustomToolbar inset dispatch which breaks on some Android OEM devices
 * when WindowCompat.setDecorFitsSystemWindows(window, false) is enabled.
 *
 * All existing per-screen overrides (headerTitle, headerLeft, headerRight set
 * via navigation.setOptions() or per-screen options) continue to work because
 * AppHeader reads from the merged options object at render time.
 */
export const getDefaultScreenOptions = (
  theme: ThemeContextValue,
): NativeStackNavigationOptions => ({
  headerStyle: {
    backgroundColor: theme.colors.background,
  },
  headerTintColor: theme.colors.onSurface,
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily.primary,
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight?.bold ?? '700',
  },
  headerShadowVisible: false,
  animation: 'slide_from_right',
  statusBarStyle: statusBarStyleFor(theme),
  statusBarTranslucent: true,
  statusBarBackgroundColor: 'transparent',
  headerTitle: createHeaderTitle(
    theme.typography.fontFamily.primary,
    theme.typography.fontSize.xl,
    theme.typography.fontWeight?.bold ?? '700',
    theme.colors.onSurface,
  ),
  // JS header — reads useSafeAreaInsets().top for correct per-device spacing.
  header: props => createElement(AppHeader, props),
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
    backgroundColor: theme.colors.background,
  },
  headerTintColor: theme.colors.onSurface,
  headerTitleStyle: {
    fontFamily: theme.typography.fontFamily.primary,
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight?.semibold ?? '600',
  },
  headerShadowVisible: false,
  animation: 'slide_from_right',
  statusBarStyle: statusBarStyleFor(theme),
  statusBarTranslucent: true,
  statusBarBackgroundColor: 'transparent',
  headerTitle: createHeaderTitle(
    theme.typography.fontFamily.primary,
    theme.typography.fontSize.lg,
    theme.typography.fontWeight?.semibold ?? '600',
    theme.colors.onSurface,
  ),
  // JS header — same safe-area approach as getDefaultScreenOptions.
  header: props => createElement(AppHeader, props),
});
