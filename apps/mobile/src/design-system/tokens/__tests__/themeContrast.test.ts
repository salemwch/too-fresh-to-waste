/**
 * WCAG contrast of the theme tokens themselves.
 *
 * Every earlier contrast finding in this migration was found by hand, one pair
 * at a time, and each time the same token pair turned up from a different
 * direction: MD2 could not migrate two greys because their target was 4.41, and
 * MD4 then found the theme's own `onSurfaceVariant` was 4.41 for the same
 * reason. That is a token-level property and it belongs in a test, not in a
 * report.
 *
 * This asserts the pairs the app actually composes - a foreground role against
 * the surfaces it is rendered on - in both themes.
 */

import { colorTokens } from '../colors';

/* ------------------------------------------------------------- WCAG maths -- */

const channels = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const relativeLuminance = (hex: string): number => {
  const [r, g, b] = channels(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Rounded to 2dp so a failure message reads like the numbers in the audit. */
export const contrastRatio = (a: string, b: string): number => {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
};

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe('WCAG contrast ratio helper', () => {
  // The helper is the instrument; if it drifts, every assertion below is noise.
  it('matches known reference values', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBe(21);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBe(1);
    expect(contrastRatio('#757575', '#FFFFFF')).toBe(4.61);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1E4448', '#FAFAFA')).toBe(contrastRatio('#FAFAFA', '#1E4448'));
  });
});

/* ------------------------------------------------------------------ pairs -- */

const SURFACE_ROLES = ['background', 'surface', 'surfaceVariant', 'surfaceContainer'] as const;

describe.each([
  ['light', colorTokens.light],
  ['dark', colorTokens.dark],
])('%s theme', (themeName, theme) => {
  const surfaces = SURFACE_ROLES.map(role => [role, theme[role] as string] as const);

  describe.each([
    ['onSurface', theme.onSurface as string],
    ['onSurfaceVariant', theme.onSurfaceVariant as string],
  ])('%s is readable text', (roleName, fg) => {
    it.each(surfaces)(`on %s (%s)`, (_surfaceName, bg) => {
      // Reported as an object so a failure names the pair, not just a number.
      expect({
        pair: `${themeName}: ${roleName} on ${_surfaceName}`,
        ratio: contrastRatio(fg, bg),
        meetsAA: contrastRatio(fg, bg) >= AA_TEXT,
      }).toMatchObject({ meetsAA: true });
    });
  });

  /*
   * A RATCHET, NOT THE TARGET.
   *
   * WCAG 1.4.11 wants 3:1 for a boundary that identifies a control. Light
   * `outline` is `neutral[300] #E0E0E0`, which is 1.14-1.26 against the light
   * surfaces, and even `neutral[500]` only reaches 2.57 - closing the gap means
   * `neutral[600]`, which would visibly redraw every border in the app.
   *
   * That is a design decision, not a migration, and it is recorded as audit
   * finding M17 rather than made here. Until it is taken, this asserts the
   * current floor so the value cannot quietly get worse.
   */
  const OUTLINE_FLOOR = themeName === 'light' ? 1.14 : 2.54;

  describe('outline is no less visible than it is today (M17)', () => {
    it.each(surfaces)('on %s (%s)', (_surfaceName, bg) => {
      expect(contrastRatio(theme.outline as string, bg)).toBeGreaterThanOrEqual(OUTLINE_FLOOR);
    });
  });

  it('records how far outline is from AA non-text, so the gap stays visible', () => {
    const worst = Math.min(...surfaces.map(([, bg]) => contrastRatio(theme.outline as string, bg)));
    expect({ theme: themeName, worstOutlineRatio: worst, aaNonText: AA_NON_TEXT }).toEqual({
      theme: themeName,
      worstOutlineRatio: themeName === 'light' ? 1.14 : 2.54,
      aaNonText: 3,
    });
  });

  /*
   * Status tints. These are the pairs a badge or an inline banner composes, and
   * they are the reason CheckoutScreen could keep a hardcoded tint palette for
   * so long without anyone noticing it had no dark half.
   */
  /*
   * A TABLE OF TODAY, NOT A TARGET - audit finding M18.
   *
   * Four of these eight pairs fail AA. That is the same defect `.claude/rules/ui-ux.md`
   * already records on web ("the bg-X/10 text-X tint pattern fails AA for 7 of 8
   * status colours"), and DESIGN.md 2.5 already prescribes the solid-fill
   * replacement. Fixing it here would mean redesigning every status badge and
   * banner in the app, which is a design change, not a token migration.
   *
   * Pinned rather than asserted so the suite stays honest: a pair that passes
   * today cannot silently start failing, and the four that fail are visible in
   * the expected values instead of hidden behind a skip.
   */
  const CONTAINER_AA: Record<string, Record<string, boolean>> = {
    light: { success: true, error: true, warning: false, info: false },
    dark: { success: false, error: false, warning: false, info: false },
  };

  describe.each([
    ['success', theme.onSuccessContainer as string, theme.successContainer as string],
    ['error', theme.onErrorContainer as string, theme.errorContainer as string],
    ['warning', theme.onWarningContainer as string, theme.warningContainer as string],
    ['info', theme.onInfoContainer as string, theme.infoContainer as string],
  ])('%s container (M18)', (statusName, fg, bg) => {
    it('matches its recorded AA verdict', () => {
      expect({
        pair: `${themeName}: on${statusName}Container on ${statusName}Container`,
        meetsAA: contrastRatio(fg, bg) >= AA_TEXT,
      }).toEqual({
        pair: `${themeName}: on${statusName}Container on ${statusName}Container`,
        meetsAA: CONTAINER_AA[themeName]?.[statusName],
      });
    });
  });

  it('primary is legible on its own surface', () => {
    expect(contrastRatio(theme.primary as string, theme.surface as string)).toBeGreaterThanOrEqual(
      AA_TEXT,
    );
  });

  it('onPrimary is legible on primary', () => {
    expect(
      contrastRatio(theme.onPrimary as string, theme.primary as string),
    ).toBeGreaterThanOrEqual(AA_TEXT);
  });

  /*
   * Secondary text has to be distinguishable from primary text, or the colour
   * hierarchy is decorative. Colour is not the only carrier - size and weight
   * also separate them - so this floor is deliberately low. It exists to catch
   * the two roles being collapsed onto the same token, not to police design.
   */
  it('separates primary from secondary text', () => {
    expect(
      contrastRatio(theme.onSurface as string, theme.onSurfaceVariant as string),
    ).toBeGreaterThan(1.3);
  });
});
