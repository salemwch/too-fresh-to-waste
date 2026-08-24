# V1 Spacing Migration Report

**Branch:** `chore/v1-spacing-migration` **Date:** 2026-08-24 **Scope:**
`apps/web`, `packages/ui`. No unrelated changes. **Finding:** V1 in
[`DESIGN_AUDIT_REPORT.md`](./DESIGN_AUDIT_REPORT.md) Part 1.

---

## Outcome

The `theme.extend.spacing` override of Tailwind's numeric keys `0`-`10` is
removed and replaced with named semantic tokens. Tailwind's default `n x 4px`
scale is restored, so every shadcn primitive renders at the size it was authored
for.

| Primitive                    | Class       | Was      | Now      |
| ---------------------------- | ----------- | -------- | -------- |
| `Button` default             | `h-10`      | **96px** | **40px** |
| `Button` sm                  | `h-9`       | **80px** | **36px** |
| `Button` lg                  | `h-11`      | 44px     | 44px     |
| `Button` icon                | `h-10 w-10` | **96px** | **40px** |
| `Input` / `Select` / `Tabs`  | `h-10`      | **96px** | **40px** |
| `Card` header/content/footer | `p-6`       | **40px** | **24px** |
| Button icon glyph            | `size-4`    | **24px** | **16px** |
| `Avatar` (packages/ui)       | `h-10 w-10` | **96px** | **40px** |

Verified in the compiled bundle: `h-9` 2.25rem < `h-10` 2.5rem < `h-11` 2.75rem.
**The size ordering is monotonic again** - `sm` is no longer taller than `lg`.

---

## Regression coverage

**Added before any migration change**, in commit `72286efe`.

`apps/web/scripts/spacing-snapshot.mjs` resolves every spacing-derived utility
in `apps/web/src` and `packages/ui/src` to the pixel it renders at, and compares
a per-file multiset of `<prefix>:<px>` counts against a committed baseline,
bucketed by migration category. A multiset rather than line numbers makes the
check invariant to code moving and to which key was used - only the rendered
pixel matters, which is exactly what the migration must preserve.

Paired Jest gate: `src/__tests__/design/spacing-scale.test.ts` (11 tests),
following the existing `check-opacity-scale.mjs` convention in this repo.

```bash
pnpm --filter @foodwaste/web check:spacing          # compare to baseline
pnpm --filter @foodwaste/web check:spacing --report # list intentional changes
pnpm --filter @foodwaste/web snapshot:spacing       # rebaseline, deliberately
```

### This is a computed-value gate, not pixel screenshots

**No browser automation is installed in this repo** (no Playwright, Puppeteer,
Storybook or Chromatic; the Chrome extension is not connected either), and
adding one would have been a large unrelated dependency change.

What was built instead resolves the complete set of visual effects this
particular migration can have - a class-to-pixel remapping - across **all 162
files** that carry spacing utilities. Screenshot diffing would have covered a
handful of routes.

**What it cannot catch**, and what a human still has to look at:

- Reflow. If an icon shrinks from 24px to 16px, the gate confirms the icon's
  size; it cannot tell you the row now looks unbalanced.
- A utility deleted outright rather than re-valued.
- Anything not expressed as a spacing utility - arbitrary values, inline styles,
  CSS files.
- Whether a _correct_ pixel value is the _right design decision_.

---

## Commits

| Commit     | Stage | Contents                                                   |
| ---------- | ----- | ---------------------------------------------------------- |
| `72286efe` | 0     | Regression harness + baseline, added **before** any change |
| `ba1cdba0` | 1     | Config change + Category A/D remap (143 files)             |
| `7b0b9b55` | 2     | Remove Button height workarounds (25 files)                |
| `7382107f` | 3     | Restore touch targets shrunk by the scale change (6 files) |

A fifth commit rebaselines the snapshot so the gate guards the new state going
forward. `3170ad4e` (dark mode, iOS zoom, focus rings, docs) precedes the
migration and is not part of it.

---

## What changed, by category

### Category A - layout spacing: preserved exactly

`p* m* gap* space*`. **4,223 utilities across 140 app files** remapped to the
named token that renders the identical pixel value.

| Old key | Renders | New token | Count |
| ------- | ------- | --------- | ----- |
| `3`     | 16px    | `md`      | 832   |
| `2`     | 8px     | `sm`      | 831   |
| `4`     | 24px    | `lg`      | 672   |
| `1`     | 4px     | `xs`      | 493   |
| `6`     | 40px    | `2xl`     | 301   |
| `5`     | 32px    | `xl`      | 253   |
| `8`     | 64px    | `4xl`     | 232   |
| `0.5`   | 2px     | `xxs`     | 177   |
| `10`    | 96px    | `6xl`     | 106   |
| `16`    | 64px    | `4xl`     | 104   |
| `12`    | 48px    | `3xl`     | 70    |
| `20`    | 80px    | `5xl`     | 48    |
| `24`    | 96px    | `6xl`     | 45    |
| `7`     | 48px    | `3xl`     | 41    |
| `9`     | 80px    | `5xl`     | 18    |

**801 utilities kept their numeric key** because no named token renders their
pixel value exactly: `1.5` (6px), `2.5` (10px), `3.5` (14px), `11` (44px), `14`
(56px) and larger. None were overridden, so all render unchanged. This is the
fine-grained tier DESIGN.md §4.2 permits alongside the named scale.

The remap ran as a **single simultaneous pass** with a lookup table. Run
sequentially (`3->4`, then `4->6`) it would have double-migrated everything that
started at `3`.

### Category D - positioning: preserved exactly

`inset top right bottom left start end translate-*`. Same remap, included in the
4,223 above.

### Category B - icon sizing: intentionally changed

Not remapped. Left to snap back to the lucide/shadcn idiom they were copied
from. The result lands almost entirely on the approved icon scale in DESIGN.md
§5.2:

| Icon px | Before | After | On the approved scale? |
| ------- | ------ | ----- | ---------------------- |
| 12      | 0      | 110   | yes (`xs`)             |
| 16      | 110    | 198   | yes (`sm`, default)    |
| 20      | 0      | 68    | yes (`md`)             |
| 24      | 198    | 38    | yes (`lg`)             |
| 32      | 68     | 36    | yes (`xl`)             |
| 40      | 38     | 41    | yes (`2xl`)            |
| 48      | 85     | 36    | yes (`3xl`)            |
| 64      | 49     | 13    | no                     |
| 96      | **41** | **0** | no - eliminated        |

**41 icons rendering at 96px are gone.** 16px, the standard icon size, went from
110 to 198 occurrences.

### Category C - box dimensions: intentionally changed, reviewed

716 app-code changes. Large boxes snapped to their authored values - most are
avatars and icon containers landing exactly on DESIGN.md §5.3 (`h-10 w-10` 96px
-> 40px is the `md` avatar; `h-8 w-8` 64px -> 32px is `sm`).

Two groups needed manual correction, in Stages 2 and 3.

---

## Workarounds removed (requirement 7)

### Stage 2 - Button height overrides, 65 occurrences in 25 files

`h-7` / `h-8` on a `<Button>` existed only because `size="sm"` rendered 80px and
the default 96px, so authors forced a smaller box by hand. The shape was
everywhere:

```tsx
<Button size='sm' variant='outline' className='h-7 text-xs'>
```

With the scale restored those overrides became actively harmful - `h-7` now
resolves to 28px, below both the 36px `sm` variant and the 44px touch floor.

- `h-7 w-7` square icon buttons -> `h-9 w-9` (36px, matching `sm`) - **11**
- standalone `h-7` / `h-8` -> removed, the variant decides - **54**

61 of the 65 already carried a `size` prop; the other 4 fall back to the 40px
default, which is the intended height for a button with no size.

### Stage 3 - touch targets, 12 occurrences in 6 files

A scan of every `button` / `a` / `Button` / `Link` with an explicit height found
twelve that Stage 1 had re-valued below 32px:

| Element                                 | Was  | Stage 1 gave | Fixed to       |
| --------------------------------------- | ---- | ------------ | -------------- |
| `<Button size='sm' className='h-6'>` x9 | 40px | **24px**     | 36px (variant) |
| raw `<button className='h-7'>` x3       | 48px | **28px**     | 48px (`h-12`)  |

The three raw buttons are dialog footer actions (Cancel / Confirm) with no
variant to fall back to, so they take an explicit `h-12` - exactly what they
rendered before the migration.

The same scan now reports **zero** interactive elements under 32px.

---

## Verification

Run after every stage.

| Stage | type-check | lint     | tests | build | spacing gate     |
| ----- | ---------- | -------- | ----- | ----- | ---------------- |
| 0     | pass       | 0 errors | 847   | -     | baseline written |
| 1     | pass       | 0 errors | 851   | pass  | **0 drift**      |
| 2     | pass       | 0 errors | 851   | pass  | **0 drift**      |
| 3     | pass       | 0 errors | 851   | pass  | **0 drift**      |

Lint reports only pre-existing warnings (`<img>` vs `next/image`, hook deps,
`any`), none on lines this migration touched.

**Zero drift in the locked categories across all 162 files, at every stage.**

---

## Unresolved visual cases

These need a human looking at a rendered screen. None is a regression this
migration introduced; all are pre-existing choices the migration has now made
visible.

**U1. 201 icons at 14px are off the approved scale.** From `size-3.5` and
`h-3.5 w-3.5`. Key `3.5` was never overridden, so these render identically
before and after - but 14px is not in DESIGN.md §5.2 (12 / 16 / 20 / 24 / 32 /
40 / 48). They exist because `3.5` was the only route to 14px when `3` was 16px
and `4` was 24px. **Not changed:** moving 201 icons to 16px is a real visual
change in dense UI, with no regression coverage that could catch a bad outcome.
Decide whether to add 14px to the scale or migrate them.

**U2. 49 icons at 28px** (`size-7`) and **9 at 36px** (`size-9`), same
situation, same reasoning.

**U3. Icons at 6px, 8px and 10px** (`size-1.5`, `size-2`, `size-2.5`, 35 total).
Likely decorative dots rather than icons, but unverified.

**U4. Large squares counted as icons.** The harness treats any square `h-N w-N`
as an icon, so `h-32 w-32` image containers (128px+, 11 occurrences) appear in
Category B. They are unchanged; the classification is imprecise, not the code.

**U5. `text-xs` (10px) on compact buttons.** Roughly 40 of the buttons whose
height override was removed still carry `text-xs`, which DESIGN.md §3.6 rule 4
forbids on anything actionable. Deliberately left alone - it is a separate
finding, not a spacing workaround, and folding it in would have widened the
migration.

**U6. Category C beyond the touch-target scan.** 716 app-code box dimensions
changed. The scan covered interactive elements under 32px and found 12, now
fixed. The remaining non-interactive boxes - dividers, progress bars, image
frames, fixed-height panels - were **not** individually reviewed. Any that were
hand-tuned against the distorted scale will look wrong.

**U7. No route has been opened in a browser.** Every claim here is static
analysis plus compiled-CSS measurement. **V1 should not be considered complete
until a human has viewed the affected routes** at 360 / 768 / 1280, in `en`,
`fr` and `ar`, in both themes.

---

## Follow-ups this migration deliberately did not do

- **V15 radius unification** (`DESIGN.md` §19-E6) was sequenced after V1 so the
  visual diffs stay readable. Still open.
- **E16** - the 961 fractional-key usages (`1.5`, `2.5`, `3.5`) are now the main
  source of off-scale values and should be reviewed as a group.
- **`.claude/rules/web.md` rule 9** still says the fonts are Inter + Noto Sans
  Arabic. That is the same staleness as V11, in a file the V11 fix did not
  cover. Out of scope here; worth a one-line correction.
- The `ui-ux.md` spacing and radius blocks still describe the pre-migration
  scale. Its header already defers to `DESIGN.md`, but the blocks themselves
  should be updated now that the code has moved.

---

## Rollback

Each stage is a single commit and reverts cleanly in reverse order. Reverting
`ba1cdba0` alone restores the old scale but leaves Stages 2 and 3 pointing at
variant heights that no longer exist at those pixel values - revert all three,
or none.
