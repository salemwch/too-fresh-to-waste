/**
 * Theme plumbing for the driver flow.
 *
 * The four driver screens each declared their palette at module scope, reading
 * `colorTokens.light.*` directly. That is why their dark baselines were
 * byte-identical to their light ones before MD4: there was no path by which the
 * theme could reach them.
 *
 * WHY A CACHE RATHER THAN A PLAIN FACTORY
 * ---------------------------------------
 * Calling `StyleSheet.create` inside a component body allocates a new styles
 * object every render, and a new object identity invalidates every `React.memo`
 * child it is passed to - `.claude/rules/performance.md` #1 and #2. The driver
 * list renders a `FlashList` of rows, so that cost lands exactly where it hurts.
 *
 * There are only ever two colour schemes, so memoising on `colorScheme` means
 * `StyleSheet.create` runs at most twice per screen for the lifetime of the
 * process, and the identity handed to children never changes while the theme
 * does not. `useMemo` inside each component would recompute per component
 * instance; this does not.
 */

import { useTheme } from '@/design-system/providers';

import type { ColorScheme, ThemeContextValue } from '@/design-system/types';

/**
 * The colour surface a driver stylesheet may read.
 *
 * Taken from the context type rather than hand-written, so it cannot drift from
 * what `ThemeProvider` actually supplies.
 */
export type DriverPalette = ThemeContextValue['colors'];

/**
 * Build a `useStyles` hook from a stylesheet factory.
 *
 * @example
 * const useStyles = createDriverStyles(c => StyleSheet.create({
 *   card: { backgroundColor: c.surface, borderColor: c.outline },
 * }));
 *
 * const Row = () => {
 *   const styles = useStyles();
 *   return <View style={styles.card} />;
 * };
 */
export function createDriverStyles<T extends Record<string, unknown>>(
  factory: (colors: DriverPalette) => T,
): () => T {
  const cache = new Map<ColorScheme, T>();

  return function useDriverStyles(): T {
    const { colorScheme, colors } = useTheme();
    const cached = cache.get(colorScheme);
    if (cached !== undefined) return cached;
    const built = factory(colors);
    cache.set(colorScheme, built);
    return built;
  };
}
