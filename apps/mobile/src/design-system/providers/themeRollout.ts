/**
 * Dark mode rollout gate.
 *
 * WHAT THIS IS
 * ------------
 * A single switch deciding whether dark mode is *reachable by a user*. It does
 * not remove dark mode. The token ramp, the themed styles on every screen, the
 * contrast gates and the ~390 light/dark snapshot baselines all stay exactly as
 * they are, and all of them keep running in CI while this is `false`.
 *
 * WHY IT IS OFF
 * -------------
 * Not because dark mode is unimplemented - phase 6.3 took it app-wide. Because
 * it is unverified where it counts. Device verification only ever reached the
 * four screens available without a login (Welcome, Onboarding, Login,
 * Register); Home, Search, Favorites, Orders, Order Details, Checkout, Profile,
 * Settings, Loyalty, Leaderboard and the whole driver flow have never been
 * rendered in dark on a real device. See §5.1 of
 * MOBILE_DEVICE_VERIFICATION_REPORT.md.
 *
 * Two rounds of device verification each found a P0 or P1 on the first screen
 * examined (D1 clipped text at 1.3x scale, D2 a white field on a dark card, D3
 * unresolved colour names falling back to black). The base rate on unexamined
 * screens is not low, so shipping the entry point would be shipping defects at
 * a rate we have measured and have no reason to think has changed.
 *
 * WHY A FLAG RATHER THAN DELETING THE CODE
 * ----------------------------------------
 * Deleting would throw away a verified token layer, the contrast ratchets and
 * every dark baseline - then require re-deriving all of it, slightly
 * differently, when the screens are ready. The flag costs one branch in
 * Settings and one prop in App.tsx.
 *
 * TO TURN IT BACK ON
 * ------------------
 * 1. Flip this to `true`.
 * 2. Update the two tests that pin it off - `themeRollout.test.ts` and the
 *    "while the rollout gate is closed" block in
 *    `SettingsScreen.appearance.test.tsx`. They fail deliberately, so the flip
 *    cannot happen without someone reading this comment.
 * 3. Ship the D5 fix (a DayNight AppCompat parent plus `values-night`) in the
 *    same change - see §4b of the device report. Without it the cold-start
 *    window flashes the wrong ground.
 *
 * The lock is applied by passing `lockToLight` to `ThemeProvider` in App.tsx,
 * not read inside the provider. That is deliberate: the visual matrix mounts
 * `ThemeProvider` directly to capture dark baselines, and a global the provider
 * consulted itself would silently collapse every one of those to light while
 * still reporting green.
 */
export const DARK_MODE_ENABLED: boolean = false;
