/**
 * AppHeader — Universal JS-driven navigation header
 *
 * WHY THIS EXISTS:
 *   MainActivity.kt sets WindowCompat.setDecorFitsSystemWindows(window, false)
 *   for edge-to-edge rendering. On many Android OEM builds, system-bar WindowInsets
 *   are consumed by an ancestor View before they reach react-native-screens'
 *   CustomToolbar.onApplyWindowInsets(), so the native toolbar receives
 *   systemBars().top = 0 and renders flush against the status bar.
 *
 *   react-native-safe-area-context reads insets via ViewCompat.getRootWindowInsets()
 *   (not the dispatch chain), so useSafeAreaInsets().top always returns the real
 *   device status-bar height regardless of OEM behaviour.
 *
 * BEHAVIOUR:
 *   - Reads options.headerTitle / headerLeft / headerRight from the merged screen
 *     options, so all per-screen navigation.setOptions() overrides work as-is.
 *   - Shows a back button when back !== undefined && headerBackVisible !== false.
 *     Uses the `navigation` prop delivered by NativeStackHeaderProps — always
 *     the NativeStack navigator, never the Tab navigator.
 *   - Height = TOOLBAR_HEIGHT + insets.top  (no hardcoded device-specific values).
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

import type { NativeStackHeaderProps } from '@react-navigation/native-stack';

// Standard toolbar content height (below the status bar area).
// 56 dp matches the Material Design / Android AppBar spec.
const TOOLBAR_HEIGHT = 56;

const BACK_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// Re-export so stacks can reference the type if needed.
type AppHeaderProps = NativeStackHeaderProps;

export const AppHeader: React.FC<AppHeaderProps> = ({ navigation, options, route, back }) => {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  // ── Derived values ──────────────────────────────────────────────────────────

  // Show back button when there is a previous screen AND headerBackVisible is
  // not explicitly disabled (e.g. VerifyEmail sets headerBackVisible: false).
  const canGoBack = back !== undefined && options.headerBackVisible !== false;

  const bgColor =
    ((options.headerStyle as ViewStyle | undefined)?.backgroundColor as string | undefined) ??
    theme.colors.surface;

  const tintColor =
    typeof options.headerTintColor === 'string' ? options.headerTintColor : theme.colors.onSurface;

  const routeTitle = typeof options.title === 'string' ? options.title : (route.name ?? '');

  // ── Title element ───────────────────────────────────────────────────────────
  // options.headerTitle is set by getDefaultScreenOptions (createHeaderTitle factory)
  // and may be overridden per-screen via navigation.setOptions() (e.g. LocationHeader).
  const titleElement: React.ReactNode = (() => {
    if (typeof options.headerTitle === 'function') {
      return options.headerTitle({ children: routeTitle, tintColor });
    }
    const text = typeof options.headerTitle === 'string' ? options.headerTitle : routeTitle;
    return (
      <Text
        style={[styles.defaultTitle, options.headerTitleStyle as object, { color: tintColor }]}
        numberOfLines={1}
      >
        {text}
      </Text>
    );
  })();

  // ── Left element ────────────────────────────────────────────────────────────
  // Prefer explicit headerLeft option; fall back to a default back button
  // when canGoBack is true (uses navigation from NativeStackHeaderProps — always correct).
  const leftElement: React.ReactNode = (() => {
    if (typeof options.headerLeft === 'function') {
      return options.headerLeft({ canGoBack, tintColor });
    }
    if (canGoBack) {
      return (
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={BACK_HIT_SLOP}
          accessibilityRole='button'
          accessibilityLabel='Go back'
        >
          <Icon
            name={Platform.OS === 'ios' ? 'chevron-back' : 'arrow-back'}
            family='Ionicons'
            size={26}
            color={tintColor}
          />
        </TouchableOpacity>
      );
    }
    return null;
  })();

  // ── Right element ───────────────────────────────────────────────────────────
  const rightElement: React.ReactNode =
    typeof options.headerRight === 'function'
      ? options.headerRight({ tintColor, canGoBack })
      : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: bgColor,
          borderBottomColor: theme.colors.outlineVariant,
          // The only dynamic value: real status-bar height from safe-area-context.
          paddingTop: insets.top,
        },
      ]}
    >
      <View style={styles.row}>
        {/* Left: only rendered when there is something to show.
            Skipping it on first-screen (no back button) lets the title
            start at the left edge (e.g. LocationHeader on Home). */}
        {leftElement != null && <View style={styles.leftContainer}>{leftElement}</View>}

        {/* Title: custom component (e.g. LocationHeader) or themed text */}
        <View style={styles.titleContainer}>{titleElement}</View>

        {/* Right: only rendered when present so it doesn't consume space */}
        {rightElement != null && <View style={styles.rightContainer}>{rightElement}</View>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: TOOLBAR_HEIGHT,
    paddingHorizontal: 4,
  },
  leftContainer: {
    // Fixed width keeps title area stable whether back button is visible or not.
    width: 44,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  rightContainer: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    // Mirror left width so text titles look visually centred when needed.
    minWidth: 44,
  },
  backButton: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
});
