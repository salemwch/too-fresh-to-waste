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
- [ ] **Phase 4 - MD2 greys.** 172 literals to neutral tokens via the brief's
      13-entry map. _Acceptance:_ no second neutral family; `MAX_RAW_COLORS`
      lowered; every baseline delta explained.
- [ ] **Phase 5 - MD4 driver.** 71 font sizes to type tokens, `useTheme()`
      added, RTL verified. _Acceptance:_ driver renders correctly in both
      themes.
- [ ] **Phase 6 - dark-mode prep.** Every theme-blind screen fixed; full gate +
      production build + device audit. _Acceptance:_ all pass **before** any
      change to the mount default.
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

## Open questions

- **Non-blocking:** `#9CA3AF` (17 uses) and `#94A3B8` (11) are 2.54/2.56 on
  white and fail WCAG AA for text; the nearest token `neutral[500]` also fails
  at 2.68. MD2 neither causes nor fixes this. Needs its own finding and a
  product call on which token secondary text should use. Raise in Phase 4, do
  not fold into it.
- **Non-blocking:** two hardcoded English strings ship in
  `DriverOrdersListScreen` - `'Starting up…'` and `'Requesting location…'` are
  not routed through `t()`, so an Arabic or French driver sees English at the
  first screen of the flow. Out of scope for a token migration; fold into Phase
  5 only if it does not widen the diff.
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
