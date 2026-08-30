/**
 * When to stop laying a row out horizontally and stack it instead.
 *
 * A row of two or three text children is fine at normal font scales and breaks
 * at large ones: every child grows, none can shrink below its own text, and
 * whatever sits last gets squeezed off the edge. Device-verified on 2026-08-30
 * at a 2.0x system font scale, where the driver header truncated its title to
 * "Livrais.." and pushed the delivery status badge off the card entirely.
 *
 * Reflowing is the accessible answer. The alternatives - capping the scale,
 * shrinking the font, ellipsising, or hiding the least important child - all
 * work by giving the user less text, which is the opposite of what they asked
 * the OS for.
 */

/**
 * Chosen from measurement, not taste: at 1.3x the affected rows still fit on a
 * 720 px / 240 dpi screen, and at 1.5x they no longer do. Stacking earlier
 * would change the layout for users who did not need it.
 */
export const LARGE_FONT_SCALE_THRESHOLD = 1.5;

/**
 * True when a horizontal row should reflow into a column.
 *
 * Takes the scale as an argument rather than reading `PixelRatio` itself, so it
 * stays pure and can be driven across the whole range in tests.
 */
export const shouldStackAtFontScale = (fontScale: number): boolean => {
  // A non-finite or non-positive scale means the platform gave us nothing
  // usable. Treat it as normal rather than permanently stacking every header.
  if (!Number.isFinite(fontScale) || fontScale <= 0) return false;
  return fontScale >= LARGE_FONT_SCALE_THRESHOLD;
};
