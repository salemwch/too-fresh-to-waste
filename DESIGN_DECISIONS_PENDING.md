# Design Decisions Pending

Findings from `DESIGN_AUDIT_REPORT.md` that are **verified as real** but were
deliberately not implemented, because each needs a product, brand or design call
rather than an engineering one.

Nothing here is blocked on effort. Each is blocked on someone deciding.

**Date:** 2026-08-24 · Every item below was re-verified against current `HEAD`.

---

## D1. Coral fills cannot carry white text (V5 / DESIGN.md §19-E2)

**Verified.** `--accent` is coral; `--accent-foreground` is white. Measured
**3.38:1** - below the 4.5 AA needs for text.

Now visible in a committed baseline: `select-open-selected.png` shows the
highlighted menu item as white-on-coral.

Same shape on `--destructive`: white on it is **3.78:1**.

| Option                                | Consequence                                                      |
| ------------------------------------- | ---------------------------------------------------------------- |
| Dark ink on the existing coral        | Passes at 5.78. A red button with dark text reads unusually      |
| Darken the fill (`error-600 #C62828`) | Passes at 5.62 with white text, but is no longer the brand coral |
| Reserve coral for non-text marks only | Passes 3:1 as a non-text indicator; loses coral CTAs             |

**Recommendation:** darken the fill for text-bearing surfaces, keep brand coral
for icons, borders and indicators. **Not actioned - this is a brand call.**

---

## D2. `border` is 1.24:1 against white (DESIGN.md §19-E4)

**Verified.** `--border` / `--input` = `174 8% 90%`. WCAG 1.4.11 wants 3:1 for a
boundary that identifies a control.

Most design systems accept this and lean on label, placement and focus ring
instead. Either darken the input border specifically, or accept formally and
name the compensating affordances. **Not actioned.**

---

## D3. `/parcless-bag` runs a parallel palette (V6)

**Verified.** 41 raw hex in two files. Five values exist in no token file:

`#F2EBD9` (14) · `#7FA896` (8) · `#C05F4A` (5) · `#3D6B5C` (5) · `#3A4F48` (2)

One marketing page has effectively forked the brand. Either map each to an
existing token (changes how the page looks) or promote them to `brand.*` with
contrast measurements (blesses a second palette).

**Not actioned - product owns whether this page is on-brand or deliberately
distinct.**

---

## D4. `.glass` on 76 dashboard cards (V17 / §19-E7)

**Verified.** 76 usages, all merchant dashboard cards, shaped
`class='glass rounded-2xl p-[24px] shadow-soft'`.

`backdrop-filter: blur(20px) saturate(140%)` on a scrolling surface repaints
everything behind it every frame. §7.5 permits it only on the fixed header and
modal overlays.

Removing it is not a refactor - it changes what 76 cards look like. **And those
routes are behind auth, so no screenshot baseline can prove the outcome.**
Decide between accepting the repaint cost and restyling the dashboard.

**Not actioned.**

---

## D5. The `accent` ramp differs between web and mobile (V19 / §19-E18)

**Verified.** 7 of 10 steps differ; only `50`, `500`, `900` agree. Web's ramp is
a tint/shade progression around `500`; mobile's `300` (`#F04535`) is a distinct
brand coral, not a tint.

Nothing is broken today - both `accent-700` values clear AA - but a component
ported between platforms changes colour at every non-500 step.

**The question is: is `accent-300` a tint of coral, or a second coral?** That is
a brand decision. **Not actioned.**

---

## D6. Radius scales are transposed (V15 / §19-E6)

**Verified.**

| Key   | Web                   | Mobile |
| ----- | --------------------- | ------ |
| `md`  | 12px                  | 8px    |
| `lg`  | 8px (`var(--radius)`) | 12px   |
| `xl`  | 20px                  | 16px   |
| `2xl` | 24px                  | 20px   |

§6.1 already declares mobile's scale canonical, so the standard exists. But
adopting it changes the corner radius of **every card, button and input** in the
product, and `--radius` moves `0.5rem` -> `0.75rem`.

Unlike the others here, this one **can** now be verified: the 240 screenshot
baselines would show exactly what moves. It is listed as a decision rather than
a task because "every corner in the product changes" deserves a yes before the
work, not after.

**Exact impact if approved.** Web `borderRadius` changes `md` 12->8, `lg` 8->12,
`xl` 20->16, `2xl` 24->20, and `--radius` moves `0.5rem`->`0.75rem`. Every
shadcn primitive is affected: `Button`/`Input`/`Select`/`Tabs` use `rounded-md`,
`Card` uses `rounded-lg`, `Dialog` uses `rounded-xl`. So every button, input,
select, tab strip, card and modal in the product changes corner radius, on
public and authenticated routes alike.

**Verifiable.** All 240 baselines would move; the diff would show exactly what
changes on the 22 public routes. The 45 authenticated routes would change with
no baseline to check them against.

**Not actioned. Ready to execute on approval.**

---

## D7. RESOLVED - Radix `DirectionProvider` (§19-E22)

Investigated and fixed 2026-08-25. Not a product decision after all: Radix
resolves direction from its own context, so
`<DirectionProvider dir={locale.direction}>` in `app-providers.tsx` was the
whole fix. Verified in the RTL baselines at all three viewports - Select check
indicator, trigger chevron and `TabsList` order all mirror correctly, with no
LTR baseline moved. See `DESIGN.md` §19-E22.

---

## D8. Remaining `left-` / `right-` offsets (V9 remainder)

**Verified.** 62 `left-*` and 53 `right-*` remain after the V9 pass converted
106 margin, padding and text-alignment utilities.

These were left on purpose. Absolute offsets need per-site judgment: some are
direction-neutral pairs (`left-0 right-0`), some sit in SVG or LTR-locked
content, and some are paired with a sibling's padding on a different element -
the case that produced the check-indicator coupling in `SelectItem`.

Converting them blind is how the `text-align` regression happened (§19-E21).
They need a reviewed pass, ideally after D7, since Radix direction changes what
"correct" looks like.

**Not actioned.**

---

## What was implemented instead

For contrast, the items from the same pass that needed no decision:

| Finding | Action                                                                  |
| ------- | ----------------------------------------------------------------------- |
| V7      | `#FF7979` -> `fill='currentColor'` on `text-brand-coral`                |
| V9      | 106 physical utilities -> logical, across 37 files                      |
| V10     | No change needed; rendered DOM measures 0 unnamed controls on 22 routes |
| V16     | Theme moved to a cookie + pre-paint script; flash eliminated            |
| V18     | Usage constraint documented (§19-E20)                                   |
