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

---

---

# Part 3 - Authenticated Sweep, Location Blocker Removed

**Date:** 2026-08-30 **Status:** substantially complete - not certified

Dark mode was not enabled at any point. `DARK_MODE_ENABLED` is still `false`,
`defaultTheme` is still `light`, and the device stayed in light mode
(`mCurUiMode=0x11`) for every capture in this pass.

---

## 25. The blocker, and how it was removed

Part 2 §20 recorded ten screens as NOT REACHED behind `LocationSelectionModal`,
which is presented over the tab navigator whenever `location.coordinates` is
null and whose scrim swallows every tab tap.

`src/dev/devLocation.ts` dispatches **`setManualLocation`** - the same action
the real city-search flow dispatches - once the store has rehydrated.

The existing schema was inspected before anything was written, as instructed,
and reused rather than duplicated:

| Concern           | What was reused                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Action            | `setManualLocation` from `store/slices/locationSlice.ts`                                          |
| Payload           | the slice's own `{ coordinates: LocationCoordinates, name: string }`                              |
| Reducer behaviour | sets `source: 'manual'`, clears the GPS name cache - identical to a real pick                     |
| Persistence       | redux-persist through the existing `locationTransform`, which strips only `error` and `isLoading` |

No parallel state format, no direct MMKV write, no new reducer.

**It does not touch location authorization.** `permissionStatus` is untouched,
no permission is faked, and the production GPS path is unchanged. It also
refuses to overwrite an existing location, so it seeds an empty slice rather
than acting as a reset.

### Rehydration ordering

This subscribes to the store rather than dispatching once, because redux-persist
replaces the slice wholesale when `REHYDRATE` lands - a seed dispatched earlier
is silently discarded and looks exactly like the fixture never ran. Asserted
directly in the tests.

### Isolation

The same three gates as the session seeder, through the same predicate:
`__DEV__`, `ENABLE_DEV_AUTH === 'true'`, and an API base URL on
localhost/127.0.0.1/10.0.2.2.

**15 tests**, mutation-checked: ignoring rehydration fails 5, overwriting an
existing location fails 2, dropping the gate fails 2. One test asserts the only
action dispatched is `location/setManualLocation` and that nothing
permission-related is dispatched.

**Confirmed on device:** the header reads "Chosen Location / Tunis, Tunisia",
the modal never appears, and the Search map centres on Tunis.

---

## 26. Screens reached in this pass

| Screen            | Status                     | Evidence                                                                       |
| ----------------- | -------------------------- | ------------------------------------------------------------------------------ |
| **Home**          | **VERIFIED**               | Content, skeletons, offer carousels; five measurements                         |
| **Search**        | **VERIFIED**               | Google map centred on the seeded location, Map/List toggle, search field       |
| **Orders**        | **VERIFIED**               | Active(3)/History(2), three `OrderCard`s; four measurements                    |
| **Order Details** | **VERIFIED**               | Items, pricing breakdown, pickup details, confirm-pickup OTP field             |
| **Profile**       | **VERIFIED**               | Avatar, points card, leaderboard and impact cards, account list                |
| **Favorites**     | **VERIFIED** (empty state) | Reached; populated list not exercised (§29)                                    |
| **Leaderboard**   | **PARTIAL**                | Skeleton loading state rendered and captured; content blocked by a fixture gap |
| Loyalty           | **NOT REACHED**            | Not navigated to in the time available                                         |
| Settings          | **NOT REACHED**            | Not navigated to                                                               |
| Checkout          | **NOT REACHED**            | Requires an offer-to-checkout flow not driven                                  |
| Driver screens    | **NOT REACHED**            | Requires a driver-role session; the fixture user is a consumer                 |

Seven of the eleven target screens were reached. Four were not, and no
verification is claimed for them.

---

## 27. Measurements

All sampled from the framebuffer.

### 27.1 OrderCard - the last item the brief named

| Element                                       | Rendered  | Was       | Ratio                 | Verdict            |
| --------------------------------------------- | --------- | --------- | --------------------- | ------------------ |
| **Establishment line ("Boulangerie du Lac")** | `#616161` | `#9E9E9E` | **5.93** on `#FAFAFA` | **M16-a VERIFIED** |
| Order number `#TFW-1000`                      | `#616161` | `#9E9E9E` | 5.93                  | M16-a VERIFIED     |
| Pickup line                                   | `#616161` | `#9E9E9E` | 5.93                  | M16-a VERIFIED     |
| Title                                         | `#212121` | unchanged | 15.9                  | correct            |
| Card dotted divider                           | `#EDEDED` | -         | -                     | decorative         |

The establishment line is the site the audit singled out as "the most-seen card
in the app". It was 2.57 and is now 5.93.

### 27.2 Home, Order Details, Profile

| Element                                      | Rendered  | Verdict                                  |
| -------------------------------------------- | --------- | ---------------------------------------- |
| Home search placeholder                      | `#616161` | M16-a VERIFIED (5.93)                    |
| OfferCard pickup line / struck price         | `#616161` | M16-a VERIFIED                           |
| OfferCard divider                            | `#E0E0E0` | M17 - dividers unchanged                 |
| Order Details `#TFW-1000`                    | `#616161` | M16-a VERIFIED                           |
| Profile email                                | `#616161` | M16-a VERIFIED                           |
| Profile "Edit Profile" button border         | `#1E4448` | `primary`, correct for an outline button |
| `ManualLocationModal` field border (focused) | `#1E4448` | focus state correct                      |

---

## 28. Findings

### DL-13 - `OrderCard` misses the entire delivery status chain - **P1** - NOT FIXED

Device-confirmed: an order with `status: 'out_for_delivery'` renders a badge
reading **"UNKNOWN"**.

`OrderCard.tsx:56` declares its **own** `STATUS_CONFIG` covering **10 of the
13** `OrderStatus` values. The three missing are `DRIVER_ASSIGNED`,
`OUT_FOR_DELIVERY` and `DELIVERED` - the whole delivery chain - and all fall
through to `DEFAULT_STATUS = { label: 'Unknown' }`.

The app already has a correct map. `features/orders/utils/orderStatus.ts` covers
all thirteen, is translated, and carries an exhaustiveness test whose own
comment says "an exhaustiveness test now enforces that". **`OrderCard` does not
use it.** The card bypasses the audited map in favour of a private, incomplete,
untranslated copy.

Two defects in one:

1. A delivery order shows the wrong status to the user.
2. Every label in that map is **hardcoded English** - `'Pending'`,
   `'Confirmed'`, `'Ready'`, `'Cancelled'`. Confirmed on device in **both**
   other locales: the French screen shows "Mes commandes / En cours /
   Historique" with **"CONFIRMED" / "READY" / "UNKNOWN"** badges, and the Arabic
   screen shows "طلباتي / نشطة / السجل" with the same English badges.

Evidence: `U2-orders.png` (en), `FR3-orders.png` (fr), `AR4-home-fs13.png` (ar,
1.3x).

### DL-14 - three untranslated strings on the most-seen screens - **P1** - NOT FIXED

Device-confirmed in French **and** Arabic:

| String                          | Location                                   |
| ------------------------------- | ------------------------------------------ |
| "Chosen Location"               | `navigation/components/LocationHeader.tsx` |
| "3 left"                        | `OfferCard` quantity badge                 |
| "Pick up today : 18:00 - 20:00" | `OfferCard` pickup line                    |

Plus, on Orders, "Pickup Today", "1x Bag" and the status labels from DL-13.

These are members of the 92-string backlog catalogued in
`MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md` §4.2 and pinned by
`i18n/__tests__/hardcodedStrings.test.ts`. What is new is that they are now
**confirmed to affect Home and Orders in both non-English locales** - the two
most-seen screens, in the primary commercial language.

### DL-15 - Profile uses three off-palette gradients - **P2** - NOT FIXED

Sampled endpoint colours:

| Card               | Gradient              | In the design system?                                           |
| ------------------ | --------------------- | --------------------------------------------------------------- |
| My Points          | `#025755` → `#2BB498` | start near-brand teal; `#2BB498` mint is not a token            |
| **Leaderboard**    | `#8873F7` → `#5C44E1` | **violet/indigo - entirely foreign**                            |
| **Mercy & Impact** | `#E6726C` → `#BA498D` | coral start is near `accent[500]`; `#BA498D` magenta is foreign |

The brand is teal `#1E4448`, gold `#C4A25A`, coral `#F55449`. Six gradient stops
here, none tokenised. This is `DESIGN.md` hard-rule territory (never invent a
design value; never use raw hex) on a screen every user visits.

### DL-16 - the confirm-pickup code field has no perceivable border - **P2** - NOT FIXED

`ConfirmPickupSection` uses a hardcoded
`FALLBACK_BORDER = colorTokens.base.neutral[300]`, not `colors.outline`.
Rendered `#E0E0E0` on `#FAFAFA` = **1.26**, where WCAG 1.4.11 asks 3.0 of a
boundary that identifies a control. M17 never reached it because it does not
read the token.

Same class as DL-9 (the Home search field). Two now, which suggests the pattern
is "components that predate the token" rather than two isolated misses.

### DL-17 - the same status is styled two different ways - **P2** - NOT FIXED

A `CONFIRMED` order renders as:

- **Order Details** - solid `#2196F3` fill, white text
- **OrderCard** - `#DBEAFE` tint with `#1E40AF` text

Different treatments for the same state on two screens one tap apart, and
`OrderCard`'s pair is Tailwind blue, a palette the MD2 migration removed from
the rest of the app. Documented in part as `DESIGN.md` §19-E25 (status tints
stay literal); the cross-screen inconsistency is new.

---

## 29. Localization and font scale - what was actually run

|                                           | English | French  | Arabic / RTL |
| ----------------------------------------- | ------- | ------- | ------------ |
| Home                                      | 1.0x    | 1.0x    | 1.0x         |
| Orders                                    | 1.0x    | 1.0x    | **1.3x**     |
| Search, Order Details, Profile, Favorites | 1.0x    | not run | not run      |

**RTL mirroring is correct.** On Home: the location pin moves right, the gift
and heart icons move left, the search field right-aligns with its magnifier on
the right, the offer carousel flows right-to-left, the price row reverses, the
tab bar reverses, and the community-goal counter renders Arabic-Indic numerals
(`١,٢٤٠ / ٢,٠٠٠`). On Orders at 1.3x: thumbnails move right, status badges move
left, the price row reverses. **No clipping and no overlap at 1.3x in RTL.**

Not run on the authenticated side: **1.5x and 2.0x**, and French/Arabic for
Search, Order Details, Profile and Favorites.

---

## 30. Interaction and states

| Check                    | Result                                                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation               | Tab bar, card → Order Details, back - all worked once the LogBox overlay was gone                                                     |
| Modals                   | `LocationSelectionModal` and `ManualLocationModal` both rendered and measured                                                         |
| Scrolling                | Home carousels scroll horizontally; Orders and Profile scroll vertically                                                              |
| Loading                  | Home skeletons and the Leaderboard skeleton captured                                                                                  |
| Empty                    | Orders empty state, Favorites empty state, manual-location empty results                                                              |
| Error                    | GPS error banner, global error boundary                                                                                               |
| Success                  | Order Details pricing/confirm-pickup rendered                                                                                         |
| Safe areas               | Content clears the status bar in all three locales                                                                                    |
| Keyboard                 | Verified in Part 1 only; not re-run on authenticated screens                                                                          |
| Dropdowns, bottom sheets | Not exercised                                                                                                                         |
| **Touch targets (M13)**  | **Still NOT REACHED** - `ChallengeHeader` is behind the Leaderboard content that did not load, and `FilterBottomSheet` was not opened |

### A note on why navigation kept failing

Worth recording because it cost several cycles and would cost anyone else the
same: **React Native's LogBox toast occupies `[0,1208][720,1280]`, which is
exactly the tab bar.** While any console error is outstanding, every tab tap
lands on "Dismiss"/"Minimize" instead of the tab. Screenshots look normal, so it
presents as "taps do nothing". Clearing the underlying errors fixed navigation;
`uiautomator dump` is what identified it.

---

## 31. Verification gate

| Check                         | Result                                          |
| ----------------------------- | ----------------------------------------------- |
| `tsc --noEmit`                | clean                                           |
| `eslint src index.js --quiet` | clean                                           |
| Unit tests                    | **113 suites, 1786 tests** passed               |
| Snapshots                     | 422 passed                                      |
| Dev fixture tests             | 41 (26 session + 15 location), mutation-checked |

---

## 32. Environment state

- `.env.production` and `.env.staging` untouched. Verified before this run: both
  still point at their real APIs and carry no `ENABLE_DEV_AUTH`.
- `.env.development` is **still pointed at the local mock** with
  `ENABLE_DEV_AUTH=true`, deliberately, per the instruction not to restore it
  until the sweep is finished. `.env.development.bak` holds the original and is
  now gitignored.
- Device restored to `en-US` at font scale 1.0.
- Release isolation is unchanged and still enforced by tests: `__DEV__`, an
  explicit flag absent from staging and production, and a localhost-only API
  requirement. The mock server is a standalone Node script under `tools/` and is
  never bundled.

---

## 33. Still open

**Screens:** Loyalty, Settings, Checkout and the driver flow were not reached.
The driver screens need a driver-role session; the fixture user is a consumer,
so reaching them needs a second fixture role.

**Matrix:** 1.5x and 2.0x on authenticated screens; French and Arabic beyond
Home and Orders; dropdowns and bottom sheets; keyboard on authenticated screens.

**M13 touch targets remain unverified on a device** across all three passes.

**Product/design decisions:** DL-13 (adopt the shared status map in
`OrderCard`), DL-15 (whether the Profile gradients are sanctioned), DL-16 and
DL-9 (whether control borders that bypass the token should be brought onto it),
DL-17 (one status, one treatment), plus everything still open in
`MOBILE_LIGHT_MODE_REMEDIATION_REPORT.md` §6.

**The design system is not certified, and this pass does not certify it.**

---

# Part 4 - Complete Sweep: All 14 Screens Reached

**Run date:** 2026-08-30 **Device:** BlueStacks (`127.0.0.1:5555`), Android 9
(API 28) **Resolution / density:** 720 x 1280, 240 dpi **Build:**
`com.toofreshtowaste.app.dev` (dev flavour, Metro), backed by the local dev mock
API on `127.0.0.1:8787` **Theme:** light only. `DARK_MODE_ENABLED` is `false`
and `lockToLight` is on; neither was touched. The Settings screen correctly
shows **no** theme control. **Locales run:** `en`, `fr`, `ar` (RTL) **Font
scales run:** 1.0x, 1.3x, 1.5x, 2.0x - each by **cold start**, never by changing
the setting on a running app (see §36 for why that distinction matters)

## 34. Per-screen verdicts

Every screen in the brief was reached in this pass. Nothing is left blocked.

| Screen             | Verdict      | Evidence                                                                    |
| ------------------ | ------------ | --------------------------------------------------------------------------- |
| Home               | **VERIFIED** | Content, carousels, header and search bar; re-measured at all four scales   |
| Search             | **VERIFIED** | Part 3                                                                      |
| Favorites          | **VERIFIED** | Part 3 (empty state; populated list still not exercised)                    |
| Orders             | **VERIFIED** | Part 3                                                                      |
| Order Details      | **VERIFIED** | Part 3                                                                      |
| **Checkout**       | **VERIFIED** | Reached this pass via Offer -> Reserve -> quantity sheet -> Checkout        |
| Profile            | **VERIFIED** | Part 3, re-confirmed here in en/fr/ar                                       |
| **Settings**       | **VERIFIED** | Reached this pass; divider colour measured; renders in all three locales    |
| **Loyalty**        | **VERIFIED** | Reached this pass, after two defects fixed (F1, F3)                         |
| **Leaderboard**    | **VERIFIED** | Reached this pass, after F2 fixed. Podium, rankings, current-user highlight |
| Offer Details      | **VERIFIED** | Reached this pass en route to Checkout                                      |
| Location modal     | **VERIFIED** | Part 2                                                                      |
| Manual location    | **VERIFIED** | Part 2 (empty state)                                                        |
| Driver screens (4) | **VERIFIED** | Commit `f844c6d0`, via the real `UserRole.DRIVER` guard                     |

**NOT REACHABLE: none.**

Two things remain _unexercised_ rather than unreachable, and are called out in
§38: a populated Favorites list, and the terminal "Confirm Order" action on
Checkout. The Checkout screen itself was reached and rendered; the confirm
button was deliberately not pressed.

## 35. Findings, and what was done about each

Recorded first, classified, then fixed - in that order, as the brief required.

### D6 - Chrome clipped text at a 2.0x font scale (P1, FIXED)

Four layouts sized their box in fixed `dp` while the text inside was
font-scaled, so at 2.0x the content outgrew the box.

| Component        | Symptom at 2.0x                                 | Fix                                     |
| ---------------- | ----------------------------------------------- | --------------------------------------- |
| `AppHeader`      | Title overflowed **upward** into the status bar | `height` -> `minHeight`                 |
| `LocationHeader` | Both lines clipped                              | Removed hardcoded `lineHeight: 12 / 18` |
| `HomeSearchBar`  | Placeholder clipped top and bottom              | `height` -> `minHeight`                 |
| `TabNavigator`   | Every tab label clipped along the bottom edge   | Height derived from the OS font scale   |

The header case is worth recording: the toolbar sits _below_
`paddingTop: insets.top`, so an oversized title grows into the status bar rather
than away from it.

`LocationHeader` is the general lesson - `fontSize` scales with the OS setting
and a literal `lineHeight` does not, so any pairing of the two clips at a large
scale. At 1.0x React Native's derived line height lands within a pixel of the
literals it replaces.

The tab bar needed a genuinely different fix. `minHeight` alone did nothing,
because react-navigation's `getTabBarHeight()` reads `height` out of
`tabBarStyle` and applies its own before the caller's. More importantly it
republishes that value through `BottomTabBarHeightContext`, which screens use to
pad their scroll content - so a `minHeight` would have grown the bar while every
screen still padded for the old 56dp, hiding content behind it. The height is
now derived from `PixelRatio.getFontScale()` in
`navigation/utils/tabBarHeight.ts`, calibrated so 1.0x reproduces the previous
56dp exactly, and it can only ever add room, never cap a scale.

**None of this disables or limits font scaling.** No `allowFontScaling={false}`,
no truncation, no hidden content.

Verified on device at 1.0x, 1.3x, 1.5x and 2.0x by cold start. 1.0x is
pixel-identical to before the change.

### D7 - Directional icons did not mirror in RTL (P1, FIXED)

React Native mirrors _layout_ under `I18nManager.isRTL` but not the _glyph_. On
every Arabic screen the back chevron sat correctly on the right edge while still
pointing left, and every disclosure chevron sat on the left edge still pointing
right. Measured, not eyeballed: the chevron apex rendered at column 9 of the
glyph box before the fix and column 24 after it.

Fixed once in the `Icon` atom through a shared name-swap map, so all ~15 call
sites are covered rather than patched one at a time. Swapping the Ionicons name
preserves glyph hinting, which `scaleX: -1` would not.

Media transport controls (`play-back` / `play-forward`) and vertical icons are
deliberately excluded - both Material and the Apple HIG are explicit that those
follow the timeline and the vertical axis, not reading order. `mirrorInRTL` is
the per-call escape hatch.

`OfferDetailsScreen` renders `IoniconsIcon` directly rather than through the
atom, so its two directional sites call the same shared map.

The change is inert in LTR: all 422 visual snapshots render unchanged.

### D8 - Settings dividers rendered black (P2, FIXED)

`borderBottomWidth` with no `borderBottomColor` defaults to **black** in React
Native. Measured after the fix: `rgb(224,224,224)` = `#E0E0E0` = `neutral[300]`
= `outlineVariant`, on both dividers.

### F1 - An unknown loyalty tier crashed My Points (P0 for the screen, FIXED)

`getTierProgress` and `getPointsToNextTier` indexed `TIER_CONFIGS[currentTier]`
with no guard, while `getTierConfig` one function above already had the correct
fallback. `currentTier` is typed `TierName`, but the value arrives over the wire
and a type is not a runtime check - so any unknown tier threw
`Cannot read property 'minPoints' of undefined` and took the whole screen into
the error boundary.

`indexOf` returning `-1` was the second half of the same bug: an unknown tier
cleared the "already at the top tier" guard and then read index `-1 + 1`, so
even without the throw it would have reported progress toward Bronze.

Both now normalise through a shared `normalizeTier`.

Membership is tested against a **Set of own keys**, not
`TIER_CONFIGS[tier] !== undefined`. The latter is an inherited-property lookup,
so a wire value named after anything on `Object.prototype` - `'toString'`,
`'constructor'` - passed the check and handed the caller a function where a
`TierConfig` was expected. The new test caught that; the first version of this
fix had the hole.

**Verification gap worth recording:** `PremiumPointsCard.test.tsx` mocks all
three of these helpers, so no test in the suite could ever have caught this. The
new `constants/__tests__/tiers.test.ts` drives the real functions across every
tier plus unrecognised input, and was mutation-checked (removing the
normalisation fails 9 tests; reintroducing the prototype hole fails 1).

### F2 - The Leaderboard fixture had the wrong shape (dev-only, FIXED)

`/loyalty/leaderboard` returned a bare paginated array, but the real contract is
`LeaderboardResponse { entries, currentUserEntry, total, hasMore, hasSetConsent }`.
The screen's `data.pages.flatMap(p => p.entries)` therefore produced
`[undefined]`, and FlashList threw
`Cannot read property 'toString' of undefined` inside `ProgressiveListView`.
**This is why Leaderboard had only ever shown its skeleton, in every locale and
every previous pass.**

The fixture was wrong and the app was right, so the fix is in the mock only. Its
entry fields now match `LeaderboardEntry`, and the `neighborhood` and `champion`
routes were moved above the prefix catch-all that had been swallowing them.

### F3 - The Loyalty fixtures were incomplete (dev-only, FIXED)

`/loyalty/account` sent `currentTier: 'bronze'`; `TierName` is capitalised.
`/loyalty/gamification` omitted `loginStreak`, `purchaseStreak` and `reviews`,
all required by `GamificationStats`, so `StreakCard` threw next once F1 was
fixed. The account object is now a single factory shared by `/loyalty/account`
and its aliases, so the two copies cannot drift apart again - which is exactly
how the casing mismatch arose.

**No production code was changed to accommodate a fixture.** F1 is a genuine
robustness fix that stands on its own; F2 and F3 are fixture corrections.

## 36. A near-miss worth recording

Setting `font_scale` on a **running** app truncates text without re-laying out,
which looks exactly like a layout regression. A false P1 was nearly filed on
that basis. Cold start disproved it. Every font-scale result in this report was
taken after `pm clear` and a cold launch.

## 37. Verification gate

| Check                        | Result                                                     |
| ---------------------------- | ---------------------------------------------------------- |
| `tsc --noEmit`               | Clean (excluding the known `rehydrationOrchestrator` debt) |
| `eslint src`                 | Clean                                                      |
| Jest                         | **117 suites / 1890 tests** passed                         |
| Visual regression            | **422 snapshots**, zero drift                              |
| Android production release   | **BUILD SUCCESSFUL** (`assembleProductionRelease`, 6m31s)  |
| Dev fixtures absent from APK | **Verified** - see below                                   |

The release APK's JS bundle was searched for every dev marker: `devSession`,
`ENABLE_DEV_AUTH`, `DEV_LOCATION`, `devGeolocation`, `devAuthRole`,
`devSessionBlockedReason`, `dev.consumer@example.invalid`, `10.0.2.2`,
`MOCK_ROLE`, `Dev Consumer`. **All ten absent.** Control strings
(`unwrapBackendResponse`, `Surprise Bag`) were found in the same bundle, so the
search is demonstrably non-vacuous rather than silently matching nothing. The
`__DEV__` guard plus `require` in `index.js` keeps those modules out of the
release module graph entirely.

## 38. Limitations - what this pass does NOT establish

- **Populated Favorites** was never exercised; only the empty state.
- **"Confirm Order" was not pressed.** Checkout renders and was verified as a
  screen; the terminal action and any post-order state were not driven.
- **One device only.** BlueStacks at 720x1280 / 240dpi, Android 9. Nothing here
  says anything about a notch, a foldable, a tablet, or Android 13+ behaviour.
- **The backend is a mock.** Shapes were checked against
  `packages/shared/src/types`, but no response came from the real API. Three of
  the six findings in this pass were fixture defects, which is itself evidence
  that fixture-vs-contract drift is the main risk of this rig.
- **Arabic was verified on Settings, Profile and Leaderboard**, not on all
  fourteen screens. Bottom sheets, dropdowns and the keyboard were not driven in
  RTL.
- **Offline and permission-denied states** were not exercised.
- **Dark mode remains unverified by design** and is switched off in production.

## 39. Certification status

**Not certified.** This pass closes the reachability gap and fixes six defects,
but §38 lists real coverage that does not exist yet. Certification is a separate
decision and is not claimed here.
