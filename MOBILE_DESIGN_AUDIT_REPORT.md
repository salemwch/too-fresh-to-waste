# Mobile Design System and UX Audit - apps/mobile

**Date:** 2026-08-25 **Scope:** `apps/mobile/src` - 379 source files, 31
screens, 5 skeleton screens. **Status:** Audit only. **No mobile source, token
or config file was modified.**

---

## Method, and what it cannot tell you

**No screen was rendered.** `adb devices` reports nothing attached and no
emulator is on `PATH`, so nothing in this report is based on looking at a
running app. Every finding below is **source inspection plus scripted
measurement** over the real tree.

That boundary matters, and it is stated per finding:

| Determinable from source                         | Requires a device                       |
| ------------------------------------------------ | --------------------------------------- |
| Which token a value came from, or that it is raw | Whether a screen looks cramped          |
| Whether an accessibility prop exists             | Whether a touch target is really < 44px |
| Whether a state branch exists in the code        | Whether the empty state reads well      |
| Whether reduced-motion is handled at all         | Clipping, overflow, keyboard overlap    |
| Locale key parity and plural coverage            | Whether Arabic text actually fits       |

**No P0 is claimed.** P0 means broken functionality or a production blocker, and
that class of defect is not reliably visible in source. Their absence here is a
limit of the method, not evidence that none exist. §"What still needs a device"
lists what to check first when one is available.

---

## Summary

The mobile app has a **well-built design system that the product largely does
not use.** The tokens are more complete than web's - a full dark ramp, semantic
spacing, platform-split shadows, a `withAlpha()` helper - but adoption sits
around 5-15% depending on the axis, and a foreign grey palette has displaced the
system's own neutrals across the commerce flow.

Accessibility is the opposite story, and is genuinely strong.

| Rank   | Count | Meaning                                           |
| ------ | ----- | ------------------------------------------------- |
| **P0** | 0     | None identified from source; see the caveat above |
| **P1** | 9     | Important consistency, theme or a11y issues       |
| **P2** | 5     | Polish and consistency                            |

### What is genuinely good

Worth stating plainly, because it is unusual and it changes where effort should
go.

- **Accessibility props are near-complete.** 179 `Touchable`/`Pressable` against
  **178 `accessibilityLabel`, 189 `accessibilityRole`, 182
  `accessibilityHint`**. Web's public routes have nothing comparable.
- **Text scaling is not suppressed anywhere.** `allowFontScaling={false}`
  appears **0 times**, and only 3 style blocks combine a fixed height with a
  `fontSize`, so the clipping risk under large system fonts is low by
  construction.
- **The edge-to-edge `StatusBar` rule is respected.** 0 occurrences of
  `translucent` or `backgroundColor` on `<StatusBar>`, which is the trap
  recorded in `CLAUDE.md`.
- **RTL is implemented the correct RN way.** `I18nManager.forceRTL` + `allowRTL`
  with an explicit restart prompt (`SettingsScreen`), because Android needs
  Activity recreation. This is **not** a deviation from web's live direction
  switch - it is the right platform behaviour.
- **Arabic pluralisation is done properly.** `ar.json` carries the full six
  i18next plural forms (`_zero`, `_two`, `_few`, `_many`) where `en.json` has
  `_one`/`_other`. The 12 "extra" Arabic keys are correct, not drift.
- **Locale parity is exact.** en 976 / fr 976 / ar 976 shared keys, zero missing
  in either direction.
- **Navigation matches the canonical spec.** Five bottom tabs - Home, Search,
  Favorites, Orders, Profile - exactly `DESIGN.md` §13.7, at 56px + bottom inset
  on Android, which is §5.5.
- **Loading states are real.** Five dedicated skeleton screens (Checkout, Order
  Details, Edit Profile, Loyalty, Leaderboard), and `FlashList` (14) is
  preferred over `FlatList` (4) per `.claude/rules/performance.md`.
- **The offline banner is global**, mounted at the root rather than per screen.

---

## P1 findings

### M1. Design tokens exist but are largely unused

- **Screens/components:** app-wide, 379 files.
- **Current behaviour**, measured outside `design-system/tokens`:

  | Axis        | Raw literal                            | Token reference | Adoption |
  | ----------- | -------------------------------------- | --------------- | -------- |
  | Font size   | **365** `fontSize: <number>`           | 37              | ~9%      |
  | Font weight | **248** literal                        | 17              | ~6%      |
  | Spacing     | **1310** raw `padding`/`margin`        | 76              | ~5%      |
  | Radius      | **344** raw `borderRadius`             | -               | -        |
  | Elevation   | **170** raw `shadowOffset`/`elevation` | 34              | ~17%     |

- **Expected** (`DESIGN.md` §3.2, §4.1, §6.1, §7.3): values come from the token
  set; `spacing`, `typography`, `radius` and `shadows` are exported and
  documented for exactly this.
- **Severity:** P1. Nothing renders wrong today, but the token layer is
  decorative - changing a token would move almost nothing.
- **Affected:** all locales, all themes, all devices.
- **Recommendation:** treat as a migration with its own gate, the way web's V1
  was handled. Do not attempt it without a screenshot harness (see M9).
- **Fix type:** technical.

### M2. A foreign grey palette has displaced the system neutrals

- **Component:** 43 files, concentrated in orders, checkout, offers, home.
- **Current behaviour:** **172** uses of Tailwind-default slate/gray hex
  (`#F8FAFC`, `#64748B`, `#94A3B8`, `#1F2937`, `#E5E7EB`, …) against **21** uses
  of the product's own neutral ramp (`#FAFAFA`…`#212121`, `#F9F3F0`).
- **Expected** (`DESIGN.md` §2.7): surfaces and text come from the documented
  neutral ramp. The slate family exists nowhere in
  `design-system/tokens/colors.ts`.
- **Severity:** P1 - this is the mobile equivalent of web's V6, but on the core
  commerce path rather than one marketing page.
- **Affected:** all locales/themes; worst in dark mode, since these literals are
  light-only.
- **Recommendation:** map each to the nearest token and confirm on device. A
  handful may be deliberate and should become tokens instead.
- **Fix type:** **product/brand decision** for any value with no exact token;
  technical for the rest.

### M3. `CheckoutScreen` hardcodes a complete parallel palette

- **Screen:** `features/orders/screens/CheckoutScreen.styles.ts`.
- **Current behaviour:** defines its own named palette -
  `SCREEN_BACKGROUND '#F8FAFC'`, `SURFACE '#FFFFFF'`, `TEXT_PRIMARY '#1F2937'`,
  `TEXT_SECONDARY '#64748B'`, `TEXT_TERTIARY '#475569'`,
  `TEXT_DISABLED '#94A3B8'`, `SUCCESS_SURFACE '#F0FDF4'`,
  `WARNING_SURFACE '#FEF3C7'` - while importing `colorTokens` and using it only
  partially. 19 raw colour literals in that one file.
- **Expected:** the highest-stakes screen in the product should be the _most_
  token-compliant, not the least.
- **Severity:** P1.
- **Affected:** all locales; light-only values mean dark mode is inconsistent
  here.
- **Recommendation:** migrate first, as the reference case for M2.
- **Fix type:** technical, once M2's mapping is agreed.

### M4. Eight screens never read the theme

- **Screens:** `ForceChangePasswordScreen`, `WelcomeScreen`,
  `DriverActiveOrderScreen`, `DriverEarningsScreen`, `DriverOrderDetailScreen`,
  `DriverOrdersListScreen`, `LeaderboardScreen`, `CheckoutScreen`.
- **Current behaviour:** no `useTheme()` call; colours come from literals, so
  these screens cannot respond to dark mode.
- **Expected** (`DESIGN.md` §2.6): a token whose light and dark value are
  identical is a bug; screens read from the theme.
- **Severity:** P1. The whole driver flow and checkout are in this list.
- **Affected:** dark mode, all locales.
- **Recommendation:** route colours through `useTheme()` as part of M2/M3.
- **Fix type:** technical.

### M5. Dark mode cannot be chosen by the user

> **PARTLY RESOLVED 2026-08-25 by MD3 = Option A (staged).** Settings now has an
> Appearance control offering light / dark / automatic, so dark is reachable and
> testable for the first time. **The app default is deliberately still `light`**
>
> - `App.tsx` keeps `defaultTheme='light'`, guarded by a test, until every
>   screen has been verified in dark on a device (phase 6). M5 stays open until
>   then.
>
> **This finding was understated.** It said dark "cannot be chosen". In fact the
> mount was `light` rather than `auto` and nothing ever wrote the storage key,
> so dark was **unreachable by any means**, and the `auto` branch, the dark ramp
> and the persistence were all dead code. See `MOBILE_DESIGN_DECISION_BRIEF.md`
> MD3.

- **Component:** `design-system/providers/ThemeProvider.tsx`,
  `features/profile/screens/SettingsScreen.tsx`.
- **Current behaviour:** the provider fully supports `light | dark | auto`,
  persists the choice to `AsyncStorage` and follows `useColorScheme()`. But
  **`setThemeMode` is never called anywhere in `features/`**, and Settings
  offers only language, notifications and attributions. The capability is dead.
- **Expected:** either the control exists, or following the system is a stated
  decision.
- **Severity:** P1 - combined with M4, a user on a dark device gets a half-dark
  app they cannot turn off.
- **Recommendation:** decide whether to expose the toggle or to follow the
  system only, then delete or wire the unused API.
- **Fix type:** **product decision**, then technical.

### M6. Reduced motion is not handled anywhere

- **Component:** app-wide; 5 files use `react-native-reanimated`.
- **Current behaviour:** **0** references to `AccessibilityInfo`,
  `isReduceMotionEnabled` or any reduced-motion flag.
- **Expected** (`DESIGN.md` §8.3 rule 3, §11.6): honouring reduced motion is
  mandatory. On RN that is `AccessibilityInfo.isReduceMotionEnabled()` plus the
  `reduceMotionChanged` listener.
- **Severity:** P1 accessibility.
- **Affected:** all locales/themes; users with vestibular sensitivity.
- **Recommendation:** a single hook consumed by the animated components.
- **Fix type:** technical.

### M7. Two different offline banners are mounted at once

- **Components:** `components/Errors/OfflineBanner.tsx` (rendered
  unconditionally in `App.tsx:327`) and
  `design-system/components/molecules/OfflineBanner` (rendered conditionally in
  `RootNavigator.tsx:456`).
- **Current behaviour:** two implementations of the same concept are both in the
  tree, both mounted. The `Errors` one self-manages via `NetInfo`; the navigator
  one is driven by `showBanner`.
- **Expected** (`DESIGN.md` §20): one component per concept.
- **Severity:** P1 - **on a real offline event both may render**. That the
  duplicate exists is certain from source; that both are simultaneously visible
  needs a device to confirm.
- **Recommendation:** keep the design-system molecule, delete the other.
- **Fix type:** technical.

### M8. 152 off-scale font sizes

- **Current behaviour:** sizes outside the documented scale - **13px ×58, 15px
  ×39, 11px ×24, 22px ×12, 17px ×6**, plus 8/9/34/40/44px.
- **Expected** (`DESIGN.md` §3.2): 10/12/14/16/18/20/24/28/32/36/42/48.
- **Severity:** P1 - 13px and 15px sit either side of the 14px body size, so
  body copy is inconsistent between screens.
- **Recommendation:** snap to the nearest scale step, on device.
- **Fix type:** technical.

### M9. No visual regression coverage exists for mobile

- **Current behaviour:** web has 240 committed screenshot baselines; mobile has
  none. There is no way to make any of M1-M3 or M8 safely.
- **Expected:** parity of safety, not of implementation.
- **Severity:** P1 - it is the blocker on every other P1 here.
- **Recommendation:** the mobile analogue is a snapshot/story harness plus a
  device or emulator in CI. **Do this before the token migration, not after** -
  that ordering is what made web's V1 migration provable.
- **Fix type:** technical.

---

## P2 findings

### M10. 491 off-grid spacing values - and a probable gap in the scale

> **PARTLY RESOLVED 2026-08-25 by MD1 = Option A.** The 12px and 20px steps were
> added to the scale as numeric sub-steps `sp[3]` and `sp[5]`, mirroring web,
> and all 323 of their usages were migrated with zero rendered change (proved by
> inverse substitution over all 86 changed files, and by 78 unchanged
> baselines). **The remaining off-grid values below are untouched and M10 stays
> open for them.** See `MOBILE_DESIGN_DECISION_BRIEF.md` and DESIGN.md §4.2.
>
> **Correction to the counts in this entry.** "211 times and 85 times" measured
> `padding*`/`margin*` only. Including `gap`/`rowGap`/`columnGap` the true
> figure is **323 across 86 files**, not 296. The conclusion was right; the
> method was too narrow.

**12px appears 211 times and 20px 85 times.** Neither exists in the mobile
spacing scale (`xxs 2, xs 4, sm 8, md 16, lg 24, xl 32 …`), yet together they
account for 60% of all off-grid values. Web's scale _does_ provide both (numeric
keys `3` and `5`).

That volume looks less like carelessness and more like **the scale being too
coarse between 8px and 24px**. Recorded as an open question in §Unresolved
decisions rather than as a violation to be corrected.

Remaining off-grid: 6px ×54, 10px ×54, 14px ×34, 3px ×12, 5px ×9, 18px ×9.

### M11. 104 off-scale border radii

10px ×26, 14px ×22, 3px ×9, 6px ×8, 28px ×6, 18px ×5, 22px ×5, 40px ×4, against
the documented `0/2/4/8/12/16/20/24/full`.

### M12. Nine screens bypass the design-system `Button`

`ForceChangePasswordScreen`, `WelcomeScreen`, the four driver screens,
`HomeScreen`, `LeaderboardScreen`, `ContactSupportScreen`, `SettingsScreen` use
raw `TouchableOpacity`/`Pressable` with no design-system button import. 18 of 31
screens do use it, so the pattern exists and is simply not universal.

### M13. `hitSlop` on 28 of 174 touchables

The other 146 rely on their own box clearing 44px. **Whether they do cannot be
determined from source** - it depends on rendered layout. Listed so it is
checked on device, not asserted as a violation.

### M14. Two list screens have no explicit error branch

`OrdersScreen` and `OrderHistoryScreen` have empty states and `RefreshControl`
but no `isError` handling, so a failed fetch likely renders as an empty list -
indistinguishable from "you have no orders".

Every other list screen (`Home`, `Search`, `Favorites`) has all three.

---

## Design-system mismatches (web vs mobile)

Differences that are **correct and should be preserved**:

| Difference                                   | Why it is right                       |
| -------------------------------------------- | ------------------------------------- |
| RTL via `forceRTL` + restart, not live flip  | Android requires Activity recreation  |
| Platform font faces (SF Pro / Roboto)        | `DESIGN.md` §19-E10, already accepted |
| Cream `#F9F3F0` ground vs web's white        | `DESIGN.md` §19-E9, deliberate        |
| iOS shadow props **and** Android `elevation` | They are not interchangeable (§7.3)   |
| Bottom tabs rather than a header nav         | §10.4 responsive pattern              |

Genuine mismatches: **M2** (foreign palette), **M8** (type scale), **M10/M11**
(spacing and radius), and the radius transposition already tracked as web
`DESIGN.md` §19-E6 / D6 - mobile is the canonical side of that one, so mobile
needs no change.

---

## Accessibility findings

**Strong**: label/role/hint coverage, no suppressed font scaling, low
fixed-height risk, `hitSlop` where used.

**Gaps**: M6 (reduced motion, 0 handling), M13 (touch targets unverifiable from
source), and `accessibilityState` on only 20 elements - so toggles, tabs and
selected rows may not announce their state. `AccessibilityInfo` is never used,
so nothing adapts to screen-reader presence.

**Not checked**: actual screen-reader output (TalkBack/VoiceOver), focus order,
and announced text. All require a device.

---

## RTL findings

Implementation is sound: `forceRTL` + restart, 161 logical style props
(`marginStart`/`marginEnd`/`paddingStart`/`paddingEnd`/`borderStart`) against 93
physical.

The 93 physical are almost entirely **absolute offsets**: `left:` ×46 and
`right:` ×46, plus one `textAlign: 'right'`. These do not auto-mirror. This is
the same class as web's D8 and needs the same per-site review - some will be
direction-neutral, some intentional.

`marginLeft`/`marginRight`/`paddingLeft`/`paddingRight`: **0 occurrences.** That
part is already clean.

**Not checked**: whether RTL layouts actually look right, directional icons,
modal and dropdown positioning under RTL. Device required.

---

## Localization findings

**No defects found.** en/fr/ar all carry 976 shared keys with zero missing and
zero orphaned. Arabic plural forms are correct and complete.

**Not checked**: whether translated strings fit their containers. French runs
~30% longer than English and Arabic ~15% taller (`DESIGN.md` §10.5), and 67
`numberOfLines` truncations exist - so overflow is plausible but unverified.

---

## Theme findings

The dark token ramp is complete and correct - `darkThemeColors.primary` maps to
`primary[300]`, which is the fix web needed (§19-E1). Mobile got this right
first.

What is wrong is **adoption**: M4 (8 screens never read the theme) and M5 (no
way to choose). A user on a dark device today gets a partially dark app.

**Not checked**: how dark mode actually looks on any screen.

---

## Unresolved product / design decisions

**MD1. Should the mobile spacing scale gain 12px and 20px?** 296 uses say the
8→16→24 progression is too coarse. Web provides both. Adding them legitimises
existing code; refusing them makes M10 a real migration. _Design decision._

> **DECIDED 2026-08-25: Option A - add both.** Implemented as numeric sub-steps
> `sp[3]` = 12px and `sp[5]` = 20px, matching web's `p-3`/`p-5`, leaving the
> named table in DESIGN.md §4.1 identical across platforms. 323 sites migrated
> (not 296 - the original count omitted `gap`). No rendered value changed. The
> residual mixed expression inside migrated files is DESIGN.md §19-E23.

**MD2. What happens to the foreign grey palette (M2)?** Map 172 literals to
existing tokens (changes appearance slightly) or promote the values into the
token set (blesses a second neutral family). _Brand decision._

**MD3. Should users be able to choose the theme (M5)?** Expose the toggle, or
follow the system only and delete the unused API. _Product decision._

> **DECIDED 2026-08-25: Option A, staged.** Phase 2 shipped the Settings
> Appearance control (light / dark / automatic) wired to the existing
> `setTheme`, with persistence unchanged. The mount default stays `light`, held
> there by an explicit test, until phase 6 fixes the theme-blind screens and a
> device audit passes. Only then does the default become `auto`.

**MD4. Is the driver flow in scope for the design system?** All four driver
screens skip both the theme and the design-system button. That may be deliberate
(an internal tool) or drift. _Product decision._

---

## What still needs a device

Nothing below is claimed either way in this report.

1. **Touch targets** - measure rendered boxes for the 146 touchables without
   `hitSlop` (M13).
2. **Dark mode** - view the 8 theme-less screens on a dark device (M4).
3. **The double offline banner** - go offline and count banners (M7).
4. **RTL layout** - Arabic on device: absolute-positioned elements, directional
   icons, modal and dropdown placement.
5. **Text fit** - French and Arabic at large system font sizes.
6. **Device sizes** - small / standard / large phone for clipping, overflow,
   cramped layout and keyboard overlap. **No device-size finding is made in this
   report, because none could be.**
7. **First run** - per `.claude/rules/testing.md`, cold-start state is its own
   surface and cannot be seen here.

---

## Corrections found while implementing Phase 1

Two findings were wrong, and one target did not exist. Left visible rather than
edited away.

**M6 said "5 files use react-native-reanimated".** They do not.
`react-native-reanimated` is **not a dependency and is imported nowhere** - it
was removed and replaced by the `EnteringView` atom built on RN's own
`Animated`. The five hits were doc-comment and test references to the library
that had been removed. The real animation surface is `Animated` across 33 files,
so reduced motion was integrated at `EnteringView`, the shared entrance
primitive.

**M7 recommended keeping the design-system OfflineBanner.** Verification only
half-supported that. The design-system molecule had **no `accessibilityRole`, no
`accessibilityLabel` and no `testID`**, and `RootNavigator` passed it a
hardcoded English string; the `components/Errors` version it was replacing had
`role='alert'`, a translated label and a testID. Keeping the molecule was still
right - `RootNavigator` already tracks both device connectivity _and_ API
network errors, where the other covered only the first - but it had to gain the
accessibility and localisation the deleted one provided, or the consolidation
would have been a regression.

**M14's second target is dead code.** `OrderHistoryScreen` has no data fetching
at all - `// TODO: Fetch order history`, a fake one-second refresh, hardcoded
English copy - and **nothing navigates to it**. It is registered in `MainStack`
and unreachable; the real order history is `OrdersScreen`'s "history" tab. An
error state was therefore not added to it, because there is no request that can
fail. The `OrdersScreen` fix covers both tabs.

**New finding - M15 (P2): `OrderHistoryScreen` is an unreachable stub.**
Registered, never navigated to, unimplemented, and its copy is not localised.
Either delete it or finish it; leaving a registered stub invites someone to
route to it. Not actioned - deciding which is a product call.

---

## Recommended implementation order

1. **M9 - build the mobile visual harness.** Everything else is unsafe without
   it. Web proved this ordering.
2. **M7 - delete the duplicate offline banner.** Small, self-contained, no
   decision needed.
3. **M6 - add reduced-motion support.** One hook, real accessibility gain.
4. **M14 - error branches on the two order list screens.**
5. **MD1-MD4 - take the four decisions.** M2, M3, M4, M5 and M10 are all blocked
   on them.
6. **M3 - migrate `CheckoutScreen`** as the reference implementation.
7. **M2, M4 - roll the palette and theme migration out**, screen by screen,
   against the harness from step 1.
8. **M1, M8, M10, M11 - the token migration**, once the scale questions in MD1
   are settled.
9. **M12, M13 - component and touch-target consistency**, last.

Steps 1-4 need no decision and can start immediately. Steps 5 onward should not
begin until MD1-MD4 are answered.
