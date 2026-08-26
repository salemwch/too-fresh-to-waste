---
status: in-progress
scope: mobile
gate:
  pnpm --filter @foodwaste/mobile type-check && pnpm --filter @foodwaste/mobile
  test && pnpm --filter @foodwaste/mobile lint
---

## Intent

Bring `apps/mobile` under the canonical design system, executing the four
product decisions (MD1-MD4) approved by the product owner on 2026-08-25 in
`MOBILE_DESIGN_DECISION_BRIEF.md`. The end state is one spacing scale, one grey
ramp, a reachable and verified dark theme, and the driver flow inside the system
rather than beside it.

The sequencing constraint is the whole plan: **every migration here is currently
invisible to the regression gate**, so baselines must be written before the
changes they exist to catch.

## Constraints

- Approved options are fixed: MD1=A, MD2=B, MD3=A (staged), MD4=A.
- **The app default stays `light` until Phase 6 passes**, including a
  real-device dark audit. Flipping to `auto` early exposes every unverified dark
  surface.
- No blind mass codemods. Per migration: verify current state, migrate, test,
  run regression, inspect drift, document exceptions.
- Baselines are captured **before** a migration, never after.
- Decisions and corrections are append-only (`.claude/rules/work-state.md` §4).
- Do not certify the design system at the end of this work.

## Tasks & Acceptance

- [x] **Phase 1 - MD1 spacing.** `sp[3]`=12, `sp[5]`=20 added; all 12/20
      padding, margin and gap literals migrated. _Acceptance:_ inverse
      substitution reproduces every changed file byte for byte; 78 baselines
      unchanged.
- [x] **Phase 2 - MD3 prep.** Theme selectable in Settings; default still
      `light`; persistence preserved. _Acceptance:_ a test proves dark is
      reachable and that the mount default is unchanged.
- [x] **Phase 3 - matrix expansion.** Baselines for OrderCard, Checkout and the
      4 driver screens across light/dark, en/fr/ar, 320/390/430. _Acceptance:_
      baselines committed and mutation-tested before Phase 4 starts. **Done:**
      350 baselines over 9 suites, none empty; the harness itself was rebuilt
      first (see decisions below).
- [x] **Phase 4 - MD2 greys.** 135 of 172 literals mapped to the neutral ramp;
      37 blocked on contrast. _Acceptance met:_ no second neutral family;
      `MAX_RAW_COLORS` 488 -> 354; **1,272 baseline values changed, all 1,272
      explained by the approved mapping, 0 unexplained.**
- [x] **Phase 5 - MD4 driver.** 32 off-scale sizes migrated (+39 on-scale
      tokenised), `useTheme()` wired through all four screens, RTL verified.
      _Acceptance met:_ **870 colour changes, every one in a dark cell; 0 in a
      light cell.** The dark baselines now differ from the light ones, which is
      the criterion Phase 3 recorded as data.
- [~] **Phase 6 - dark-mode prep.** 6.1-6.4 done; **6.5 (device audit) not done
  and 6.6 (default -> auto) therefore blocked.** Every baselined surface now
  renders differently in dark, asserted by `darkModeCoverage.test.ts`.
  Production bundle builds.
- [ ] **Migration report.** Counts before/after, baseline changes, regressions
      caught, unresolved a11y findings, remaining work.

## Decisions

**2026-08-25 - MD1 uses numeric keys `3`/`5`, not new named tokens.** DESIGN.md
§4.2 already assigns fine-grained steps to numeric keys and names "the 12px step
between `sm` and `md`" explicitly. Web's `p-3`/`p-5` were verified by resolving
the Tailwind config to be 12px/20px. Adding `smd`/`mlg` to the named scale was
rejected because §4.1's named table is shared with web and would have had to
change on both sides; numeric keys required no web change at all.

**2026-08-25 - MD1 scope stays at 12/20, leaving migrated files mixed.**
On-scale literals (16, 24, …) were not migrated, so a touched `StyleSheet` now
mixes `sp[3]` with raw `16`. Accepted and recorded as DESIGN.md §19-E23;
clearing it is audit finding M1, a separate migration. Rejected the alternative
of migrating all on-scale literals in touched files: ~800 extra edits, outside
the approved scope, and it would have buried the 323 reviewable changes.

**2026-08-25 - correction: the MD1 count was 28 short.** The brief measured
`padding*`/`margin*` only and reported 297. `gap`/`rowGap`/`columnGap` were
never looked at and hold 28 more. True size 323 across 86 files. Found by the
edge-case lens during implementation, not by the gate. Recorded in the brief's
corrections section and in audit M10.

**2026-08-25 - verification is by inverse substitution, not by snapshots.** The
78 baselines contain none of the migrated values, so a green snapshot run proves
only the absence of collateral drift. The binding proof is that substituting the
tokens back reproduces all 86 originals byte for byte - exhaustive over every
site rather than sampled.

**2026-08-25 - the rollout guard is a source assertion, and is labelled as
one.** `SettingsScreen.appearance.test.tsx` reads `App.tsx` and requires
`defaultTheme='light'`. `.claude/rules/testing.md` rightly says source-text
assertions are not tests, and this one is not counted as behavioural coverage.
It exists because the risk is a one-word edit in a file no test renders, and
because shipping `auto` early puts every dark-phone user on an unverified theme.
Mutation-checked: flipping the mount to `auto` turns it red. Phase 6 deletes it.

**2026-08-25 - correction: MD3's evidence grepped the wrong symbol.** The brief
asserted `setThemeMode` had no call sites. That is the provider's internal
`useState` setter and was never on the context; the public API is `setTheme`.
Re-checked under the correct name before building: still zero call sites, still
nothing writing `@foodwaste/theme`, so the conclusion held. The method did not.

**2026-08-26 - correction: the phase 1 baselines observed nothing, and the
harness was the reason.** `captureStyles` keyed every capture on `testID`. Not
one screen in this app sets one - `OrderCard`, `CheckoutScreen` and all four
driver screens have zero between them - so every screen-level baseline it wrote
was `{}`. Measured: 40 of 40 OrderCard baselines and 8 of 12 committed
OrdersScreen baselines were the empty object. The atoms were fine only because
their specs pass a `testID` prop explicitly.

This invalidates the phase 1 acceptance criterion as written. "78 baselines
unchanged" was true and meaningless: 74 style keys were actually being observed
across all 78 cases. The inverse-substitution proof is what actually carried
phase 1, and it still stands on its own.

Fixed by keying on the structural path (`View[0]/RCTScrollView[0]/Text[1]`) when
no `testID` is present, and by making an empty capture a hard failure rather
than a recorded value. The original testID-first reasoning - that a contract key
survives refactors where a positional one does not - is still right, and tagged
nodes keep their key; it just cannot be the only key. Positional keys churn on
structural edits, which is the correct trade here: phases 4 and 5 change style
values, not tree shape, and a baseline covering every styled node cannot be
defeated by someone forgetting to tag one.

Verified additive: 74 pre-existing style keys checked, 0 lost, 0 value-drifted,
744 keys gained.

**2026-08-26 - the harness tracks four props as well as style.** `pinColor` is a
prop, not a style, so a style-only capture would have watched phase 5 change the
driver map's raw `#FF9800` - the one raw colour the audit names - and stayed
green. `color` (ActivityIndicator), `placeholderTextColor` and `tintColor` are
in for the same reason. Recorded with an `@` prefix so a prop can never be read
as a style key. Verified additive across all baselines: 2,962 keys checked, 0
lost, 0 unexplained drift.

**2026-08-26 - screens are rendered to stability, not for a fixed number of
flushes.** The first async variant flushed twice. That settled the driver
screens and did not settle Checkout, whose React Query fetch needs more hops -
so all seven Checkout states captured `SkeletonCheckoutScreen`,
byte-identically, and passed. Replaced with a bounded loop that flushes until
the serialised tree is unchanged for four consecutive rounds, throwing if it
never settles.

Four rounds, not one: a screen waiting on a fetch is _already_ unchanged between
the first two rounds, so a single-round check declares the skeleton stable. That
is precisely the bug it was meant to catch. Mutation-checked - setting the
requirement back to 1 turns 51 of 62 Checkout tests red.

**2026-08-26 - Checkout mocks at the service boundary, with a real
QueryClient.** Overriding `useQuery` alone left `useMutation` unprovided, since
`OrderSuccessModal` (rendered unconditionally) calls it. Mocking
`offersService.getOfferById` instead keeps the real query wiring inside the
baseline, which is the part that decides whether the skeleton or the form is on
screen. `react-redux` is mocked rather than the `@/hooks` barrel, because the
barrel pulls in react-redux's untransformed ESM build.

**2026-08-26 - snapshots are not trusted to be the state they are named after.**
`CheckoutScreen.matrix.test.tsx` carries six non-snapshot assertions naming an
element that exists in exactly one branch. Snapshot-only coverage cannot tell a
correct baseline from a uniformly wrong one; that distinction is what was missed
twice in this phase, so it is now asserted rather than inspected.

**2026-08-26 - correction: the first driver fixtures used the wrong status
casing.** They set `'DRIVER_ASSIGNED'` / `'OUT_FOR_DELIVERY'`, while
`OrderStatus` values are lowercase snake_case and the driver screens compare
against `'out_for_delivery'` directly. `DriverAvailableOrder.status` is typed as
plain `string`, so it type-checked cleanly and would have made every
status-dependent branch unreachable - the active-delivery screen would have
baselined its before-pickup layout under both names. Now built from the enum.

**2026-08-26 - the global haptics mock was incomplete and it hid as a broken
suite.** `jest.setup.js` mocked only `trigger`, but `src/utils/haptics.ts` reads
`HapticFeedbackTypes` at module scope, so any suite whose tree reaches
`OrderSuccessModal` failed at import with "Cannot read properties of undefined".
Fixed in the shared setup rather than per-spec.

**2026-08-26 - correction: there are 17 foreign greys, not 13.** The brief's MD2
section says "13 greys from a different palette". Enumerating Tailwind's slate
and gray ramps against the source gives **17** distinct values. The usage total
(172) and file count (43) it publishes are both exactly right, which is how the
wrong distinct-count survived - the numbers that mattered were checked and this
one was not.

**2026-08-26 - correction: the brief's `#94A3B8` row names the wrong token.** It
reads "`#94A3B8` | `neutral[400]` | 30 [sic 28]". `#94A3B8` is (148,163,184);
`neutral[400] #BDBDBD` is at distance **49**, `neutral[500] #9E9E9E` at **28**.
The published distance of 28 is the distance to neutral[500], and §4 of the same
document independently calls neutral[500] "the nearest token" for this value. So
the table cell is a typo, not a deliberate override, and the row is internally
inconsistent with its own distance column.

Resolved to `neutral[500]`, which is what both the arithmetic and §4 say. It is
also the better call on contrast: `neutral[400]` on white is ~1.9 against
neutral[500]'s 2.68, so the typo would have made a failing pair substantially
worse.

**2026-08-26 - #64748B and #6B7280 are NOT migrated, on contrast grounds.** Both
map to `neutral[600] #757575`. Measured against the surfaces they actually
appear on rather than against white:

| pair                   | before   | after    |
| ---------------------- | -------- | -------- |
| `#64748B` on `#F8FAFC` | **4.55** | **4.41** |
| `#6B7280` on `#F9FAFB` | **4.63** | **4.41** |

Both cross from passing to failing AA. Six files are affected, including
`CheckoutScreen.styles.ts` and `OrderSuccessModal.tsx` - the checkout path. The
phase brief says to stop a mapping that creates a new contrast failure rather
than force it, so both greys are left as raw hex (37 uses) pending the product
decision in audit finding M16.

This falsifies a claim in the decision brief: MD2 §4 states that "**mapping to
tokens changes no AA verdict** - every pair keeps its existing pass or fail
status". That was measured against white only. On the `*-50` screen background
two mappings do change the verdict.

**2026-08-26 - blocked greys are asserted present, not merely absent from the
map.** `foreignGreyPalette.test.ts` fails if a Tailwind value reappears _and_
fails if `#64748B`/`#6B7280` disappear. Without the second assertion the obvious
follow-up cleanup - "we missed 37" - would push six screens below AA with a
green suite. Mutation-checked in both directions.

**2026-08-26 - semantic tints are out of scope and stay raw.** An early sweep
that filtered greys by saturation pulled in `#FEE2E2` (error surface), `#DBEAFE`
(info), `#F0FDF4` (success), `#FCE7F3`, and the brand-teal derivatives `#0F2628`
/ `#4B6264` / `#8FA6A9`. Mapping any of those to a neutral would have destroyed
the semantic while passing every test. The migration is scoped to the two
Tailwind ramps by exact value, never by "looks grey".

**2026-08-26 - `colorTokens` must not be mocked.**
`KonnectPaymentSheet.test.tsx` stubbed it with only `base.primary`, so the
moment MD2 gave that component a `base.neutral` read the whole suite failed to
load. It is a pure constants module with no native dependency; there was nothing
to stub, and a fake of a constant can only drift from it. Mock deleted rather
than extended.

**2026-08-26 - correction: "71 off-scale font sizes" was 71 font-size
literals.** The driver screens contain 71 `fontSize:` literals, of which **39
are already on the scale** (12, 14, 16, 18, 48) and only **32 are off it** (13,
15, 17, 34, 40, 44). The audit and brief both read as though all 71 were
violations. They conflate "raw literal" (audit M1) with "off-scale" (audit M8) -
different findings with different fixes.

Both were migrated, and they are reported separately because their risk is not
comparable: the 32 change rendered output, the 39 cannot.

**2026-08-26 - font sizes map by nearest token, ties broken downward, applied
per value rather than per usage.** `13 -> sm`, `15 -> base`, `17 -> md`,
`34 -> 4xl`, `40 -> 6xl`, `44 -> 6xl`.

Mapping by DESIGN.md §3.2's role column would be more faithful in isolation, and
it was rejected: `infoLabel` and `infoValue` are both 13 today, so sending the
label to `sm` and the value to `base` would **invent** a hierarchy the screen
does not have. That is the redesign the phase brief rules out. One source value,
one target token.

Ties break downward because these are dense rows in fixed-height containers and
French runs ~30% longer than English (§3.6.7): growing every row by a step risks
clipping in fr/ar, shrinking cannot. Relative hierarchy survives either way - 13
and 15 are one step apart, and so are 12 and 14.

Checked afterwards: all five `lineHeight` literals in the driver flow still sit
at 1.13-1.57x their (now smaller) font size, so nothing is clipped.

**2026-08-26 - `PRIMARY` and `SUCCESS` became theme reads too, not just the
surface colours.** The obvious minimal change was to theme only the greys and
leave the brand constants alone, since a brand colour is theme-independent by
definition. Measured, that would have shipped an unreadable screen:
`primary[500] #1E4448` on the dark surface `#1E1E1E` is **1.57**. The theme
already maps `colors.primary` to `primary[300]` in dark, which is **6.31**, and
`colors.success` to `success[300]` at 8.28. Using `theme.colors.primary` rather
than `colorTokens.base.primary[500]` is what makes dark mode legible rather than
merely different.

**2026-08-26 - styles are memoised per colour scheme in a module cache, not per
component.** `createDriverStyles` in `features/driver/driverTheme.ts` returns a
hook backed by a `Map<ColorScheme, T>`. Calling `StyleSheet.create` in a
component body allocates a new object every render, and a fresh identity
invalidates every `React.memo` child it reaches - `.claude/rules/performance.md`
#1 and #2 - which on `DriverOrdersListScreen` means every `FlashList` row. There
are only two schemes, so the factory runs at most twice per screen for the life
of the process and the identity handed to children never changes while the theme
does not. `useMemo` per component would recompute per instance; this does not.

**2026-08-26 - the map marker moved to `secondary[700]`, and `warning` was
rejected.** The pickup pin was `#FF9800`, the one raw colour the audit names.
Candidates by distance: `secondary[700] #FFA000` (**8**), `warning[500] #F57C00`
(30), `secondary[500] #FFC107` (42), `accent[500] #F55449` (100).

`warning` is the closest _semantic-sounding_ token and is wrong: a collection
point is not a warning state, and encoding that in a token is worse than the raw
hex it replaces - the next reader would take it as meaning something. `accent`
is reserved for destructive. `secondary`'s documented role is "warm secondary
highlights", which is what this marker is: the secondary waypoint beside the
customer pin. At distance 8 it is also imperceptible, so requirement "do not
redesign unnecessarily" is met at the same time.

**2026-08-26 - light rendering is unchanged by the theme work, and that was
verified before regenerating.** Running the driver suites after wiring
`useTheme` produced exactly **66 failures, all of them dark cells** (22
baselines x 3 dark cells); all 110 light-cell baselines passed byte-identical.
Counted across the whole phase: 870 colour changes in dark cells, **0 in
light**.

**2026-08-26 (6.1) - light `onSurfaceVariant` moved from neutral[600] to
neutral[700].** Only two roles bind to neutral[600]: light `onSurfaceVariant`
and dark `outline`. They are different roles and only the first is a text
colour, so only the first moved - dark `outline` passes non-text 3.0 on every
dark surface (3.03-4.07) and is untouched.

neutral[700] passes AA on all four light surfaces (5.34-6.19) and was unused by
any light role, so the light text ramp is now contiguous: onBackground 900,
onSurface 800, onSurfaceVariant 700. The cost is that primary/secondary
separation narrows from 2.18 to 1.62; accepted, because colour is not the only
carrier of that hierarchy and the alternative was failing AA app-wide.

Verified: 470 baseline values changed, every one `#757575 -> #616161`, all in
light cells, 0 unexplained.

**2026-08-26 (6.1) - the 37 held grey mappings followed the token, not the
nearest-token rule.** MD2 blocked `#64748B` and `#6B7280` because their nearest
token, neutral[600], gave 4.41. With light `onSurfaceVariant` now at
neutral[700] they map there instead: 5.92 on the same background, against 4.55
and 4.62 before.

This deliberately abandons nearest-token (46 and 37 away, versus 28 and 15).
Nearest-token was the right rule while every candidate passed; here it selected
a failing value, so the semantic role wins over proximity.
`foreignGreyPalette.test.ts` now has an empty exception list and forbids the
whole ramp.

**2026-08-26 (6.1) - contrast is now a test, not a report.**
`themeContrast.test.ts` asserts every foreground role against every surface the
app composes it with, in both themes, plus a self-check of the WCAG helper
against known reference values. Every contrast finding in this migration was
previously found by hand, one pair at a time, and the same pair kept reappearing
from different directions.

**2026-08-26 (6.1) - two token-level failures found by that test are NOT fixed,
and are pinned rather than skipped.**

- **M17, light `outline`.** neutral[300] is 1.14-1.26 against the light
  surfaces, against a 3.0 target for a control boundary. Even neutral[500] only
  reaches 2.57, so closing it means neutral[600] and visibly redrawing every
  border in the app.
- **M18, status containers.** Four of eight `on*Container`/`*Container` pairs
  fail AA - all four in dark, plus warning and info in light. This is the same
  defect `.claude/rules/ui-ux.md` already records on web, and DESIGN.md 2.5
  already prescribes the solid-fill replacement.

Both are asserted against a table of today's measured reality, so the values
cannot silently worsen and the gap stays visible in the expected values. Fixing
either is a design change, not a token migration.

**2026-08-26 (6.3) - correction: M4's list of eight was neither complete nor
entirely correct.**

Wrong on two entries. `LeaderboardScreen` is **deliberately** theme-fixed - its
palette file says so in its own header ("always renders on a dark gold-accented
surface") - and `WelcomeScreen` is a full-bleed brand-primary splash whose
`c.primary` in dark would become light teal, i.e. worse. Neither is a defect.

Incomplete in the direction that matters more: it listed only _screens_.
`darkModeCoverage.test.ts` - which reads baselines rather than source -
immediately found `OrderCard` and the `Button` disabled variant rendering
identically in both themes. OrderCard is the most-seen card in the product and
was in nobody's list, because the audit was looking for screens.

**2026-08-26 (6.3) - Checkout gives up pure white to gain a dark mode.** No
theme role has a light value of `#FFFFFF`, so a ground/card pair that survives
into dark has to move one of the two. Ground
`#FAFAFA -> c.surfaceVariant #F5F5F5` and card `#FFFFFF -> c.surface #FAFAFA`:
both 5 points in RGB, imperceptible, and it matches the convention the driver
flow already set rather than inventing a second one. A white card on a dark
screen is not imperceptible.

**2026-08-26 (6.3) - status tints stay literal in Checkout and OrderCard.** The
obvious migration is `SUCCESS_SURFACE -> c.successContainer` and so on.
Measured, that trades a hardcoded palette for a tokenised one that is worse
(M18). `SUCCESS_TEXT` on `SUCCESS_SURFACE` is already 3.6 and fails; that is
pre-existing and is not changed here either. These values are light-only, so
both surfaces are theme-aware while their badges are not yet - recorded rather
than papered over.

**2026-08-26 (6.4/6.5) - coverage was widened by generalising the gate, not by
writing twelve more suites.** `darkModeCoverage.test.ts` asserts that _every_
committed baseline differs between light and dark, with a named, empty exemption
list. That catches a theme-blind surface the moment it gains a baseline, which
the brief's enumerated list cannot. The screens named in 6.4 that have no
baseline yet (Home, Search, Favorites, Profile, Settings, Loyalty, Leaderboard,
modals) are **still uncovered** and are listed as remaining work.

## Open questions

- **RAISED, now audit finding M16.** `#9CA3AF` and `#94A3B8` migrated to
  `neutral[500]`, which is 2.68 on white and still fails AA. 29 `neutral[500]`
  usages, **17 of them text a low-vision user must read**, enumerated with
  file:line in M16. The same product decision unblocks the 37 `#64748B`/
  `#6B7280` uses. **Blocking for Phase 6's device audit, not for Phase 5.**
- **Non-blocking, still open after Phase 5.** `DriverOrdersListScreen` ships six
  untranslated English strings: `'Starting up…'`, `'Requesting location…'`, and
  the online/offline `Switch`'s `accessibilityLabel` and `accessibilityHint`
  ternaries (four strings). A French or Arabic driver sees English at the first
  screen of the flow, and a screen-reader user hears it. **Deliberately not
  fixed in Phase 5**: the phase brief forbids using the migration to resolve
  unrelated findings silently, and a translation change would not be visible in
  the resolved-style gate. Needs its own change with keys added to all three
  locale files together.
- **Non-blocking:** the driver screens compare `order.status` against string
  literals rather than `OrderStatus`, and the field is typed `string`. That is
  what let the fixture bug above type-check. Worth tightening, separately.
- **Non-blocking:** a Checkout user with no stored location sees delivery
  offered, because `isOutsideDeliveryZone` returns `false` when `userCoords` is
  null. It is now baselined and asserted as current behaviour, not endorsed -
  the backend `MAX_DELIVERY_KM` gate would reject at submit.
- **Non-blocking:** `OrderHistoryScreen` is dead code (audit M15). It appears in
  the Phase 1 diff only because it contained migrated literals. Decide whether
  to delete rather than maintain it through Phases 4-6.
