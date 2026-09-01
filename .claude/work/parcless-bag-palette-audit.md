---
status: done
scope: web
gate: pnpm --filter @foodwaste/web test:visual
---

# D3 usage audit - `#7FA896` and `#C05F4A` on `/parcless-bag`

## Intent

`FINAL_DESIGN_DECISION_MATRIX.md` recorded D3 as a **conditional** blocker: sage
and terracotta both measure below AA against the page's cream ground, but the
matrix measured the palette in the abstract and said so - _"This has not been
checked against how they are actually used."_

This entry closes that gap. It classifies every occurrence of the two colours by
role and measures each one against **the background it is actually painted on**,
not against a representative ground.

**No source was changed.** The page is not redesigned and its palette is not
remapped.

## Outcome

**Both colours carry normal body text in failing combinations. D3 is a
certification blocker, not an intentional exception.**

The condition the matrix set out has been met on both counts, so the
"intentional documented exception" branch does not apply.

## Method

- Occurrences found by regex over the repo for the hex forms and the `rgb()`
  forms (`127,168,150` / `192,95,74`). 8 sage, 5 terracotta hex, 1 terracotta
  `rgba()`. Counts match `DESIGN_DECISIONS_PENDING.md` D3.
- Ground for each occurrence resolved by walking up the JSX to the nearest
  element that sets a background, then alpha-compositing any translucent overlay
  onto it.
- `bg-primary` resolved from `globals.css` - `--primary: 186 41% 20%` =
  `#1E4448` in `:root`, `186 40% 52%` = `#54ACB6` in `.dark`.
- Ratios computed with the WCAG 2.1 relative-luminance formula. Script:
  scratchpad `contrast.mjs` / `contrast2.mjs`.
- Text size in px assumes the 16px root - `globals.css` sets no `font-size` on
  `html` or `:root`, so `rem` is the browser default.
- WCAG large-text threshold applied as 24px normal / 18.66px bold.

## `#7FA896` (sage) - 8 occurrences, **all 8 are text**

Every sage usage is a foreground colour on a dark ground. **None sits on the
cream `#F2EBD9`**, which is what the matrix measured it against.

| #   | Line | Element                                   | Ground (light theme)                                | Size / weight | Ratio    | Role      | AA 4.5   |
| --- | ---- | ----------------------------------------- | --------------------------------------------------- | ------------- | -------- | --------- | -------- |
| 1   | 202  | Hero subtitle `<p>`                       | `bg-primary` `#1E4448`                              | 15.68px / 300 | **4.02** | body text | **FAIL** |
| 2   | 247  | Scroll-hint `<span>`                      | `bg-primary` `#1E4448`                              | 9.92px / 400  | **4.02** | body text | **FAIL** |
| 3   | 353  | Stat description `<p>`                    | `bg-primary` card (L343)                            | 13.92px / 300 | **4.02** | body text | **FAIL** |
| 4   | 362  | Mini-stat label `<p>`                     | `rgba(255,255,255,.055)` over `#1E4448` = `#2A4E52` | 10.88px / 300 | **3.42** | body text | **FAIL** |
| 5   | 392  | How-it-works subtitle `<p>`               | `bg-primary` section (L379)                         | 15.36px / 300 | **4.02** | body text | **FAIL** |
| 6   | 418  | Step body `<p>`                           | `rgba(255,255,255,.04)` over `#1E4448` = `#274B4F`  | 14.08px / 300 | **3.58** | body text | **FAIL** |
| 7   | 430  | `BENEFIT_STYLES.dark.body`, rendered L487 | `bg-primary` card **+ `opacity-[0.82]`**            | 13.44px / 300 | **3.23** | body text | **FAIL** |
| 8   | 571  | CTA body `<p>`                            | `bg-primary` section (L553)                         | 15.36px / 300 | **4.02** | body text | **FAIL** |

No sage occurrence is an icon, border, background or decoration. There is
nothing here to classify as decorative and exempt.

### Two things the abstract measurement got wrong

**The matrix's 2.22 figure is not reachable.** It measured sage on cream. Sage
is never painted on cream. The real worst case is **3.23** and the typical case
**4.02** - materially better than recorded, and still failing.

**Occurrence 7 is the worst, and the cause is not the colour.** `opacity-[0.82]`
on L487 blends the text toward its own backdrop, dropping an already-marginal
4.02 to 3.23. The opacity is applied to the shared benefit-card body style, so
it degrades every variant, not just the sage one.

## `#C05F4A` (terracotta) - 3 text, 2 background, 1 decorative

| #   | Line | Element                           | Role           | Measured against             | Size / weight | Ratio    | AA 4.5                  |
| --- | ---- | --------------------------------- | -------------- | ---------------------------- | ------------- | -------- | ----------------------- |
| 1   | 297  | Concept eyebrow `<p>`             | **body text**  | `bg-[#F2EBD9]`               | 10.08px / 600 | **3.55** | **FAIL**                |
| 2   | 338  | Floating badge fill               | **background** | `#F2EBD9` boundary           | -             | 3.55     | n/a (passes 1.4.11 3:1) |
| 2a  | 338  | ...its `text-white` label         | **body text**  | `#C05F4A`                    | 11.52px / 600 | **4.22** | **FAIL**                |
| 2b  | 338  | `shadow-[...rgba(192,95,74,.45)]` | **decorative** | -                            | -             | -        | exempt                  |
| 3   | 438  | `BENEFIT_STYLES.terra.bg`         | **background** | `#F2EBD9` section (L455)     | -             | 3.55     | n/a (passes 1.4.11 3:1) |
| 3a  | 438  | ...its `text-white` title (L481)  | **body text**  | `#C05F4A`                    | 23.2px / 400  | **4.22** | **FAIL**                |
| 3b  | 438  | ...its `text-white` body (L487)   | **body text**  | `#C05F4A` + `opacity-[0.82]` | 13.44px / 300 | **3.37** | **FAIL**                |
| 4   | 457  | Benefits eyebrow `<p>`            | **body text**  | `bg-[#F2EBD9]`               | 10.08px / 600 | **3.55** | **FAIL**                |
| 5   | 530  | Quote attribution `<cite>`        | **body text**  | `bg-[#F2EBD9]`               | 11.84px / 600 | **3.55** | **FAIL**                |

The two **background** uses are fine on their own terms: as a non-text surface
boundary against cream, 3.55 clears WCAG 1.4.11's 3:1. What fails is the white
text placed on them.

**3a is a near miss worth naming precisely.** `1.45rem` = **23.2px** at
weight 400. WCAG's large-text exemption starts at 24px. It misses by 0.8px, so
it is graded as normal text at 4.22 and fails. At `1.5rem` the identical colour
pairing would pass as large text. This is the one item on the list that a size
change resolves without touching the palette - but that is still a design
decision, not a defect fix, and is **not actioned here**.

## Dark theme: sage becomes invisible

`bg-primary` is the one design token this page uses. It inverts under `.dark`
(`#1E4448` -> `#54ACB6`); the hardcoded sage on top of it does not move.

| Occurrence ground             | Light | Dark     |
| ----------------------------- | ----- | -------- |
| `bg-primary`                  | 4.02  | **1.00** |
| `rgba(255,255,255,.055)` card | 3.42  | **1.06** |
| `rgba(255,255,255,.04)` card  | 3.58  | **1.04** |
| `bg-primary` + `opacity-.82`  | 3.23  | **1.00** |

**1.00 is not a rounding artefact, and it is not only a calculation.** It was
confirmed against the rendered pixels of the two new baselines. Sampling the
hero subtitle band (`x=65..430, y=645..738`) in `desktop-light-en` and
`desktop-dark-en`:

| Baseline           | Ground    | Glyph pixels         | Contrast |
| ------------------ | --------- | -------------------- | -------- |
| `desktop-light-en` | `#1E4448` | `#7FA896` x **2752** | **4.02** |
| `desktop-dark-en`  | `#54ACB6` | `#7FA896` x **2752** | **1.00** |

**The identical 2752 glyph pixels are present in both.** The text is painted in
dark mode and is perceptually absent: `#7FA896` and `#54ACB6` are within
rounding distance of the same relative luminance. Six of the eight sage
strings - the hero subtitle, the scroll hint, the stat description, the
how-it-works subtitle, the step bodies and the CTA body - are affected.

Method note: the glyph colour was taken by enumerating every distinct colour in
the band rather than by luminance distance from the ground. A luminance search
finds nothing here **because** the failure is luminance-identical text, and
would have silently reported the background pattern (`#59ACB2`) as the glyph.

Terracotta is unaffected: it sits on hardcoded `#F2EBD9`, which does not respond
to the theme.

This was **not** previously recorded anywhere. It is a strictly worse finding
than the light-mode one and is why the route now carries a visual baseline in
both themes.

## Reachability

Not a dead page. Linked from `components/layout/Header.tsx`, fully translated in
`en` / `fr` / `ar` (listed in `FULLY_TRANSLATED_ROUTES`), and the slug is not
localised, so `/en|fr|ar/parcless-bag` all serve the same route.

## Visual coverage added

`/parcless-bag` added to `tests/visual/routes.spec.ts`, giving 12 baselines (3
viewports x {light-en, dark-en, light-ar, light-fr}).

**What it does and does not prove.** Baselines are viewport-only at scroll 0,
per the rationale already in that spec, so they pin the **hero** - which carries
sage occurrences 1 and 2 and the theme-dependent ground. The concept, benefits,
quote and CTA sections are below the fold and remain uncovered. The baseline is
a drift detector for the one page whose colours cannot drift with the token set;
it is not a contrast gate, and nothing here should be read as one.

## Verification

`pnpm --filter @foodwaste/web test:visual` - **48 passed**. The 36 pre-existing
route baselines are byte-unchanged (no drift from adding the route), and 12 new
`parcless-bag.png` baselines were written.

The baselines are non-vacuous: the spec asserts a 200 before screenshotting, and
the dominant-colour sample above shows the real hero ground in both themes
rather than a blank or error page.

## Resolved 2026-09-01

**Implemented as `DESIGN.md` §19-E33.** The finding below stands as written;
this section records what was done about it.

The audit scoped itself to the two colours, as asked. Widening the same
measurement to **every** text pairing on the page found 25 failing in light and
**40 in dark** - because `bg-primary` inverts under `.dark` while the hardcoded
foregrounds do not. The two audited colours were 8 of the 25.

So the fix is structural first: the palette is pinned to ten `--pb-*` tokens on
the page's own `<main>` with **no `.dark` block**, and the page stops
participating in theming. Five values then moved by the minimum lightness step
on their own hue - sage `#7FA896` -> `#9FBEB0`, terracotta `#C05F4A` ->
`#AB4F3B` (one value covering both its roles), gold for small text, the ink on
light grounds, and the muted subtitle. `opacity-[0.82]` came off the shared
benefit body, and two low-alpha foregrounds were raised.

**0 of 87 text nodes fail** in either theme, gated by
`tests/visual/contrast.spec.ts` across all 12 project combinations and
mutation-checked.

**The dark-mode section below understated it.** It reported six sage strings at
1.00. Every hardcoded foreground on the inverting ground was affected, not only
sage - the audit simply was not looking at the others.

## What was NOT decided here

Per the brief: no redesign, no palette remap, no product decision.

The finding is that D3 **cannot be closed as an intentional exception**. Which
remedy to take - map to tokens, promote the five values to `brand.*` with
passing variants, darken sage and terracotta for text roles while keeping them
for surfaces, or raise the two eyebrow labels above the large-text threshold -
is still the product and brand call D3 has always been.

## Decisions

- 2026-09-01: audited, not changed. D3 reclassified from **conditional** to
  **confirmed certification blocker**, on the grounds that 11 of the 14 text
  roles across the two colours fail AA at their real rendered grounds.
- 2026-09-01: the matrix's sage figure (2.22 on cream) is superseded by
  3.23-4.02 on `bg-primary`. The original figure was measured against a ground
  sage is never painted on. Conclusion unchanged; the number was wrong and is
  corrected rather than quietly dropped.
