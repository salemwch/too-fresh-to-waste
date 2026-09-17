/**
 * RTL helpers
 *
 * Arabic is a first-class locale, and `I18nManager.forceRTL` flips the layout
 * engine — but only for *logical* style props. These helpers cover the cases
 * React Native does NOT flip automatically.
 *
 * What flips on its own (prefer these, no helper needed):
 *   - `flexDirection: 'row'` and its children order
 *   - `marginStart` / `marginEnd`, `paddingStart` / `paddingEnd`
 *   - `borderStartWidth` / `borderEndWidth`
 *   - `insetInlineStart` / `insetInlineEnd` (the logical form of `left`/`right`
 *     on absolutely-positioned elements). Note these flip the ANCHOR only —
 *     a `translateX` on the same element is never mirrored and must be negated
 *     by hand under RTL.
 *
 * What does NOT flip (use these helpers):
 *   - `textAlign`, which RN types as 'auto' | 'left' | 'right' | 'center' |
 *     'justify' — there is no 'start'/'end' value, and 'auto' follows the
 *     text's own direction rather than the layout's
 *   - icon glyphs that encode direction (chevrons, arrows)
 *   - `LinearGradient`'s `start` / `end`, which are plain numbers in the
 *     component's own 0..1 space and carry no notion of direction
 *
 * @see https://reactnative.dev/docs/i18nmanager
 */

import { isAppRTL } from '@/i18n/direction';

import type { TextStyle } from 'react-native';

/**
 * Text aligned to the reading START of the line.
 * LTR → 'left', RTL → 'right'.
 */
export const textAlignStart = (): TextStyle['textAlign'] => (isAppRTL() ? 'right' : 'left');

/**
 * Text aligned to the reading END of the line — the RTL-safe replacement for a
 * hardcoded `textAlign: 'right'`.
 * LTR → 'right', RTL → 'left'.
 */
export const textAlignEnd = (): TextStyle['textAlign'] => (isAppRTL() ? 'left' : 'right');

/**
 * Mirrors a directional glyph. Chevrons and arrows point the wrong way under
 * RTL, and unlike layout they are content, so RN cannot flip them for us.
 *
 * @example
 *   <Text>{mirrorGlyph('›')}</Text>   // '‹' in Arabic
 */
export const mirrorGlyph = (glyph: string): string => {
  if (!isAppRTL()) return glyph;

  const MIRRORED: Record<string, string> = {
    '›': '‹',
    '‹': '›',
    '»': '«',
    '«': '»',
    '→': '←',
    '←': '→',
    '⟩': '⟨',
    '⟨': '⟩',
    '>': '<',
    '<': '>',
  };

  return glyph.replace(/[›‹»«→←⟩⟨<>]/g, char => MIRRORED[char] ?? char);
};

// ---------------------------------------------------------------------------
// Gradients
// ---------------------------------------------------------------------------

/** A `LinearGradient` direction: the pair of props, not one point. */
export interface GradientDirection {
  readonly start: { readonly x: number; readonly y: number };
  readonly end: { readonly x: number; readonly y: number };
}

/**
 * Cached per (direction, y0, y1) so a call site gets the SAME object on every
 * render.
 *
 * `start` and `end` are compared by identity down in the native gradient, so a
 * fresh `{ x, y }` literal each render re-uploads the ramp every frame. This is
 * the `.claude/rules/performance.md` #1 rule ("no new allocations in render"),
 * and it is why this is a lookup rather than a plain constructor.
 *
 * THE DIRECTION IS PART OF THE KEY, AND HAS TO BE. An earlier version keyed on
 * `(y0, y1)` alone, reasoning that direction cannot change without an app
 * restart. It can: `RNRestart` falls back to `Activity.recreate()` under the
 * new architecture, which rebuilds the native side - picking up the new layout
 * direction - while the JS context, and therefore this cache, survives intact.
 * Every gradient then kept the ramp it was first rendered with.
 */
const gradientCache = new Map<string, GradientDirection>();

/**
 * A gradient that runs along the READING direction: its first colour sits where
 * the text starts.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every gradient in the app was written `start={{x:0,y:0}} end={{x:1,y:1}}` —
 * a fixed left-to-right ramp. Layout mirrors under RTL and the ramp does not,
 * so in Arabic the copy moved to the other end of it while the pixels stayed
 * put. Measured on the Profile screen, white heading text over the loyalty
 * card's ramp:
 *
 *     English  on #025755  →  8.41:1   passes AA
 *     Arabic   on #2ab297  →  2.65:1   fails AA outright
 *
 * Same colours, same component, and nothing in the code changed — which is
 * exactly why it reads to a user as "switching language changed the colours".
 * The ramp has to follow the text.
 *
 * @param y0 vertical position of the first stop (0 top, 1 bottom)
 * @param y1 vertical position of the last stop — equal to `y0` for a flat
 *        horizontal ramp, greater for a diagonal one
 *
 * @example
 *   const grad = readingGradient(0, 1);      // the 0,0 -> 1,1 diagonal
 *   <LinearGradient colors={…} start={grad.start} end={grad.end} />
 */
export const readingGradient = (y0 = 0, y1 = 0): GradientDirection => {
  const rtl = isAppRTL();
  const key = `${rtl ? 'rtl' : 'ltr'}:${y0},${y1}`;
  const cached = gradientCache.get(key);
  if (cached) return cached;

  const direction: GradientDirection = Object.freeze({
    start: Object.freeze({ x: rtl ? 1 : 0, y: y0 }),
    end: Object.freeze({ x: rtl ? 0 : 1, y: y1 }),
  });
  gradientCache.set(key, direction);
  return direction;
};
