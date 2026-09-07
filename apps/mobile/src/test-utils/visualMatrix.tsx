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
 * It does not observe **text**, either - only resolved style. Two states that
 * differ solely in wording (the driver screen's "permission denied" vs
 * "permission blocked", say) produce byte-identical baselines, and correctly so.
 * Copy regressions need a different gate; this one cannot see them.
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
import { act, render } from '@testing-library/react-native';

import { ThemeProvider } from '@/design-system/providers';

/* ------------------------------------------------------------- devices ---- */

/**
 * Real logical-pixel sizes, not invented ones.
 *
 * small    iPhone SE (2nd/3rd gen) - the narrowest screen still supported
 * standard iPhone 14 / Pixel 7 class
 * large    iPhone 15 Pro Max class
 */
const DEVICES = {
  small: { width: 320, height: 568 },
  standard: { width: 390, height: 844 },
  large: { width: 430, height: 932 },
} as const;

type DeviceName = keyof typeof DEVICES;
type ThemeName = 'light' | 'dark';
type LocaleName = 'en' | 'fr' | 'ar';

export interface MatrixCase {
  device: DeviceName;
  theme: ThemeName;
  locale: LocaleName;
}

/** Each axis exercised once, rather than the full 18-cell cross product. */
const DEFAULT_CASES: MatrixCase[] = [
  { device: 'standard', theme: 'light', locale: 'en' },
  { device: 'standard', theme: 'dark', locale: 'en' },
  { device: 'standard', theme: 'light', locale: 'fr' },
  { device: 'standard', theme: 'light', locale: 'ar' },
  { device: 'small', theme: 'light', locale: 'en' },
  { device: 'large', theme: 'light', locale: 'en' },
];

/**
 * Every axis value the design brief names, at the cost of eight cells.
 *
 * `DEFAULT_CASES` samples each axis once against the standard device, which is
 * right for an atom whose theme and locale behaviour cannot interact. It is not
 * right for a screen: a grey that reads acceptably in light can disappear in
 * dark, and RTL changes which side a padded edge lands on - so theme has to
 * cross with locale, and both device extremes have to appear.
 *
 * Covers light + dark, en + fr + ar (RTL), and 320 / 390 / 430 px.
 */
export const FULL_CASES: MatrixCase[] = [
  { device: 'standard', theme: 'light', locale: 'en' },
  { device: 'standard', theme: 'dark', locale: 'en' },
  { device: 'standard', theme: 'light', locale: 'fr' },
  { device: 'standard', theme: 'light', locale: 'ar' },
  { device: 'standard', theme: 'dark', locale: 'ar' },
  { device: 'small', theme: 'light', locale: 'en' },
  { device: 'small', theme: 'dark', locale: 'en' },
  { device: 'large', theme: 'light', locale: 'en' },
];

const caseName = (c: MatrixCase): string => `${c.device}-${c.theme}-${c.locale}`;

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

/**
 * Design values React Native carries as **props** rather than style.
 *
 * Missing these would have left a hole exactly where MD4 lands: the driver map's
 * raw `pinColor='#FF9800'` - the one raw colour the audit calls out by name - is
 * a prop, so a style-only capture would have watched phase 5 change it and
 * stayed green. Same for `ActivityIndicator color`, which is how every loading
 * state in the app gets its brand colour.
 *
 * Recorded with an `@` prefix so a prop can never be confused with a style key.
 */
const TRACKED_PROPS = ['pinColor', 'color', 'placeholderTextColor', 'tintColor'] as const;

type StyleRecord = Record<string, unknown>;

const trackedStyle = (style: unknown): StyleRecord | null => {
  const flat = StyleSheet.flatten(style as never) as StyleRecord | undefined;
  if (!flat) return null;
  const out: StyleRecord = {};
  for (const key of TRACKED) if (flat[key] !== undefined) out[key] = flat[key];
  return Object.keys(out).length > 0 ? out : null;
};

/**
 * Walk the rendered tree and record the resolved style of every styled node.
 *
 * KEYING
 * ------
 * A node with a `testID` is keyed by it; anything else is keyed by its
 * structural path (`View[0]/RCTScrollView[1]/Text[0]`). Colliding keys get a
 * `#2`, `#3` suffix rather than overwriting each other.
 *
 * The original version keyed on `testID` **only**, on the reasoning that a
 * contract-based key survives refactors while a positional one does not. That
 * reasoning is right and the implementation was still wrong, because not one
 * screen in this app sets a `testID`: `OrderCard`, `CheckoutScreen` and all four
 * driver screens have zero between them. Every screen-level baseline it produced
 * was the empty object, so the suite was green while observing nothing at all.
 *
 * Positional keys do churn when a wrapper moves. That is the correct trade here:
 * the migrations these baselines gate (MD2 colour, MD4 type) change style
 * values, not tree shape, and a baseline that covers every styled node cannot be
 * defeated by someone forgetting to tag one.
 *
 * The index is the node's position among its siblings, counted whether or not it
 * carried tracked style - otherwise skipping an unstyled wrapper would silently
 * renumber everything after it.
 */
function captureStyles(tree: unknown): Record<string, StyleRecord> {
  const found: Record<string, StyleRecord> = {};

  const put = (key: string, style: StyleRecord): void => {
    if (found[key] === undefined) {
      found[key] = style;
      return;
    }
    let n = 2;
    while (found[`${key}#${n}`] !== undefined) n += 1;
    found[`${key}#${n}`] = style;
  };

  const visit = (node: unknown, path: string): void => {
    if (!node || typeof node !== 'object') return;

    const n = node as {
      type?: unknown;
      props?: Record<string, unknown>;
      children?: unknown;
    };

    const record: StyleRecord = { ...trackedStyle(n.props?.['style']) };
    for (const prop of TRACKED_PROPS) {
      const value = n.props?.[prop];
      if (typeof value === 'string' || typeof value === 'number') record[`@${prop}`] = value;
    }
    if (Object.keys(record).length > 0) {
      const testID = n.props?.['testID'];
      put(typeof testID === 'string' ? testID : path, record);
    }

    const children = n.children;
    if (!Array.isArray(children)) return;

    /* Text nodes are plain strings; they carry no style and must not consume an
     * index, or adding a word to a label would renumber its siblings. */
    let index = 0;
    for (const child of children) {
      if (!child || typeof child !== 'object') continue;
      const type = (child as { type?: unknown }).type;
      const name = typeof type === 'string' ? type : 'Node';
      visit(child, `${path}${path ? '/' : ''}${name}[${index}]`);
      index += 1;
    }
  };

  const root = tree as { type?: unknown } | null;
  const rootName = typeof root?.type === 'string' ? root.type : 'Node';
  visit(tree, `${rootName}[0]`);
  return found;
}

/* --------------------------------------------------------------- clock ---- */

/**
 * Every matrix render happens at this instant.
 *
 * Screens in this app branch on the wall clock - `OrderCard` prints "Today" or
 * "Tomorrow" and pulses a dot while the pickup window is open, Checkout shows a
 * countdown. Without a fixed clock those baselines would pass all morning and
 * fail in the afternoon, and a gate that fails for reasons unrelated to the diff
 * is a gate people start regenerating on sight.
 *
 * Chosen to be unambiguous: a Thursday, mid-morning, well away from midnight in
 * both UTC and Tunisia (UTC+1) so no fixture lands on a different calendar day
 * depending on the runner's timezone.
 */
export const FROZEN_NOW = new Date('2026-01-15T10:30:00.000Z');

/* ------------------------------------------------------------ renderer ---- */

let restoreDimensions: (() => void) | null = null;

/** Apply one matrix cell. Returns a teardown that restores the real globals. */
function applyCase(c: MatrixCase): () => void {
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
function renderCase(ui: React.ReactElement, c: MatrixCase) {
  const teardown = applyCase(c);
  // Frozen here rather than in each spec's beforeAll: a determinism guarantee
  // you have to remember to opt into is one that eventually gets forgotten, and
  // the resulting flake looks like a real regression.
  jest.useFakeTimers({ now: FROZEN_NOW });
  try {
    const result = render(<ThemeProvider defaultTheme={c.theme}>{ui}</ThemeProvider>);
    return { styles: captureStyles(result.toJSON()), result };
  } finally {
    jest.useRealTimers();
    teardown();
  }
}

/**
 * Cycle-safe serialisation of a rendered tree, for change detection only.
 *
 * `JSON.stringify` on `toJSON()` output throws: `RefreshControl` (and other RN
 * components that take a context value as a prop) put objects in props that
 * close a cycle through `Provider`. Repeated references are replaced with a
 * marker rather than dropped, so a change from one shared object to another is
 * still visible as a change.
 */
const serialiseTree = (tree: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify(tree, (_key, value: unknown) => {
    if (typeof value === 'function') return '[fn]';
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[circular]';
      seen.add(value);
    }
    return value;
  });
};

/** How many flush rounds before we accept the tree will not settle. */
const MAX_SETTLE_ROUNDS = 20;

/**
 * Consecutive unchanged rounds required before the tree counts as settled.
 *
 * One is not enough. A screen waiting on a fetch is *already* unchanged between
 * the first two rounds - the request has not resolved yet - so a single-round
 * check declares the skeleton stable and captures it. That is exactly what the
 * first version of this did to all seven Checkout states.
 */
const STABLE_ROUNDS_REQUIRED = 4;

/**
 * Drive a freshly-rendered tree to a stable state.
 *
 * Each round resumes pending microtasks and runs anything the effects queued on
 * a timer, then compares the serialised tree with the previous round. Two
 * identical rounds means nothing further is pending and the capture is of a
 * settled screen rather than whatever frame the flush count happened to land on.
 *
 * Throws rather than returning quietly if the tree never settles: a screen that
 * re-renders forever is a real defect (an effect writing state unconditionally),
 * and silently baselining round 20 of it would hide that.
 */
async function settle(result: { toJSON: () => unknown }): Promise<void> {
  let previous = serialiseTree(result.toJSON());
  let stableRounds = 0;
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    const current = serialiseTree(result.toJSON());
    if (current === previous) {
      stableRounds += 1;
      if (stableRounds >= STABLE_ROUNDS_REQUIRED) return;
    } else {
      stableRounds = 0;
    }
    previous = current;
  }
  throw new Error(
    `Tree did not settle after ${MAX_SETTLE_ROUNDS} flush rounds - it is still ` +
      're-rendering. Look for an effect that writes state on every render.',
  );
}

/**
 * The async counterpart of `renderCase`.
 *
 * Several screens decide what to render only after an awaited effect settles -
 * `DriverOrdersListScreen` checks the location permission, `DriverOrderDetailScreen`
 * takes a position fix, `CheckoutScreen` resolves a query. A synchronous render
 * catches all of them mid-flight and would pin the spinner as the baseline for
 * every case, which is a baseline of the loading state wearing the label of the
 * populated one.
 *
 * Flushes until the tree stops changing rather than a fixed number of times.
 * A fixed count is a guess about someone else's promise chain, and the guess was
 * wrong: two flushes settled the driver screens but not Checkout, whose React
 * Query fetch needs more hops - so all seven Checkout states captured the
 * skeleton, identically, and passed.
 */
export async function renderCaseAsync(ui: React.ReactElement, c: MatrixCase) {
  const teardown = applyCase(c);
  jest.useFakeTimers({ now: FROZEN_NOW });
  try {
    const result = render(<ThemeProvider defaultTheme={c.theme}>{ui}</ThemeProvider>);
    await settle(result);
    return { styles: captureStyles(result.toJSON()), result };
  } finally {
    jest.useRealTimers();
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
        /* A baseline of {} is the failure this harness shipped with for a week:
         * it snapshots cleanly, diffs against nothing, and reports green while
         * the screen underneath it is rewritten. An empty capture means the
         * render collapsed or the walk found no styled node - either way there
         * is no gate, so say so loudly instead of recording the emptiness. */
        expect(Object.keys(styles).length).toBeGreaterThan(0);
        expect(styles).toMatchSnapshot();
      });
    }
  });
}

/**
 * `matrixSnapshot` for screens whose render settles asynchronously.
 *
 * Takes a factory rather than an element: these screens own state, and reusing
 * one element instance across eight cells lets a mounted tree from a previous
 * case leak into the next.
 */
export function matrixSnapshotAsync(
  label: string,
  ui: () => React.ReactElement,
  cases: MatrixCase[] = DEFAULT_CASES,
): void {
  describe(label, () => {
    for (const c of cases) {
      it(`${caseName(c)}`, async () => {
        const { styles } = await renderCaseAsync(ui(), c);
        expect(Object.keys(styles).length).toBeGreaterThan(0);
        expect(styles).toMatchSnapshot();
      });
    }
  });
}
