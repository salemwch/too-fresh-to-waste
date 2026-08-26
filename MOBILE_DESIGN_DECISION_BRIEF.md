# Mobile Design Decision Brief

Four decisions block the mobile token migration (M1-M4 in
`MOBILE_DESIGN_AUDIT_REPORT.md`). Each is a product or brand call, not a
technical one, which is why they were held back rather than resolved during
Phase 1.

**No source code was modified to produce this document.** Every number below was
measured against the working tree at `f2336b26`.

---

## Summary

| ID  | Decision                                     | Scale             | Recommendation                      |
| --- | -------------------------------------------- | ----------------- | ----------------------------------- |
| MD1 | Should the spacing scale gain 12px and 20px? | 489 literals      | **Option A** - add both             |
| MD2 | What happens to the foreign grey palette?    | 172 uses/43 files | **Option B** - map to tokens        |
| MD3 | Should users be able to choose the theme?    | Whole app         | **Option A** - ship `auto` + toggle |
| MD4 | Is the driver flow in scope?                 | 4 screens/2,527 L | **Option A** - in scope             |

### Read this before the four sections: the gate does not cover this work yet

The mobile regression gate committed in Phase 1 holds **78 baselines** across
`Button` (24), `Atoms` (42) and `OrdersScreen` (12). Measured against those
files:

| Decision | Baselines it would move today                                   |
| -------- | --------------------------------------------------------------- |
| MD1      | **0 of 78** - no baseline contains a 12px or 20px spacing value |
| MD2      | **0 of 78** - no baseline contains any of the 13 foreign greys  |
| MD3      | 14 of 78 are dark cells, but they only move if screens change   |
| MD4      | **0 of 78** - no driver screen has a baseline                   |

This is not a reason to delay the decisions. It is a reason not to mistake a
green run for coverage of the migration: the components already tokenised are
exactly the ones the gate watches, and the 43 files that need changing are
exactly the ones it does not. **Baselines for the affected screens must be
written before the migration starts, not after** - a baseline captured after a
change records the change rather than testing it.

---

## MD1 - Should the mobile spacing scale gain 12px and 20px?

### 1. Current implementation

`src/design-system/tokens/spacing.ts` defines an 8pt-derived scale:
`2, 4, 8, 16, 24, 32, 40, 48, 64, 80, 96`. There is no 12 and no 20.

### 2. Exact evidence

Counting every numeric `padding*`/`margin*` literal in `src/`:

| Status            | Count   | Share   |
| ----------------- | ------- | ------- |
| On the scale      | 817     | 63%     |
| **Off the scale** | **489** | **37%** |

The off-grid values are not scattered noise. Two values are most of them:

| Value                                | Uses | Files | On the web scale?          |
| ------------------------------------ | ---- | ----- | -------------------------- |
| 12                                   | 210  | 79    | yes (`space-3` equivalent) |
| 20                                   | 87   | 47    | yes                        |
| 10                                   | 56   |       | no                         |
| 6                                    | 54   |       | no                         |
| 14                                   | 34   |       | no                         |
| others (3, 5, 18, 15, 1, 28, 60 ...) | 48   |       | no                         |

**12 and 20 together are 297 uses - 61% of all off-grid spacing.**

### 3. Affected components / usages / screens

210 + 87 = 297 literals across roughly 90 distinct files, spanning every feature
area. The remaining 192 off-grid literals are genuinely ad hoc and are _not_
part of this decision.

### 4. Accessibility impact

None either way. Spacing at this magnitude does not affect touch-target minimums
(those are `minHeight`/`minWidth`, tracked separately as M12) or contrast.

### 5. UX impact

Under Option A: none visible - the numbers stay identical, only their source
changes. Under Option B: 297 values shift by 4px each, which compounds in nested
layouts and is the visible-change path.

### 6. Visual impact

Option A is a **pure refactor with zero rendered difference**. Option B moves
real pixels on ~90 files.

### 7. Impact on existing users

Option A: none. Option B: every list row, card and modal that currently uses 12
or 20 changes density. Users do not read a changelog for spacing; they
experience it as the app having been redesigned.

### 8. Option A - add `12` and `20` to the scale

The scale becomes `2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`. 297
literals become token references with no rendered change. Residual off-grid
drops from 489 to 192 (37% to 15%) **for free**. This also aligns mobile with
web, which already has both.

### 9. Option B - keep the 8pt scale and migrate 12 to 16, 20 to 24

Scale purity is preserved. 297 values each grow by 4px. Requires visual review
of ~90 files on a device, because a 4px growth inside a nested layout is not
locally reasonable about.

### 10. Recommendation - **Option A**

The scale is already being violated 210 times for 12px alone. When two-thirds of
the off-grid usage disagrees with a scale, the scale is the thing that is wrong.
A 4pt sub-step is standard practice (Material 3 and the web app both carry one),
and Option A converts the single largest category of drift into compliance
without a single pixel moving. Option B spends a device-review cycle on ~90
files to buy a purity nobody can see.

### 11. Risks

Option A: the scale gets 2 more entries, so "which token" has slightly more
answers - mitigated by documenting 12/20 as sub-steps rather than peers. Option
B: 4px compounding, and the review burden is precisely the thing that makes
large migrations get abandoned half-done.

### 12. Migration scope

Option A: token file edit + codemod over 297 literals. Option B: the same
codemod plus a full device pass.

### 13. Baselines affected

**0 of 78 today.** Option A would keep it 0 by construction (no value changes).
Option B would move any baseline covering an affected screen - and none exist
yet, which is the argument for writing them first.

---

## MD2 - What happens to the foreign grey palette?

### 1. Current implementation

The design system ships `neutral[50..900]`. Alongside it, 13 greys from a
different palette (the Tailwind slate/gray ramps) appear as raw hex.

### 2. Exact evidence

**172 uses across 43 files.** Heaviest:

| File                             | Uses |
| -------------------------------- | ---- |
| `OrderCard.tsx`                  | 15   |
| `CharityDonationBottomSheet.tsx` | 12   |
| `DiscountClaimModal.tsx`         | 10   |
| `OrderSuccessModal.tsx`          | 10   |
| `OfferDetailsScreen.tsx`         | 9    |

Nearest-token distance (RGB euclidean) was computed for all 13. Most are 24 or
below, which is imperceptible. Three are visible shifts:

| Foreign   | Nearest token  | Distance |
| --------- | -------------- | -------- |
| `#475569` | `neutral[700]` | 30       |
| `#64748B` | `neutral[600]` | 28       |
| `#94A3B8` | `neutral[400]` | 28       |

### 3. Affected components / usages / screens

172 uses, 43 files. Includes the checkout and order surfaces - the
highest-stakes screens in the app.

### 4. Accessibility impact

Every foreground/background pair these greys participate in was measured.
**Mapping to tokens changes no AA verdict** - every pair keeps its existing pass
or fail status.

That measurement surfaced a **pre-existing failure that this decision does not
fix**: `#9CA3AF` (17 uses) and `#94A3B8` (11 uses) sit at **2.54** and **2.56**
on white, well under the 4.5:1 minimum for body text. The nearest token,
`neutral[500] #9E9E9E`, fails too at **2.68**. Migrating to tokens neither
causes nor cures this. It is a separate finding and should be raised as one -
those two greys are being used for text that a low-vision user cannot read.

### 5. UX impact

Negligible under either option. This is a consistency and maintainability
decision, not a UX one.

### 6. Visual impact

Option B: 10 of 13 greys shift imperceptibly; 3 shift visibly but subtly, on
secondary text and borders.

### 7. Impact on existing users

Effectively none. No user will notice a 28-unit RGB shift on a divider.

### 8. Option A - adopt the foreign greys as official tokens

Zero visual change. But the app then carries two grey ramps with overlapping
roles, and every future author has to guess which is canonical. This is how the
drift happened in the first place.

### 9. Option B - map all 172 uses to the nearest existing token

One grey ramp. 10 of 13 mappings are invisible; 3 are minor. Removes 172 raw hex
literals, which is 52% of the app's entire raw-colour count (332).

### 10. Recommendation - **Option B**

The whole point of the token layer is that there is one answer. Option A
legitimises the drift and doubles the ramp permanently to avoid a change no user
can see. Option B is a one-time cost with a measured, bounded visual delta and
no accessibility regression.

**Do it after MD3**, not before. If dark mode becomes reachable, these greys
have to become theme-aware anyway, and mapping them twice is wasted work.

### 11. Risks

The 3 visible mappings land on secondary text and borders - worth a device check
on `OrderCard` and the checkout sheets specifically. Low risk, but not zero, and
the gate cannot see it (see below).

### 12. Migration scope

43 files, 172 replacements, mechanical. Codemod-able with a fixed 13-entry map.

### 13. Baselines affected

**0 of 78.** Not one of the 13 foreign greys appears in any committed baseline -
confirmed by grep across all three snapshot files. The gate would stay green
through this entire migration while 172 colours changed. `OrderCard` and the
checkout surfaces need baselines _before_ this starts.

---

## MD3 - Should users be able to choose the theme?

### 1. Current implementation

Not "there is no toggle". Stronger, and worse:

```
src/App.tsx:443    <ThemeProvider defaultTheme='light'>
```

`ThemeProvider` supports `light | dark | auto`, persists the choice to
AsyncStorage, and exposes `setThemeMode` and `toggleTheme`.

### 2. Exact evidence

The chain, verified end to end:

1. `App.tsx:443` mounts with `defaultTheme='light'` - pinned to light, **not**
   `auto`.
2. `ThemeProvider`'s `loadTheme` effect reads `AsyncStorage.getItem(storageKey)`
   and applies a saved mode if present.
3. `setThemeMode` and `toggleTheme` have **zero call sites** outside the
   provider. Grep across all of `src/` returns one hit, and it is the type
   declaration in `design-system/types/index.ts:153`.
4. Nothing ever writes the storage key, so step 2's read always returns `null`.

**Dark mode is unreachable in the shipped app.** It does not follow the system
setting either, because the mount is `light` rather than `auto`. The entire dark
token ramp, the `auto` branch, and the AsyncStorage persistence are dead code
today.

This is more severe than the audit stated (M5 described it as "no user-facing
toggle"). The correction is recorded here rather than by editing the audit.

### 3. Affected components / usages / screens

Every screen. 32 `useTheme()` call sites in feature code render only their light
branch; the audit's M4 (8 screens that never read the theme) is currently
invisible to users for the same reason.

### 4. Accessibility impact

**This is the strongest argument in the brief.** Dark mode is an accessibility
accommodation for photophobia, migraine and light sensitivity, and on OLED
hardware it is a battery accommodation. The app ignores a system-level
preference the user has already expressed. Users who set their phone to dark get
a light app with no explanation and no recourse.

### 5. UX impact

Option A: the app honours a setting the user already made elsewhere. Option B:
status quo - the dead code stays dead.

### 6. Visual impact

Option A: substantial for users on dark - a whole second theme becomes visible
for the first time, including any screen where it was never verified.

### 7. Impact on existing users

Nobody has ever seen this app in dark mode, so there is no "before" to regress.
But shipping `auto` flips a large share of users to a theme that has **never
been visually verified on a device**. That is the real risk here, and it is a
reason to sequence carefully - not a reason to keep dark mode unreachable.

### 8. Option A - ship `auto` by default plus a Settings toggle

Change the mount to `auto`, wire `setThemeMode` into Settings. The persistence
and the token ramp already exist. Small code change, large surface exposure.

### 9. Option B - remove the dark ramp and commit to light-only

Honest about what ships. Deletes a meaningful amount of dead code. Forfeits the
accessibility accommodation and makes M4 and MD2's theme-awareness moot.

### 10. Recommendation - **Option A, staged**

The infrastructure is built and paid for; only the wiring is missing. But **do
not ship `auto` blind.** Stage it:

1. Land the Settings toggle first, defaulting to `light`. Dark becomes reachable
   for opt-in and internal testing without changing anyone's default.
2. Write matrix baselines for the main screens in both themes, and audit dark on
   a device - M4's 8 theme-blind screens will render wrong and must be fixed
   here.
3. Only then flip the mount to `auto`.

This gets the accommodation shipped without a mass flip to an unverified theme.

### 11. Risks

Flipping to `auto` in one step exposes every unverified dark surface at once,
including the 8 screens from M4 that ignore the theme entirely and would render
light-on-light or dark-on-dark. The staging above is what removes this risk.

### 12. Migration scope

Step 1 is small: one Settings screen entry plus the provider default. Steps 2-3
are the real work and overlap heavily with M4 and MD2.

### 13. Baselines affected

14 of 78 are dark cells (4 Button, 7 Atoms, 3 OrdersScreen). They **would not
change** from wiring the toggle - they already force `theme='dark'` explicitly
and so already test the dark path. They move only when M4's theme-blind screens
are fixed, which is the point of step 2. Note the corollary: the gate proves
dark works for `Button`, `Atoms` and `OrdersScreen` and for **nothing else**.

---

## MD4 - Is the driver flow in scope for the design system?

### 1. Current implementation

`src/features/driver/` - 7 files, 4 screens, 2,527 lines:

| Screen                    | Lines |
| ------------------------- | ----- |
| `DriverActiveOrderScreen` | 799   |
| `DriverOrdersListScreen`  | 743   |
| `DriverOrderDetailScreen` | 656   |
| `DriverEarningsScreen`    | 329   |

Reached through a real role gate at `src/navigation/RootNavigator.tsx:334`
(`user?.role === UserRole.DRIVER`). This is production UI for a live user role,
not an internal tool.

### 2. Exact evidence

Measured `features/driver/` against the eight main consumer feature areas
(orders, home, offers, profile, search, favorites, loyalty, leaderboard):

| Metric                             | Driver | Rest of app | Per file: driver vs rest |
| ---------------------------------- | ------ | ----------- | ------------------------ |
| Files                              | 7      | 159         |                          |
| Raw hex colours                    | **1**  | 332         | **0.1 vs 2.1**           |
| `colorTokens.` references          | 46     |             |                          |
| `useTheme()` calls                 | **0**  | 32          |                          |
| Design-system imports              | 8      | 124         |                          |
| Raw `fontSize:` literals           | **71** | 211         | **10.1 vs 1.3**          |
| `accessibilityLabel` per touchable | 1.08   | 0.98        |                          |

**This contradicts the audit's framing.** The audit implied the driver flow was
drifting. On colour it is the _most_ compliant area in the app - 46 token
references and exactly one raw hex, which is `pinColor='#FF9800'` on a map
marker. It also has slightly better accessibility labelling than the consumer
screens.

Its two genuine gaps are typography and theming: 71 raw `fontSize` literals in 7
files (19x `fontSize: 13`, 9x `fontSize: 15` - both off-scale), and zero
`useTheme()`, meaning it is hard-pinned to light and will break outright if MD3
ships.

### 3. Affected components / usages / screens

4 screens, 2,527 lines, one user role.

### 4. Accessibility impact

Already at parity or slightly better on labelling. But zero `useTheme()` means
that if MD3 lands, driver screens render with light-theme values on a dark
background - which is the one place in this brief where a decision can actively
create an accessibility failure rather than just fail to fix one.

### 5. UX impact

Drivers currently get a coherent experience. Excluding the flow means it drifts
from here on, silently.

### 6. Visual impact

In scope: 71 font sizes snap to the nearest scale step; theme wiring added. Out
of scope: nothing changes now, and it diverges over time.

### 7. Impact on existing users

Drivers are a small population but a high-dependency one - they use these
screens as a work tool for hours. A typography pass is low-risk for them; being
left out of MD3 is not.

### 8. Option A - driver flow is in scope

Included in the token migration and in MD3's theme work. Adds 4 screens, needs
baselines. The colour work is nearly done already.

### 9. Option B - driver flow is out of scope

Saves migration effort now. Guarantees the flow breaks visually the day MD3
ships, and the design system stops describing the whole app - which makes "is
this compliant?" unanswerable rather than just unanswered.

### 10. Recommendation - **Option A**

The cost is far lower than the audit implied. Colour is effectively done; the
remaining work is a font-size codemod over 7 files and adding `useTheme()`.
Given the flow is role-gated production UI and MD3 would visibly break it, the
exclusion option is not really "leave it alone" - it is "let it break later".

### 11. Risks

Low. The largest single change is 71 font-size literals in a flow with no
baselines, which is the standard argument for writing baselines first.

### 12. Migration scope

7 files: font-size codemod, `useTheme()` wiring, one `pinColor` to a token, plus
4 new matrix specs.

### 13. Baselines affected

**0 of 78 - the driver flow has no baseline coverage at all.** In scope means 4
new matrix specs (`DriverOrdersList`, `DriverActiveOrder`, `DriverOrderDetail`,
`DriverEarnings`), each needing its navigation and query dependencies mocked the
way `OrdersScreen.matrix.test.tsx` does.

---

## Recommended sequence, if all four are accepted

MD1 first (zero visual risk, removes 61% of spacing drift, unblocks the rest).
Then MD3 step 1 (toggle only, default unchanged) so dark becomes testable. Then
baselines for the affected screens (`OrderCard`, checkout, the 4 driver screens)
**before** any colour or type migration. Then MD2 and MD4 together, since both
are theme-adjacent. MD3 step 3 (`auto`) last, once dark has been verified on a
device.

The ordering matters for one reason: **every migration in this brief is
currently invisible to the gate.** Baselines have to come before the changes
they are meant to catch.

---

## Corrections to the audit recorded here

Per `.claude/rules/work-state.md`, decisions and corrections are append-only.
Two findings in `MOBILE_DESIGN_AUDIT_REPORT.md` were understated or misframed,
and the corrections are recorded here rather than by rewriting the audit:

1. **M5 / MD3 was understated.** The audit said there is no user-facing theme
   toggle. The measurement above shows dark mode is not merely un-toggleable but
   **unreachable**, because the mount is `defaultTheme='light'` rather than
   `auto` and nothing ever writes the AsyncStorage key the provider reads.
2. **MD4 was misframed.** The audit implied the driver flow had drifted from the
   design system. On colour it is the most compliant area in the app (1 raw hex
   across 2,527 lines). Its actual gaps are typography and theming.
3. **MD1's own count was 28 short (found 2026-08-25, during implementation).**
   Every figure in the MD1 section above - 489 off-grid, 297 for 12+20, 61% -
   came from a regex over `padding*` and `margin*` only. It never looked at
   `gap`, `rowGap` or `columnGap`, which are spacing by every definition the
   scale uses. There are 28 more (27x `gap: 12`, 1x `gap: 20`) in 21 files.

   **The true MD1 migration size is 323 sites across 86 files, not 297.** The
   recommendation is unaffected - a larger count argues the same way - but the
   number was wrong and the method that produced it was too narrow. The
   migration and its completeness test both cover the gap properties.

4. **MD3's evidence named the wrong function (found 2026-08-25).** Point 3 of
   the MD3 section says "`setThemeMode` and `toggleTheme` have zero call sites".
   `setThemeMode` is the provider's internal `useState` setter and was never on
   the context; the public API is **`setTheme`**. Grepping for the wrong name
   could easily have produced a false negative.

   Re-checked against the correct name before implementing: `setTheme` and
   `toggleTheme` both have zero call sites outside the provider, and nothing
   writes `@foodwaste/theme`. **The conclusion stands unchanged - dark mode was
   unreachable** - but it stood on a grep that did not test what it claimed to.

5. **The regression matrix this brief relies on was not observing screens at all
   (found 2026-08-26).** Every section above rests on the same premise: that the
   design matrix added in `f2336b26` is the safety net which makes MD1-MD4
   reviewable. The "which visual regression baselines would be affected" field
   was answered against that premise for all four decisions.

   The premise was false for screens. `captureStyles` recorded the resolved
   style of nodes carrying a `testID`, and **no screen in this app sets one** -
   `OrderCard`, `CheckoutScreen` and all four driver screens have zero between
   them. Measured on 2026-08-26: 40 of 40 `OrderCard` baselines and 8 of 12
   committed `OrdersScreen` baselines were the empty object `{}`. They diffed
   against nothing and reported green. The atom baselines were sound, because
   those specs pass a `testID` prop explicitly - which is why the defect
   survived: the part of the matrix anyone looked at worked.

   So the honest reading of MD1's "78 baselines unchanged" acceptance is that 74
   style keys were observed across all 78 cases. What actually carried Phase 1
   was the inverse-substitution proof, which reconstructs every migrated file
   byte for byte and is unaffected by this.

   Fixed in Phase 3 before any MD2/MD4 work: captures fall back to a structural
   path when no `testID` exists, four colour-bearing **props** (`pinColor`,
   `color`, `placeholderTextColor`, `tintColor`) are tracked alongside style, an
   empty capture is now a hard failure, and screens are rendered to stability
   rather than for a fixed number of flushes. Coverage went from 74 observed
   style keys to 350 baselines across 9 suites, none empty.

   Two further defects of the same kind were caught by the same pass and are
   recorded in `.claude/work/mobile-design-token-migration.md`: all seven
   Checkout states initially captured the loading skeleton byte-identically, and
   the first driver fixtures used a status casing that no branch matches. Both
   passed. **The lesson this brief should carry into Phase 4 is that a green
   snapshot run is not evidence a baseline observed anything** - the baseline
   has to be read, and the state it claims to be in has to be asserted.

6. **MD2's accessibility claim was measured against white only (found
   2026-08-26).** §4 of the MD2 section states that "**mapping to tokens changes
   no AA verdict** - every pair keeps its existing pass or fail status", and the
   recommendation in §10 rests on it: "a measured, bounded visual delta and no
   accessibility regression".

   Re-measured against the surfaces each grey actually appears on, rather than
   against white, two mappings do change the verdict:

   | pair                   | before   | after    |
   | ---------------------- | -------- | -------- |
   | `#64748B` on `#F8FAFC` | **4.55** | **4.41** |
   | `#6B7280` on `#F9FAFB` | **4.63** | **4.41** |

   Both cross the 4.5 AA threshold for text, in six files including
   `CheckoutScreen.styles.ts` and `OrderSuccessModal.tsx`. Those two greys - 37
   uses - were therefore **not migrated**, and are asserted as deliberately
   present by `foreignGreyPalette.test.ts` so a later "cleanup" cannot silently
   complete them.

   The other 135 uses migrated with no verdict change anywhere, so the
   recommendation itself holds; the blanket phrasing of the guarantee did not.

   Two smaller corrections found in the same pass:

   - **There are 17 foreign greys, not 13.** The 172-use and 43-file figures are
     both exactly right, which is how the wrong distinct-count survived.
   - **The `#94A3B8` row names `neutral[400]`, which is not its nearest token.**
     `neutral[400]` is at distance 49; `neutral[500]` is at 28, and 28 is the
     distance the row itself publishes. §4 of the same section independently
     calls `neutral[500]` the nearest token for this value. Migrated to
     `neutral[500]`; `neutral[400]` would also have made a failing contrast pair
     considerably worse (~1.9 against 2.68).
