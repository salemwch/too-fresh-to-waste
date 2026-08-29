# Mobile Light-Mode Device Verification

**Date:** 2026-08-29 **Scope:** the changes in
`MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md` (M16-a, M17, M18, M13) **Status:** not
certified

Dark mode was not enabled at any point. The device stayed in light
(`mCurUiMode=0x11`) for every capture, `DARK_MODE_ENABLED` is still `false`, and
`defaultTheme` is unchanged.

---

## 1. The rig

|                    |                                                         |
| ------------------ | ------------------------------------------------------- |
| Emulator           | BlueStacks, reporting as `samsung SM-S908E`             |
| Android            | 9 (API 28), `x86_64`                                    |
| Screen             | 720 × 1280 px                                           |
| Density            | 240 dpi (hdpi, 1.5×) → **480 × 853 dp**                 |
| Default font scale | 1.0                                                     |
| UI mode            | light, `mCurUiMode=0x11`                                |
| Build              | **dev build, JS served by Metro** — not the release APK |
| Locales installed  | `en-US`, `fr-FR`, `ar-EG`, `ar-TN`                      |

### Caveats that limit what this proves

- **It is an emulator, not hardware.** BlueStacks pre-grants runtime permissions
  and has deviated from real devices before (see `android_repro_rig_bluestacks`
  in project memory). Nothing here substitutes for a physical phone.
- **480 dp logical width** is narrow. Text fits more easily on a wider device
  and less easily on a 320 dp one; neither was tested.
- **Android 9 (API 28)** is older than the app's normal target.
- The JS came from Metro, so this verifies the **source**, not the R8-minified
  release bundle.

---

## 2. Method

Colour claims are **measured, not eyeballed.** Each screenshot was decoded with
`pngjs` and sampled pixel by pixel, reporting colour runs along a scan line. A
claim like "the border is `#757575`" below means those bytes were read out of
the framebuffer, not that it looked about right.

Contrast ratios are computed from those sampled values with the same WCAG
relative-luminance formula the token tests use.

---

## 3. What was actually rendered

| Screen                                    | Locales              | Font scales        |
| ----------------------------------------- | -------------------- | ------------------ |
| Onboarding / Welcome                      | en, fr, **ar (RTL)** | 1.0                |
| Login                                     | en, fr, **ar (RTL)** | 1.0, 1.3, 1.5, 2.0 |
| Register                                  | en                   | 1.0                |
| Password-rules dropdown (unmet + all-met) | en                   | 1.0                |
| Forgot Password                           | en                   | 1.0                |
| Google Sign-In error banner               | en                   | 1.0                |
| Login with keyboard open                  | ar                   | 1.3                |

**Locales: all three** (`en-US`, `fr-FR`, `ar-EG`). Reached by reordering the
device language list through Android Settings and then `pm clear`-ing the app,
because the app reads a stored language first and only falls back to the device
locale. The app's own language control lives in `SettingsScreen`, which is
behind a login.

**Font scales: 1.0, 1.3, 1.5, 2.0** — each with a **cold start**. §6 explains
why that qualifier decides the whole result.

---

## 4. M17 — control boundaries vs dividers

The central question was whether control borders actually darkened and dividers
actually did not. Both confirmed, by measurement:

| Element                       | Rendered  | Token                             | Ratio                 | Floor              |
| ----------------------------- | --------- | --------------------------------- | --------------------- | ------------------ |
| Email/password field border   | `#757575` | `outline` = `neutral[600]`        | **4.41** on `#FAFAFA` | 3.0 ✅             |
| "Remember me" checkbox border | `#757575` | `outline`                         | 4.41                  | 3.0 ✅             |
| "OR" divider rule             | `#E0E0E0` | `outlineVariant` = `neutral[300]` | 1.26                  | none (decorative)  |
| Focused field border          | `#1E4448` | `primary`                         | —                     | focus state intact |

**Dividers did not become heavier.** `#E0E0E0` is exactly what they rendered
before M17 — `outlineVariant` inherited `outline`'s old value precisely so this
would be true, and the device confirms it.

Both hold identically in Arabic: border `#757575`, divider `#E0E0E0`.

### Not reachable

Disabled controls, switches and skeleton surfaces are all behind a login or a
loading state I could not trigger without submitting a form. **The disabled
button border fix — six `Button` variants moved to `outlineVariant` so they
would not darken — is verified only by snapshot, not on the device.**

---

## 5. M16-a — low-contrast text and icons

| Element                          | Rendered  | Was       | Ground    | Ratio now | Was  |
| -------------------------------- | --------- | --------- | --------- | --------- | ---- |
| Field label ("Email Address")    | `#616161` | `#9E9E9E` | `#FAFAFA` | **5.93**  | 2.57 |
| Placeholder ("Enter your email") | `#616161` | `#9E9E9E` | `#FAFAFA` | **5.93**  | 2.57 |
| Subtitle                         | `#616161` | `#9E9E9E` | `#FAFAFA` | **5.93**  | 2.57 |
| Password unmet-rule **icon**     | `#616161` | `#9E9E9E` | `#F5F5F5` | **5.68**  | 2.46 |
| Password unmet-rule **label**    | `#616161` | `#9E9E9E` | `#F5F5F5` | **5.68**  | 2.46 |
| Password met-rule label          | `#424242` | unchanged | `#F5F5F5` | 9.0       | —    |

Arabic labels measured `#616161` too, so the fix is locale-independent as
expected.

**Visual hierarchy holds.** Secondary text at `#616161` is still clearly lighter
than primary text at `#424242`; the two roles remain distinguishable. Nothing
read as unexpectedly heavy at 1.0×.

### Not reachable

**`OrderCard`'s establishment line and the Home search placeholder — the two
sites the brief named specifically — were not rendered.** Both are behind
authentication. See §8.

---

## 6. Font scaling — and a false alarm I nearly filed

This is the most important methodological point in the report.

Setting `font_scale` on the **running** app produced text truncated mid-word
with no ellipsis: "Password" → "Passw", "Email Address" → "Email", "OR" → "O",
"Welcome Back" → "Welcome". At 2.0× the screen was unusable, with glyphs clipped
vertically as well. It looked exactly like device finding D1 returning.

It was not. **The layout had not re-flowed at all** — the card, the Sign In
button and every row sat at pixel-identical positions to 1.0×, while only glyph
sizes changed. That is stale layout, not bad layout.

Cold-starting the app at the same font scale renders correctly:

| Scale | Cold-start result                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| 1.0   | correct                                                                                                     |
| 1.3   | **correct** — every string complete, "By signing in…" wraps to two lines                                    |
| 1.5   | correct                                                                                                     |
| 2.0   | **correct** — "Welcome Back" wraps to three lines, subtitle to two, "Forgot Password?" drops to its own row |

Measured reflow, cold start: the email field's y-position moves 442 → 482 → 510
as the text above it grows. **D1 is genuinely fixed**, and the `flexWrap` /
`flexShrink` work behind it does what it claims.

Had I stopped at the first observation I would have reported a P1 regression
that does not exist. The generalisable lesson, and the reason it is written
here: **changing `font_scale` on a running app is not a valid way to test font
scaling.** Force-stop and relaunch.

---

## 7. M18 — no live consumer, and no improvement claimed

The brief said not to claim a visual improvement for unreachable code paths.
There is none to claim.

`onWarningContainer`'s only consumer is `PasswordStrengthIndicator`'s warning
banner, and it is unreachable: it needs all five basic password rules met
**and** `strength.score < 2`, but the rules force length ≥ 12 with all four
character classes, so the entropy floor is 12 × log2(94) ≈ 78.6 bits — score 3.

Confirmed on the device from **both** directions:

- typed `abc` (rules unmet) → rules dropdown shows, **no banner**
- typed a password satisfying every rule → dropdown collapses, **no banner**

`onInfoContainer` has zero consumers anywhere in `src` (`toast.tsx`'s
`infoContainer` is a local StyleSheet key, not the token).

So the M18 token fix remains correct and remains invisible. It buys nothing
today and prevents a 2.81 banner the moment anyone loosens the length rule.

---

## 8. M13 — not verified

Both fixed touch targets are behind authentication:

- `ChallengeHeader.infoBtn` — Leaderboard
- `FilterBottomSheet.closeButton` — Search filters

**Neither was rendered, so neither the 44 px target nor the absence of overlap
was checked on the device.** The `hitSlop` values are arithmetically correct
((44 − 36)/2 = 4, (44 − 32)/2 = 6) and gated by
`design-system/__tests__/touchTargets.test.ts`, and that is all that can be said
today.

---

## 9. Issues found

### DL-1 — error banner text fails AA · **P1** · FIXED, device-verified

Google Sign-In fails on this rig ("Could not retrieve credentials"), which
rendered an error banner nobody had looked at. Sampling it gave **`#D32F2F` text
on `#FFEBEE`** — the bare `error` token on `errorContainer`, measuring **4.36**,
under the 4.5 AA floor. The paired token `onErrorContainer` `#C62828` is 4.92.

Seven sites had it. All now use the paired token:

`GoogleSignInButton`, `ReviewModal`, `VerifyEmailScreen`, `EditProfileScreen`,
`SecurityScreen`, `ResendVerificationModal` (icon only — its label was already
correct, so the row had two different reds).

**Re-measured on the device after the fix: `#C62828` on `#FFEBEE` = 4.92.**

Why no test caught it: `themeContrast.test.ts` checks that the _tokens_ pair
correctly, and they do. These sites simply did not use the paired token. And
**none of the 422 snapshot baselines renders an error banner** — fixing all
seven changed zero baselines. Token correctness and usage correctness are
different properties needing different tests, which is now
`tokens/__tests__/containerPairing.test.ts`.

### DL-2 — pending-verification icon fails 1.4.11 · **P2** · FIXED, not device-verified

`VerifyEmailScreen`'s status icon paints `colors.warning` `#F57C00` on
`warningContainer` `#FFF3E0` = **2.47**, under the 3.0 floor for a graphic that
carries meaning — and this icon is the only thing distinguishing the pending
state from the error state. Moved to `onWarningContainer` (5.08).

Only the warning branch moved; the other two were measured and pass (`primary`
on `primaryContainer` 7.45, `error` on `errorContainer` 4.36). The pending state
needs a real verification link to reach, so **this fix is not device-verified.**

### DL-3 — French onboarding heading collides with its body copy · **P2** · NOT FIXED

French wraps the onboarding heading to four lines where English takes three
("SAUVEZ LA NOURRITURE" alone occupies two), consuming the gap before the
paragraph. Measured separation: **2 px at x=60, 5 px at x=250**. No pixel
overlap, but effectively zero spacing, and it reads as collision.

Not caused by this pass — the changes were colour-only, proven by 0 non-colour
drift across 268 baseline lines. Arabic does not have it (3 lines, clean gap).

Smallest fix: give the heading block a `marginBottom` from the spacing scale, or
cap the heading's `numberOfLines` and let the type scale down. Both are layout
changes to a screen this pass was not scoped to touch.

### DL-4 — the Google button label never localises · **P2** · NOT FIXED

"Continue with Google" stays English in French and Arabic. It is baked into
`assets/images/android_light_rd_ctn.svg`, Google's own branded asset. Google
ships localised variants; the fix is an asset swap per locale, governed by
Google's branding rules. Not something to improvise in a verification pass.

### DL-5 — the app does not re-flow when font scale changes while running · **P3, observation**

Described in §6. `fontScale` is **not** in the manifest's `configChanges`, so
Android should recreate the Activity and it evidently did not here. Whether that
is a BlueStacks quirk or real Android 9 behaviour cannot be settled on this rig,
and a user changing font size usually does so with the app backgrounded.
Recorded rather than actioned.

### DL-6 — `Input` has a fixed height that never scales · **P3, observation**

The field box measured **exactly 66 px at every font scale from 1.0 to 2.0** —
it does not grow by one pixel. `Input.styles.ts:189` sets
`height: sizeStyles[size].minHeight`, commented "Fixed height, not minHeight".

Benign today: 44 dp of box holds the placeholder even at 2.0× on this density,
and nothing clipped. It is latent, not active — the box cannot reflow, so a
larger scale, a taller script, or a two-line value will clip. The one-word fix
(`height` → `minHeight`, three occurrences) would move every form field in the
app and needs its own verification cycle.

---

## 10. Issues fixed during this pass

| ID   | Severity | Fix                           | Verified on device         |
| ---- | -------- | ----------------------------- | -------------------------- |
| DL-1 | P1       | 7 sites → `onErrorContainer`  | **yes** — re-measured 4.92 |
| DL-2 | P2       | 1 icon → `onWarningContainer` | no — state unreachable     |

Both are usage-site fixes; no token changed, and **no snapshot baseline
changed** — which is itself the finding recorded under DL-1.

New gate: `tokens/__tests__/containerPairing.test.ts`, which asserts a status
container's foreground is its paired `on*Container` token. It scans within 14
lines of a container background (file-wide scoping produced false positives such
as a required-field asterisk), carries a negative control, a border-exclusion
control, and three reviewed icon exemptions each recorded with its measurement.
Mutation-checked: reverting the Google banner turns it red.

---

## 11. Issues still pending

| ID                                        | Severity | Status                                    |
| ----------------------------------------- | -------- | ----------------------------------------- |
| DL-3 French onboarding collision          | P2       | open — layout change, out of scope here   |
| DL-4 Google button not localised          | P2       | open — needs Google's localised assets    |
| DL-5 no re-flow on live font-scale change | P3       | open — rig-ambiguous                      |
| DL-6 `Input` fixed height                 | P3       | open — latent; fix moves every form field |

Everything left open from `MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md` §6 also
remains open: 120 off-scale font sizes, 248 off-grid spacing values, 104
off-scale radii, 92 hardcoded strings, 18 files bypassing the design-system
`Button`, and both dark-theme halves of M17 and M18.

---

## 12. Screens that could **not** be reached

No claim of verification is made for any of these.

**Behind authentication** — Google Sign-In fails on this rig, and I did not
enter a password:

Home (and the search placeholder), Search, `FilterBottomSheet`, Favorites,
Orders, **`OrderCard`**, Order Details, Checkout, Profile, Settings (including
the language and appearance controls), Loyalty, Leaderboard
(**`ChallengeHeader`**), and the entire driver flow — including the six strings
translated in the previous pass, whose French and Arabic renderings are **not**
device-verified.

**Reachable but not triggered:** disabled buttons, switches, skeleton loading
surfaces, the email-verification pending state (DL-2's fix), and any bottom
sheet or modal.

**Consequence:** the two M16-a sites the brief named specifically —
`OrderCard`'s establishment line and the Home search placeholder — remain
unverified on a device, as does every M13 fix.

---

## 13. General checks

| Check                  | Result                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scrolling              | Register and Forgot Password scroll; content reachable behind the keyboard                                                                             |
| Keyboard overlap       | Focused field stays fully visible above the keyboard (verified in Arabic at 1.3×)                                                                      |
| Safe areas             | Status bar not overlapped; content starts below it in all three locales                                                                                |
| Navigation             | Login ↔ Register ↔ Forgot Password, and hardware back, all behaved                                                                                     |
| RTL mirroring          | **Correct** — input icons move right, password-visibility eye moves left, checkbox and "forgot password" swap sides, onboarding skip moves to the left |
| Touch-target usability | Not assessed — both fixed targets are behind a login                                                                                                   |
| Modals / bottom sheets | Not reached                                                                                                                                            |

---

## 14. Verification gate

| Check                | Result                                                        |
| -------------------- | ------------------------------------------------------------- |
| `tsc --noEmit`       | clean                                                         |
| `eslint src --quiet` | clean                                                         |
| Unit tests           | **111 suites, 1745 tests** passed                             |
| Visual regression    | **422 snapshots** passed, **zero drift** from the seven fixes |

---

## 15. Not certified

The design system is **not** certified and this pass does not certify it.

What this pass establishes: on one emulator, in three locales, at four font
scales, across six pre-login screens, M17 and M16-a render the values they were
supposed to render, M18 has no live consumer, and D1 is genuinely fixed.

What it does not establish: anything about the authenticated half of the app,
which is where `OrderCard`, Checkout and the driver flow live; anything about
real hardware; anything about the release bundle; and anything about the M13
touch-target fixes, which were never rendered.
