/**
 * Bottom inset a scroll container needs to clear the floating tab bar.
 *
 * WHY THIS EXISTS
 * ---------------
 * `FloatingTabBar` is absolutely positioned, so react-navigation no longer
 * shrinks each screen to sit above it - screens run the full height and their
 * content passes underneath. That is the entire point: the veil can only fade
 * content out behind the buttons if there is content back there to fade. It is
 * also what stops the content's hard bottom edge showing as a line across the
 * screen, because the edge is now under an opaque part of the veil instead of
 * stopping exactly where the veil begins at zero opacity.
 *
 * The cost is that every scroll container inside a tab stack has to pad itself,
 * or its last row sits under the bar permanently and cannot be scrolled clear.
 * There are eight such screens - the five tab roots plus OrderDetails,
 * EditProfile and ContactSupport. Everything else lives in `MainStack`, outside
 * the tab navigator, where no tab bar is rendered at all.
 *
 * Separate file from `floatingTabBarLayout.ts` on purpose: that module is pure
 * arithmetic with no React or native dependency, which is what makes it
 * testable without mounting anything.
 */

import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFloatingTabBarLayout } from '../utils/floatingTabBarLayout';

import type { ViewStyle } from 'react-native';

/**
 * The bar's height is independent of how many tabs it holds - only the width
 * changes - so a fixed count here is safe and keeps the hook argument-free.
 */
const TAB_COUNT = 5;

/** Raw height the bar occupies over the content, including the safe-area inset. */
export const useFloatingTabBarInset = (): number => {
  const insets = useSafeAreaInsets();
  return getFloatingTabBarLayout({ tabCount: TAB_COUNT, bottomInset: insets.bottom })
    .containerHeight;
};

/**
 * A scroll container's own style, MERGED with room for the tab bar.
 *
 * Takes the base style rather than replacing it. An earlier version returned
 * only `{ paddingBottom }`, and every call site passed it straight to
 * `contentContainerStyle` - which silently dropped each screen's existing
 * padding. Seven screens lost their horizontal gutters at once and the content
 * ran edge to edge. Nothing failed; it just looked wrong.
 *
 * Memoised because `contentContainerStyle` is compared by identity: a fresh
 * object each render invalidates the list's own memoisation and re-lays-out
 * every row. See `.claude/rules/performance.md`.
 *
 * @param base the screen's StyleSheet entry. Stable identity, so it is safe as
 *        a dependency.
 */
export const useFloatingTabBarContentInset = (base?: ViewStyle): ViewStyle => {
  const inset = useFloatingTabBarInset();
  return useMemo(() => {
    // `padding` shorthand plus an explicit `paddingBottom` is well defined in
    // React Native - the specific side wins - so a base using either form keeps
    // its other three sides.
    const ownBottom = typeof base?.paddingBottom === 'number' ? base.paddingBottom : 0;
    return { ...base, paddingBottom: ownBottom + inset };
  }, [inset, base]);
};
