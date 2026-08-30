/**
 * Bottom tab bar height, derived from the OS font scale.
 *
 * The bar used to be a flat 56dp (+ bottom inset) on Android. The icon block is
 * a fixed 28dp, but the label is font-scaled, so at a 2.0x system font scale the
 * content grew past 56dp and every tab label was clipped along the bottom edge.
 * Device-verified on 2026-08-30.
 *
 * The result must be fed to `tabBarStyle.height`, not `minHeight`:
 * react-navigation reads `height` out of tabBarStyle in `getTabBarHeight()` and
 * republishes it through `BottomTabBarHeightContext`, which screens use to pad
 * their scroll content. A `minHeight` would grow the bar while leaving every
 * screen padding for the old 56dp, hiding content behind the taller bar.
 */

/** `ICON_SIZE_TALL` in @react-navigation/bottom-tabs `TabBarIcon`. Not font-scaled. */
export const TAB_ICON_HEIGHT = 28;

/**
 * Calibrated so a 1.0x scale reproduces the previous flat 56dp exactly
 * (28 icon + 12 label + 16 padding), keeping the bar pixel-identical at normal
 * scales and letting it grow only when the text genuinely needs the room.
 */
export const LABEL_LINE_RATIO = 1.2;

export interface TabBarHeightInput {
  /** `PixelRatio.getFontScale()`. */
  fontScale: number;
  /** `useSafeAreaInsets().bottom`. Ignored on iOS, where the base already covers it. */
  bottomInset: number;
  /** Rendered `tabBarLabelStyle.fontSize`. */
  labelFontSize: number;
  platform: 'ios' | 'android';
}

/**
 * Never shrinks below the platform base, so this can only ever add room for
 * text that would otherwise be clipped - it cannot cap accessibility sizes.
 */
export const getTabBarHeight = ({
  fontScale,
  bottomInset,
  labelFontSize,
  platform,
}: TabBarHeightInput): number => {
  const isIOS = platform === 'ios';

  // paddingTop + paddingBottom applied to the bar in TabNavigator.
  const verticalPadding = isIOS ? 32 : 16;
  const baseHeight = isIOS ? 88 : 56;

  // A non-finite or non-positive scale means the platform gave us nothing
  // usable; fall back to 1 rather than producing NaN and collapsing the bar.
  const safeScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  const safeInset = Number.isFinite(bottomInset) && bottomInset > 0 ? bottomInset : 0;

  const labelBlockHeight = Math.ceil(labelFontSize * safeScale * LABEL_LINE_RATIO);
  const contentHeight = TAB_ICON_HEIGHT + labelBlockHeight + verticalPadding;

  return Math.max(baseHeight, contentHeight) + (isIOS ? 0 : safeInset);
};
