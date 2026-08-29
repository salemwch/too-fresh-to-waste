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

---

---

# Part 2 - Authenticated Device Verification

**Date:** 2026-08-29 **Status:** partial - not certified

Dark mode was not enabled at any point in this pass. `DARK_MODE_ENABLED` is
still `false`, `defaultTheme` is still `light`, and the device stayed in light
(`mCurUiMode=0x11`) for every capture.

---

## 16. How authentication was reached

The blocker recorded in Part 1 §12 was that every authenticated screen sat
behind a login that could not be performed: `.env.development` pointed at the
**production** API, Google Sign-In fails on this rig, and entering a password is
not something I will do.

Two pieces now solve it, and **neither touches authentication**:

| Piece                           | What it does                                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `tools/dev-mock-api/server.mjs` | Serves the real backend's response envelope from `localhost:8787` with fixture data                    |
| `src/dev/devSession.ts`         | Writes the same three `SecureStorage` entries a real login writes: tokens, user JSON, session metadata |

The app's own `loadStoredAuthAsync` then finds them on boot and authenticates
exactly as it always does. There is no bypass, no new Redux action, no relaxed
guard, and no branch inside any auth code path.

**Confirmed on device**, from logcat:

```
auth/loadStoredAuth/fulfilled   flowState: "authenticated"
auth/syncCurrentUser/fulfilled  flowState: "authenticated"
```

That is the app's normal stored-auth boot path, unmodified.

### The fixture had to satisfy the app's own token validation

The first attempt authenticated and then dropped the session 64 seconds later:

```
[TOKEN-VALIDATOR] Refresh token has invalid format | parts: 2
[AUTH-MIDDLEWARE] Refresh token missing or malformed, clearing session
```

`utils/tokenValidator.ts` requires a three-part JWT shape. **The fixture was
changed to conform; the validator was not relaxed to accept the fixture.** That
distinction is the whole point of the exercise.

### Three gates, unchanged from the previous pass

`__DEV__`, `ENABLE_DEV_AUTH === 'true'`, and an API base URL on
localhost/127.0.0.1/10.0.2.2. 26 tests, mutation-checked. Pre-flight for this
run confirmed `.env.production` and `.env.staging` still point at their real
APIs and carry no `ENABLE_DEV_AUTH`.

---

## 17. A pre-existing bug this uncovered - dev and staging never read their .env

**Severity: P1. Fixed, because it blocked everything else.**

The dev build ignored the changed `API_BASE_URL` entirely. `BuildConfig.java`
held the right value and the app still read `http://localhost:3000` - the
hardcoded fallback in `src/config/environment.ts`.

Cause: `applicationId` is `com.toofreshtowaste.app` with
`applicationIdSuffix ".dev"`, so the runtime package is
`com.toofreshtowaste.app.dev` while `BuildConfig` is generated into
`com.toofreshtowaste.app`. `react-native-config` resolves `BuildConfig` by the
runtime package name, missed, and returned an **empty config** - so every
`Config[...]` read in JS fell through to its fallback.

**Consequence:** dev and staging builds have never read their `.env` files. They
ran with fallback API URLs and placeholder Firebase, Maps and storage-encryption
values.

**Production was never affected** - it sets no `applicationIdSuffix`, so its
package already matched.

Fixed by adding
`resValue "string", "build_config_package", "com.toofreshtowaste.app"` to the
`dev` and `staging` flavors, which is the documented remedy.

---

## 18. Screens: reached, and not reached

| Screen                                         | Status                     | Evidence                                                   |
| ---------------------------------------------- | -------------------------- | ---------------------------------------------------------- |
| **Home**                                       | **VERIFIED**               | Rendered with live content; five colour measurements below |
| Location modal (`LocationSelectionModal`)      | **VERIFIED**               | Rendered; a P1 contrast defect found in it                 |
| Manual location search (`ManualLocationModal`) | **VERIFIED** (empty state) | Rendered; borders measured                                 |
| Global error boundary                          | **VERIFIED**               | Rendered; off-palette CTA found                            |
| Search                                         | **NOT REACHED**            | Blocked - see §20                                          |
| Favorites                                      | **NOT REACHED**            | Blocked                                                    |
| Orders                                         | **NOT REACHED**            | Blocked                                                    |
| Order Details                                  | **NOT REACHED**            | Blocked                                                    |
| Checkout                                       | **NOT REACHED**            | Blocked                                                    |
| Profile                                        | **NOT REACHED**            | Blocked                                                    |
| Settings                                       | **NOT REACHED**            | Blocked                                                    |
| Loyalty                                        | **NOT REACHED**            | Blocked                                                    |
| Leaderboard                                    | **NOT REACHED**            | Blocked                                                    |
| Driver screens                                 | **NOT REACHED**            | Blocked                                                    |

**Home is the first authenticated screen ever rendered on a device in this
project.** The rest remain unverified and are not claimed otherwise.

---

## 19. Home - measured

All values sampled from the framebuffer, not judged by eye.

| Element                                      | Rendered  | Role               | Ratio                 | Verdict                                                  |
| -------------------------------------------- | --------- | ------------------ | --------------------- | -------------------------------------------------------- |
| **Home search placeholder**                  | `#616161` | `onSurfaceVariant` | **5.93** on `#FAFAFA` | **M16-a VERIFIED** (was `#9E9E9E`, 2.57)                 |
| **OfferCard pickup line**                    | `#616161` | `onSurfaceVariant` | **5.93**              | **M16-a VERIFIED**                                       |
| **OfferCard struck price**                   | `#616161` | `onSurfaceVariant` | **5.93**              | **M16-a VERIFIED**                                       |
| OfferCard title                              | `#424242` | `onSurface`        | 9.0                   | unchanged, correct                                       |
| **OfferCard divider**                        | `#E0E0E0` | `outlineVariant`   | -                     | **M17 VERIFIED** - card dividers did **not** get heavier |
| `ManualLocationModal` field border (focused) | `#1E4448` | `primary`          | -                     | focus state correct                                      |
| `ManualLocationModal` Cancel border          | `#1E4448` | `primary`          | -                     | correct                                                  |

Home rendered its donation card, the community-goal banner ("Autumn Challenge
1,240 / 2,000 bags"), the "Urgent Deals" carousel with `OfferCard`s showing "3
left", the SOS badge and "TND24.00 -> TND8.00", and the bottom tab bar. Loading
skeletons and the location empty state were also observed.

**One of the two items the brief named specifically - the Home search
placeholder - is now verified.** The other, `OrderCard`'s establishment line, is
still **NOT REACHED** (Orders tab, §20). Note that `OfferCard` (Home) and
`OrderCard` (Orders) are different components; only the former was reached.

---

## 20. Why the remaining screens were not reached

A location gate, not a design problem.

`LocationSelectionModal` is presented modally over the tab navigator whenever
`location.coordinates` is null, with a scrim that swallows taps on the tab bar.
It offers two ways out, and on this rig neither completes:

1. **"Use my current location"** - BlueStacks has no GPS fix. The app correctly
   surfaces `GPS signal not found. Please try again or search for your city.`
2. **City search** - issues `POST /geolocation/geocode`. The fixture was
   corrected to the real `GeocodeResult[]` shape from
   `packages/shared/src/types/geo.types.ts:145`
   (`{ coordinates, displayName, address }`), and results still did not bind.

This is an environment and fixture limitation. **It is not evidence of a defect
in the app**, and it is not recorded as one.

### What would unblock it next time

Seed `location.coordinates` alongside the auth fixture. The location slice is
Redux persisted to MMKV rather than Keychain, so the current seeder cannot reach
it - that is a known extension, not a redesign.

---

## 21. Findings

### DL-7 - `LocationSelectionModal` GPS error fails AA - **P1** - NOT FIXED

Measured on device: **`#D32F2F` text on `#FFEBEE`** = **4.36**, under the 4.5 AA
floor. The paired token `onErrorContainer` `#C62828` is **4.92**.

This is the same defect class as DL-1, at a site DL-1's fix did not reach - and
**`containerPairing.test.ts` does not catch it**. The gate scans 14 lines past a
container background; here the container style is defined at
`LocationSelectionModal.tsx:91` and applied at line 167, so the foreground sits
outside the window. The gate was described as necessary-not-sufficient when it
was written; this is the concrete proof.

Recorded, not fixed, per the instruction to record first.

### DL-8 - global error boundary is off-palette - **P2** - NOT FIXED

The `Something went wrong` fallback renders its "Try Again" CTA in **`#1976D2`**

- Material Blue, the `info` ramp - where the brand primary is `#1E4448` teal.
  White on it is 4.6, so it is legible; it is simply not this product's colour.
  The heading at `#D32F2F` on the cream ground is 4.53 and passes.

### DL-9 - Home search field has no perceivable boundary - **P2** - NOT FIXED

The field fill is `#FAFAFA` on a `#F9F3F0` page: **1.05**. Its edge is
`#EEEEEE`: **1.06**. WCAG 1.4.11 asks 3.0 of a boundary that identifies a
control. Only the placeholder text makes the field findable.

`HomeSearchBar` uses its own local colour constants and never reads
`colors.outline`, so M17 did not touch it.

### DL-10 - components crash on unexpected API shapes - **P2** - NOT FIXED

Three separate red-screens during this pass, each from a field being absent
rather than wrong:

| Component                      | Read                            | Result                                      |
| ------------------------------ | ------------------------------- | ------------------------------------------- |
| `useAppVersionCheck.ts:26`     | `minVersion.split('.')`         | `Cannot read property 'split' of undefined` |
| `MonthlyBagGoalBanner.tsx:117` | `stats....toLocaleString()`     | `...of undefined`                           |
| `OfferCard.tsx:345`            | `offer.pricing.discountedPrice` | `...of undefined`                           |

`useAppVersionCheck` wraps its _fetch_ in try/catch but not its _parse_, so a
malformed response white-screens rather than skipping the check. `OfferCard`
reads `offer.pricing.*` with no optional chaining in three places.

These were provoked by fixture shapes, so they are **not** proof of a production
defect. They are recorded because the same class of failure would follow any
backend field rename, and the blast radius is the whole tree via the error
boundary.

### DL-11 - stale persisted query cache survives fixture changes - observation

Corrected fixtures appeared to have no effect across several relaunches. The
cause was the React Query cache persisted to MMKV still holding offers from the
first broken fixture: `force-stop` does not clear it, only `pm clear` does.
Worth knowing for anyone debugging against this mock, and worth knowing
generally - a bad payload can outlive the deploy that caused it.

### DL-12 - one native crash, not reproduced - observation

A single `Fatal signal 11 (SIGSEGV)` on the `mqt_v_js` thread during a cold
start, before any network request. It did not recur across roughly a dozen
subsequent launches. Recorded for completeness; on the evidence available this
is rig flakiness rather than an app defect.

---

## 22. Not covered in this pass

Stated plainly rather than implied:

- **Localization** - English only. No French or Arabic/RTL pass was run on the
  authenticated side.
- **Font scaling** - 1.0x only. No 1.3/1.5/2.0 pass on the authenticated side.
- **Interaction** - no modal/bottom-sheet/dropdown/keyboard/scroll matrix beyond
  what Home and the location modal exercised.
- **Accessibility** - no touch-target, label or state-announcement audit on the
  authenticated screens.
- **The states the brief listed** - disabled controls, switches, skeletons,
  error, loading, empty, success: only **skeletons**, **empty** (manual
  location) and **error** (GPS, error boundary) were observed. Disabled controls
  and switches were not reached.
- **M13 touch targets** - still NOT REACHED. Both live behind Leaderboard and
  the Search filter sheet.

---

## 23. Verification gate

| Check                         | Result                                   |
| ----------------------------- | ---------------------------------------- |
| `tsc --noEmit`                | clean                                    |
| `eslint src index.js --quiet` | clean                                    |
| Unit tests                    | **112 suites, 1771 tests** passed        |
| Snapshots                     | 422 passed                               |
| Dev-session isolation tests   | 26 passed, mutation-checked              |
| Android dev debug build       | BUILD SUCCESSFUL, installed and launched |

---

## 24. Still open for a product or design decision

- **DL-7** - one line, but it is the third instance of the container-pairing
  class; the question is whether to widen `containerPairing.test.ts` beyond line
  proximity or accept that it is a partial net.
- **DL-8** - what the error boundary's CTA should look like in brand terms.
- **DL-9** - whether the Home search field should carry a perceivable boundary,
  which is a visible change to the most-seen screen.
- **DL-10** - whether to harden the three call sites, or accept that a backend
  contract change red-screens the app.
- Everything still open from `MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md` §6.

**The design system is not certified, and this pass does not certify it.**
