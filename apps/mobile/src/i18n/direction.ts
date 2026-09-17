/**
 * The app's reading direction - the value JS code must branch on.
 *
 * WHY NOT `I18nManager.isRTL`
 * --------------------------
 * Because it lies for a whole app lifetime after a language change, and it
 * lies in BOTH directions. Device-measured on 2026-09-16, one build, one
 * device, changing the language from the in-app switcher:
 *
 *   step                              native layout   I18nManager.isRTL (JS)
 *   cold start in Arabic              RTL             true      agree
 *   switch to English, RNRestart      LTR             true      DISAGREE
 *   cold start in English             LTR             false     agree
 *   switch to Arabic, RNRestart       RTL             false     DISAGREE
 *
 * `RNRestart.restart()` tears down and rebuilds the React Native instance, but
 * it does not restart the PROCESS. The native layout direction picks the new
 * value up; `I18nManager`'s JS-side flag is still whatever it was when the
 * process started. So for the whole session after a language change, the layout
 * is mirrored one way and every piece of JS that asks about direction is told
 * the other.
 *
 * WHAT THAT BROKE
 * ---------------
 * Everything that branches on it, all at once, and all reported as one bug
 * ("switching language changed the colours"):
 *
 *   - directional icons did not mirror, so every disclosure chevron in Arabic
 *     pointed the wrong way
 *   - `readingGradient` did not flip, so the white headings on the Profile
 *     cards sat on the LIGHT end of their ramp: white on #2ab297 is 2.65:1 and
 *     fails WCAG AA, where the intended #025755 is 8.41:1
 *   - `textAlignStart` / `textAlignEnd` resolved backwards
 *
 * THE FIX
 * -------
 * Ask the app, not the platform. The chosen language IS the direction, the app
 * already resolves it at i18n bootstrap, and unlike the platform flag it is
 * correct the instant it is set. `@/i18n` calls `setAppDirection` while it
 * initialises, which `App.tsx` imports before the navigator - so every screen
 * and component module evaluates after the value is in place.
 *
 * Note this does NOT remove the need to restart after a language change: only
 * the native side can re-lay-out mirrored, and on Android that needs the
 * Activity recreated. It removes the DISAGREEMENT, which is the part that
 * showed up as a bug.
 */

import { I18nManager } from 'react-native';

export type AppDirection = 'ltr' | 'rtl';

let appDirection: AppDirection | undefined;

/**
 * Records the direction the app resolved from its language. Called once, by
 * the i18n bootstrap; nothing else should call it.
 */
export const setAppDirection = (direction: AppDirection): void => {
  appDirection = direction;
};

/**
 * True when the app's chosen language reads right-to-left.
 *
 * Falls back to the platform flag when read before the bootstrap has run.
 * That path should be unreachable in the app - `App.tsx` imports `@/i18n`
 * above the navigator - but a test or a script may import a leaf component on
 * its own, and the platform flag is the best answer available there.
 */
export const isAppRTL = (): boolean =>
  appDirection === undefined ? I18nManager.isRTL : appDirection === 'rtl';

/** Test seam. Resets to "not yet bootstrapped", never used by app code. */
export const resetAppDirectionForTests = (): void => {
  appDirection = undefined;
};
