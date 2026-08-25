/**
 * Deterministic render matrix for design-system regression testing.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a screenshot harness. It renders no pixels and cannot tell you that
 * a screen looks cramped, that Arabic text overflows its container, or that a
 * touch target is too small. Those need a device, and
 * MOBILE_DESIGN_AUDIT_REPORT.md lists them as outstanding.
 *
 * WHAT IT IS
 * ----------
 * A gate over the properties the mobile audit actually found broken: colours
 * taken from outside the token set, off-scale type, off-grid spacing, radii
 * that do not exist in the scale, and theme values that fail to change between
 * light and dark. Those are all *resolved style values*, and resolved style is
 * exactly what React Native hands back from a test render.
 *
 * It runs in CI with no emulator, which is the whole point: without it, the
 * token migration (M1/M2) has no safety net at all, and that migration is the
 * largest single change left in the app.
 *
 * THE MATRIX
 * ----------
 * device (small | standard | large) x theme (light | dark) x locale (en | fr | ar)
 *
 * Cases are not multiplied blindly. Theme and locale are independent, so the
 * default set covers each axis against the standard device rather than paying
 * for 18 permutations that cannot fail independently. Pass an explicit `cases`
 * array when a component genuinely needs the cross product.
 *
 * @example
 * describe('Button', () => {
 *   matrixSnapshot('primary', <Button variant='primary'>Save</Button>);
 * });
 */

import React from 'react';
import { Dimensions, I18nManager, StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';

/* ------------------------------------------------------------- devices ---- */

/**
 * Real logical-pixel sizes, not invented ones.
 *
 * small    iPhone SE (2nd/3rd gen) - the narrowest screen still supported
 * standard iPhone 14 / Pixel 7 class
 * large    iPhone 15 Pro Max class
 */
export const DEVICES = {
  small: { width: 320, height: 568 },
  standard: { width: 390, height: 844 },
  large: { width: 430, height: 932 },
} as const;

export type DeviceName = keyof typeof DEVICES;
export type ThemeName = 'light' | 'dark';
export type LocaleName = 'en' | 'fr' | 'ar';

export interface MatrixCase {
  device: DeviceName;
  theme: ThemeName;
  locale: LocaleName;
}

/** Each axis exercised once, rather than the full 18-cell cross product. */
export const DEFAULT_CASES: MatrixCase[] = [
  { device: 'standard', theme: 'light', locale: 'en' },
  { device: 'standard', theme: 'dark', locale: 'en' },
  { device: 'standard', theme: 'light', locale: 'fr' },
  { device: 'standard', theme: 'light', locale: 'ar' },
  { device: 'small', theme: 'light', locale: 'en' },
  { device: 'large', theme: 'light', locale: 'en' },
];

export const caseName = (c: MatrixCase): string => `${c.device}-${c.theme}-${c.locale}`;

/* ------------------------------------------------------- style capture ---- */

/**
 * The style properties this gate is responsible for.
 *
 * Deliberately narrow. Capturing the whole style object would make every
 * baseline churn on unrelated edits, and a baseline nobody trusts gets
 * regenerated on sight rather than read.
 */
const TRACKED = [
  'backgroundColor',
  'color',
  'borderColor',
  'tintColor',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'textAlign',
  'padding',
  'paddingTop',
  'paddingBottom',
  'paddingHorizontal',
  'paddingVertical',
  'paddingStart',
  'paddingEnd',
  'paddingLeft',
  'paddingRight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginHorizontal',
  'marginVertical',
  'marginStart',
  'marginEnd',
  'marginLeft',
  'marginRight',
  'borderRadius',
  'borderWidth',
  'width',
  'height',
  'minHeight',
  'minWidth',
  'opacity',
  'elevation',
  'flexDirection',
  'alignSelf',
] as const;

type StyleRecord = Record<string, unknown>;

const trackedStyle = (style: unknown): StyleRecord | null => {
  const flat = StyleSheet.flatten(style as never) as StyleRecord | undefined;
  if (!flat) return null;
  const out: StyleRecord = {};
  for (const key of TRACKED) if (flat[key] !== undefined) out[key] = flat[key];
  return Object.keys(out).length > 0 ? out : null;
};

/**
 * Walk the rendered tree and record the resolved style of every node carrying a
 * `testID`, keyed by that id.
 *
 * Keying on `testID` rather than tree position is what makes the baseline
 * survive refactors: moving a `<View>` wrapper changes the tree but not the
 * contract, and only contract changes should turn a baseline red.
 */
export function captureStyles(tree: unknown): Record<string, StyleRecord> {
  const found: Record<string, StyleRecord> = {};

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const n = node as { props?: Record<string, unknown>; children?: unknown };
    const testID = n.props?.['testID'];
    if (typeof testID === 'string') {
      const style = trackedStyle(n.props?.['style']);
      if (style) found[testID] = style;
    }
    if (n.children) visit(n.children);
  };

  visit(tree);
  return found;
}

/* ------------------------------------------------------------ renderer ---- */

let restoreDimensions: (() => void) | null = null;

/** Apply one matrix cell. Returns a teardown that restores the real globals. */
export function applyCase(c: MatrixCase): () => void {
  const size = DEVICES[c.device];
  const realGet = Dimensions.get.bind(Dimensions);
  const realRTL = I18nManager.isRTL;

  jest
    .spyOn(Dimensions, 'get')
    .mockImplementation((dim: 'window' | 'screen') =>
      dim === 'window' || dim === 'screen'
        ? { ...size, scale: 2, fontScale: 1 }
        : realGet(dim as never),
    );

  // RN reads isRTL synchronously; the app itself flips it via forceRTL + restart.
  Object.defineProperty(I18nManager, 'isRTL', { value: c.locale === 'ar', configurable: true });

  restoreDimensions = () => {
    (Dimensions.get as jest.Mock).mockRestore?.();
    Object.defineProperty(I18nManager, 'isRTL', { value: realRTL, configurable: true });
  };
  return restoreDimensions;
}

/**
 * Render `ui` inside one matrix cell and return its captured styles.
 *
 * The theme is forced rather than inferred, so a run does not depend on the
 * host machine's appearance setting.
 */
export function renderCase(ui: React.ReactElement, c: MatrixCase) {
  const teardown = applyCase(c);
  try {
    const result = render(<ThemeProvider defaultTheme={c.theme}>{ui}</ThemeProvider>);
    return { styles: captureStyles(result.toJSON()), result };
  } finally {
    teardown();
  }
}

/**
 * Snapshot one component across the matrix.
 *
 * Baselines land in `__snapshots__` beside the spec and are committed - they
 * are the contract. Regenerate deliberately with `-u`, never to make a red run
 * green.
 */
export function matrixSnapshot(
  label: string,
  ui: React.ReactElement,
  cases: MatrixCase[] = DEFAULT_CASES,
): void {
  describe(label, () => {
    for (const c of cases) {
      it(`${caseName(c)}`, () => {
        const { styles } = renderCase(ui, c);
        expect(styles).toMatchSnapshot();
      });
    }
  });
}
