/**
 * Geometry for the floating tab bar.
 *
 * WHY THIS IS A SEPARATE PURE MODULE
 * ----------------------------------
 * The bar is drawn as an SVG silhouette with touch targets positioned on top of
 * it. The two are laid out from the same numbers, and if they ever disagree the
 * user taps one tab and activates its neighbour - which renders perfectly and is
 * wrong anyway. Extracted, the arithmetic is verifiable without mounting a
 * navigator. Same pattern as `tabBarHeight.ts` and `canRenderNavigator.ts`.
 *
 * WHERE THE NUMBERS COME FROM
 * ---------------------------
 * They were measured off the reference artwork pixel by pixel, not chosen:
 *
 *     circle 47px | connecting band 36px | centre spacing 42px
 *
 * giving `circle / band = 1.306` and `spacing / circle = 0.894`. Those two
 * ratios are the design - scale the circle and everything else follows. The
 * first attempt at this bar inverted them (a band taller than the circles) and
 * looked nothing like the reference, so they are derived here rather than
 * re-typed at each call site.
 */

import { I18nManager } from 'react-native';

/** Circle diameter. The only free variable; everything else derives from it. */
export const TAB_CIRCLE_SIZE = 70;

/**
 * `circle / band` measured off the reference. The circles must be TALLER than
 * the band - that is what makes them bulge past it and read as discs rather
 * than as buttons sitting inside a pill.
 */
export const BAND_RATIO = 1.306;

/** Band height. Derived, never typed: see BAND_RATIO. */
export const TAB_BAND_HEIGHT = TAB_CIRCLE_SIZE / BAND_RATIO;

/**
 * How far adjacent circles overlap. From `spacing / circle = 0.894`:
 * For a 70px circle: 70 - (70 x 0.894) = 7.42, so 7 is the nearest whole pixel.
 * This is NOT a free constant - it has to be re-derived whenever
 * TAB_CIRCLE_SIZE changes. It was 6 at a 54px circle, and the ratio test caught
 * it drifting out of tolerance the moment the circle grew.
 *
 * The overlap is what fuses the discs and the band into one silhouette instead
 * of a row of separate buttons.
 */
export const TAB_OVERLAP = 7;

/** Clear space under the shape, above the home indicator / safe-area inset. */
export const TAB_BAR_LIFT = 24;

/** Clear space over the shape, so the bulge is never clipped by the bar bounds. */
export const TAB_BAR_TOP_PAD = 8;

/**
 * How far the veil reaches ABOVE the bar, so the fade has already begun by the
 * time it meets the bar's top edge rather than switching on there.
 *
 * Matched to the mockup, whose scrim is 118px from the screen bottom while the
 * bar itself starts around 100px up - roughly 18px of overhang.
 */
export const TAB_BAR_SCRIM_OVERHANG = 20;

/**
 * Transparent bleed on every side of the SVG canvas.
 *
 * The shadow is a real Gaussian blur, and a blur spreads BEYOND the shape it
 * comes from. Sized to the canvas exactly, the soft edge is chopped off square
 * at the bounds - which looks like a hard rectangular crop, the very artefact
 * the blur exists to avoid. Must comfortably exceed dy + stdDeviation.
 */
export const TAB_CANVAS_PAD = 16;

export interface FloatingTabBarLayoutInput {
  /** Number of tabs. */
  tabCount: number;
  /** `useSafeAreaInsets().bottom`. */
  bottomInset: number;
}

export interface FloatingTabBarLayout {
  /** Width of the merged silhouette. */
  shapeWidth: number;
  /** SVG canvas size, i.e. the shape plus blur bleed on every side. */
  canvasWidth: number;
  canvasHeight: number;
  /** Band height, derived from the circle. */
  bandHeight: number;
  /**
   * Height the bar occupies over the content.
   *
   * The bar IS absolutely positioned, so this is not reserved layout space -
   * screens run full height and their content passes underneath. Each scroll
   * container inside a tab stack pads itself by this much via
   * `useFloatingTabBarInset`, or its last row can never be scrolled clear.
   */
  containerHeight: number;
  /** Centre x of each circle, in SVG coordinates, left to right. */
  circleCentres: number[];
}

/**
 * A tab count below 1 would produce a negative width, which react-native-svg
 * renders as nothing at all - a silently invisible tab bar. Clamped instead.
 */
const safeCount = (tabCount: number): number =>
  Number.isFinite(tabCount) && tabCount > 0 ? Math.floor(tabCount) : 1;

const safeInset = (bottomInset: number): number =>
  Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;

export const getFloatingTabBarLayout = ({
  tabCount,
  bottomInset,
}: FloatingTabBarLayoutInput): FloatingTabBarLayout => {
  const count = safeCount(tabCount);
  const step = TAB_CIRCLE_SIZE - TAB_OVERLAP;
  const shapeWidth = count * TAB_CIRCLE_SIZE - (count - 1) * TAB_OVERLAP;

  const circleCentres = Array.from(
    { length: count },
    (_unused, index) => TAB_CIRCLE_SIZE / 2 + index * step,
  );

  return {
    shapeWidth,
    canvasWidth: shapeWidth + TAB_CANVAS_PAD * 2,
    canvasHeight: TAB_CIRCLE_SIZE + TAB_CANVAS_PAD * 2,
    bandHeight: TAB_BAND_HEIGHT,
    containerHeight: TAB_BAR_TOP_PAD + TAB_CIRCLE_SIZE + TAB_BAR_LIFT + safeInset(bottomInset),
    circleCentres,
  };
};

/**
 * Map a route index to the circle it should light up.
 *
 * SVG coordinates do not mirror under RTL - `I18nManager` flips flexbox and the
 * `start`/`end` style props, but an `x` attribute is still an `x` attribute. So
 * the silhouette is laid out left-to-right in both directions (it is symmetric,
 * so it looks identical either way) and only the *mapping* flips. Touch targets
 * are positioned with `left` from these same values, which likewise does not
 * mirror, so the icon and its hit area cannot drift apart.
 */
export const visualTabIndex = (routeIndex: number, tabCount: number): number => {
  const count = safeCount(tabCount);
  const clamped = Math.min(Math.max(routeIndex, 0), count - 1);
  return I18nManager.isRTL ? count - 1 - clamped : clamped;
};
