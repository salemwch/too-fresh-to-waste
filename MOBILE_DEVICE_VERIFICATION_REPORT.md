# Mobile Device Verification Report — Phase 6.5

**Status:** PARTIAL — auth-gated screens were not reachable (see §5) **Date:**
2026-08-26 **Build under test:** `assembleDevDebug` from the working tree at
`4da1cb37`, installed as `com.toofreshtowaste.app.dev`, JS served by Metro.
**Default theme during test:** `light` — unchanged, and unchanged in git.

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

## 7. Verdict for Phase 6.6

**Do not change `defaultTheme` to `auto`.**

Two independent reasons, either sufficient:

1. **D1 is a P0** and is not theme-specific — it is a live accessibility defect
   in the current light-mode build.
2. **The screens that matter most are unverified** (§5.1). Turning on `auto`
   would put every dark-phone user onto a dark Checkout and a dark driver flow
   that no one has looked at.

The mechanism is sound — §3.2 shows `auto` works exactly as intended. It is the
_content_ that is not ready, not the switch.

### Recommended order

1. Fix **D1** (P0, ships today's users a broken form at 1.3×).
2. Fix **D2** and **D3**, then add an `Input` matrix entry.
3. Get a session onto the device and re-run §5.1 and §5.2.
4. Re-run this report.
5. Only then reconsider `auto`.
