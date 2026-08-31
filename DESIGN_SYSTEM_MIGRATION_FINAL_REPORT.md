# Design System Migration - Final Report

**Date:** 2026-08-31 **Branch:** `chore/v1-spacing-migration` **Scope:**
`apps/web` and `apps/mobile`

This report describes the **measured state of the repository at HEAD**, not the
state described by the audits that started the work. Where an audit finding has
since been fixed, withdrawn, or overtaken, that is said here and the original
number is given alongside the current one.

Every count below was re-measured against the working tree while writing this
report. Nothing is carried forward from an earlier document on trust.

> **This report does not certify the design system.** `DESIGN_CERTIFICATION.md`
> has deliberately not been created. §13 states exactly what still blocks
> certification.

---

## 1. Web work completed

| Area                        | Result                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Dark mode renders           | **FIXED.** `body` now uses `bg-background text-foreground`; seven `.dark` tokens repointed at the §2.6 ramp         |
| Tailwind spacing scale      | **FIXED.** Named keys only (`xxs`..`6xl`). Numeric keys are **not** overridden, so `p-4` is Tailwind's default 16px |
| Theme persistence           | **FIXED.** Cookie plus pre-paint script; the flash is gone                                                          |
| RTL in Radix menus          | **FIXED.** `DirectionProvider dir={dir}` in `app-providers.tsx`                                                     |
| Physical -> logical spacing | **FIXED for margins/padding.** `ml-*`/`mr-*` now measure **0**; `pl-*`/`pr-*` **2**                                 |
| Coral SVG fill              | **FIXED.** `#FF7979` -> `fill='currentColor'`                                                                       |
| Unnamed controls            | **NOT A REAL FINDING.** Rendered DOM measured 0 unnamed controls across 22 routes                                   |
| Opacity scale               | **CLEAN.** No dead opacity modifiers                                                                                |
| Spacing drift guard         | **IN PLACE.** `check:spacing` reports no drift in locked categories across **162 files**                            |

**Measured now:** `left-*` **65**, `right-*` **56** remain (absolute offsets,
deliberately not converted - see §9 D8). `.glass` **76** usages. `parcless-bag`
**41** raw hex values.

---

## 2. Mobile work completed

| Area                     | Before         | Now (measured)                           | Status                           |
| ------------------------ | -------------- | ---------------------------------------- | -------------------------------- |
| Foreign Tailwind greys   | 172            | **16**                                   | **FIXED** (91% removed)          |
| Off-grid spacing values  | 491            | **197 of 1018**                          | **PARTIALLY FIXED**              |
| Off-scale font sizes     | 152            | **120 of 297**                           | **PARTIALLY FIXED**              |
| Off-scale border radii   | 104            | **115 of 344**                           | **UNRESOLVED** - not worked      |
| Visual regression        | none           | **422 snapshots / 12 matrices**          | **FIXED**                        |
| Driver flow tokenisation | outside system | under the system                         | **FIXED**                        |
| Theme-blind screens      | 8              | 2 (intentional)                          | **FIXED** (see E26)              |
| Reduced motion           | unhandled      | `useReducedMotion` hook + `EnteringView` | **PARTIALLY FIXED**              |
| `hitSlop` coverage       | 28 of 174      | **31 of 175**                            | **UNRESOLVED** - marginal change |

**Spacing tokens 12 and 20 were added** to close the gap the audit identified,
and literals were migrated onto the scale.

---

## 3. Accessibility fixes

| ID             | Finding                                         | Status                                                                      |
| -------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| M16-a          | Secondary text at 2.57-2.68, under AA           | **FIXED.** `onSurfaceVariant` -> `#616161`; device-measured **5.93-6.19**   |
| M16-b          | Light `onSurfaceVariant` itself failed AA       | **FIXED** in the same change                                                |
| M17            | Light `outline` invisible as a control boundary | **FIXED.** Split `outline` (controls, 3:1) from `outlineVariant` (dividers) |
| M17 (Checkout) | Option cards still used the divider token       | **FIXED.** 1.26 -> **4.41** on device                                       |
| M18            | Four of eight status-container pairs failed AA  | **FIXED** for light `warning`/`info`; dark pairs remain (E25)               |
| D8 (device)    | Settings dividers rendered black                | **FIXED.** Measured `#E0E0E0` = `outlineVariant`                            |
| D6 (device)    | Chrome clipped text at 2.0x font scale          | **FIXED.** `AppHeader`, `LocationHeader`, `HomeSearchBar`, `TabNavigator`   |
| B1             | Header rows lost content at large font scales   | **FIXED.** Reflow at 1.5x; device-verified at 1.0/1.3/1.5/2.0x in en/fr/ar  |
| B1-b           | Driver name capped at `maxWidth: 100`           | **FIXED.** Cap now scales with the font                                     |
| B2             | Tab items 96x40 dp                              | **FIXED.** Device-measured **96x44 dp**                                     |
| B2-b           | Establishment link 212x20 dp                    | **NOT A REAL FINDING** - see below                                          |
| F1             | Unknown loyalty tier crashed My Points          | **FIXED.** Plus a prototype-key hole the test caught                        |
| M13            | `hitSlop` on 28 of 174 touchables               | **UNRESOLVED.** Now 31 of 175                                               |

### B2-b is withdrawn, not deferred

The OfferCard establishment link was reported in earlier passes as a 212x20 dp
touch-target violation. **It is not one.** `disabled={!onEstablishmentPress}`,
and no caller anywhere in the repo passes that handler, so the control is
disabled on every screen it renders on. Device testing confirmed it: tapping
inside its bounds - and inside the `hitSlop` added to "fix" it - both navigate
to OfferDetails, because the tap falls through to the card.

WCAG 2.5.5 governs interactive targets. A permanently disabled control is not
one, so there was never a violation. **This is counted as withdrawn, not as an
open defect.**

The real defect was smaller and is fixed: it advertised
`accessibilityRole='button'` with an actionable label while doing nothing.
Button semantics and `hitSlop` are now conditional on a handler being passed.

**Method note that made the difference:** `uiautomator` reports layout bounds
and **not** `hitSlop`, so bounds alone can neither confirm nor refute any
`hitSlop` claim. Only tapping outside the visual bounds settles it.

---

## 4. Typography fixes

- **Mobile off-scale font sizes: 152 -> 120 of 297 literals. PARTIALLY FIXED.**
  The residue clusters on `13` (39), `15` (30) and `11` (24) - values with no
  token, which is a scale question rather than a migration one.
- **`LocationHeader` hardcoded `lineHeight` removed. FIXED.** `fontSize` scales
  with the OS setting and a literal `lineHeight` does not, so the pair clipped
  at 2.0x.
- **`OfferCard.establishmentName` still pairs `fontSize: 16` with
  `lineHeight: 20`. UNRESOLVED.** Same class as the above; it did not surface as
  a clipping defect in the runs performed, but the pattern is the one that
  caused them.
- **Font faces: mobile uses platform faces, not Quicksand/Comfortaa.
  INTENTIONAL** (E10, `ACCEPTED`).

---

## 5. Spacing fixes

- **Web: FIXED and guarded.** Named scale only; numeric keys not overridden;
  `check:spacing` reports no drift across 162 files.
- **Mobile: PARTIALLY FIXED.** 197 off-grid of 1018 literals, down from 491. The
  residue is dominated by `10` (56), `6` (55) and `14` (34) - again values with
  no token.
- **Fractional Tailwind spacing keys (E16): 961 usages. OPEN.** Untouched by
  this work.

---

## 6. Colour and token migrations

| Item                                     | Status                                          |
| ---------------------------------------- | ----------------------------------------------- |
| Mobile foreign greys -> neutral tokens   | **FIXED.** 172 migrated, 16 remain              |
| `CheckoutScreen` parallel palette        | **FIXED**                                       |
| `outline` / `outlineVariant` role split  | **FIXED** (E28 documents the new contract)      |
| Mobile 26-colour unconstrained palette   | **CONSTRAINED** (E20)                           |
| Two Tailwind greys kept raw              | **INTENTIONAL**, on accessibility grounds (E24) |
| `warning`/`info` 700 step added          | **FIXED** (E29)                                 |
| Web `accent` vs mobile `accent` ramp     | **DEFERRED** - brand decision (D5 / E18)        |
| Coral cannot carry white text (3.38)     | **DEFERRED** - brand decision (D1 / E1, E2)     |
| `border` at 1.24 against white           | **DEFERRED** - design decision (D2 / E4)        |
| `parcless-bag` parallel palette (41 hex) | **DEFERRED** - product decision (D3)            |

---

## 7. Radius work

**Effectively none, and this is the weakest area of the migration.**

- **Web/mobile radius scales remain transposed.** Web `md` 12 / `lg` 8 (via
  `--radius`) / `xl` 20 / `2xl` 24; mobile `md` 8 / `lg` 12 / `xl` 16 /
  `2xl` 20. `DESIGN.md` §6.1 declares mobile's canonical, so the standard exists
  and the code does not follow it. **DEFERRED** (D6 / E6, `PLANNED`, ready to
  execute on approval).
- **Mobile off-scale radii: 104 at audit, 115 now. UNRESOLVED.** This category
  was never worked; the small rise is incidental to other changes.

---

## 8. RTL and localization

| Item                                    | Status                                                                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Radix `DirectionProvider`               | **FIXED** (D7 / E22), verified in RTL baselines                                                                                                                             |
| Web margins/padding -> logical          | **FIXED.** `ml-*`/`mr-*` at 0                                                                                                                                               |
| Web absolute offsets (`left-`/`right-`) | **DEFERRED.** 65 / 56 remain; need a reviewed per-site pass (D8)                                                                                                            |
| Mobile directional icons mirror in RTL  | **FIXED.** One shared map in the `Icon` atom; ~15 call sites                                                                                                                |
| Six untranslated driver strings         | **FIXED**                                                                                                                                                                   |
| Nine further untranslated strings       | **FIXED.** ContactSupport body, 4 DriverStack titles, Online/Offline, "Chosen Location", OfferCard badge/pickup/type/sold-out                                               |
| Arabic plural categories                | **FIXED.** `{n} left` needed all six CLDR categories; with only `_one`/`_other`, `count: 3` resolves to `few`, finds nothing, and **silently renders the English fallback** |
| Hardcoded-string ratchet                | **~35 files remain. UNRESOLVED**, but tracked and gated                                                                                                                     |

---

## 9. Device verification

**Rig:** BlueStacks, Android 9 (API 28), 720x1280 @ 240 dpi (1 dp = 1.5 px),
light theme, dev build against a local mock API.

**All 14 target screens were reached.** Home, Search, Favorites, Orders, Order
Details, Checkout, Profile, Settings, Loyalty, Leaderboard, Offer Details,
location modal, manual location, and the four driver screens.

| Check             | Coverage                                                              |
| ----------------- | --------------------------------------------------------------------- |
| Font scales       | 1.0x, 1.3x, 1.5x, 2.0x - **by cold start**, never by changing it live |
| Locales           | en, fr, ar (RTL)                                                      |
| Header reflow     | **VERIFIED** at all four scales in all three locales                  |
| Tab touch targets | **VERIFIED** 96x44 dp, en and ar                                      |
| Contrast          | Measured from framebuffer pixels, using the darkest glyph pixel       |
| Error states      | **VERIFIED** - checkout 409, network banner, list error + Retry       |
| Confirm Order     | **VERIFIED** against the mock                                         |

**Two measurement traps are recorded because both nearly produced false
results:**

1. Single-pixel sampling of text reads anti-aliased edges. Checkout helper text
   measured 1.56 that way and **6.19** correctly.
2. Changing `font_scale` on a running app truncates text without re-laying out,
   which looks exactly like a layout regression. A false P1 was nearly filed.

---

## 10. Visual regression coverage

| Platform   | Coverage                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------ |
| **Mobile** | **422 snapshots across 12 matrices.** Resolved-style matrices over device x theme x locale |
| **Web**    | **NOT VERIFIED.** 0 image baselines exist in the repo                                      |

The mobile matrix renders no pixels - it captures resolved styles - which is
precisely why an unchanged baseline is meaningful evidence that a font-scale
reflow is inert at 1.0x.

**E17 ("visual coverage has not been performed") remains `OPEN` for web.**
`DESIGN_DECISIONS_PENDING.md` D6 refers to "240 screenshot baselines"; **no such
baselines exist in the working tree.** Any decision resting on them needs them
created first.

---

## 11. Test and build results

Measured at HEAD while writing this report.

| Gate                              | Result                                                     |
| --------------------------------- | ---------------------------------------------------------- |
| Mobile `tsc --noEmit`             | **Clean** (excluding known `rehydrationOrchestrator` debt) |
| Mobile `eslint src`               | **Clean**                                                  |
| Mobile Jest                       | **119 suites / 1919 tests passed**                         |
| Mobile snapshots                  | **422 passed, zero drift**                                 |
| Mobile Android production release | **BUILD SUCCESSFUL**                                       |
| Web `tsc --noEmit`                | **Clean**                                                  |
| Web Jest                          | **22 suites / 854 tests passed**                           |
| Web `check:spacing`               | **No drift across 162 files**                              |
| Web `check:opacity`               | **No dead modifiers**                                      |

---

## 12. Production-safety verification

The mobile dev-authentication and mock infrastructure exists only for
verification. It was proven not to reach production.

| Check                               | Result                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------- |
| Dev auth code in production bundle  | **0 of 20 markers**, searched in **UTF-8 and UTF-16LE**                   |
| Mock API URL in production bundle   | **Absent** (`10.0.2.2`, `127.0.0.1`, `:8787`, `dev-mock-api`)             |
| `ENABLE_DEV_AUTH` in prod/staging   | **Absent** from both `.env` files                                         |
| Production API baked in             | **`https://api.toofreshtowaste.com`**, in the native dex                  |
| Production authentication unchanged | **VERIFIED** - diff vs `master` is styling only                           |
| Production authorization unchanged  | **VERIFIED** - no role, guard or flow-state change                        |
| Debugging bypasses                  | **None.** Dev modules referenced only inside `if (__DEV__)` via `require` |
| Test fixtures bundled               | **None**                                                                  |

**The bundle scan had to be run twice to be correct.** The release bundle is
Hermes bytecode (magic `c61fbc03`) which stores non-ASCII as UTF-16LE. A
UTF-8-only search reported Arabic as absent from production - a false alarm of
the worst kind. Both encodings are now searched, and three control strings are
asserted present so the scan cannot pass vacuously.

**Driver-role routing uses the real `UserRole.DRIVER` guard.** The server's role
drives it; no guard was weakened to reach the driver screens.

---

## 13. Explicit current limitations

### Production mobile is LIGHT ONLY

`DARK_MODE_ENABLED = false` in
`apps/mobile/src/design-system/providers/themeRollout.ts`. While false, the
Settings appearance control is not rendered and `App.tsx` passes `lockToLight`,
so the app resolves light regardless of the system setting or any saved
preference. **INTENTIONALLY DISABLED** (E27).

### Dark-mode infrastructure is preserved but disabled

The dark palette, `ThemeProvider`, and the dark half of the 422-snapshot matrix
all still exist and are exercised by tests. Only the runtime rollout is gated.
**Dark mode has never been verified on a device and must not be enabled without
that pass.** **NOT VERIFIED.**

### OfferCard width is a product/design decision

`maxWidth: 270` dp on the vertical variant. Measured on Favorites: renders **405
px in a 624 px row**, left-aligned, **35% of the row unused**.

| Width  | Available | Rendered | Unused       |
| ------ | --------- | -------- | ------------ |
| 320 dp | 256 dp    | 256 dp   | 0 dp (0%)    |
| 390 dp | 326 dp    | 270 dp   | 56 dp (17%)  |
| 430 dp | 366 dp    | 270 dp   | 96 dp (26%)  |
| 480 dp | 416 dp    | 270 dp   | 146 dp (35%) |

Invisible at 320 dp and worsening with width, which is why it was never caught.
Full entry: `.claude/work/offercard-width-decision.md`. **DEFERRED.**

### Remaining P1 / P2 findings

| Finding                                              | Severity | Status                                                                       |
| ---------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| Off-scale border radii (115) and no radius migration | P2       | **UNRESOLVED**                                                               |
| Off-scale font sizes (120) and spacing (197)         | P2       | **UNRESOLVED**                                                               |
| `hitSlop` on 31 of 175 touchables                    | P2       | **UNRESOLVED**                                                               |
| `establishmentName` hardcodes `lineHeight: 20`       | P2       | **UNRESOLVED**                                                               |
| ~35 files on the hardcoded-string ratchet            | P2       | **UNRESOLVED**                                                               |
| Fractional Tailwind spacing keys (961)               | P2       | **OPEN** (E16)                                                               |
| Dark `*Container` pairs fail AA                      | P2       | **OPEN** (E25), moot while dark is disabled                                  |
| Home search input reports 319x21 dp                  | P2       | **NOT VERIFIED** - probably the inner `TextInput`; not settled by a tap test |

### Device limitations

**One device.** BlueStacks, Android 9, 720x1280 @ 240 dpi. **Nothing here says
anything about a notch, a foldable, a tablet, or Android 13+ behaviour.** No iOS
device was used at any point.

**The backend was a mock in every authenticated pass.** Shapes were checked
against `packages/shared/src/types`, but no response came from the real API. Six
defects across the passes were fixture-versus-contract drift, which is itself
evidence that this is the rig's main weakness.

### Flows not actually exercised

- Payment beyond the cash path; online payment was never driven
- Order lifecycle past confirmation - no pickup, delivery or cancellation
- Offline and permission-denied states
- fr/ar on Search, Orders, Order Details, Offer Details; Contact Support in ar
- French tab-bar geometry (**inferred** from identical en/ar geometry, not
  measured)
- Consumer `AppHeader` at 1.5x/2.0x (the shared reflow was exercised on the
  driver stack)
- Every authenticated **web** route - no visual baseline exists for any of them

---

## 14. Final readiness

| Area                     | Status                         | Evidence                                               | Remaining action                                   |
| ------------------------ | ------------------------------ | ------------------------------------------------------ | -------------------------------------------------- |
| Web tokens and spacing   | **Ready**                      | `check:spacing` clean, 162 files; 854 tests            | None                                               |
| Web dark mode            | **Ready**                      | E1 resolved, verified in compiled bundle               | None                                               |
| Web RTL                  | **Mostly ready**               | `DirectionProvider` in place; `ml/mr` at 0             | Reviewed pass on 121 absolute offsets (D8)         |
| Web visual coverage      | **NOT VERIFIED**               | 0 baselines exist                                      | Create baselines before any radius decision        |
| Mobile colour tokens     | **Ready**                      | 16 foreign greys left of 172; contrast device-measured | Optional cleanup of the residue                    |
| Mobile spacing           | **Partial**                    | 197 off-grid of 1018, from 491                         | Decide tokens for 6/10/14 or accept                |
| Mobile typography        | **Partial**                    | 120 off-scale of 297, from 152                         | Decide tokens for 11/13/15 or accept               |
| Mobile radius            | **Not started**                | 115 off-scale; scales still transposed                 | D6 approval, then migrate                          |
| Mobile accessibility     | **Ready for light mode**       | Device-measured contrast, 44 dp tabs, 2.0x reflow      | `hitSlop` coverage; `establishmentName` lineHeight |
| Mobile RTL/localization  | **Ready for verified screens** | en/fr/ar dumps, no raw keys, RTL geometry confirmed    | 4 screens not inspected in fr/ar                   |
| Mobile visual regression | **Ready**                      | 422 snapshots, zero drift                              | None                                               |
| Mobile device coverage   | **Partial**                    | 14 screens, 4 scales, 3 locales, one device            | Second device class; real backend                  |
| Mobile dark mode         | **Intentionally disabled**     | `DARK_MODE_ENABLED = false`                            | Device verification pass before enabling           |
| Production safety        | **Ready**                      | 0 dev markers, both encodings; auth diff styling-only  | None                                               |
| Build and test gates     | **Ready**                      | Mobile 1919 + web 854 tests; production build succeeds | None                                               |

**No area is claimed 100% complete.** The migration is substantially done for
colour, and partially done for spacing and typography. Radius is not started.

---

## 15. What blocks certification

Nothing on this list is an open defect. They are gaps in **evidence** and
**decisions**.

### Blocking - evidence that does not exist

1. **Web has no visual baselines at all.** `DESIGN.md` E17 is still `OPEN` and
   accurate: no web route has been visually verified at any viewport, locale or
   theme. `DESIGN_DECISIONS_PENDING.md` D6 assumes 240 baselines that are not in
   the repository.
2. **Mobile device coverage is one emulator.** No second form factor, no iOS, no
   Android 13+.
3. **No authenticated pass has run against the real backend.**

### Blocking - decisions only a human can make

4. **D1** coral cannot carry white text (3.38) - brand call
5. **D2** `border` at 1.24 - accept or darken
6. **D3** `parcless-bag`'s 41 raw hex - on-brand or deliberately distinct
7. **D4** `.glass` on 76 dashboard cards - accept the repaint cost or restyle
8. **D5** `accent` ramp divergence - tint or second coral
9. **D6** radius transposition - approve and every corner in the product changes
10. **OfferCard width** - full-bleed or a deliberate narrow card

### Not blocking

The P2 residue in §13 - off-scale radii, spacing, typography, `hitSlop`
coverage, the string ratchet. Each is tracked, none is a live accessibility or
correctness defect in light mode, and none needs a decision before release.

### Explicitly not a blocker

**The OfferCard establishment-link touch target.** It was reported as a
violation in two earlier passes, withdrawn here on device evidence, and must not
be carried forward as an open defect.

---

## 16. Documentation drift found while writing this

`CLAUDE.md` currently tells the reader that `DESIGN.md` §19-E1 (dark mode cannot
render) and §19-E5 (Tailwind numeric spacing keys overridden, `p-4` is 24px, the
default `<Button>` renders 96px tall) "are the ones that affect everyday work".

**Both were resolved on 2026-08-24 and both are stale.** Verified at HEAD:
`body` uses `bg-background text-foreground`, and `tailwind.config.ts` defines
only named spacing keys, so `p-4` is Tailwind's default 16px.

`CLAUDE.md` also states "Three P0 findings are open". That count predates this
work and is no longer accurate.

**Recommended action:** correct those lines in `CLAUDE.md`. They are the first
thing a new contributor reads, and they currently describe a codebase that no
longer exists. Not changed here, because `CLAUDE.md` is the project's own
instruction file and editing it is a maintainer's call.
