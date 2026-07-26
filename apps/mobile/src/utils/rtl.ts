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
 *
 * @see https://reactnative.dev/docs/i18nmanager
 */

import { I18nManager } from 'react-native';

import type { TextStyle } from 'react-native';

/**
 * Text aligned to the reading START of the line.
 * LTR → 'left', RTL → 'right'.
 */
export const textAlignStart = (): TextStyle['textAlign'] => (I18nManager.isRTL ? 'right' : 'left');

/**
 * Text aligned to the reading END of the line — the RTL-safe replacement for a
 * hardcoded `textAlign: 'right'`.
 * LTR → 'right', RTL → 'left'.
 */
export const textAlignEnd = (): TextStyle['textAlign'] => (I18nManager.isRTL ? 'left' : 'right');

/**
 * Mirrors a directional glyph. Chevrons and arrows point the wrong way under
 * RTL, and unlike layout they are content, so RN cannot flip them for us.
 *
 * @example
 *   <Text>{mirrorGlyph('›')}</Text>   // '‹' in Arabic
 */
export const mirrorGlyph = (glyph: string): string => {
  if (!I18nManager.isRTL) return glyph;

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
