# Mobile Device Verification Report — Phase 6.5

**Status:** PARTIAL — D1-D4 fixed and re-verified on device; D5 diagnosed and
deliberately not shipped; auth-gated screens still unreachable (see §5)
**Date:** 2026-08-26 **Build under test:** `assembleDevDebug` from the working
tree at `4da1cb37`, installed as `com.toofreshtowaste.app.dev`, JS served by
Metro. **Default theme during test:** `light` — unchanged, and unchanged in git.

This report exists because a resolved-style snapshot gate cannot see clipping,
truncation, keyboard behaviour, safe areas, or how a theme actually looks.
Everything below was observed on a running device. Where something was **not**
observed, it is listed in §5 rather than assumed.

---

## 1. Rig

| Property      | Value                                                            |
| ------------- | ---------------------------------------------------------------- |
| Emulator      | BlueStacks, `127.0.0.1:5555`                                     |
| Spoofed model | `SM-S908E` (Galaxy S22 Ultra) — **spoofed, not real hardware**   |
| Android       | 9 (API 28)                                                       |
| ABI           | x86_64 host, app runs `arm64-v8a` via native bridge (`libnb.so`) |
| Resolution    | 720 × 1280 px                                                    |
| Density       | 240 dpi (1.5×)                                                   |
| Logical size  | **480 × 853 dp**                                                 |
| Font scale    | 1.0 default                                                      |
| Locale        | `en-US`                                                          |

### 1.1 The installed app was the wrong app

The package already on the device was a **Play Store release build dated
2026-08-09**, sixteen days before Phase 1. Auditing it would have verified the
pre-migration app and reported false confidence. The whole tree was rebuilt and
installed as the `dev` flavour before any observation was made.

### 1.2 What this rig cannot prove

- **Safe areas.** BlueStacks is a desktop VM with no notch, no punch-hole, no
  gesture bar and no rounded corners. There are no insets, so inset handling
  **cannot be verified here at all**.
- **Real hardware / OEM skins / API 29+.**
- **Thumb reachability.** Input is synthesised, so a target can be measured but
  not _felt_.
- **Real network.** No backend was running (see §5).

### 1.3 Corrections to earlier claims in this migration

- **"API 28 predates system dark mode, so `auto` is untestable here" — wrong.**
  `cmd uimode night yes|no` flips `mCurUiMode` between `0x11`
  (`UI_MODE_NIGHT_NO`) and `0x21` (`UI_MODE_NIGHT_YES`), and the app follows it
  live (§3.2). Note `mComputedNightMode` stays `false` in **both** states — that
  field looks like the answer and is not.
- **`android:configChanges` already contains `uiMode`**
  (`AndroidManifest.xml:49`), which per the React Native docs is the
  prerequisite for a live theme switch without the Activity being torn down.
  Confirmed empirically in §3.2.

---

## 2. Executed matrix

| Axis       | Covered                         | Not covered                     |
| ---------- | ------------------------------- | ------------------------------- |
| Theme      | light, dark, auto (live switch) | —                               |
| Locale     | English                         | **French, Arabic/RTL** (§5)     |
| Width      | 480 dp native                   | 320 / 390 / 430 dp (§5)         |
| Font scale | 1.0, **1.3**                    | 1.15, 1.5, 2.0                  |
| Screens    | Welcome, Login                  | **everything behind auth** (§5) |

---

## 3. Verified working

### 3.1 `defaultTheme='light'` overrides the system

System set to night (`mCurUiMode=0x21`), app default `light`. The theme-aware
Login screen **stayed light**. This is the precondition for keeping the default
at `light` while dark mode ships, and it holds on device.

_Evidence: `08-after-skip.png` (system dark, app light)._

### 3.2 `auto` follows the system live, with no restart

With `defaultTheme='auto'` (temporary local edit, reverted — see §6), flipping
`cmd uimode night no → yes` switched the running app from light to dark
**without relaunching it**. `useColorScheme()` observes the change on API 28.

_Evidence: `14b-AUTO-systemlight.png` → `15-AUTO-systemdark-liveswitch.png`._

### 3.3 Dark mode renders

Background, card, headings, links, and the brand button all resolve correctly.
The Sign In button renders `primary[300] #54ACB5` with dark text — the
theme-aware brand fix from Phase 5, confirmed visually rather than inferred.

_Evidence: `11-DARK-login.png`._

### 3.4 WelcomeScreen is a deliberate brand surface

Renders on the brand ground with white/coral in both themes, as recorded in
`DESIGN.md` §19-E26. Not a defect.

_Evidence: `06-welcome-light-en.png`._

---

## 4. Findings

### D1 — Form labels truncate at 1.3× font scale · **P0**

|                |                                       |
| -------------- | ------------------------------------- |
| Screen         | LoginScreen                           |
| Device         | BlueStacks 480 dp, font scale **1.3** |
| Locale / theme | en / dark (also present in light)     |
| Evidence       | `12-DARK-login-fontscale1.3.png`      |

**Reproduction:** `adb shell settings put system font_scale 1.3`, open Login.

**Observed:** labels are cut mid-word, not wrapped:

| Intended                            | Rendered                    |
| ----------------------------------- | --------------------------- |
| `Password`                          | **`Passw`**                 |
| `Email Address`                     | `Email`                     |
| `Welcome Back 👋`                   | `Welcome`                   |
| `Remember me`                       | `Remember`                  |
| `Forgot Password?`                  | `Forgot`                    |
| `OR`                                | `O`                         |
| `Don't have an account? Sign Up`    | `Don't have an` / `Sign`    |
| `Need to verify email? Resend Link` | `Need to verify` / `Resend` |
| terms sentence                      | clipped at `and`            |

**Severity P0.** 1.3× is a mainstream accessibility setting, not an extreme. A
password field labelled `Passw` is a broken form, and it is broken _specifically
for users who enlarged the text because they need to_. It also fails `DESIGN.md`
§3.6.7 (French runs ~30% longer) by the same mechanism — if 1.3× English
truncates, French at 1.0× is at risk.

**Likely cause:** fixed-height/fixed-width containers with `numberOfLines={1}`
and no `flexShrink`, so the scaled glyphs are clipped rather than wrapped.

**Recommended fix:** allow these labels to wrap; remove `numberOfLines={1}` from
form labels and the terms sentence; size their containers from content. Where a
single line is genuinely required, cap with `maxFontSizeMultiplier` rather than
truncating. Then re-run at 1.0 / 1.3 / 1.5.

---

### D2 — Text inputs stay white in dark mode · **P1**

|                |                                          |
| -------------- | ---------------------------------------- |
| Screen         | LoginScreen (design-system `Input` atom) |
| Locale / theme | en / **dark**                            |
| Evidence       | `11-DARK-login.png`                      |

**Observed:** both inputs render a **white** field with a light placeholder on
the `#1E1E1E` card. They are the brightest objects on the screen and read as
unstyled.

**Severity P1.** Not unreadable, but the single most obvious "this app does not
really have a dark mode" artefact on the screen.

**Likely cause:** the `Input` atom's background is a literal, not a theme role.
Phase 6.3 converted screens and `OrderCard`; the input atom was not in that set
and has no matrix baseline of its own that crosses light/dark on the field
background.

**Recommended fix:** route the `Input` surface to `colors.surface` /
`colors.surfaceVariant` and its border to `colors.outline`, then add an `Input`
entry to the visual matrix so `darkModeCoverage.test.ts` covers it.

---

### D3 — Secondary copy is near-invisible in dark · **P1**

|                |                     |
| -------------- | ------------------- |
| Screen         | LoginScreen         |
| Locale / theme | en / **dark**       |
| Evidence       | `11-DARK-login.png` |

**Observed:** two strings render dark-grey on the dark card:

- `Save food, save money, save the planet` (subtitle)
- `By signing in, you agree to our Terms of Service and Privacy Policy`

Both are legible only on close inspection. Compare `Email Address` / `Password`
directly above them, which are correctly light.

**Likely cause:** these two use a hardcoded dark text literal rather than
`onSurfaceVariant`. `LoginScreen` calls `useTheme()` but keeps a static
`StyleSheet`, so only _some_ of its colours are theme-derived — the failure mode
`createThemedStyles` exists to prevent.

**Recommended fix:** move `LoginScreen`'s stylesheet onto `createThemedStyles`
and map both to `colors.onSurfaceVariant`.

---

### D4 — Status-bar content is dark-on-dark on the brand ground · **P2**

|                |                           |
| -------------- | ------------------------- |
| Screen         | WelcomeScreen             |
| Locale / theme | en / light                |
| Evidence       | `06-welcome-light-en.png` |

**Observed:** the clock and system icons render dark on the dark-teal brand
ground. Legible but low contrast.

**Likely cause:** `barStyle` is not set to `light-content` for this screen. Note
`CLAUDE.md` forbids passing `translucent`/`backgroundColor` to `StatusBar` under
edge-to-edge — `barStyle` is not affected by that rule.

**Recommended fix:** set `barStyle='light-content'` while a brand-ground screen
is focused, and restore on blur.

---

### D5 — Light flash on cold start in dark mode · **P2**

|                |                          |
| -------------- | ------------------------ |
| Screen         | app launch               |
| Locale / theme | en / dark                |
| Evidence       | `10-DARK-login-real.png` |

**Observed:** with the app resolving to dark, the pre-JS window renders the
cream `#F9F3F0` ground, then snaps to dark once JS mounts.

**Likely cause:** the native window background / splash theme is a fixed light
colour with no `values-night` counterpart.

**Recommended fix:** add a `values-night` window background so the native frame
matches the resolved theme before JS mounts.

---

## 4b. Round 2 — fixes and their device re-verification

Each fix below was re-run on the same rig. Nothing here is claimed from source.

### D1 — FIXED and verified · was P0

**Cause, confirmed:** not `numberOfLines`. A flex child is `flexShrink: 0` by
default in React Native, so once scaled glyphs stopped fitting the row, the
`<Text>` kept its intrinsic width and the parent clipped it. `errorText` and
`successText` already carried `flex: 1` and reflowed correctly at 1.3x — which
is what identified the mechanism.

**Fix:** `flexShrink: 1` on the text in each row, `flexWrap: 'wrap'` where a
second line is the right answer, and `flexShrink: 1` on the `Input` atom's label
row. Font scaling is **not** disabled anywhere.

**Verified at 1.3x** (`23-FIXED-light-1.3.png` against
`12-DARK-login-fontscale1.3.png`):

| Element            | Before           | After                  |
| ------------------ | ---------------- | ---------------------- |
| `Password`         | `Passw`          | **`Password`**         |
| `Email Address`    | `Email`          | **`Email Address`**    |
| `Welcome Back 👋`  | `Welcome`        | **full**               |
| subtitle           | clipped          | **full**               |
| `Remember me`      | `Remember`       | **full**               |
| `Forgot Password?` | `Forgot`         | **full**               |
| `OR`               | `O`              | **`OR`**               |
| terms sentence     | clipped at `and` | **wraps to two lines** |

No clipping, no overlap, no broken rhythm. The terms line reflows rather than
truncating, which is the correct behaviour.

**Regression coverage:** `src/test-utils/__tests__/textScalingSafety.test.tsx`
walks the rendered tree and fails on a row whose text can neither shrink nor
wrap. Jest does not run Yoga layout, so it cannot observe clipping itself — the
test says so, and carries a negative control proving it detects the exact shape
the fix removed.

### D2 — FIXED and verified · was P1

**Cause:** `Input.styles.ts` set `backgroundColor: colors.base.neutral[0]` on
the `default` and `outlined` variants, commented "Pure white for better text
visibility" — a light-mode statement written before there was a dark mode.
`filled` was already theme-derived.

**Fix:** both variants now use `colors.surface` — `#FAFAFA` in light (5 RGB from
the old white, imperceptible) and `#1E1E1E` in dark. Placeholder
(`onSurfaceVariant`) and selection (`primary`) were already theme-aware and are
untouched; the border is `colors.outline`, which is 3.62 on the dark surface.

**Verified:** `24-FIXED-dark-1.0.png` — the fields are dark with a visible
border, not the brightest objects on the screen.

**Regression coverage:** `Input.matrix.test.tsx`, 32 baselines across resting,
error, disabled and filled in both themes. The error state was initially written
with a non-existent `state` prop, which type-checked as a snapshot but captured
the resting state — caught by `tsc` and corrected; the states are now asserted
distinct (error border `#D32F2F`).

### D3 — FIXED and verified · was P1, and far wider than reported

**The reported symptom was two strings on one screen. The cause was the `Text`
atom, and it affected 158 call sites.**

`Text.types.ts` documents `color` as "Text color from theme or custom color",
but the implementation was `color: color ?? colors.onSurface` — the prop went
straight to React Native as a raw colour value. RN cannot parse `'secondary'`,
drops the style, and the text falls back to platform-default black. Readable on
a light card; invisible on a dark one.

Usage: 136 `secondary`, 15 `primary`, 5 `error`, and one each of `warning`,
`success`, `white`.

**Fix:** `Text` resolves semantic names against the theme, passes raw values
through untouched, and `TextColorName` makes the valid names discoverable so a
typo is a type error rather than an invisible string.

**Verified:** `24-FIXED-dark-1.0.png` — both strings are legible. Baselines show
the 8 `secondary` texts resolving `#616161` in light and `#BDBDBD` in dark, and
`primary` flipping `#1E4448` → `#54ACB5`.

**Regression coverage:** `LoginScreen.matrix.test.tsx`, 8 baselines. The screen
had none before, which is why this survived every gate — **no baseline in the
app rendered a `<Text color='secondary'>` at all**.

### D4 — FIXED and verified · was P2

`App.tsx` rendered `<StatusBar barStyle='dark-content' />` unconditionally, and
sat _outside_ `ThemeProvider`, so it could not have read the theme.

**Fix:** `ThemedStatusBar` inside the provider, choosing `light-content` in dark
and `dark-content` in light. Only `barStyle` is set — `backgroundColor` and
`translucent` are no-ops under edge-to-edge.

**Verified:** `24-FIXED-dark-1.0.png` — the clock and icons are light on the
dark ground; `23-FIXED-light-1.3.png` — dark on the light ground.

**Residual:** this follows the _theme_. `WelcomeScreen` and `LeaderboardScreen`
paint a fixed dark brand ground in **both** themes and still want
`light-content` regardless. They need a screen-level `statusBarStyle`. Recorded,
not guessed at.

### D5 — NOT SHIPPED · root-caused, fix verified, then deliberately reverted

The naive fix does not work, and the working fix makes today's build worse. Both
statements were established on the device, not reasoned about.

1. **`values-night/colors.xml` alone changed nothing**
   (`25-D5-coldstart-systemdark.png` — still cream). Cause: `AppTheme` inherits
   `Theme.AppCompat.Light.NoActionBar`, and a `.Light` parent pins AppCompat's
   night mode off, so `-night` resources are never selected.
2. **Switching the parent to `Theme.AppCompat.DayNight.NoActionBar` fixed it**
   (`26-D5-coldstart-daynight.png` — `#121212`), with light unaffected
   (`27-D5-coldstart-systemlight.png` — still cream).
3. **And that is why it was reverted.** `values-night` follows the **system**,
   not the app's theme. With the shipped default at `light`, a user whose
   _system_ is dark would get a dark window followed by a light app —
   `28-MISMATCH-lightdefault-systemdark.png` confirms the dark window under a
   light default. Today those users see cream → cream, which is consistent.
   Shipping this would trade one flash for a worse one.

**The recipe is verified and recorded; it belongs in the same change as the
`auto` flip, not before it.** The alternative — making the native window follow
the app's _persisted_ preference rather than the system — is the complete fix
and needs the theme mirrored into SharedPreferences plus
`AppCompatDelegate.setDefaultNightMode` at startup.

`git status` on `android/` is clean; nothing from this investigation shipped.

---

## 5. NOT verified — and why

**This is the load-bearing section of this report.** The following were in the
brief and were **not** exercised. None of them should be read as passing.

### 5.1 Every authenticated screen

`Home`, `Search`, `Favorites`, `Orders`, `Order Details`, **`Checkout`**,
`Profile`, **`Settings` (the theme control itself)**, `Loyalty`, `Leaderboard`
and the **entire driver flow** sit behind login. No backend was running, and the
device has no stored session
(`[Auth] Loaded from Keychain {"hasTokens":false}`).

That means the surfaces this migration changed _most_ — Checkout and the driver
screens in Phases 4–6 — have **not** been seen on a device. Their dark mode is
proven only by the resolved-style baselines.

Unblocking this needs a reachable backend or a seeded session.

### 5.2 French and Arabic / RTL

The in-app language control is inside Settings (auth-gated), and RTL requires
the app's `forceRTL` + restart path. The device locale cannot be changed without
root (`run-as` is blocked, `su` is absent on this BlueStacks image).

**No RTL claim in this migration has been verified on a device.** Alignment,
absolute positioning, directional icons, dropdown indicators, modal and
bottom-sheet positioning and selected states in Arabic are all unverified.

### 5.3 Screen sizes

`wm density 360` did not produce a re-layout in the running app before capture,
so 320 / 390 / 430 dp were **not** verified. Only the native 480 dp was
observed.

### 5.4 Interaction

Keyboard appearance and overlap, scrolling, modals, bottom sheets, dropdowns,
selects and navigation transitions were not exercised — all live behind auth or
require the screens in §5.1.

### 5.5 Accessibility

Touch-target sizes, screen-reader label and state announcements, and
reduced-motion behaviour were not measured on device. Contrast was checked
numerically in `themeContrast.test.ts`, not by an on-device sampler.

---

## 6. Test-harness honesty

To reach dark and auto without a login, `App.tsx`'s `defaultTheme` was edited
locally to `'dark'` and then `'auto'`, and reverted. The committed default is
**`light`**, and `git status` on `App.tsx` is clean at the time of writing.
Nothing in §3 depends on that edit other than which theme was active.

Device state was restored afterwards: `font_scale=1.0`, `density=240`,
`uimode night=no`.

---

## 6b. Still not done — the authenticated path

The brief asked for a repeatable authenticated device path (deterministic
account, dev backend, mocked API, or injected session) so that Home, Search,
Favorites, Orders, Order Details, Checkout, Profile, Settings, Loyalty,
Leaderboard and the driver screens could be rendered.

**That was not built in this round.** The five findings above consumed it, and
D3 turned out to be an app-wide atom bug rather than two strings, which widened
the work. Nothing was weakened in production authentication, because nothing was
touched.

Consequence, unchanged from the previous round: **the surfaces this migration
altered most have still never been rendered on a device.** Checkout and the
driver flow are proven only by resolved-style baselines.

The cheapest option of the four is mocking the API layer behind the real
navigation path - it needs no backend and no production auth change - and it is
what the next round should build first.

---

## 7. Verdict for Phase 6.6

**Do not change `defaultTheme` to `auto`.** `App.tsx` is unchanged and
`git status` on it is clean.

The blocking reason has changed, and that is worth stating plainly. Last round
it was D1, a live P0. That is now fixed and verified on the device. What blocks
it now is **coverage, not known defects**:

- The authenticated surfaces have still never been rendered (§5.1, §6b).
  Checkout and the driver flow are the screens this migration changed most.
- French and Arabic/RTL remain unverified (§5.2). **No RTL claim anywhere in
  this migration has been checked on a device.**
- D5 is unshipped by design, and its correct fix is coupled to this very flip.

### The gate, restated

| Precondition                    | State                                                                  |
| ------------------------------- | ---------------------------------------------------------------------- |
| D1 resolved                     | **yes** — verified at 1.3× on device                                   |
| D2 resolved                     | **yes** — verified in dark on device                                   |
| D3 resolved                     | **yes** — verified in dark; root cause was app-wide                    |
| Authenticated surfaces rendered | **no**                                                                 |
| No P0/P1 dark-mode blockers     | **none known** — but only across the screens reachable without a login |
| Device audit passes             | **partially** — §5 is still large                                      |

"No P0/P1 blockers remain" is only true of what has been looked at. Two rounds
of this exercise have each found a P0 or P1 on the first screen examined, and
most screens have not been examined.

### Order for the next round

1. Build the mocked-API authenticated path (§6b).
2. Render and audit §5.1 in both themes.
3. Cover French and Arabic/RTL.
4. Ship D5's verified recipe **together with** the `auto` flip, not before it.
5. Re-run this report, then reconsider the default.
