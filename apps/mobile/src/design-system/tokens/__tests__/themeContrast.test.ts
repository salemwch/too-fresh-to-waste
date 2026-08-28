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
   * M17 - RESOLVED for light on 2026-08-28, still a ratchet for dark.
   *
   * The earlier note here said closing this gap "would visibly redraw every
   * border in the app". That was true of the token as it stood, and it was the
   * wrong conclusion: 60 of `outline`'s 79 uses were dividers, skeleton
   * blocks, switch tracks and drag handles, none of which WCAG 1.4.11 governs.
   * Moving those to `outlineVariant` - which took `outline`'s old neutral[300],
   * so they render unchanged - left 19 real control boundaries, and darkening
   * only those to neutral[600] is not a redesign.
   *
   * Light is now asserted against the standard. Dark keeps a floor: its outline
   * is 2.54-4.07, which fails on the darkest surface, and dark mode is gated
   * off (DESIGN.md 19-E27) so this is unreachable rather than shipped. Fixing
   * it means picking a value for a theme nobody has verified on hardware.
   */
  describe('outline identifies a control boundary (M17)', () => {
    if (themeName === 'light') {
      it.each(surfaces)('meets AA non-text on %s (%s)', (_surfaceName, bg) => {
        expect({
          pair: `light: outline on ${_surfaceName}`,
          ratio: contrastRatio(theme.outline as string, bg),
          meetsNonText: contrastRatio(theme.outline as string, bg) >= AA_NON_TEXT,
        }).toMatchObject({ meetsNonText: true });
      });
    } else {
      it.each(surfaces)('is no less visible than today on %s (%s)', (_surfaceName, bg) => {
        expect(contrastRatio(theme.outline as string, bg)).toBeGreaterThanOrEqual(2.54);
      });
    }
  });

  /*
   * outlineVariant is decorative - dividers and fills - so it has no contrast
   * floor to meet. What it must not do is drift into being as strong as
   * `outline`, because then the split that made M17 affordable has collapsed
   * and the two roles are one token again.
   */
  it('keeps outlineVariant weaker than outline, so the roles stay distinct', () => {
    const worstOutline = Math.min(
      ...surfaces.map(([, bg]) => contrastRatio(theme.outline as string, bg)),
    );
    const worstVariant = Math.min(
      ...surfaces.map(([, bg]) => contrastRatio(theme.outlineVariant as string, bg)),
    );
    expect(worstVariant).toBeLessThan(worstOutline);
  });

  it('records the outline ratios so a regression reads as a number, not a boolean', () => {
    const worst = Math.min(...surfaces.map(([, bg]) => contrastRatio(theme.outline as string, bg)));
    expect({ theme: themeName, worstOutlineRatio: worst, aaNonText: AA_NON_TEXT }).toEqual({
      theme: themeName,
      worstOutlineRatio: themeName === 'light' ? 3.97 : 2.54,
      aaNonText: 3,
    });
  });

  /*
   * Status tints. These are the pairs a badge or an inline banner composes, and
   * they are the reason CheckoutScreen could keep a hardcoded tint palette for
   * so long without anyone noticing it had no dark half.
   */
  /*
   * M18. The light half is now a target; the dark half is still a table of today.
   *
   * LIGHT - all four pass as of 2026-08-28. The earlier note here said fixing
   * this "would mean redesigning every status badge and banner in the app".
   * That was wrong, and it is worth leaving the correction visible: counting
   * the consumers showed `onWarningContainer` had exactly one
   * (PasswordStrengthIndicator's warning banner) and `onInfoContainer` had
   * none at all. It was a token-pair defect, not a component pattern, and it
   * cost two ramp steps - warning[700] and info[700].
   *
   * DARK - all four still fail, and are pinned rather than fixed. Dark mode is
   * gated off (DESIGN.md 19-E27), so this is unreachable by a user, and fixing
   * it means choosing container/text pairs for a theme nobody has verified on
   * hardware. Pinned so the numbers stay visible instead of hidden behind a
   * skip, and so a pair that passes cannot silently start failing.
   */
  const CONTAINER_AA: Record<string, Record<string, boolean>> = {
    light: { success: true, error: true, warning: true, info: true },
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
