# Mobile Light-Mode Remediation

**Date:** 2026-08-28 **Scope:** `apps/mobile`, light theme only **Status:** not
certified

Dark mode stayed gated throughout (`DARK_MODE_ENABLED = false`, `DESIGN.md`
§19-E27). `defaultTheme` is unchanged, the Settings appearance control is still
hidden, and no dark-mode infrastructure was removed. One dark-affecting change
was made and it is called out in §3.3, because it was needed to stop a
light-mode fix from silently degrading the dark baselines.

---

## 1. Summary

|                                 |                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Findings closed                 | M16-a, M17, M18 (light half), M13 (decidable subset)                                       |
| Findings corrected in the audit | M7, M14 - both already resolved; the audit was stale                                       |
| New findings raised             | 3 (unreachable branch, stub screen, stale test mock)                                       |
| Findings left open with cause   | M8, M10, M11, M12, M16-a residual, M18 dark half, M17 dark half, 92 hardcoded strings      |
| Files changed                   | 66                                                                                         |
| Snapshot baselines              | 390 → 422 (+32); 268 lines changed, **0 unexplained**                                      |
| New regression gates            | 4 files, 47 assertions                                                                     |
| Gate                            | tsc clean · eslint clean · 110 suites / 1740 tests / 422 snapshots · production APK builds |

---

## 2. Accessibility measurements

All ratios are WCAG 2.1 relative luminance, computed by `contrastRatio` in
`themeContrast.test.ts`, which is itself checked against three reference values
so the instrument cannot drift silently.

Light surfaces are `background` `#F9F3F0`, `surface` `#FAFAFA`, `surfaceVariant`
`#F5F5F5`, `surfaceContainer` `#EEEEEE`.

### 2.1 M16-a - secondary text and icons

|                            | Before                   | After                                         |
| -------------------------- | ------------------------ | --------------------------------------------- |
| Token                      | `neutral[500]` `#9E9E9E` | `onSurfaceVariant` = `neutral[700]` `#616161` |
| On the four light surfaces | 2.31 - 2.68              | **5.34 - 6.19**                               |
| AA text (4.5)              | fails everywhere         | passes everywhere                             |
| 1.4.11 non-text (3.0)      | fails everywhere         | passes everywhere                             |

### 2.2 M17 - control boundaries

|                           | Before                                | After                                     |
| ------------------------- | ------------------------------------- | ----------------------------------------- |
| `outline`                 | `neutral[300]` `#E0E0E0`, 1.14 - 1.26 | `neutral[600]` `#757575`, **3.97 - 4.41** |
| `outlineVariant`          | `neutral[200]` `#EEEEEE`, 1.00 - 1.16 | `neutral[300]` `#E0E0E0`, 1.14 - 1.32     |
| 1.4.11 (3.0) on `outline` | fails everywhere                      | passes everywhere                         |

Intermediate steps were measured and rejected: `neutral[400]` reaches 1.62 -
1.80 and `neutral[500]` 2.31 - 2.57. `neutral[600]` is the first step that
clears 3.0 on all four surfaces, including the worst (`surfaceContainer`, 3.97).

### 2.3 M18 - status containers, light

| Pair                                       | Before   | After                             |
| ------------------------------------------ | -------- | --------------------------------- |
| `onSuccessContainer` on `successContainer` | 6.99     | 6.99 (unchanged, already passing) |
| `onErrorContainer` on `errorContainer`     | 4.92     | 4.92 (unchanged, already passing) |
| `onWarningContainer` on `warningContainer` | **2.81** | **5.08**                          |
| `onInfoContainer` on `infoContainer`       | **4.03** | **5.03**                          |

---

## 3. Findings resolved

### 3.1 M16-a - 29 of 39 low-contrast sites moved; 10 held deliberately

The audit recorded 29 usages. The real count at the time of this pass was
**39**; the extra ten are `Button`'s eight disabled-label variants plus two
disabled sites the earlier count did not reach. The number is stated because it
changes the shape of the finding: a third of the "failures" were never failures.

Each site was classified by the role the code puts it in, not by its value:

| Role                               | Count | Action                     |
| ---------------------------------- | ----- | -------------------------- |
| Secondary / tertiary / body text   | 14    | → `onSurfaceVariant`       |
| Icons carrying meaning             | 12    | → `onSurfaceVariant`       |
| Input placeholders                 | 3     | → `onSurfaceVariant`       |
| Disabled button label (8 variants) | 8     | **kept** on `neutral[500]` |
| Disabled button fill               | 1     | **kept**                   |
| Disabled payment-option label      | 1     | **kept**                   |

The ten held sites are inactive user-interface components, which WCAG 1.4.3
explicitly exempts. Darkening them would work against the affordance - a
disabled control is meant to recede. See §6.1 for why this is not the end of
that argument.

Worst-placed sites now fixed: `OrderCard`'s establishment line (the most-seen
card in the app), `HomeSearchBar`'s search placeholder, `CheckoutScreen`'s
secondary text, and `OfferCard`'s unfilled favourite heart.

Gated by `design-system/tokens/__tests__/neutralRoleAdoption.test.ts`, which
pins the exemption list **and the exact usage count per exempt file**, so a file
on the list cannot quietly grow a new text usage. Mutation-checked:
reintroducing `neutral[500]` in `HomeSearchBar` turns it red.

### 3.2 M17 - the reason this was thought unaffordable was wrong

The audit and the test both recorded that fixing `outline` "would visibly redraw
every border in the app". That was a fair description of the token as it stood
and the wrong conclusion, and the error is worth keeping visible because it cost
this finding two phases of being deferred.

`outline` had **79 usages**. Counting them by role rather than treating them as
one population:

| Role                                                                               | Count  | Governed by 1.4.11? | Token now        |
| ---------------------------------------------------------------------------------- | ------ | ------------------- | ---------------- |
| Dividers and separators                                                            | ~40    | no                  | `outlineVariant` |
| Decorative fills - skeleton blocks, switch tracks, slider tracks, drag handles     | ~17    | no                  | `outlineVariant` |
| Informational container borders - info boxes, timers, cards, badges                | ~11    | no                  | `outlineVariant` |
| Disabled-state foregrounds                                                         | 3      | no (1.4.3 exempt)   | `outlineVariant` |
| **Control boundaries** - inputs, OTP boxes, checkbox, chips, buttons, search field | **19** | **yes**             | `outline`        |

60 moved, 19 stayed. `outlineVariant` was then set to `neutral[300]` - the value
`outline` used to hold - so **all 60 moved sites render exactly the colour they
rendered before**. The only visible change in the app is that 19 control borders
got darker, which is the finding.

This follows the Material 3 definitions the token names come from: `outline` is
"important boundaries, such as a text field outline"; `outlineVariant` is
"decorative elements, such as dividers". The dark theme already had this
structure and was left alone.

**A regression this introduced, and its fix.** Six of the 19 kept sites were
`Button`'s `disabled ? colors.outline : <variant>` branches. Darkening those
gave every disabled button a solid mid-grey border where it previously had an
almost invisible one - the opposite of what a disabled control should do, and
not required by any standard, since 1.4.3 exempts inactive components. All six
disabled branches now read `outlineVariant` and render exactly as before. This
also removed a dead ternary at `Button.styles.ts:71`, which read
`disabled ? colors.outline : colors.outline` and so had never distinguished the
disabled state at all.

### 3.3 M18 - a token defect, not a badge redesign

The audit recommended adopting `DESIGN.md` §2.5's solid-fill badge app-wide and
noted that fixing M18 "would mean redesigning every status badge and banner in
the app". Counting the consumers first showed otherwise:

- `onWarningContainer` - **one** consumer (`PasswordStrengthIndicator`'s warning
  banner)
- `onInfoContainer` - **zero** consumers anywhere in `src`

So the fix is two ramp steps, not a component migration:

| Token          | Value     | Provenance                                                              |
| -------------- | --------- | ----------------------------------------------------------------------- |
| `warning[700]` | `#B84000` | HSL(21°, 100%, 36%) - the existing warning hue, darkened                |
| `info[700]`    | `#1565C0` | Material Blue 800, the next published step after `info[600]` = Blue 700 |

`info[700]` needed no derivation. `warning[700]` did: the ramp is Material
Orange, and Material's own Orange ends at 900 `#E65100`, which measures 3.46 on
the container and still fails. Deep Orange 900 `#BF360C` would have passed at
5.11 but jumps palette family for the sake of using a published name, so the
step was derived by holding hue and saturation and dropping lightness instead.
No usage-site colour was introduced.

Both ramps gained a `700` step; `success` and `error` did not, because their
light pairs already pass and adding tokens nothing needs is speculation.

**Dark is untouched and still fails all four pairs.** That is recorded, not
fixed - see §6.4.

### 3.4 M13 - touch targets, the decidable subset

The audit's position was that 146 of 174 touchables "cannot be determined from
source", which is correct and unchanged. What is decidable is the subset whose
style pins **both** axes below 44px, because those are that size by
construction:

| Site                                     | Box   | Before          | After                 |
| ---------------------------------------- | ----- | --------------- | --------------------- |
| `ChallengeHeader` `infoBtn`              | 36×36 | no hitSlop      | `hitSlop={4}` → 44×44 |
| `FilterBottomSheet` `closeButton`        | 32×32 | no hitSlop      | `hitSlop={6}` → 44×44 |
| `KonnectPaymentSheet` `closeButton`      | 36×36 | `hitSlop={12}`  | unchanged             |
| `EstablishmentBottomSheet` `closeButton` | 32×32 | hitSlop 10      | unchanged             |
| `PlaceOffersBottomSheet` `closeButton`   | 32×32 | hitSlop 10      | unchanged             |
| `FloatingVoteTab` `closeBtn`             | 20×20 | hitSlop present | unchanged             |

`hitSlop` rather than a larger box, because growing the box moves the icon and
reflows its row - a redesign these findings do not call for - and because four
sibling close buttons already use exactly this pattern. The values reach 44 on
each axis rather than being round numbers: (44 − 36)/2 = 4, (44 − 32)/2 = 6.

Gated by `design-system/__tests__/touchTargets.test.ts`. Mutation-checked by
removing the added `hitSlop`.

### 3.5 Token adoption

`PasswordStrengthIndicator`'s warning icon was a raw `#FF9800` (Material
Orange 500) sitting inside a banner whose own border reads `colors.warning`
`#F57C00` - two different oranges, one box. Now `theme.colors.warning`.

### 3.6 M7 and M14 - the audit was stale

Both were re-checked rather than trusted, and both had already been resolved by
earlier phases:

- **M7** (two offline banners mounted at once): the `components/Errors` banner
  is gone from `App.tsx` and has no importers. Only the design-system molecule
  remains, rendered conditionally in `RootNavigator`. Its empty barrel file
  `src/components/Errors/index.ts` - no exports, no importers - was deleted as
  the last residue.
- **M14** (no error branch on two list screens): `OrdersScreen` now has an
  explicit `error` branch with a retry, at `OrdersScreen.tsx:295`. The
  `OrderHistoryScreen` half of the finding is misframed - see §5.2.

---

## 4. Localization

### 4.1 The six driver strings - fixed

`DriverOrdersListScreen` shipped six English strings. All six now route through
`t()`, with keys added to `en`, `fr` and `ar` **in the same change**.

| Key                         | en                                                           | fr                                                                        | ar                                                    |
| --------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------- |
| `driver.startingUp`         | Starting up…                                                 | Démarrage…                                                                | جارٍ البدء…                                           |
| `driver.requestingLocation` | Requesting location…                                         | Demande de localisation…                                                  | جارٍ طلب الموقع…                                      |
| `driver.a11yGoOnline`       | Go online                                                    | Passer en ligne                                                           | الاتصال بالإنترنت                                     |
| `driver.a11yGoOffline`      | Go offline                                                   | Passer hors ligne                                                         | الانتقال إلى وضع عدم الاتصال                          |
| `driver.a11yGoOnlineHint`   | Starts showing nearby delivery orders and sending you alerts | Affiche les commandes de livraison à proximité et vous envoie les alertes | يبدأ بعرض طلبات التوصيل القريبة وإرسال التنبيهات إليك |
| `driver.a11yGoOfflineHint`  | Stops new delivery orders and alerts from reaching you       | Empêche les nouvelles commandes et alertes de vous parvenir               | يمنع وصول طلبات التوصيل والتنبيهات الجديدة إليك       |

French follows the existing file's register (`Passer en ligne` matches
`offlineBody`'s `Passez en ligne`) and its typographic apostrophe. Verified by
`i18n/__tests__/localeParity.test.ts`, which asserts every key exists in all
three locales with no empty values, and by reading all eighteen strings back out
of the three JSON files.

`ar.json` carries four keys `en` does not (`deliveryCount_zero/two/few/many`).
These were checked rather than assumed: they are i18next plural categories that
Arabic requires and English does not. Correct, not orphaned.

### 4.2 The rest of the app - measured, not fixed

Scanning for the same defect elsewhere found **92 hardcoded user-facing strings
across 33 files**. Worst: `VotingCard` (14), `PrivacyScreen` (6),
`LocationSelectionModal` (5). They include `Save Changes`, `Delete Account`,
`No offers found`, `Order History` and most empty states.

Not fixed here, and the reason is not time. Adding them means writing 184 new
French and Arabic strings; producing those is mechanical, but **shipping them
unreviewed is a content decision**, and French is this product's primary
commercial language for search volume. That belongs in its own change with a
native reader on it, not folded into a design-token pass.

Pinned instead by `i18n/__tests__/hardcodedStrings.test.ts`, which records the
count per file. The backlog can shrink freely; it cannot grow. The detector is
deliberately conservative - it only sees a text node alone on its line between
two JSX lines, so 92 is a floor, not a total.

---

## 5. New findings raised

### 5.1 `PasswordStrengthIndicator`'s warning banner is unreachable

Found while adding the baseline that M18's fix should have moved. The banner
requires all five basic rules met **and** `strength.score < 2`. Those conditions
are mutually exclusive:

- one basic rule is `length >= 12`
- the other four put a lower-case, upper-case, digit and symbol in the password,
  so the entropy pool is 26 + 26 + 10 + 32 = 94
- score comes from `length × log2(pool)`, thresholds `<40 → 0`, `<55 → 1`,
  `<70 → 2`, `<90 → 3`
- the floor is 12 × log2(94) = **78.6 bits**, which is score 3

There is no password that reaches it. `onWarningContainer` therefore has **zero
reachable consumers**, and that is why correcting it changed no pixel.

The token fix is still right - the pair was genuinely below AA and would ship a
2.81 banner the moment anyone loosened the length rule - but it bought no
user-visible improvement today, and this report says so rather than letting a
green matrix imply otherwise. Encoded as a proof in
`PasswordStrengthIndicator.matrix.test.tsx`, which fails if the arithmetic ever
makes the branch reachable. Whether to delete the branch or lower the threshold
is a product call and was not made.

### 5.2 `OrderHistoryScreen` is a stub, not a screen missing an error state

The audit's M14 asks for an `isError` branch here. It cannot have one: the
screen fetches nothing. It carries `// TODO: Fetch order history`, a
`RefreshControl` whose handler is a 1-second `setTimeout`, an always-rendered
empty state, and three hardcoded English strings.

It is registered in `MainStack` but **nothing navigates to it** - there is no
`navigate('OrderHistory')` anywhere in `src`. So it is reachable only by deep
link, and shows a permanent empty state if reached. Audit finding M15 asked
whether to delete it; that is still open and is a product decision, so it was
left in place.

### 5.3 `VotingCard.test.tsx` asserted against a fabricated palette

Its `colorTokens` mock declared a neutral ramp of `#F9FAFB`, `#E5E7EB`,
`#D1D5DB`, `#4B5563`, `#1F2937` - Tailwind values. The real ramp is Material
(`#FAFAFA`, `#EEEEEE`, `#E0E0E0`, `#757575`, `#424242`). Anything the suite
proved about colour, it proved about values the app has never rendered.

It was also a partial stub declaring only `base`, so the moment a module in its
import graph read `colorTokens.light` the whole suite failed to load - which is
how it surfaced. `tokens/colors` is a pure constants module with no side
effects, so the mock was removed rather than repaired. All 76 voting tests pass
against the real tokens.

---

## 6. Left open, with cause

### 6.1 M16-a residual - the ten disabled sites

WCAG exempts them, so they are compliant. The audit's own words were "exempt
from AA, but unreadable in practice", and that judgement has not been re-made.
At `neutral[500]` on `surfaceContainer` a disabled button label is 2.31.
Deciding how legible a disabled control should be is a design call, not a
compliance one.

### 6.2 M8 / M10 / M11 - off-scale typography, spacing, radii

Re-measured across 382 files:

| Finding            | Literals | Off-scale     | Dominant values                        |
| ------------------ | -------- | ------------- | -------------------------------------- |
| M8 `fontSize`      | 294      | **120** (41%) | 13px ×39, 15px ×30, 11px ×24, 22px ×12 |
| M10 spacing        | 1115     | **248** (22%) | 10px ×77, 6px ×76, 14px ×36            |
| M11 `borderRadius` | 344      | **104** (30%) | 10px ×26, 14px ×22, 3px ×9, 6px ×8     |

These are all the same shape of problem, and it is not a mechanical migration.
There is no 13px, 10px or 6px step to snap to, so every site is either a visible
size change or an argument for extending the scale. That is exactly what MD1
faced with 12px and 20px, and it was resolved by **adding** the steps - a
`DESIGN.md` §20 governance event, decided by the product owner, after which 323
sites migrated with zero rendered change.

The same decision is needed here and was not taken unilaterally. The
distributions above are the input to it: 10px and 6px alone account for 62% of
the off-grid spacing, and 13px and 15px for 58% of the off-scale type.

**Recommendation, not a decision:** treat 6/10 spacing and 13/15 type the way
12/20 were treated - extend the scale, migrate losslessly, then revisit the long
tail. The alternative, snapping everything to the nearest existing step, changes
rendering at hundreds of sites and has no proof strategy short of reviewing
every screen.

### 6.3 M12 - nine (now 18) files bypass the design-system `Button`

18 files under `src/features` build bespoke buttons from `TouchableOpacity` or
`Pressable`, against 31 files that import the design-system `Button`. Replacing
them changes size, colour, shadow and press behaviour on 18 screens - a
redesign, which is out of this pass's scope.

### 6.4 M17 and M18, dark half

Dark `outline` is 2.54 - 4.07 and fails on the darkest surface. All four dark
status-container pairs fail AA. Both are pinned by `themeContrast.test.ts`
rather than fixed, because dark mode is gated off and unreachable by users, and
choosing values for a theme nobody has verified on hardware would be guessing.
They are preconditions for reopening the gate, not for shipping light.

---

## 7. Visual baseline changes

422 baselines, up from 390. Every changed line was attributed by inverse
substitution before being accepted.

| Transition            | Lines   | Cause                                                                        |
| --------------------- | ------- | ---------------------------------------------------------------------------- |
| `#EEEEEE` → `#E0E0E0` | 125     | M17: sites already on `outlineVariant`, which moved `neutral[200]` → `[300]` |
| `#9E9E9E` → `#616161` | 84      | M16-a                                                                        |
| `#757575` → `#616161` | 34      | M17, dark cells: sites moved `outline` → `outlineVariant`                    |
| `#E0E0E0` → `#757575` | 25      | M17 light: the 19 control boundaries                                         |
| **Total**             | **268** | **0 unexplained, 0 non-colour drift**                                        |

The 125-line row is the one to notice: those sites were _already_ on
`outlineVariant` before this change, and they got slightly darker as a
side-effect of that token moving. They went from 1.00 - 1.16 (invisible, and
literally identical to the surface on `surfaceContainer`) to 1.14 - 1.32, which
is what dividers rendered at before. Visible, minor, and in the right direction.

**32 baselines added** for `PasswordStrengthIndicator` across the full 8-cell
matrix (light/dark × en/fr/ar × 320/390/430), covering empty, very-weak,
rule-floor and strong. Verified non-empty and theme-sensitive rather than
assumed: 0 `Object {}` captures, and light/dark differ at equal length.

---

## 8. Regression gates added

| File                                           | Assertions       | Mutation-checked                         |
| ---------------------------------------------- | ---------------- | ---------------------------------------- |
| `tokens/__tests__/neutralRoleAdoption.test.ts` | 4                | yes - reintroducing `neutral[500]` fails |
| `design-system/__tests__/touchTargets.test.ts` | 3                | yes - removing a `hitSlop` fails         |
| `i18n/__tests__/hardcodedStrings.test.ts`      | 5                | ratchet, both directions                 |
| `PasswordStrengthIndicator.matrix.test.tsx`    | 3 + 32 snapshots | fixture assertion is what found §5.1     |

`themeContrast.test.ts` was tightened: light `outline` moved from a ratchet to a
real AA assertion, light containers from a recorded table to `true` for all
four, and a new test asserts `outlineVariant` stays weaker than `outline` so the
split that made M17 affordable cannot silently collapse. Mutation-checked by
reverting `onWarningContainer` to `warning[600]`.

Each new gate carries a non-empty-input assertion, because the failure mode this
project has actually hit twice is a green suite that measured nothing.

---

## 9. Verification

| Check                    | Result                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `tsc --noEmit`           | clean (pre-existing `rehydrationOrchestrator` errors excluded, as documented in CLAUDE.md)                    |
| `eslint src --quiet`     | clean                                                                                                         |
| Unit tests               | **110 suites, 1740 tests** passed                                                                             |
| Visual regression        | **422 snapshots** passed; 268 changed lines, 0 unexplained                                                    |
| Production Android build | `assembleProductionRelease` **BUILD SUCCESSFUL**, R8 minify + `lintVital` passed, signed APK 26,948,935 bytes |

The APK was rebuilt after the final code change rather than reusing the earlier
one.

---

## 10. Remaining device-verification gaps

Unchanged by this pass, and still the largest gap in the whole migration.

- **No screen in this report was verified on a device.** Every contrast number
  is computed from tokens; every layout claim is a resolved-style snapshot. Jest
  does not run Yoga, so nothing here proves what a phone renders.
- The 19 darkened control borders are the change most worth looking at on
  hardware. They are correct by measurement and their weight has not been seen.
- The authenticated surfaces - Home, Search, Favorites, Orders, Order Details,
  Checkout, Profile, Settings, Loyalty, Leaderboard, driver - have **still never
  been rendered on a device** in either theme (§5.1 of
  `MOBILE_DEVICE_VERIFICATION_REPORT.md`).
- **No RTL claim in this migration has ever been device-verified**, including
  the three new Arabic driver strings.
- Both previous rounds of device verification found a P0 or P1 on the first
  screen examined.

---

## 11. Not certified

The design system is **not** certified and this report does not certify it.

What is true: the light theme's known WCAG failures in the token layer are
closed and gated. What is not true, and would have to be before certification:
the consistency debt in §6.2 is 472 off-scale values across type, spacing and
radius; 92 user-facing strings are English-only in all three locales; and none
of it has been looked at on a device.
