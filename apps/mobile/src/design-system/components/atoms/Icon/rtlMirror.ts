/**
 * RTL mirroring for directional icons.
 *
 * React Native mirrors *layout* under `I18nManager.isRTL` - a row reverses, a
 * chevron moves from the right edge to the left - but it does not mirror the
 * glyph itself. So in Arabic a "back" chevron ends up on the correct side while
 * still pointing the wrong way, which reads as "forward". Device-verified on
 * 2026-08-30: every disclosure chevron on the Arabic profile pointed right.
 *
 * Both the Material and the Apple HIG guidance is to mirror icons that express
 * direction or forward/backward progression, and to leave everything else
 * alone. We swap the icon *name* for its Ionicons counterpart rather than
 * applying `scaleX: -1`, because a real glyph keeps its hinting and stroke
 * weight, while a flipped one can shift by a subpixel and look slightly off.
 *
 * Deliberately NOT mirrored:
 * - `play-back` / `play-forward` and other media transport controls. Both specs
 *   are explicit that these follow the timeline, not the reading direction, and
 *   a mirrored rewind button would mean the opposite of what it does.
 * - Vertical icons (`chevron-up`, `arrow-down`, ...). RTL does not flip these.
 * - Anything with no direction (`heart`, `home`, ...).
 */

/**
 * Symmetric pairs. Declared one way and expanded to both directions below, so a
 * pair can never be half-registered.
 */
const MIRROR_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['chevron-back', 'chevron-forward'],
  ['chevron-back-outline', 'chevron-forward-outline'],
  ['chevron-back-circle', 'chevron-forward-circle'],
  ['chevron-back-circle-outline', 'chevron-forward-circle-outline'],
  ['arrow-back', 'arrow-forward'],
  ['arrow-back-outline', 'arrow-forward-outline'],
  ['arrow-back-circle', 'arrow-forward-circle'],
  ['arrow-back-circle-outline', 'arrow-forward-circle-outline'],
  ['caret-back', 'caret-forward'],
  ['caret-back-outline', 'caret-forward-outline'],
  ['caret-back-circle', 'caret-forward-circle'],
  ['caret-back-circle-outline', 'caret-forward-circle-outline'],
];

const MIRROR_MAP: ReadonlyMap<string, string> = new Map(
  MIRROR_PAIRS.flatMap(([a, b]) => [
    [a, b],
    [b, a],
  ]),
);

/** Whether this icon expresses reading direction and should mirror under RTL. */
export const isDirectionalIcon = (name: string): boolean => MIRROR_MAP.has(name);

/**
 * The name to render. Returns `name` unchanged in LTR, for a non-directional
 * icon, or when the caller has opted out - so this is safe to apply to every
 * icon in the app.
 */
export const mirrorIconName = (name: string, isRTL: boolean): string => {
  if (!isRTL) return name;
  return MIRROR_MAP.get(name) ?? name;
};
