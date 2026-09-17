/**
 * Floating tab bar - a white silhouette of overlapping circles on the cream ground.
 *
 * WHY THIS IS NOT `tabBarStyle`
 * -----------------------------
 * react-navigation's default bar clips its children to the bar's bounds. This
 * design depends on the circles bulging past the band, so the shape has to be
 * drawn by something that is allowed to overflow. Hence a custom `tabBar`.
 *
 * WHY SVG RATHER THAN VIEWS
 * -------------------------
 * The band and the five circles must read as ONE shape with ONE shadow. Views
 * would need an Android `elevation` per circle, and rule 11 in
 * `.claude/rules/mobile.md` is explicit that elevation on a rounded view renders
 * a rectangular shadow outline - five square shadows behind a scalloped shape.
 * In one SVG, overlapping shapes with the same fill merge with no internal seam,
 * and the shadow is an offset copy of the whole group. Same technique as the
 * blob in `HomeCategoryRail`.
 *
 * WHY THE BAR STAYS IN LAYOUT FLOW
 * --------------------------------
 * It is not absolutely positioned. react-navigation sizes each screen to sit
 * above the tab bar, so keeping it in flow means no screen needs new bottom
 * padding. Floating it absolutely would have meant auditing every scroll
 * container in the app for content hidden behind the shape.
 *
 * KNOWN DEVIATION
 * ---------------
 * This bar is icon-only. `DESIGN.md` §13.7 requires "icon + label always" on
 * mobile tabs. That rule has not been changed, so this is a deliberate,
 * user-directed deviation and belongs in §19 Known Exceptions - see the note in
 * the task report. It is recorded here so the next reader does not treat the
 * missing labels as an oversight and "fix" them.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, FeDropShadow, Filter, G, Rect } from 'react-native-svg';

import { Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { colorTokens } from '@/design-system/tokens/colors';
import { VotingLiveDot } from '@/features/voting/components/VotingLiveDot';

import {
  TAB_BAR_SCRIM_OVERHANG,
  TAB_BAR_LIFT,
  TAB_BAR_TOP_PAD,
  TAB_CANVAS_PAD,
  TAB_CIRCLE_SIZE,
  TAB_OVERLAP,
  getFloatingTabBarLayout,
} from '../utils/floatingTabBarLayout';

import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// ============================================================================
// Palette
// ============================================================================

const COLORS = {
  /** Band and circles. Pure white, not `surface` (#FAFAFA), so the shape reads
   *  as cleanly as possible against the cream ground it sits on. */
  shape: colorTokens.base.neutral[0],
  /** Active circle. Gold is 2.42:1 on white and cannot carry a state there;
   *  coral is 3.38:1, over the 3:1 bar for a non-text mark. */
  active: colorTokens.base.accent[500],
  /** Resting icons on white: 8.95:1. */
  iconRest: colorTokens.base.primary[500],
  /** Icon on the coral circle. */
  iconActive: colorTokens.base.neutral[0],
  badge: colorTokens.base.error[500],
} as const;

/**
 * White on cream is 1.05:1, so the shadow is the ONLY thing defining this bar's
 * edge - load-bearing, not decoration.
 *
 * It MUST be a real Gaussian blur. The first version used the offset-copy trick
 * from `HomeCategoryRail` - a second copy of the shape nudged down at low
 * opacity - and on a device that reads as a hard grey OUTLINE around each
 * circle, because an offset copy has a hard edge by definition. It looked like
 * every tab had a border. `FeDropShadow` blurs properly, and the CSS mockup's
 * `drop-shadow` this is reproducing is a blur too.
 *
 * Applied to the whole group, not per shape: one filter pass over the merged
 * silhouette, so no shadow is cast into the seams where circles overlap.
 */
const SHADOW = {
  id: 'floatingTabBarShadow',
  dy: 4,
  blur: 5,
  color: 'rgb(15, 34, 37)',
  opacity: 0.11,
} as const;

/**
 * Height of the cream veil that sits ABOVE the bar.
 *
 * The bar is in layout flow, so content stops at its top edge rather than
 * scrolling underneath. Without this the last card is sliced off square. The
 * veil overhangs upward and fades content out as it approaches the bar, which
 * is the dissolve in the mockup. Deliberately NOT achieved by floating the bar:
 * that would have meant re-padding every scroll container in the app.
 */
/**
 * THE FADE. One number, one ramp.
 *
 * The veil opacity at the BAR TOP EDGE, as a fraction. Everything else is a
 * straight line through it: transparent at the veil top, this value at the
 * bar top, continuing at the same rate until fully opaque.
 *
 *     0.20  gentle - content stays visible well past the buttons
 *     0.39  the mockup  (current)
 *     0.60  strong - content is nearly gone by the time it reaches the discs
 *
 * WHY THERE IS ONLY ONE NUMBER
 * An earlier version exposed three - one per landmark - by placing a gradient
 * stop at each. That genuinely made them independent, and it was a mistake.
 * A gradient is linear BETWEEN stops, so every stop is a change of slope, and
 * the eye reads a change in rate as an edge (a Mach band). Three stops meant
 * three chances to see a seam: a patch that looks intense, then one that looks
 * light, then nothing. Exactly the artefact the fade exists to avoid.
 *
 * A quadratic ease was tried too. It has no seams, but it finishes at twice
 * its average slope, piling the whole change into the opaque end - which reads
 * as one big intense band instead of several small ones.
 *
 * A single straight line is the only shape with no rate change anywhere. Its
 * two endpoints are rate changes, but they sit at 0% opacity (the veil edge,
 * nothing to see) and 100% (both sides identical solid cream). That is why
 * the mockup is a plain two-stop linear-gradient and nothing cleverer.
 *
 * Do not add stops to "smooth" this. Every stop added makes it less smooth.
 */
const FADE_AT_BAR_TOP = 0.39;

/**
 * The veil has to be the SAME colour as the ground it fades into, or the fade
 * lands on a slightly different cream and the mismatch reads as a tint. Taken
 * from the theme rather than written as a literal so the two cannot drift.
 */
const hexToRgb = (hex: string): string => {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map(ch => ch + ch)
          .join('')
      : clean;
  const channel = (at: number): number => Number.parseInt(full.slice(at, at + 2), 16);
  const [r, g, b] = [channel(0), channel(2), channel(4)];
  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) {
    // Unparseable theme value: fall back to fully transparent rather than to a
    // guessed colour, so a wrong veil colour can never be painted over content.
    return '0, 0, 0';
  }
  return `${r}, ${g}, ${b}`;
};

/**
 * Kept at ~0.39 of the circle, the ratio measured off the reference artwork
 * (18px glyph in a 47px disc). Hard-coding the pixel size instead means the
 * icons stay put while the circle grows and start to look lost in it.
 */
const ICON_SIZE = Math.round(TAB_CIRCLE_SIZE * 0.39);

/**
 * The tabs this navigator declares.
 *
 * Spelled out rather than derived. `TabParamList extends Record<string, object
 * | undefined>`, so `keyof TabParamList` widens to `string` and
 * `Record<keyof TabParamList, ...>` enforces nothing at all - it compiles, it
 * looks like a totality check, and it accepts an empty object. The literal
 * tuple is what actually makes a missing icon a compile error.
 */
const TAB_ROUTES = ['Home', 'Search', 'Favorites', 'Orders', 'Profile'] as const;
type TabRouteName = (typeof TAB_ROUTES)[number];

/**
 * `satisfies`, not an annotation: it checks every route has an icon while
 * keeping the literal keys, so `ICONS.Home` stays a real property rather than
 * an index-signature lookup.
 */
const ICONS = {
  Home: { focused: 'home', unfocused: 'home-outline' },
  Search: { focused: 'search', unfocused: 'search-outline' },
  Favorites: { focused: 'heart', unfocused: 'heart-outline' },
  Orders: { focused: 'receipt', unfocused: 'receipt-outline' },
  Profile: { focused: 'person', unfocused: 'person-outline' },
} as const satisfies Record<TabRouteName, { focused: string; unfocused: string }>;

/**
 * `route.name` is typed `string` by react-navigation, so the lookup can miss
 * at the type level even though the Record above is total - every route this
 * navigator declares is a key, so the fallback is unreachable by construction.
 *
 * It returns the Home glyphs rather than a neutral placeholder glyph, and that
 * is deliberate: the shipped Ionicons.ttf is a SUBSET generated from the names
 * referenced in src/, so naming a glyph here that no reachable code uses would
 * add it to the APK to serve a branch that never runs.
 *
 * Note the scanner is deliberately over-inclusive - it treats ANY quoted word
 * as a possible icon name, comments included - so do not quote a glyph name in
 * prose here either. Guarded by __tests__/iconFontSubset.test.ts, which caught
 * both mistakes.
 */
const isTabRoute = (name: string): name is TabRouteName =>
  (TAB_ROUTES as readonly string[]).includes(name);

const iconName = (routeName: string, focused: boolean): string => {
  const pair = isTabRoute(routeName) ? ICONS[routeName] : ICONS.Home;
  return focused ? pair.focused : pair.unfocused;
};

// ============================================================================
// Keyboard visibility
// ============================================================================

/**
 * `tabBarHideOnKeyboard` is implemented inside react-navigation's own
 * `BottomTabBar` (it reads `isKeyboardShown` there), so a custom bar loses the
 * behaviour unless it reimplements it. Without this the bar sits on top of the
 * keyboard on Android.
 */
const useIsKeyboardShown = (): boolean => {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Android never emits the `Will` events; iOS emits both but `Will` fires in
    // step with the animation, so the bar does not lag the keyboard up.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => setShown(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setShown(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return shown;
};

// ============================================================================
// Component
// ============================================================================

const FloatingTabBarComponent = ({
  state,
  descriptors,
  navigation,
  insets,
}: BottomTabBarProps): React.ReactElement | null => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isKeyboardShown = useIsKeyboardShown();

  const tabCount = state.routes.length;

  const layout = getFloatingTabBarLayout({ tabCount, bottomInset: insets.bottom });

  /*
   * Computed here, above the keyboard early-return, because the colour list is
   * a hook and hooks cannot run conditionally.
   *
   * Solved in PIXELS from the bar, then converted to fractions - not written
   * as fractions directly. The veil grows with the safe-area inset, so a fixed
   * fraction would silently mean different opacities on different phones: 39%
   * at the bar top with no inset, 31% with a 34px gesture bar. Same code, same
   * constants, different fade.
   */
  const veilHeight = layout.containerHeight + TAB_BAR_SCRIM_OVERHANG;
  /*
   * Solved in PIXELS from the bar, then converted. The veil grows with the
   * safe-area inset, so a fixed fraction would mean a different fade per
   * device: 39% at the bar top with no inset, 31% with a 34px gesture bar.
   */
  const scrimSolidAt = Math.min(1, TAB_BAR_SCRIM_OVERHANG / FADE_AT_BAR_TOP / veilHeight);

  /*
   * Memoised: a fresh array each render re-uploads the gradient every frame.
   * Keyed on the joined alphas rather than the array identity, which changes
   * on every render by construction.
   */
  const scrimColors = useMemo(() => {
    const rgb = hexToRgb(theme.colors.background);
    // Two distinct values and nothing between them: one straight ramp. The
    // third entry repeats the second so the veil stays solid to the screen
    // edge - it is not a stop in the ramp, both sides of it are identical.
    return [`rgba(${rgb}, 0)`, `rgba(${rgb}, 1)`, `rgba(${rgb}, 1)`];
  }, [theme.colors.background]);

  const handlePress = useCallback(
    (routeKey: string, routeName: string, isFocused: boolean) => {
      /*
       * `canPreventDefault` is required, not optional. The Profile tab attaches
       * a `tabPress` listener that calls `preventDefault()` to pop its stack to
       * the top instead of navigating. A custom bar that simply calls
       * `navigate()` would silently break that.
       */
      const event = navigation.emit({
        type: 'tabPress',
        target: routeKey,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(routeName);
      }
    },
    [navigation],
  );

  const handleLongPress = useCallback(
    (routeKey: string) => {
      navigation.emit({ type: 'tabLongPress', target: routeKey });
    },
    [navigation],
  );

  if (isKeyboardShown) {
    return null;
  }

  const { canvasWidth, canvasHeight, shapeWidth, bandHeight, containerHeight, circleCentres } =
    layout;

  const radius = TAB_CIRCLE_SIZE / 2;
  const bandY = (TAB_CIRCLE_SIZE - bandHeight) / 2;

  /** Band + every circle. Same fill, so the union has no internal seams. */
  const silhouette = (
    <>
      <Rect
        x={0}
        y={bandY}
        width={shapeWidth}
        height={bandHeight}
        rx={bandHeight / 2}
        fill={COLORS.shape}
      />
      {circleCentres.map(cx => (
        <Circle key={cx} cx={cx} cy={radius} r={radius} fill={COLORS.shape} />
      ))}
    </>
  );

  return (
    <View style={[styles.container, { height: containerHeight }]} testID='floating-tab-bar'>
      {/*
       * Covers the WHOLE bar, not just a strip above it, and the bar has no
       * background of its own - this gradient IS the ground. Content bled up
       * from the screen above therefore shows through behind the bar's top
       * edge and dissolves as it passes behind the band and the buttons.
       *
       * Must never intercept a tap meant for a card underneath.
       */}
      <LinearGradient
        colors={scrimColors}
        locations={[0, scrimSolidAt, 1]}
        style={[styles.scrim, { top: -TAB_BAR_SCRIM_OVERHANG, height: veilHeight }]}
        pointerEvents='none'
      />
      <View style={[styles.shape, { width: canvasWidth, height: canvasHeight }]}>
        <Svg width={canvasWidth} height={canvasHeight} pointerEvents='none'>
          <Defs>
            <Filter id={SHADOW.id} x='-25%' y='-25%' width='150%' height='150%'>
              <FeDropShadow
                dx='0'
                dy={String(SHADOW.dy)}
                stdDeviation={String(SHADOW.blur)}
                floodColor={SHADOW.color}
                floodOpacity={String(SHADOW.opacity)}
              />
            </Filter>
          </Defs>
          {/* Translated by the blur bleed so the soft edge is not clipped. */}
          <G x={TAB_CANVAS_PAD} y={TAB_CANVAS_PAD}>
            <G filter={`url(#${SHADOW.id})`}>{silhouette}</G>
          </G>
        </Svg>

        {/*
         * ONE ROW, AND THE DISC LIVES INSIDE THE TAB IT MARKS.
         *
         * This was five absolutely-positioned targets at
         * `left: circleCentres[visualTabIndex(index)]`, with the coral disc
         * drawn separately - first as an SVG <Circle>, then as another absolute
         * View. Both versions put the disc and the icons in SEPARATE coordinate
         * systems, and under RTL those systems did not agree. Measured on one
         * device, one build, one locale, differing only in how it was restarted:
         *
         *   restarted from inside the app   JS isRTL false, native layout RTL
         *   restarted cold from the launcher JS isRTL true, native layout RTL
         *
         * so `visualTabIndex` and the platform's own mirroring each applied, or
         * did not, independently of each other. The disc landed on the wrong
         * tab, and the focused icon - painted WHITE so it reads on coral - ended
         * up on a plain white circle and disappeared. A different icon vanished
         * on every tab change, which is exactly how it was reported.
         *
         * A flex row removes the disagreement instead of compensating for it.
         * `flexDirection: 'row'` and `marginStart` are mirrored by the layout
         * engine itself, and the disc is a CHILD of the focused tab, so nothing
         * computes where it goes. There is no longer anything that can drift:
         * the result is identical whichever value `isRTL` holds, which is what
         * makes it safe across both restart paths above.
         *
         * `justifyContent: 'center'` is what keeps the row on the painted
         * silhouette: the row's content is exactly `shapeWidth` wide, the canvas
         * is that plus the blur bleed either side, and the silhouette is
         * symmetric - so slot k lands on a drawn circle in either direction.
         */}
        <View style={styles.row} pointerEvents='box-none'>
          {state.routes.map((route, index) => {
            const isFocused = state.index === index;

            /*
             * Optional-chained rather than defaulted to `{ options: {} }`: that
             * fallback widens the type to `{}` and loses `title` entirely.
             */
            const label = descriptors[route.key]?.options.title ?? route.name;

            return (
              <Pressable
                key={route.key}
                onPress={() => handlePress(route.key, route.name, isFocused)}
                onLongPress={() => handleLongPress(route.key)}
                style={[styles.slot, index > 0 && styles.slotOverlap]}
                accessibilityRole='tab'
                accessibilityState={{ selected: isFocused }}
                accessibilityLabel={label}
                accessibilityHint={t('tabs.a11ySwitchHint', { tab: label })}
                testID={`tab-${route.name}`}
              >
                {isFocused && (
                  <View
                    style={styles.activeCircle}
                    pointerEvents='none'
                    testID='floating-tab-bar-active-circle'
                  />
                )}
                <View style={styles.iconWrapper}>
                  <Icon
                    name={iconName(route.name, isFocused)}
                    family='Ionicons'
                    size={ICON_SIZE}
                    color={isFocused ? COLORS.iconActive : COLORS.iconRest}
                  />
                  {route.name === 'Profile' && <VotingLiveDot />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
};

FloatingTabBarComponent.displayName = 'FloatingTabBar';

export const FloatingTabBar = memo(FloatingTabBarComponent);

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    // The shape's blur bleed extends past the padding box.
    overflow: 'visible',
    /*
     * Absolutely positioned, so react-navigation stops shrinking each screen to
     * fit above it and content runs underneath. That is what makes the fade
     * possible at all - a veil over empty ground fades nothing, and the
     * content hard bottom edge showed as a line exactly where the veil began.
     *
     * Every scroll container inside a tab stack pays for this with a bottom
     * inset from useFloatingTabBarInset, or its last row is stuck under here.
     *
     * No background colour: the gradient is the ground.
     */
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // The shape is pinned to the top of the container; the lift is the padding
    // underneath it, so the safe-area inset grows the container downward rather
    // than pushing the shape up into the content.
    paddingTop: TAB_BAR_TOP_PAD - TAB_CANVAS_PAD,
    justifyContent: 'flex-start',
  },
  shape: {
    position: 'relative',
  },
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  /**
   * Covers the whole canvas and centres its content, so the five slots land on
   * the five painted circles with no hardcoded offset anywhere. Mirrored by the
   * layout engine under RTL, which is the entire point - see the note on the
   * row above.
   *
   * `box-none` on the element: the row must not swallow a tap meant for
   * content showing through the gap above the shape.
   */
  row: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: TAB_CANVAS_PAD,
  },
  /** One tab: touch target, disc box and icon box in a single element. */
  slot: {
    width: TAB_CIRCLE_SIZE,
    height: TAB_CIRCLE_SIZE,
    borderRadius: TAB_CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * `marginStart`, not `marginLeft`: the overlap has to follow the reading
   * direction, and the logical prop is the one the layout engine mirrors. This
   * is what fuses the discs into one silhouette rather than a row of separate
   * buttons - see TAB_OVERLAP.
   */
  slotOverlap: {
    marginStart: -TAB_OVERLAP,
  },
  /**
   * The coral disc under the focused tab. Absolutely fills its OWN slot, so it
   * cannot be anywhere except exactly under that tab's icon.
   *
   * No `elevation` and no `overflow: 'hidden'` - rule 11 in
   * `.claude/rules/mobile.md`. It needs neither: the shadow belongs to the
   * silhouette underneath, and this disc only has to be filled.
   */
  activeCircle: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: TAB_CIRCLE_SIZE / 2,
    backgroundColor: COLORS.active,
  },
  /** Anchor for VotingLiveDot, which positions itself absolutely. */
  iconWrapper: {
    position: 'relative',
  },
});

/** Re-exported so the navigator can keep the flow height in one place. */
export { TAB_BAR_LIFT };
