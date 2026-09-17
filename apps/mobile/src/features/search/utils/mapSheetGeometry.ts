/**
 * Height of the map's offer sheets, and the padding their lists need.
 *
 * THE BUG THIS EXISTS TO FIX
 * --------------------------
 * Both sheets were `height: SCREEN_HEIGHT * 0.45` anchored at `bottom: 0`, and
 * the floating tab bar is absolutely positioned over the bottom ~110dp of the
 * screen. On a 800dp phone that left 360dp of sheet with 110dp of it behind the
 * bar - so a third of the panel the user opened to read offers was covered by
 * navigation, and the last card could never be scrolled clear of it.
 *
 * WHY HEIGHT + INSET RATHER THAN A BIGGER RATIO
 * ---------------------------------------------
 * The fix is not "make the sheet taller" - that changes how much map stays
 * visible above it, which is the thing the ratio was tuned for. The sheet grows
 * by exactly the height the bar steals, so the READABLE area is the ratio, on
 * every device, whatever the safe-area inset turns out to be.
 *
 * WHY NOT LIFT THE SHEET TO `bottom: tabBarInset`
 * -----------------------------------------------
 * The sheet has rounded top corners and an opaque body. Lifted, the map shows
 * through the strip beneath it and behind the semi-transparent tab bar, so the
 * panel reads as floating over a gap. Anchored at 0 and grown, it stays a sheet.
 *
 * The list then pads itself by the inset on top of its own padding, or the last
 * offer card sits under the bar permanently - the same rule every scroll
 * container in a tab stack follows (`useFloatingTabBarInset`).
 */

/**
 * Share of the screen the sheet's READABLE area takes - i.e. excluding the
 * strip the tab bar covers.
 *
 * 0.52, up from the 0.45 that was measured against a screen with no floating
 * bar: two offer cards plus the header have to fit, and at 0.45 the second card
 * was always half-cut.
 */
export const MAP_SHEET_RATIO = 0.52;

/** Falls back to a 800dp phone if the platform hands us nothing usable. */
const FALLBACK_SCREEN_HEIGHT = 800;

/**
 * Past this the sheet stops reading as a sheet and starts reading as a screen,
 * and the map behind it - the thing that gives the offers their context -
 * disappears entirely. Reached on short screens once the inset is added.
 */
const MAX_SHEET_FRACTION = 0.8;

export interface MapSheetGeometryInput {
  /** `useWindowDimensions().height`. */
  screenHeight: number;
  /** `useFloatingTabBarInset()` - height the bar occupies over the content. */
  tabBarInset: number;
}

export interface MapSheetGeometry {
  /** Total height of the sheet, anchored at `bottom: 0`. */
  sheetHeight: number;
  /**
   * What the offer list must add to its own `paddingBottom`, so its last row
   * can be scrolled out from under the tab bar.
   */
  listPaddingBottom: number;
}

const safe = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

/** A zero or absent inset is legitimate - a device with no bar rendered. */
const safeInset = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

export const getMapSheetGeometry = ({
  screenHeight,
  tabBarInset,
}: MapSheetGeometryInput): MapSheetGeometry => {
  const height = safe(screenHeight, FALLBACK_SCREEN_HEIGHT);
  const inset = safeInset(tabBarInset);

  // Rounded: a fractional height makes the slide-in animation's `toValue`
  // disagree with the laid-out box by a sub-pixel, which shows as a hairline of
  // map under the sheet's bottom edge.
  const readable = Math.round(height * MAP_SHEET_RATIO);
  const sheetHeight = Math.min(readable + inset, Math.round(height * MAX_SHEET_FRACTION));

  return { sheetHeight, listPaddingBottom: inset };
};
