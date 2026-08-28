/**
 * Build a `useStyles` hook from a stylesheet factory.
 *
 * WHY THIS EXISTS
 * ---------------
 * A screen that calls `StyleSheet.create` at module scope cannot respond to the
 * theme - the object is built once, before any provider exists, so whatever
 * palette it read is frozen in. That is why eight screens rendered identically
 * in light and dark (audit M4), and it is not fixable by swapping the values:
 * the stylesheet has to be built per theme.
 *
 * WHY A CACHE RATHER THAN A PLAIN FACTORY OR `useMemo`
 * ----------------------------------------------------
 * Calling `StyleSheet.create` inside a component body allocates a new object
 * every render, and a fresh identity invalidates every `React.memo` child it is
 * passed to - `.claude/rules/performance.md` #1 and #2. On a list screen that is
 * every row.
 *
 * `useMemo` fixes the per-render churn but still recomputes once per component
 * instance, and still hands a different object to two siblings. There are only
 * ever two colour schemes, so caching on `colorScheme` means the factory runs at
 * most twice per module for the life of the process, and every component in the
 * tree receives the same object identity.
 *
 * @example
 * const useStyles = createThemedStyles(c => StyleSheet.create({
 *   card: { backgroundColor: c.surface, borderColor: c.outlineVariant },
 * }));
 *
 * const Row = () => {
 *   const styles = useStyles();
 *   return <View style={styles.card} />;
 * };
 */

import { useTheme } from '@/design-system/providers';

import type { ColorScheme, ThemeContextValue } from '@/design-system/types';

/**
 * The colour surface a themed stylesheet may read.
 *
 * Taken from the context type rather than hand-written, so it cannot drift from
 * what `ThemeProvider` actually supplies.
 */
export type ThemePalette = ThemeContextValue['colors'];

export function createThemedStyles<T extends Record<string, unknown>>(
  factory: (colors: ThemePalette) => T,
): () => T {
  const cache = new Map<ColorScheme, T>();

  return function useThemedStyles(): T {
    const { colorScheme, colors } = useTheme();
    const cached = cache.get(colorScheme);
    if (cached !== undefined) return cached;
    const built = factory(colors);
    cache.set(colorScheme, built);
    return built;
  };
}
