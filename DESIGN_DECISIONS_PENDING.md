# Design Decisions Pending

Findings from `DESIGN_AUDIT_REPORT.md` that are **verified as real** but were
deliberately not implemented, because each needs a product, brand or design call
rather than an engineering one.

Nothing here is blocked on effort. Each is blocked on someone deciding.

**Date:** 2026-08-24 · Every item below was re-verified against current `HEAD`.

---

## D1. Coral fills cannot carry white text (V5 / DESIGN.md §19-E1, §19-E2)

**RESOLVED 2026-09-01.** Both failures are fixed. The entry is kept for the
reasoning, not as open work.

**Was:** `--accent` is coral with a white `--accent-foreground` = **3.38:1**.
Same shape on `--destructive`: white on it is **3.78:1**. Both below AA's 4.5.

| Option                                | Consequence                                                 |
| ------------------------------------- | ----------------------------------------------------------- |
| Dark ink on the existing coral        | Passes at 5.76. A red button with dark text reads unusually |
| Darken the fill (`error-600 #C62828`) | Passes with white text, but is no longer the brand coral    |
| Reserve coral for non-text marks only | Passes 3:1 as a non-text indicator; loses coral CTAs        |

**What was done - the two were fixed from opposite ends, deliberately:**

- **`accent` moved its foreground** to dark ink: **3.38 -> 5.76**. DESIGN.md
  §2.4 had approved that pairing since the table was written, so this
  implemented a decided position rather than taking a new one (§21-C8). The
  coral fill is untouched, so brand coral survives for icons, borders and
  indicators.
- **`destructive` moved its fill** to the existing `error` red `#D32F2F`,
  keeping white: **3.78 -> 4.98**. White-on-red is what a destructive control is
  expected to look like, which is why the fill moved and the text did not.

`error-600 #C62828`, named in the option table above - this entry claimed it was
**"not a token this repo defines"**, and that was **wrong**. It is `error[600]`
in the mobile ramp, and DESIGN.md §2.5 cites `error-600` with a measured ratio;
what was missing was a web Tailwind exposure, added 2026-09-01 for §19-E31.

The resting fill is unaffected: `#D32F2F` is `error-500` and a 500 step is right
for a resting fill, which is why the result is 4.98 rather than the predicted
5.62. Both clear AA.

Fixed in **two** files, because the token is redefined per route group:
`app/globals.css` and `merchant-signup/merchant-signup.css`, the latter shipping
stock shadcn red (`#EF4444`, white = 3.76). One hardcoded `text-white` on
`bg-accent` - the merchant establishment save button - had to move to
`text-accent-foreground` with it.

The fill change carries the **91 `text-destructive`** sites from 3.78 to 4.98,
since darkening a fill and darkening text move the same way.

**Two new findings came out of the fix, both now in DESIGN.md §19:**

- **E31** - `hover:bg-destructive/90` and `/80` faded the fill toward the page.
  **Resolved 2026-09-01**: re-measured at HEAD they were 4.25 and 3.64 (the
  figures here were computed against pure white, not the real `#FAFAFA`
  foreground), plus an unrecorded dark-mode Badge instance at ~4.4. Both now use
  a solid `--destructive-hover` from the existing error ramp.
- **E32** - this entry previously said the failure was "now visible in a
  committed baseline: `select-open-selected.png` shows the highlighted menu item
  as white-on-coral." That was true of the image and **false as evidence.** All
  252 visual tests passed against baselines still holding the old colours.
  Screenshot comparison cannot detect a colour-token change of this size;
  `tests/visual/contrast.spec.ts` now covers it by measuring computed colours.

---

## D2. `border` is 1.24:1 against white (DESIGN.md §19-E4)

**Verified.** `--border` / `--input` = `174 8% 90%`. WCAG 1.4.11 wants 3:1 for a
boundary that identifies a control.

Most design systems accept this and lean on label, placement and focus ring
instead. Either darken the input border specifically, or accept formally and
name the compensating affordances. **Not actioned.**

---

## D3. `/parcless-bag` runs a parallel palette (V6)

**RESOLVED 2026-09-01** as `DESIGN.md` §19-E33. Kept for the reasoning.

**Was:** 41 raw hex in two files, five values in no token file - `#F2EBD9` (14)
· `#7FA896` (8) · `#C05F4A` (5) · `#3D6B5C` (5) · `#3A4F48` (2). The open
question was whether the page had forked the brand deliberately.

**The audit that settled it** (`.claude/work/parcless-bag-palette-audit.md`)
found something underneath the brand question that was not product-owned: all 8
sage usages were body text, terracotta carried body text and white labels, and
`bg-primary` inverts under `.dark` while the hardcoded foregrounds do not.
Measured across all 44 text pairings: **25 failing in light, 40 in dark.**

**What was done - the palette was kept, the mechanism was changed.** The brand
question is answered in favour of "deliberately distinct": ten `--pb-*` tokens
in `parcless-bag.css`, scoped to the page's own `<main>`, with **no `.dark`
block**. The page no longer participates in theming, which is the normal
treatment for an art-directed marketing page. Light and dark route baselines are
now pixel-identical at all three viewports.

Five values moved, each derived on its own hue and saturation by the minimum
lightness step that clears the worst ground it is painted on - sage
`#7FA896`->`#9FBEB0`, terracotta `#C05F4A`->`#AB4F3B`, gold for small text
`#C4A25A`->`#C6A55F`, ink on light grounds `#1E4448`->`#0A1C1E` (already the
marquee colour, so not a new value), muted subtitle `#5A7A72`->`#527068`. A
single terracotta covers both its roles, so the page did not gain a second one.
Non-text uses - the illustration, surface tints, hairline borders, the drop
shadow - were left alone.

**0 of 87 text nodes now fail**, gated by `tests/visual/contrast.spec.ts` across
3 viewports x {light-en, dark-en, light-ar, light-fr}, mutation-checked.

**Not a redesign.** Layout, type scale, spacing and composition are untouched;
the light-mode baselines moved by 3.6k-9.4k pixels, which is the recoloured text
and nothing else.

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

Unlike the others here, this one **can** be verified before it ships. It is
listed as a decision rather than a task because "every corner in the product
changes" deserves a yes before the work, not after.

**Exact impact if approved.** Web `borderRadius` changes `md` 12->8, `lg` 8->12,
`xl` 20->16, `2xl` 24->20, and `--radius` moves `0.5rem`->`0.75rem`. Every
shadcn primitive is affected: `Button`/`Input`/`Select`/`Tabs` use `rounded-md`,
`Card` uses `rounded-lg`, `Dialog` uses `rounded-xl`. So every button, input,
select, tab strip, card and modal in the product changes corner radius, on
public and authenticated routes alike.

**Verifiable, and here is the actual evidence available** (re-measured
2026-08-31 - an earlier version of this entry said "240 baselines", which was
not accurate):

`apps/web/tests/visual/__screenshots__` holds **192 committed Playwright
baselines** across 12 viewport x theme x locale combinations:

| Spec                 | Baselines | Covers                          |
| -------------------- | --------- | ------------------------------- |
| `components.spec.ts` | 156       | 13 components x 12 combinations |
| `routes.spec.ts`     | 36        | **3 routes** x 12 combinations  |

Run with `pnpm --filter @foodwaste/web test:visual`.

**What that does and does not prove.** Every shadcn primitive this change
touches - Button, Input, Select, Tabs, Card, Dialog - is in the component
baselines, so the corner-radius change would be visible there before it ships.
That is the important half. What it will not show is those primitives **in
situ**: 3 routes have an image of record, so the other public routes and all 45
authenticated routes would change with nothing to check them against.

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

**Verified.** Re-measured 2026-08-31: **65 `left-*` and 56 `right-*`** across
**38 files** remain after the V9 pass converted 106 margin, padding and
text-alignment utilities. (The original entry recorded 62 / 53; the small rise
is incidental to other work, not a regression in the V9 pass.) Margin and
padding are fully converted - `ml-*`/`mr-*` now measure **0**, `pl-*`/`pr-*`
measure **2**.

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
