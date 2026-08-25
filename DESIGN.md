# DESIGN.md - Too Fresh To Waste Design System

> **This document is the single source of truth for all frontend work** across
> `apps/web`, `apps/mobile`, and `packages/ui`. Visual design, UX behaviour,
> accessibility, responsive behaviour, motion, content hierarchy and interaction
> patterns are all governed here.
>
> **It is derived from the shipped implementation, not invented.** Every value
> was read out of `tailwind.config.ts`, `globals.css`, `layout.tsx`, or
> `apps/mobile/src/design-system/tokens/`, or measured from the compiled CSS.
> Contrast ratios were computed, not estimated.
>
> Where the code and the standard disagree, the gap is recorded in
> [§19 Known Exceptions and Decisions](#19-known-exceptions-and-decisions) with
> a status. Nothing is quietly corrected in prose, and nothing is hidden.

## How to use this document

| You are...                      | Read                                      |
| ------------------------------- | ----------------------------------------- |
| Building a new screen           | §14 UX Standards, then §18 self-review    |
| Building a shared component     | §13 Component Standards, then §20         |
| Picking a colour                | §2. Never pick outside it                 |
| Picking a spacing or size value | §4 (rhythm) and §5 (component dimensions) |
| Introducing a new pattern       | §20 Governance Rule. Do not skip it       |
| Deviating deliberately          | §19. Record it or it is a defect          |

**Precedence:** `CLAUDE.md` (project constraints) > this document > personal
preference. Where this document and a `.claude/rules/*.md` file disagree, **this
document wins** and the rule file is to be corrected; known instances are in
§21.

### Sources of truth

| Concern                     | File                                                 |
| --------------------------- | ---------------------------------------------------- |
| Web colour / type / spacing | `apps/web/tailwind.config.ts`                        |
| Web runtime theme vars      | `apps/web/src/app/globals.css`                       |
| Web font loading            | `apps/web/src/app/[locale]/layout.tsx`               |
| Mobile tokens               | `apps/mobile/src/design-system/tokens/*.ts`          |
| Web primitives              | `apps/web/src/components/ui/*.tsx`                   |
| Cross-app primitives        | `packages/ui/src/components/*.tsx`                   |
| Gap analysis                | [`DESIGN_AUDIT_REPORT.md`](./DESIGN_AUDIT_REPORT.md) |

---

## 1. Foundations

### 1.1 Design philosophy

Too Fresh To Waste asks a stranger to pay, in advance, for a bag whose contents
they cannot see, then to walk to a shop they may not know, before a deadline.
Every pixel is either buying down that risk or adding to it. That is the whole
brief.

**Premium** is precision, not ornament: consistent rhythm, one type scale,
restrained colour, surfaces that hold still. **Friendly** is the two rounded
geometric sans faces, generous radii, plain copy. **Trustworthy** is deep teal
anchoring every persistent surface, and money, pickup codes and countdowns that
are never decorated or ambiguous. **Sustainable** is numbers we can prove, never
stock leaf iconography. **Modern** is flat surfaces, real dark mode, and logical
properties so Arabic is a first-class layout. **Accessible** is WCAG 2.2 AA as a
floor, not a goal.

#### The four pillars, in priority order

When two conflict, the higher wins.

1. **Clarity over beauty.** If a user cannot tell what a bag costs, when it
   expires, or where to collect it, the screen has failed however it looks.
2. **Trust over delight.** No dark patterns, no fake scarcity, no countdown that
   does not reflect a real deadline.
3. **Consistency over novelty.** A screen that invents its own spacing, colour
   or font is a bug, even when prettier in isolation.
4. **Performance over polish.** A blur, shadow or animation that costs frames is
   removed, not tuned. See `.claude/rules/performance.md`.

### 1.2 Brand personality

**Emotional tone**

| We are                             | We are not                          |
| ---------------------------------- | ----------------------------------- |
| Warm, practical, matter-of-fact    | Preachy, guilt-tripping, moralising |
| Proud of small wins                | Grandiose about saving the planet   |
| Local and specific (Tunis, TND)    | Generic global-startup English      |
| Honest about surprise-bag contents | Overpromising what is in the bag    |

Never shame a user for waste. Rescuing food is a good deal _and_ a good deed, in
that order. Lead with the saving; let the impact follow.

**Visual tone.** Flat, breathable, photography-led. Chrome recedes so food does
the emotional work. One accent per viewport. Decoration that encodes no
information is removed.

**Interaction tone.** Responsive and quiet. Feedback within 100ms. Motion
explains where a thing came from and went; it never performs. Destructive
actions always confirm.

### 1.3 Banned decorations

Each was removed from this codebase deliberately. Do not reintroduce them.

- **A hairline rule beside an eyebrow label.** A tracked-out coloured label
  already reads as an eyebrow. Appeared on eight marketing pages in four
  spellings before removal.
- **Tinted radial glows behind content.** They gave the brand green a yellow
  cast on one page and a coral cast on the next. Backgrounds stay flat.
- **Glassmorphism as generic decoration.** See §7.5.
- **The em dash.** Use a spaced hyphen.

---

## 2. Colour System

### 2.1 Brand ramps

**These are the product's identity and are not up for revision.**

The **primary** ramp is byte-identical in `tailwind.config.ts` and
`apps/mobile/src/design-system/tokens/colors.ts`, verified step by step. The
**accent** ramp is **not**: it diverges at 7 of 10 steps between the two files.
Only `50`, `500` and `900` agree. See §19-E18 - always state which platform a
non-500 accent value comes from.

**Primary - teal.** The trust anchor.

| Token         | Hex       | HSL         | Role                                |
| ------------- | --------- | ----------- | ----------------------------------- |
| `primary-50`  | `#EBF3F4` | 186 30% 94% | Subtle wash, selected row           |
| `primary-100` | `#C2DDE0` | 186 33% 82% | Hover tint, container fill          |
| `primary-200` | `#8BC4CB` | 186 38% 67% | Border on teal surfaces             |
| `primary-300` | `#54ACB5` | 186 40% 52% | **Dark-mode primary** (§2.6)        |
| `primary-400` | `#367A81` | 186 41% 36% | Active state                        |
| `primary-500` | `#1E4448` | 186 41% 20% | **Brand primary.** CTA, header, nav |
| `primary-600` | `#18363A` | 186 41% 16% | Pressed                             |
| `primary-700` | `#112528` | 186 41% 11% | Depth, dark ground                  |
| `primary-800` | `#0B1819` | 186 41% 7%  | Max-contrast surface                |
| `primary-900` | `#050A0B` | 186 41% 3%  | Near-black teal                     |

**Accent - coral.** Urgency and destructive only, never decoration.

| Token        | Web (`tailwind.config.ts`) | Mobile (`colors.ts`) | Role                             |
| ------------ | -------------------------- | -------------------- | -------------------------------- |
| `accent-300` | `#FFB7B1`                  | `#F04535`            | Highlight, onboarding            |
| `accent-400` | `#FF9F97`                  | `#FF5A52`            | **Dark-mode accent** (§2.6)      |
| `accent-500` | `#F55449`                  | `#F55449`            | Expiry, urgency, destructive     |
| `accent-600` | `#C4433A`                  | `#E03D31`            | Pressed                          |
| `accent-700` | `#93322C`                  | `#C02D22`            | **Accessible coral text** (§2.5) |

Both `accent-700` values clear AA on the coral tint (web 6.83, mobile 5.13), so
neither is a compliance failure - but they are different colours under one name.

**Secondary - gold.** `41 47% 56%` (`#C4A25A`). The accent for the **dark teal
ground only**. Aliases `secondary-light #E2C48A`, `secondary-dark #9A7B35`,
standalone `gold #D4A017`.

**Marketing sub-palette** (`brand.*`, used by `/companies`, `/esg`, editorial):

| Token              | Hex       | Role                                 |
| ------------------ | --------- | ------------------------------------ |
| `brand-cream`      | `#F9F3F0` | Light ground, dashboard ground       |
| `brand-teal`       | `#005250` | Marketing teal fill                  |
| `brand-teal-light` | `#007A78` | Gradient partner                     |
| `brand-dark`       | `#0A1F1E` | Marketing dark ground                |
| `brand-coral`      | `#FF7973` | Marketing coral                      |
| `brand-green`      | `#017C6E` | **Light-surface interactive colour** |
| `brand-deep`       | `#1E4448` | Alias of `primary-500`               |

### 2.2 The one-accent system

**Gold owns the dark ground. `#017C6E` owns the light ground. Coral is reserved
for urgency and destructive states.** One system with a light half and a dark
half, not two competing accents. Two accents made the rollout map read as a
different product from the rest of the site.

`#017C6E` limits are numeric, not stylistic:

| Pairing                    | Ratio | Verdict                           |
| -------------------------- | ----- | --------------------------------- |
| `#017C6E` on white         | 5.11  | Passes AA text                    |
| White on `#017C6E`         | 5.11  | Passes AA text                    |
| `#017C6E` on cream         | 4.65  | Passes AA text                    |
| `#017C6E` on `#1E4448`     | 2.08  | **Banned. Effectively invisible** |
| `#017C6E` beside `#FFA000` | 2.50  | **Banned. Reads as a clash**      |

### 2.3 Light theme - measured contrast

Computed against `background #FFFFFF`. **AA text = 4.5, AA non-text = 3.0.**

| Token              | Hex       | On white | Text | UI   |
| ------------------ | --------- | -------- | ---- | ---- |
| `foreground`       | `#000F0F` | 19.53    | PASS | PASS |
| `muted-foreground` | `#5E6E6D` | 5.35     | PASS | PASS |
| `primary`          | `#1E4448` | 10.63    | PASS | PASS |
| `brand-green`      | `#017C6E` | 5.11     | PASS | PASS |
| `success`          | `#2E7D32` | 5.13     | PASS | PASS |
| `error`            | `#D32F2F` | 4.98     | PASS | PASS |
| `destructive`      | `#EF4343` | 3.78     | FAIL | PASS |
| `accent`           | `#F55347` | 3.38     | FAIL | PASS |
| `info`             | `#2196F3` | 3.12     | FAIL | PASS |
| `warning`          | `#F57C00` | 2.70     | FAIL | FAIL |
| `secondary`        | `#C4A25A` | 2.42     | FAIL | FAIL |
| `border`           | `#E3E8E7` | 1.24     | n/a  | FAIL |

**Binding consequences:**

- `text-warning` and `text-secondary` on a light ground are **banned at any
  size**. They fail even the 3:1 non-text threshold.
- `text-accent`, `text-info` and `text-destructive` on a light ground are
  **banned for text**. They may be non-text marks (icon, rule, indicator) where
  3:1 applies.
- For coloured text on light surfaces use `primary`, `brand-green`, `success`,
  `error`, or the darker ramp shades in §2.5.
- `border` at 1.24 does not meet 1.4.11 for a control boundary. See §19-E4.

### 2.4 Foreground pairing - which text colour goes on which fill

Measured. **Use this table; do not guess.**

| Fill          | White text | Dark ink text | **Approved foreground**    |
| ------------- | ---------- | ------------- | -------------------------- |
| `primary`     | 10.63 PASS | 1.84 FAIL     | **white**                  |
| `success`     | 5.13 PASS  | 3.81 FAIL     | **white**                  |
| `error`       | 4.98 PASS  | 3.92 FAIL     | **white**                  |
| `brand-green` | 5.11 PASS  | -             | **white**                  |
| `secondary`   | 2.42 FAIL  | 8.06 PASS     | **dark ink** `180 100% 3%` |
| `warning`     | 2.70 FAIL  | 7.22 PASS     | **dark ink**               |
| `info`        | 3.12 FAIL  | 6.25 PASS     | **dark ink**               |
| `accent`      | 3.38 FAIL  | 5.78 PASS     | **dark ink**               |
| `destructive` | 3.78 FAIL  | 5.17 PASS     | see §19-E2 (unresolved)    |

Two of these contradict what `globals.css` ships today: `--accent-foreground`
and `--destructive-foreground` are both white. Both are live WCAG failures. See
§19-E1 and §19-E2.

### 2.5 Status badges - the accessible pattern

**The `bg-X/10 text-X` tint pattern fails AA for 7 of 8 status colours** at 12px
semibold. Measured on the 10%-over-white tint:

| Status        | tint + `-500` text | Verdict  |
| ------------- | ------------------ | -------- |
| `primary`     | 8.95               | PASS     |
| `success`     | 4.49               | **FAIL** |
| `error`       | 4.28               | **FAIL** |
| `destructive` | 3.31               | **FAIL** |
| `accent`      | 3.01               | **FAIL** |
| `info`        | 2.82               | **FAIL** |
| `warning`     | 2.45               | **FAIL** |
| `secondary`   | 2.25               | **FAIL** |

**Standard: status badges use a solid fill with the §2.4 approved foreground.**
One pattern, all pass, no new tokens.

```text
PENDING           bg-warning   text-[dark ink]         (7.22)
RESERVED          bg-info      text-[dark ink]         (6.25)
CONFIRMED         bg-primary   text-white              (10.63)
READY_FOR_PICKUP  bg-primary   text-white              (10.63)
PICKED_UP         bg-success   text-white              (5.13)
DRIVER_ASSIGNED   bg-info      text-[dark ink]         (6.25)
OUT_FOR_DELIVERY  bg-info      text-[dark ink]         (6.25)
DELIVERED         bg-success   text-white              (5.13)
CANCELLED         bg-error     text-white              (4.98)
EXPIRED           bg-muted     text-muted-foreground   (4.62)
```

**Both order chains are listed on purpose.** A screen that styles only the
pickup chain leaves every delivery order unstyled.

The softer tint pattern is permitted **only** where the measured pair passes.
Using existing ramp shades, these do:

| Tint background | Text          | Ratio                      |
| --------------- | ------------- | -------------------------- |
| `primary/10`    | `primary-500` | 8.95                       |
| `success/10`    | `success-600` | 6.89                       |
| `error/10`      | `error-600`   | 4.83                       |
| `accent/10`     | `accent-700`  | 6.83 (web) / 5.13 (mobile) |

`warning` and `info` have **no existing ramp shade** reaching 4.5 on their own
tint (best available: `warning-600` 2.80, `info-600` 4.15). They use the solid
fill. Extending those ramps is deferred; see §19-E3.

### 2.6 Dark theme

`darkMode: 'class'`; `ThemeProvider` writes `.dark` onto `<html>`.

**Rule: a token whose light and dark value are identical is a bug.**

_Fixed 2026-08-24._ `body` now applies `bg-background text-foreground`, and the
dark ramp below is live in `globals.css`. `--secondary` is intentionally shared
across themes: it measures 8.06 on the dark ground and needs no dark variant.

**Approved dark ramp.** Taken from the mobile dark theme, which already resolves
this correctly (`darkThemeColors.primary = primary[300]`). Measured against
`background #000F0F` and `card #081717`:

| Token              | Hex       | on bg | on card | Verdict |
| ------------------ | --------- | ----- | ------- | ------- |
| `foreground`       | `#FAFAFA` | 18.71 | 17.57   | PASS    |
| `muted-foreground` | `#839594` | 6.22  | 5.84    | PASS    |
| `primary`          | `#54ACB5` | 7.39  | 6.94    | PASS    |
| `secondary`        | `#C4A25A` | 8.06  | 7.56    | PASS    |
| `accent` (web)     | `#FF9F97` | 9.91  | 9.31    | PASS    |
| `accent` (mobile)  | `#FF5A52` | 6.36  | 5.97    | PASS    |
| `destructive`      | `#E57373` | 6.54  | 6.14    | PASS    |
| `success`          | `#81C784` | 9.71  | 9.11    | PASS    |
| `error`            | `#E57373` | 6.54  | 6.14    | PASS    |
| `warning`          | `#FFB74D` | 11.28 | 10.59   | PASS    |
| `info`             | `#64B5F6` | 8.82  | 8.28    | PASS    |

**In dark mode every semantic fill takes dark-ink text** (all pairings
6.5-11.3). This inverts the light rule in §2.4, which is expected: the fills
lighten, so the ink darkens.

### 2.7 Surfaces

| Role                | Light (web) | Light (mobile) | Dark      |
| ------------------- | ----------- | -------------- | --------- |
| `background`        | `#FFFFFF`   | `#F9F3F0`      | `#000F0F` |
| `card` / `surface`  | `#FFFFFF`   | `#FAFAFA`      | `#081717` |
| `surface-variant`   | `#F5F5F5`   | `#F5F5F5`      | `#2C2C2C` |
| `surface-container` | `#EEEEEE`   | `#EEEEEE`      | `#383838` |
| Dashboard ground    | `#F9F3F0`   | -              | -         |

The white/cream split is **deliberate**: cream reads warmer in-hand on a phone,
white reads cleaner behind marketing photography. Do not harmonise without a
product decision.

### 2.8 Focus colour

| Theme | `--ring`      | Against   | Ratio | Verdict |
| ----- | ------------- | --------- | ----- | ------- |
| Light | `186 41% 20%` | white     | 10.63 | PASS    |
| Dark  | `186 40% 52%` | `#000F0F` | 7.39  | PASS    |

The ring must clear **3:1 against both the control and the ground behind it**.

**The marketing header is the one place the default ring fails**, because its
ground toggles between teal (at rest) and cream (scrolled). It carries an
adaptive ring, defined once beside the other ground-dependent classes:

```tsx
const focusRingClass = isScrolledState
  ? 'focus-visible:ring-primary-500' // teal on cream  = 9.67
  : 'focus-visible:ring-white'; //      white on teal = 10.63
```

Both class names are written out in full so Tailwind's JIT scanner detects them.
**Never build a class name by concatenation** - the utility silently will not be
emitted.

Use `focus-within` on the **wrapper** when an input is a transparent child of a
bordered container: the whole field should light up, not the bare text box.

### 2.9 Colour usage rules

1. **Never write a raw hex or arbitrary colour in a component.** `bg-[#f9f3f0]`
   is a violation even though the value is correct - it is untraceable when the
   token moves.
2. **One accent per viewport.** A coral CTA plus a coral badge above the fold is
   two.
3. **Colour is never the only signal.** Every status pairs with a label or icon.
4. **Never introduce a near-miss.** `#FF7979` beside `brand-coral #FF7973` is
   two brands.
5. **`success` is not the sustainability colour.** Sustainability is the brand
   teal. Green impact stats read as confirmation toasts.
6. **Legitimate raw-hex exceptions, and only these:** `opengraph-image.tsx`
   (Satori does not run Tailwind) and `partner-kit` print/swatch styles where
   the hex _is_ the content.

---

## 3. Typography

### 3.1 Font families

Loaded via `next/font/google` in `app/[locale]/layout.tsx`, self-hosted at build
time. Two rounded geometric sans faces, so headings and body sit in one family
of shapes rather than pairing a serif against a sans.

| Class                            | Stack                                                       | Use                      |
| -------------------------------- | ----------------------------------------------------------- | ------------------------ |
| `font-sans`                      | `var(--font-quicksand), var(--font-noto-arabic), system-ui` | Body, UI, default        |
| `font-heading`                   | `var(--font-comfortaa), var(--font-noto-arabic), system-ui` | H1-H3, brand moments     |
| `font-mono`                      | `monospace`                                                 | Pickup codes, order IDs  |
| `font-display` / `font-playfair` | **aliases of `font-heading`**                               | Legacy. Not for new code |

Three load-bearing rules:

- **Noto Sans Arabic sits in both stacks**, not behind a locale conditional.
  Neither Latin face carries Arabic glyphs, so the browser falls through per
  character and Arabic resolves with no component-level branching.
- **Every `var()` in a font stack must be defined on `<html>` for every
  locale.** A `var()` pointing at an undefined property invalidates the whole
  declaration at computed-value time and the browser drops to Times New Roman.
  This happened on en/fr while the Arabic variable was applied only on `ar`.
- **`[dir='rtl'] body` puts Noto first** so shared glyphs (digits, punctuation,
  quotes) come from the Arabic face.

Mobile uses platform faces (`SF Pro Display`/`Text`, `Roboto`). Correct for
native; not a divergence to fix.

### 3.2 Type scale

**Smaller at every step than the Tailwind default. `text-base` is 14px, not
16px.** Shared by web `tailwind.config.ts` and mobile `typography.ts`.

| Class       | Size | LH   | Computed | Role                              |
| ----------- | ---- | ---- | -------- | --------------------------------- |
| `text-xs`   | 10px | 1.4  | 14px     | Legal, timestamps. Never UI copy  |
| `text-sm`   | 12px | 1.4  | 17px     | Caption, table cell, helper text  |
| `text-base` | 14px | 1.5  | 21px     | **Default body**                  |
| `text-md`   | 16px | 1.5  | 24px     | Long-form body, mobile input text |
| `text-lg`   | 18px | 1.5  | 27px     | Lead paragraph, card title        |
| `text-xl`   | 20px | 1.5  | 30px     | H4, section subhead               |
| `text-2xl`  | 24px | 1.4  | 34px     | H3                                |
| `text-3xl`  | 28px | 1.4  | 39px     | H2 mobile                         |
| `text-4xl`  | 32px | 1.25 | 40px     | H2 desktop, H1 mobile             |
| `text-5xl`  | 36px | 1.25 | 45px     | H1                                |
| `text-6xl`  | 42px | 1.25 | 53px     | Hero, marketing only              |
| `text-7xl`  | 48px | 1.25 | 60px     | Display hero, marketing only      |

### 3.3 Weights and letter spacing

| Weight     | Value | Use                          |
| ---------- | ----- | ---------------------------- |
| `regular`  | 400   | Body                         |
| `medium`   | 500   | Labels, H5/H6, button text   |
| `semibold` | 600   | H3/H4, badges, table headers |
| `bold`     | 700   | H1/H2, prices                |

Thin/light (100/300) and extrabold/black (800/900) exist in the mobile token
file but are **not approved for product UI**.

| Tracking | Value | Use                 |
| -------- | ----- | ------------------- |
| `tight`  | -0.25 | 28px and above only |
| `normal` | 0     | Everything else     |
| `wide`   | +0.25 | Labels, button text |
| `wider`  | +0.5  | Overline, badges    |
| `widest` | +1    | Pickup codes        |

**Never tighten body text.** `tracking-tight` at 28px and up only.

### 3.4 Semantic roles

Use these combinations. Do not assemble new ones.

| Role           | Web classes                                                      | Mobile token      |
| -------------- | ---------------------------------------------------------------- | ----------------- |
| **Display**    | `font-heading text-6xl md:text-7xl font-bold tracking-tight`     | `display.large`   |
| **H1**         | `font-heading text-4xl md:text-5xl font-bold tracking-tight`     | `headline.large`  |
| **H2**         | `font-heading text-3xl md:text-4xl font-semibold tracking-tight` | `headline.medium` |
| **H3**         | `font-heading text-2xl font-semibold`                            | `headline.small`  |
| **H4**         | `font-sans text-xl font-semibold`                                | `title.large`     |
| **H5**         | `font-sans text-lg font-medium`                                  | `title.medium`    |
| **H6**         | `font-sans text-md font-medium`                                  | `title.small`     |
| **Body**       | `text-base font-normal text-foreground`                          | `body.medium`     |
| **Body long**  | `text-md font-normal leading-relaxed`                            | `body.large`      |
| **Body small** | `text-sm font-normal`                                            | `body.small`      |
| **Lead**       | `text-lg text-muted-foreground leading-relaxed`                  | -                 |
| **Label**      | `text-sm font-medium tracking-wide`                              | `label.medium`    |
| **Caption**    | `text-sm text-muted-foreground`                                  | `body.small`      |
| **Overline**   | `text-sm font-semibold uppercase tracking-wider`                 | -                 |
| **Button**     | `text-base font-medium tracking-wide`                            | `label.large`     |
| **Badge**      | `text-xs font-semibold uppercase tracking-wider`                 | `badge`           |

### 3.5 Numeric and data typography

Money and countdowns are the highest-trust content in the product.

| Role               | Classes                                                     |
| ------------------ | ----------------------------------------------------------- |
| **Price**          | `font-sans text-xl font-bold tabular-nums`                  |
| **Original price** | `text-sm font-normal line-through text-muted-foreground`    |
| **Savings**        | `text-sm font-semibold tabular-nums`                        |
| **Pickup code**    | `font-mono text-4xl font-bold tracking-widest tabular-nums` |
| **Countdown**      | `text-base font-semibold tabular-nums`                      |
| **Table numeric**  | `text-base tabular-nums text-end`                           |
| **Stat figure**    | `text-3xl font-bold tabular-nums`                           |

**`tabular-nums` is mandatory on every number that changes in place.** Without
it digits have different widths and the value jitters as it updates. This is the
most common numeric-typography defect.

Currency always renders as **TND** through the shared formatter, never
string-concatenated.

### 3.6 Typography rules

1. **One `<h1>` per page.** Levels never skip. Style with classes, not by
   choosing a different tag.
2. **`font-heading` stops at H3.** Comfortaa's wide rounded counters hurt
   legibility at UI sizes.
3. **Measure 60-75 characters.** `max-w-prose` or `max-w-2xl`. A hero line that
   wraps six times is a design failure.
4. **Never `text-xs` for anything actionable or required.** 10px fails on a
   phone in daylight.
5. **Never `text-justify`.** Rivers in Latin, worse in Arabic.
6. **Arabic runs ~15% taller.** Never fix a heading's height; let it grow.
7. **French runs ~30% longer than English.** Buttons and labels must not be
   width-locked to the English string.

---

## 4. Spacing System

### 4.1 The named scale (approved)

**Spacing is expressed in named tokens.** These values match
`apps/mobile/src/design-system/tokens/spacing.ts` exactly, so web and mobile
share one rhythm.

| Token | Value | Intended use                       | Example                        |
| ----- | ----- | ---------------------------------- | ------------------------------ |
| `xxs` | 2px   | Hairline gaps, badge inner padding | Badge `py-xxs`                 |
| `xs`  | 4px   | The two things are one thing       | Icon-to-label gap              |
| `sm`  | 8px   | Directly related elements          | Label to input; chips in a row |
| `md`  | 16px  | **Default.** Siblings in a group   | Card padding, form field gap   |
| `lg`  | 24px  | Distinct groups inside one block   | Comfortable card padding       |
| `xl`  | 32px  | Separate blocks within a section   | Form section separation        |
| `2xl` | 40px  | Section padding, mobile            | Marketing section `py`         |
| `3xl` | 48px  | Section separation, mobile         | Between marketing sections     |
| `4xl` | 64px  | Section separation, desktop        | Between marketing sections     |
| `5xl` | 80px  | Major section break                | Hero to first section          |
| `6xl` | 96px  | Hero padding, desktop              | Hero `py`                      |

**Proximity encodes relationship.** Two things 16px apart are claimed to be
siblings. Space is the cheapest hierarchy available and the first thing to fix
when a screen feels wrong.

| Distance | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| 4px      | The two things are one thing (icon + its label)         |
| 8px      | Directly related (label and its input)                  |
| 16px     | Siblings in a group (fields in a form, cards in a grid) |
| 24px     | Distinct groups inside one block                        |
| 32-48px  | Separate blocks within a section                        |
| 64-96px  | Separate sections of a page                             |

### 4.2 Tailwind's numeric keys stay at their defaults

**Do not overload Tailwind's numeric spacing keys with a semantic scale.** This
is a hard rule, and the reason is documented at length in
`DESIGN_AUDIT_REPORT.md` Part 1: the current config does exactly that, and it is
the product's largest open defect.

- Named tokens (`p-md`, `gap-lg`) carry **semantic rhythm**.
- Numeric keys (`p-1`, `p-4`, `gap-2`) keep **Tailwind's default `n x 4px`** and
  remain available for fine-grained values the named scale does not cover, such
  as the 12px step between `sm` and `md`.

Both are legitimate. What is not legitimate is redefining `4` to mean something
other than 16px, because every shadcn primitive, every copied snippet and every
developer's muscle memory assumes the default.

**Until the migration in §19-E5 lands, the numeric keys in `apps/web` do not
mean what they say.** Consult `DESIGN_AUDIT_REPORT.md` Part 1.2 before writing
any numeric spacing class in web code.

### 4.3 Arbitrary values

`p-[13px]` is a defect unless justified in §19. If a value is needed repeatedly
and does not exist, that is a §20 governance event: add the token, do not
sprinkle the literal.

Prefer `gap-*` and `space-y-*` on the container over per-child margins. Margins
collapse, do not respond to `flex`/`grid` reordering, and break in RTL far more
often than gap does.

---

## 5. Sizing System

**Component dimensions are not layout spacing.** A button's height is a
component decision; the space between two buttons is a layout decision. They use
different token sets and must never be conflated.

These values are taken from `apps/mobile/src/design-system/tokens/spacing.ts`
(`sizing`), which is the more complete of the two implementations.

### 5.1 Control heights

| Component    | `sm` | `md` (default) | `lg` | `xl` |
| ------------ | ---- | -------------- | ---- | ---- |
| **Button**   | 36px | 40px           | 48px | 56px |
| **Input**    | 36px | 44px           | 52px | -    |
| **Select**   | 36px | 44px           | 52px | -    |
| **Textarea** | -    | min 80px       | -    | -    |

Inputs are taller than buttons at `md` (44 vs 40) on purpose: an input is a
touch target that must also accommodate a text caret and a visible label
relationship.

`sm` controls are for **dense desktop contexts only** and must still carry a
44px hit area via padding (§11.4).

### 5.2 Icons

| Token | Size | Use                                        |
| ----- | ---- | ------------------------------------------ |
| `xs`  | 12px | Inline marks inside dense text             |
| `sm`  | 16px | **Default.** Inside buttons, inputs, chips |
| `md`  | 20px | Standalone UI icon, list row               |
| `lg`  | 24px | Navigation, section header                 |
| `xl`  | 32px | Feature icon                               |
| `2xl` | 40px | Empty-state icon (small)                   |
| `3xl` | 48px | Empty-state icon (standard)                |

**Icon sizes are a fixed set.** Inconsistent icon sizing is one of the fastest
ways a UI reads as unfinished. An icon inside a button is always 16px.

### 5.3 Avatars

| Token | Size | Use                             |
| ----- | ---- | ------------------------------- |
| `xs`  | 24px | Inline mention, dense table row |
| `sm`  | 32px | List row                        |
| `md`  | 40px | **Default.** Header, nav        |
| `lg`  | 48px | Card, comment                   |
| `xl`  | 64px | Profile summary                 |
| `2xl` | 80px | Profile header                  |
| `3xl` | 96px | Profile page hero               |

Resolution order is always `profileImage > avatar > null`, then initials
fallback. Never render an empty grey circle.

### 5.4 Badges

| Token | Height | Use                       |
| ----- | ------ | ------------------------- |
| `xs`  | 16px   | Notification dot          |
| `sm`  | 20px   | Count indicator           |
| `md`  | 24px   | **Default.** Status badge |
| `lg`  | 28px   | Prominent status          |

### 5.5 Navigation and layout chrome

| Element               | Size                                    |
| --------------------- | --------------------------------------- |
| Marketing header      | 64px                                    |
| Dashboard sidebar     | 256px expanded / 64px collapsed         |
| Mobile bottom tab bar | 56px + bottom safe-area inset           |
| Table row (min)       | 48px                                    |
| Card image            | 200px (mobile token), or `aspect-[4/3]` |
| Card min-height       | 120px                                   |
| Card max-width        | 400px                                   |
| Modal max-width       | 560px                                   |

### 5.6 Touch targets

| Standard            | Minimum                          |
| ------------------- | -------------------------------- |
| WCAG 2.2 AA (2.5.8) | 24 x 24 px                       |
| iOS HIG             | 44 x 44 px                       |
| Material 3          | 48 x 48 px                       |
| **This product**    | **44 x 44 px**, 48px for primary |

Minimum 8px between adjacent targets. A 16px glyph may be the visual size as
long as the **hit area** is padded to 44px.

---

## 6. Radius System

### 6.1 The unified scale (approved)

One scale for web and mobile. These are the values already in
`apps/mobile/src/design-system/tokens/spacing.ts`; web currently disagrees and
must migrate (§19-E6).

| Token  | Value  | Use                                        |
| ------ | ------ | ------------------------------------------ |
| `none` | 0      | Full-bleed media, table cells              |
| `xs`   | 2px    | Hairline chips                             |
| `sm`   | 4px    | Nested elements inside a rounded container |
| `md`   | 8px    | **Default.** Buttons, inputs, selects      |
| `lg`   | 12px   | Cards, dropdowns, popovers                 |
| `xl`   | 16px   | Modals, sheets, large surfaces             |
| `2xl`  | 20px   | Marketing feature cards                    |
| `3xl`  | 24px   | Hero media                                 |
| `full` | 9999px | Pills, badges, avatars, toggles            |

### 6.2 Rules

1. **Nested radii decrease inward.** A `lg` card containing a button uses `md`,
   not `lg`. Equal radii at different depths read as misalignment.
2. **One radius family per surface.** Never mix `md` and `xl` on sibling
   elements.
3. **Never an arbitrary radius.** `rounded-[7px]` is a defect.
4. **`full` is for genuinely pill-shaped things only** - badges, avatars,
   toggles. A `rounded-full` button on a rectangular layout reads as a different
   product.

---

## 7. Elevation System

### 7.1 The principle

**Elevation encodes distance from the page, and distance means interactivity or
transience.** A raised surface is either something you can act on or something
that will go away. A permanently raised surface that does neither is noise.

Prefer a **border** for structure and a **shadow** for lift. Do not use both at
full strength on one element: a bordered card with a heavy shadow reads as two
containers.

### 7.2 Web shadow scale

| Token        | Value                                                 | Use                        |
| ------------ | ----------------------------------------------------- | -------------------------- |
| `shadow-xs`  | `0 1px 2px rgba(0,0,0,.05)`                           | Resting input, subtle chip |
| `shadow-sm`  | `0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06)` | **Card at rest** (default) |
| `shadow`     | `0 4px 6px -1px rgba(0,0,0,.1)`                       | Card hover, raised button  |
| `shadow-md`  | `0 8px 10px -2px rgba(0,0,0,.1)`                      | Dropdown, popover          |
| `shadow-lg`  | `0 12px 16px -4px rgba(0,0,0,.1)`                     | Sticky bar, drawer edge    |
| `shadow-xl`  | `0 16px 24px -8px rgba(0,0,0,.1)`                     | Modal                      |
| `shadow-2xl` | `0 24px 48px -12px rgba(0,0,0,.25)`                   | Hero image, feature only   |

**Brand-tinted shadows** (teal or coral, never grey) for brand surfaces:
`shadow-teal-sm`, `shadow-teal-form` (auth/signup card), `shadow-soft`,
`shadow-elegant`, `shadow-coral`, `shadow-glow-coral` (sparingly).

### 7.3 Mobile elevation

React Native needs both; they are not interchangeable.

| Level | iOS (offset / opacity / radius) | Android `elevation` |
| ----- | ------------------------------- | ------------------- |
| `xs`  | `0,1` / .05 / 2                 | 1                   |
| `sm`  | `0,2` / .10 / 3                 | 2                   |
| `md`  | `0,4` / .15 / 6                 | 4                   |
| `lg`  | `0,8` / .20 / 12                | 8                   |
| `xl`  | `0,12` / .25 / 16               | 12                  |
| `2xl` | `0,16` / .30 / 24               | 16                  |

Always apply through the `shadows` token export. iOS shadow props are silently
ignored on Android and `elevation` is ignored on iOS.

### 7.4 When NOT to use a shadow

- On a flat page section. Sections separate by ground colour, not lift.
- On a disabled control. Disabled means inert; inert means flat.
- On more than two stacked layers. Three shadows deep is unreadable.
- **On the dark ground.** Shadows are invisible on `#081717`. Use a 1px border
  at `rgba(255,255,255,.08)` instead - **surface contrast is the dark-mode
  equivalent of elevation.**
- On a list of many cards above `shadow-sm`. Fifty lifted cards read as static.

### 7.5 Blur and glassmorphism

**`backdrop-filter` is not decoration.** It forces a repaint of everything
behind it every frame.

**Permitted only on:** the fixed marketing header, and modal/drawer overlays.

**Banned on:** any scrolling surface, cards, list rows, dashboard panels,
sidebars. The `.glass` utility in `globals.css` is currently defined as a
general dashboard utility; that is a defect (§19-E7).

### 7.6 Layering (z-index)

Only these values. Never an arbitrary `z-[9999]`.

| Layer             | z-index |
| ----------------- | ------- |
| Base content      | `z-0`   |
| Sticky header     | `z-10`  |
| Dropdown, popover | `z-20`  |
| Sticky CTA bar    | `z-30`  |
| Drawer / sheet    | `z-40`  |
| Modal + overlay   | `z-50`  |
| Toast             | `z-50`  |

---

## 8. Motion

From `apps/mobile/src/design-system/tokens/motion.ts`.

### 8.1 Duration

| Token     | Value | Use                              |
| --------- | ----- | -------------------------------- |
| `instant` | 0ms   | State that must not animate      |
| `fast`    | 150ms | Hover, focus, small state change |
| `normal`  | 250ms | **Default.** Standard transition |
| `slow`    | 350ms | Complex reveal, page transition  |
| `slower`  | 500ms | Loading, complex reveal          |
| `slowest` | 750ms | Hero, onboarding                 |

Anything over 400ms on a routine interaction reads as lag, not polish.

### 8.2 Easing

| Token        | Curve                              | Use                   |
| ------------ | ---------------------------------- | --------------------- |
| `standard`   | `cubic-bezier(0.4, 0, 0.2, 1)`     | Default entrance/exit |
| `decelerate` | `cubic-bezier(0, 0, 0.2, 1)`       | Entering the screen   |
| `accelerate` | `cubic-bezier(0.4, 0, 1, 1)`       | Leaving the screen    |
| `sharp`      | `cubic-bezier(0.4, 0, 0.6, 1)`     | Temporary elements    |
| `bounce`     | `cubic-bezier(.68,-.55,.265,1.55)` | Celebration only      |

Mobile springs: `gentle` (d15/s120), `standard` (d20/s150), `bouncy` (d10/s120),
`quick` (d25/s200, m0.8).

### 8.3 Rules

1. **Animate `transform` and `opacity` only.** Never animate layout properties
   (`width`, `height`, `top`, `margin`); they trigger layout on every frame.
2. **Motion explains, never performs.** If removing it loses no information, it
   was decoration.
3. **`prefers-reduced-motion` is mandatory.** Reduce to opacity fades; disable
   parallax, marquees and float loops entirely.
4. **Nothing flashes more than three times per second** (WCAG 2.3.1).
5. **Never animate a value the user is reading.** Prices and countdowns update
   instantly.

---

## 9. Responsive Behaviour

### 9.1 Breakpoints

| Token | Min width | Device class               | Status                    |
| ----- | --------- | -------------------------- | ------------------------- |
| `xs`  | 360px     | Smallest phone             | **0 usages** - see §19-E8 |
| `sm`  | 640px     | Large phone / small tablet | 398 usages                |
| `md`  | 768px     | Tablet portrait            | 275 usages                |
| `lg`  | 1024px    | Tablet landscape / laptop  | 499 usages                |
| `xl`  | 1280px    | Desktop                    | 43 usages                 |
| `2xl` | 1536px    | Large desktop              | **0 usages** - see §19-E8 |

**360px is the floor.** Nothing may overflow horizontally at 360px. The body
never scrolls sideways; wide content scrolls inside its own `overflow-x-auto`
container.

### 9.2 What actually changes at each breakpoint

Defining breakpoints is not enough. This is the required behaviour.

#### Mobile (< 640px)

- **Layout:** single column. Everything stacks.
- **Navigation:** bottom tab bar (app) or hamburger sheet (marketing). No
  horizontal nav.
- **Tables:** become a card per row. Never a horizontal scroll.
- **Modals:** become bottom sheets.
- **Filters:** full-screen or bottom sheet with an explicit Apply.
- **Primary action:** fixed bottom bar, inside the thumb zone.
- **Container gutter:** 16px (`px-md`). Never zero.
- **Type:** H1 at `text-4xl`, H2 at `text-3xl`.
- **Grids:** offer cards 1 across; stat tiles 2 across.
- **Images:** full-bleed edge to edge is acceptable here and only here.

#### Tablet (640px - 1023px)

- **Layout:** two columns where content genuinely pairs. Do not split a form.
- **Navigation:** marketing header expands to inline links; app keeps tabs.
- **Tables:** may become a real table if it has 4 columns or fewer.
- **Modals:** centred dialogs return.
- **Grids:** offer cards 2 across; feature blocks 2 across.
- **Container gutter:** 24px (`px-lg`).
- **Sidebar:** still collapsed or off-canvas.

#### Desktop (1024px - 1279px)

- **Layout:** full multi-column. Sidebar becomes persistent at 256px.
- **Navigation:** full header nav; dashboard sidebar expanded.
- **Tables:** full table with sticky header.
- **Filters:** inline sidebar, applied live, no Apply button.
- **Grids:** offer cards 3 across; feature blocks 3 across.
- **Container:** `max-w-7xl` (1280px), gutter 32px (`px-xl`).
- **Type:** H1 at `text-5xl`, H2 at `text-4xl`.
- **Hover states become meaningful** - and must never be the only affordance.

#### Large desktop (>= 1280px)

- **Content does not keep growing.** The container caps at `max-w-7xl`; extra
  width becomes margin. Line length is a readability constraint, not a leftover.
- **Grids:** offer cards 4 across maximum. Beyond that, cards shrink below their
  legible minimum.
- **Dashboard:** may show a third column (detail panel) instead of a drawer.
- **Never** scale type up further. `text-7xl` is the ceiling.

### 9.3 Containers

| Context                  | Width                | Gutter                    |
| ------------------------ | -------------------- | ------------------------- |
| Marketing section        | `max-w-7xl` (1280px) | `px-md md:px-lg lg:px-xl` |
| Long-form / legal / blog | `max-w-3xl` (768px)  | `px-md md:px-lg`          |
| Dashboard content        | full width           | `p-md md:p-lg`            |
| Form / auth card         | `max-w-md` (448px)   | centred, `p-lg`           |
| Modal                    | `max-w-lg` (512px)   | `p-lg`                    |

Always `mx-auto` on a `max-w-*` container.

### 9.4 Section rhythm

| Context                     | Vertical padding             |
| --------------------------- | ---------------------------- |
| Marketing section (mobile)  | `py-3xl` (48px)              |
| Marketing section (desktop) | `py-4xl lg:py-5xl` (64-80px) |
| Hero                        | `py-5xl lg:py-6xl` (80-96px) |
| Dashboard section           | `py-lg` (24px)               |
| Between cards in a list     | `gap-md` (16px)              |

Sections alternate ground colour (white / cream / deep teal). **Never two
adjacent sections with the same ground and no divider** - the page reads as one
undifferentiated scroll.

### 9.5 Dashboard shell

`fixed inset-0`, **never `h-screen`**. `h-screen` plus an inner scroll container
produces a double scrollbar and, on iOS Safari, a viewport that changes height
as the URL bar hides.

```tsx
<div className='fixed inset-0 flex flex-col bg-background'>
  <Header />
  <div className='flex flex-1 min-h-0 overflow-hidden'>
    <Sidebar />
    <main className='flex-1 overflow-y-auto overscroll-contain min-h-0'>
      {children}
    </main>
  </div>
</div>
```

`min-h-0` on both the row and the `main` is required: a flex child defaults to
`min-height: auto` and refuses to shrink, so the scroll container never forms.

### 9.6 Mobile-specific behaviour

**Thumb zones.** Design at 360px, then let it grow.

| Zone                 | Region       | Put here                         |
| -------------------- | ------------ | -------------------------------- |
| **Easy** (thumb arc) | Bottom third | Primary CTA, tabs, sheet actions |
| **Stretch**          | Middle       | Content, scrollable lists        |
| **Hard**             | Top corners  | Back, close, rarely-used only    |

Primary actions belong at the bottom. A "Reserve bag" button at the top of a
phone screen requires a hand shuffle at the exact moment of commitment.
Destructive and confirming actions are never adjacent in the easy zone.

**Safe areas.** Respect `env(safe-area-inset-*)` on web and
`useSafeAreaInsets()` on mobile. Bottom bars add the bottom inset to their
**padding**, never their height.

Under edge-to-edge Android (`edgeToEdgeEnabled=true`), never pass `translucent`
or `backgroundColor` to `<StatusBar>`. Both are no-ops that route into React
Native's deprecated path.

---

## 10. RTL and Localization

**Arabic is a production locale.** Locales are `en` (default), `fr`, `ar` (RTL).
French is the primary commercial language for Tunisian search volume; write
French copy first and translate outward.

### 10.1 Logical properties are the default

| Use                           | Not                           |
| ----------------------------- | ----------------------------- |
| `ms-*` / `me-*`               | `ml-*` / `mr-*`               |
| `ps-*` / `pe-*`               | `pl-*` / `pr-*`               |
| `start-*` / `end-*`           | `left-*` / `right-*`          |
| `text-start` / `text-end`     | `text-left` / `text-right`    |
| `border-s` / `border-e`       | `border-l` / `border-r`       |
| `rounded-s-*` / `rounded-e-*` | `rounded-l-*` / `rounded-r-*` |

`left-*` and `right-*` are the highest risk, because absolutely-positioned
elements do not mirror: a "new" badge pinned `right-2` lands on the wrong side
of every card in Arabic.

### 10.2 Physical values require justification

A physical property is permitted **only** when the thing genuinely does not
mirror, and the justification must be recorded in §19. Legitimate cases:

- **Media that is not directionally neutral** - a logo lockup, a photograph.
- **Content locked to LTR** - code blocks, URLs, IBANs, phone numbers.
- **A chart axis** where the data convention is fixed.

Everything else mirrors.

### 10.3 Direction is never hardcoded

`next-intl` sets `dir` on the document. Never write `dir="rtl"` in a component,
and never branch a component on locale to flip a layout - that is what logical
properties are for.

### 10.4 Translation completeness

**Translations are atomic.** A key is added to `en`, `fr` and `ar` **plus the
namespace arrays**, in the same commit. A key present in one locale is a defect,
not a to-do.

**No technical text ever reaches a user.** Every `catch` renders a translated
message. A stack trace, HTTP status or Mongo error in the UI is a defect.

### 10.5 Layout tolerance

| Locale  | Relative length           | Consequence                                 |
| ------- | ------------------------- | ------------------------------------------- |
| English | baseline                  | -                                           |
| French  | ~+30%                     | Buttons and labels must not be width-locked |
| Arabic  | ~-10% width, ~+15% height | Never fix a heading's height                |

Test every screen in Arabic before calling it done. Numbers, currency and dates
go through the locale-aware formatters, never manual concatenation.

---

## 11. Accessibility

**Target: WCAG 2.2 Level AA. This is a release gate, not an aspiration.**

### 11.1 Contrast

| Content                                | Minimum                          |
| -------------------------------------- | -------------------------------- |
| Body text (< 18px, or < 14px bold)     | 4.5:1                            |
| Large text (>= 18px, or >= 14px bold)  | 3:1                              |
| UI boundaries, icons, focus indicators | 3:1                              |
| Disabled elements                      | exempt, but never the only state |

All approved pairings are measured in §2.3, §2.4, §2.5 and §2.6. **If a pairing
is not in one of those tables, it has not been approved.**

### 11.2 Keyboard

Everything operable by mouse is operable by keyboard, in visual order, with no
trap except an intentional modal trap that `Esc` releases.

| Key          | Behaviour                             |
| ------------ | ------------------------------------- |
| `Tab`        | Next focusable                        |
| `Enter`      | Activate button/link, submit form     |
| `Space`      | Activate button, toggle checkbox      |
| `Esc`        | Close modal, drawer, dropdown         |
| Arrows       | Move within tabs, menus, radio groups |
| `Home`/`End` | First/last in a composite widget      |

A `<div onClick>` is not a button: no role, no focus, no keyboard activation.
Custom controls carry the matching role and state.

### 11.3 Focus

Visible on **every** interactive element:

```
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
```

`outline-none` without a replacement ring is a defect. The ring must clear 3:1
against both the control and the ground behind it. On the teal header, use a
white ring with a teal offset.

Focus moves into a dialog on open and returns to the trigger on close.

### 11.4 Touch targets

44 x 44 px minimum, 48px for primary actions, 8px minimum separation. Visual
size may be smaller; the hit area may not.

### 11.5 Semantics and screen readers

- Landmarks on every page: `header`, `nav`, `main`, `footer`.
- One `<h1>`; no skipped levels.
- `alt` on every image; `alt=""` for decorative.
- `aria-label` on every icon-only control.
- Form errors linked with `aria-describedby` and announced.
- Loading regions marked `aria-busy`; live updates in `aria-live` regions
  (`polite` normally, `assertive` for errors).
- Skip-to-content link as the first focusable element on the page.
- Active nav item marked `aria-current="page"`, not colour alone.

### 11.6 Reduced motion

Honour `prefers-reduced-motion`. Reduce to opacity fades; disable parallax,
marquees and float loops. Nothing flashes more than three times per second.
Auto-playing carousels can be paused.

### 11.7 Forms

Every input has a real `<label>` (never a placeholder as label), `autocomplete`,
the right `inputmode`/`type`, and a stable helper-text slot. Validation messages
are specific and actionable. See §15.1.

---

## 12. State Model

Every interactive component implements **all** of these. A component missing one
is incomplete, not "done except".

| State         | Requirement                                                                    |
| ------------- | ------------------------------------------------------------------------------ |
| **Rest**      | Token background; `shadow-sm` if raised                                        |
| **Hover**     | Tint shift only (`hover:bg-primary/90`). Never a size change on a form control |
| **Focus**     | `focus-visible` ring per §11.3. Never removed                                  |
| **Active**    | `active:scale-[0.98]` or the `-600` pressed token                              |
| **Selected**  | Background fill **and** a non-colour marker (check, `aria-current`)            |
| **Disabled**  | `opacity-50 pointer-events-none`, `aria-disabled`, flat, no shadow             |
| **Loading**   | Spinner inside, label retained, `disabled`, width locked                       |
| **Error**     | `border-error`, message below, `aria-describedby`, `aria-invalid`              |
| **Empty**     | See §15.2                                                                      |
| **Read-only** | Visually distinct from disabled; still focusable and copyable                  |

**Hover is never the only affordance.** Touch devices have no hover, and roughly
half the product's traffic is mobile.

**Loading must not collapse the label to a bare spinner.** The button changes
width and the layout jumps. Keep the text, prepend the spinner.

---

## 13. Component Standards

Every shared component documents: **anatomy, variants, sizes, spacing,
typography, states, interaction, accessibility, responsive, RTL.** A component
without all ten is not ready to be shared.

Sizes below are **target rendered pixels**. Several web primitives currently
render far larger; see §19-E5.

### 13.1 Button

- **Anatomy:** `[leading icon 16px] [label] [trailing icon 16px]`, `gap-sm`.
- **Variants:** `default` (the one primary action, **exactly one per view**),
  `secondary` (0-2), `outline`, `ghost`, `link` (navigates, never mutates),
  `destructive` (0-1, always confirms).
- **Sizes:** `sm` 36px / `px-sm`, `md` 40px / `px-md`, `lg` 48px / `px-xl`,
  `icon` 40x40.
- **Typography:** `text-base font-medium tracking-wide`.
- **Radius:** `md` (8px).
- **States:** all ten in §12.
- **Interaction:** activates on `Enter` and `Space`. Loading keeps the label and
  locks the width.
- **Accessibility:** every button has an accessible name; icon-only requires
  `aria-label`. Never `<div onClick>`.
- **Responsive:** full width on mobile inside forms and sticky bars; intrinsic
  width on desktop.
- **RTL:** leading/trailing icons swap automatically via `gap` + logical order.
  Never position an icon with `ml`/`mr`.

### 13.2 Input / Textarea

- **Anatomy:** `label` (above) / `control` / `helper or error` (below,
  reserved).
- **Sizes:** 36 / 44 / 52px. Textarea `min-h-[80px]`.
- **Padding:** `px-sm py-xs`. **Radius:** `md`.
- **Typography:** **16px minimum on mobile** - `text-md md:text-base`.
- **The 16px rule is not cosmetic.** iOS Safari zooms the viewport when a
  focused input is under 16px and does not zoom back out.
- **States:** rest, focus (ring), error (`border-error` + message), disabled,
  read-only, loading.
- **Accessibility:** real `<label>`, never a placeholder as label. Placeholders
  vanish on focus, fail contrast, and are not reliably announced.
  `autocomplete`, `inputmode`, `aria-invalid`, `aria-describedby`.
- **Responsive:** always full width in a single-column form.
- **RTL:** `text-start`; the caret and any prefix/suffix mirror. Currency and
  units use logical placement.

### 13.3 Select

Matches Input geometry: 44px at `md`, `px-sm`, `radius md`, chevron 16px. Menu
gets `shadow-md`, `radius lg`, internal scroll bounded by the Radix
available-height variable. Selected item shows a **check**, never colour alone.
Above ~8 options use a searchable combobox. Native `<select>` on mobile is
acceptable and often better.

### 13.4 Card

- **Anatomy:**
  `[media] [header: title + optional meta] [body] [footer actions]`.
- **Padding:** 16px compact, **24px default**, 32px marketing feature.
- **Gap:** `space-y-sm` (8px) in the header, `gap-md` (16px) in the body.
- **Radius:** `lg` (12px); `2xl` (20px) for marketing feature cards.
- **Border:** `border border-border`. **Shadow:** `shadow-sm` at rest.
- **A non-clickable card gets no hover state.** A hover lift promises an
  interaction that does not exist.
- **A whole-card link needs one anchor**, not an anchor per element. Use a
  stretched pseudo-element overlay so the accessible name is the title and the
  whole surface is the hit area.
- **Offer cards** keep `aspect-[4/3]` media so a grid never ragged-bottoms, and
  must show price, original value, collection window, distance, quantity left.
- **RTL:** media stays in flow order; badges pin with `start`/`end`, never
  `left`/`right`.

### 13.5 Dialog / Modal / Drawer

| Property | Modal              | Drawer / sheet                |
| -------- | ------------------ | ----------------------------- |
| Width    | `max-w-lg` (512px) | `max-w-sm`, full-width mobile |
| Radius   | `xl` (16px)        | `rounded-t-xl` (bottom sheet) |
| Shadow   | `shadow-xl`        | `shadow-lg`                   |
| Overlay  | `bg-black/50`      | `bg-black/50`                 |
| Padding  | `p-lg` (24px)      | `p-lg`                        |

Non-negotiable: focus moves in on open and returns to the trigger on close;
focus is trapped while open; `Esc` closes; background scroll is locked;
`role="dialog"` `aria-modal="true"` with `aria-labelledby` on the title.

**On mobile, prefer a bottom sheet.** A centred modal on a 360px screen either
overflows or shrinks below the touch-target floor, and sheets sit in the thumb
zone. **Never nest a modal inside a modal.**

### 13.6 Table

- **Header:**
  `text-sm font-semibold text-muted-foreground uppercase tracking-wider`, sticky
  on scroll.
- **Cells:** `px-sm py-xs`, `text-base`, row height 48px minimum.
- **Alignment:** numbers `text-end` with `tabular-nums`; text `text-start`.
- **Zebra striping is banned.** Use `border-b border-border` - it survives dark
  mode and prints.
- **Tables do not go to mobile.** Below `md`, render each row as a card with
  labelled fields. A horizontally scrolling table hides the columns that matter.
- **Row actions** live in an overflow menu, never three buttons per row.
- Always ship an empty state, a skeleton with the same row height, and a row
  count.
- **RTL:** column order mirrors; numeric alignment follows `text-end`, which
  flips correctly on its own.

### 13.7 Navigation

**Marketing header:** fixed, 64px, `z-10`, teal at rest, cream once scrolled.
Logo links to `/`. Language switcher and primary CTA always visible; the rest
collapses to a sheet below `lg`.

**Dashboard sidebar:** 256px expanded / 64px collapsed, teal ground. Active item
marked by background fill **and** `aria-current="page"`.

**Mobile bottom tabs:** 5 items maximum (Home, Search, Favorites, Orders,
Profile), 56px + safe-area inset, **icon + label always** - icon-only tabs
measurably reduce recognition. Badge counts cap at `99+`.

All nav is keyboard-reachable in DOM order, with a skip-to-content link first.
**RTL:** the entire bar mirrors; the back chevron flips direction.

### 13.8 Tabs

40px high, `text-sm font-medium`, active gets `bg-background` + `shadow-sm`.
Real `role="tablist"` with arrow-key navigation and roving `tabindex`. Above 4
tabs, or on mobile, scroll horizontally with a gradient affordance rather than
wrapping to a second row.

**Tabs never carry destructive or primary actions**, and switching a tab must
never lose form state. **RTL:** order mirrors; arrow keys follow visual
direction.

### 13.9 Badge

20 / 24 / 28px, `px-sm py-xxs`, `radius full`,
`text-xs font-semibold uppercase tracking-wider`. Status colours come from §2.5
and **must cover both order chains**.

Badges are labels, not buttons. If it is clickable it is a chip and needs a 44px
hit area.

### 13.10 Toast / Feedback

Bottom-centre on mobile, top-right on desktop, `max-w-sm`, `shadow-lg`,
`radius lg`, `z-50`. Success auto-dismisses at 4s. **Errors do not
auto-dismiss** and carry a close button plus, where possible, a retry. Maximum
three stacked, then queue. Rendered in an `aria-live` region.

**A toast is never the only record of something important.** A failed payment
belongs on the page, not only in a message that disappears.

### 13.11 Avatar

Sizes per §5.3. Always `radius full`. Resolution `profileImage > avatar > null`,
then initials. Never an empty grey circle. `alt` is the person's name, or
`alt=""` when the name is already adjacent in text.

---

## 14. UX Standards

**Every new screen must be evaluated against all fifteen points before it is
considered complete.** This is the design brief, not a retrospective checklist.

| #   | Criterion                 | The question to answer                                                        |
| --- | ------------------------- | ----------------------------------------------------------------------------- |
| 1   | **Information hierarchy** | What is the one thing the user must see first? Is it the most prominent?      |
| 2   | **Primary action**        | Is there exactly one, and is it unmistakable?                                 |
| 3   | **Secondary actions**     | Are they clearly subordinate and not competing for the same visual weight?    |
| 4   | **Cognitive load**        | How many decisions does this screen ask for at once? Can any be deferred?     |
| 5   | **Content density**       | Right for the context? Dense for merchant tools, generous for consumer flows. |
| 6   | **Navigation clarity**    | Can the user tell where they are, how they got here, and how to leave?        |
| 7   | **Error prevention**      | Can the mistake be made impossible rather than reported after the fact?       |
| 8   | **Feedback**              | Does every action confirm within 100ms that it was received?                  |
| 9   | **Loading state**         | Shipped, and matching the final layout?                                       |
| 10  | **Empty state**           | Shipped, and does it distinguish the three empties (§15.2)?                   |
| 11  | **Error state**           | Shipped, translated, actionable, with a route forward?                        |
| 12  | **Success state**         | Proportional to the stakes, and does it carry the next action?                |
| 13  | **Accessibility**         | §11 in full, measured not assumed.                                            |
| 14  | **Mobile usability**      | Verified at 360px, primary action in the thumb zone.                          |
| 15  | **RTL behaviour**         | Verified in Arabic, not inferred from the class names.                        |

### 14.1 Content hierarchy

Every screen answers, in this order: **what is this, what can I do, what
happened.** If a user has to read the third thing to understand the first, the
hierarchy is wrong.

Rank by: size, then weight, then colour, then position, then space. Reach for
size and weight before colour - colour is the weakest hierarchy signal and the
one that fails for colour-blind users and in greyscale print.

**One primary action per view.** If two things look equally important, neither
is. Secondary actions drop to `outline` or `ghost`; tertiary actions move into
an overflow menu.

### 14.2 Interaction patterns

Predictable beats clever. These are the product's fixed conventions:

| Intent              | Pattern                                                     |
| ------------------- | ----------------------------------------------------------- |
| Navigate            | Link. Never a button that navigates                         |
| Mutate              | Button. Never a link that mutates                           |
| Choose one of few   | Radio group or segmented control                            |
| Choose one of many  | Select, or combobox above ~8 options                        |
| Choose several      | Checkboxes; chips when the set is small and visual          |
| Confirm destruction | Dialog naming the exact object, with the verb on the button |
| Reveal detail       | Drawer on desktop, bottom sheet on mobile                   |
| Filter a list       | Inline sidebar on desktop, sheet with Apply on mobile       |
| Bulk action         | Selection mode with a persistent action bar                 |

Destructive confirmations never use "Are you sure?" with OK/Cancel. Name the
object and put the verb on the button: "Delete 3 offers" / "Keep them".

---

## 15. UX Rules by State

### 15.1 Forms

One column, always. Multi-column forms double completion errors and break at
360px.

Label above the field. Mark the **required** fields, not the optional ones,
unless most are optional. Group related fields with 16px inside a group and 32px
between groups.

**Validate on blur; re-validate on change once a field has errored.** Validating
every keystroke from empty tells users they are wrong before they have finished
being right.

Errors sit beneath the field, in `text-error`, prefixed with an icon, and say
what to do: "Password needs at least 8 characters", not "Invalid input". Reserve
the helper line so the layout does not shift when it appears.

On submit: disable the button, spinner inline, label retained. On failure keep
every value the user typed, move focus to the first error, and summarise at the
top if more than three fields failed.

### 15.2 Empty states

Four parts: icon, heading, one line of subtext, and a CTA where an action
exists.

```tsx
<div className='flex flex-col items-center justify-center py-2xl gap-sm text-center'>
  <Icon className='size-12 text-muted-foreground' />
  <h3 className='text-md font-semibold'>No offers nearby yet</h3>
  <p className='text-sm text-muted-foreground max-w-xs'>
    Try widening your search radius, or check back this evening when shops post
    what is left.
  </p>
  <Button>Widen search</Button>
</div>
```

**Distinguish the three empties** - they are different problems with different
fixes: **nothing yet** (onboard them), **nothing matched** (relax the filter),
**nothing left** (come back later).

### 15.3 Loading states

| Duration   | Treatment                                       |
| ---------- | ----------------------------------------------- |
| < 300ms    | Nothing. A flashed spinner is worse than a wait |
| 300ms - 3s | Skeleton matching the final layout exactly      |
| > 3s       | Skeleton plus progress or a reassuring message  |
| Background | Inline indicator, never block the screen        |

Skeletons must match real content dimensions or the page jumps when data lands,
which is CLS. Never replace a populated list with a full-page spinner on
refetch: keep the stale data and mark it `aria-busy`.

Optimistic updates are for actions that practically cannot fail (favourite),
**never for payments**.

### 15.4 Error states

| Scope   | Treatment                                         |
| ------- | ------------------------------------------------- |
| Field   | Inline, beneath the field                         |
| Form    | Summary at top, focus moved to first error        |
| Section | Inline block with retry; rest of page still works |
| Page    | Full error state with retry and a way out         |
| Network | Persistent banner, auto-retry with backoff        |

State what happened, why if known, and what to do next. Always offer a route
forward. Never blame the user. Never dead-end. Never show technical text.

### 15.5 Success states

Confirm proportionally to the stakes. A favourite gets an icon change. A saved
setting gets a toast. **A completed order gets a full screen** with the pickup
code, address and collection window, because that is the screen the user will
reopen at the shop.

Success states carry the next action, not just a tick.

---

## 16. Marketplace UX Rules

Product-specific rules encoding the domain model in `CLAUDE.md`. Getting these
wrong costs money or trust.

**Merchants.** The dashboard is a work tool used in a busy kitchen, often
one-handed. Density over decoration. Today's orders are the landing view. New
order alerts are sound + badge + persistent list entry, never a toast alone.
Show the **merchant's own take (81%)**, never only the customer price; never
surface platform margin, driver fee or the donation split as a deduction from
them.

**Listings.** Photograph first, with a category fallback, never a blank grey
box. Always show price, original value, collection window, distance, quantity
left. Show discount as both a percentage and an absolute TND saving. **Never
invent scarcity** - "3 left" renders only when three are left. Allergens are
never behind a tap; that is a safety issue, not a filter preference. Sold out
stays visible and greyed with a "notify me".

**Mystery bags.** The surprise is the product; uncertainty about whether it is
worth it is not. Always state the guaranteed value floor and the category, and
what is never included. A mystery bag never hides an allergen disclosure.

**Checkout.** Show `subtotal + deliveryFee` before payment; **no fee ever
appears first on the confirmation screen**. Pickup means the delivery-fee line
is absent, not "0.00 TND". Beyond `MAX_DELIVERY_KM` (5km) delivery is refused
**at selection time with a clear reason**, never after payment. Handle success,
failure, timeout and duplicate webhook distinctly. On the mobile online-payment
path the user leaves to an external browser: tell them they will return, then
poll and show progress. Never auto-retry a payment without asking.

**Pickup.** The code is the largest element on screen, `font-mono`, legible at
arm's length at full brightness. Show the window as a **countdown**
(`expiresAt = offer.availableUntil + 30 min`). Address, map and call are one tap
away. The screen works offline once loaded - shop wifi is unreliable. Warn
before expiry, not after.

**Rewards.** State points in what they buy. "Save a Bag" is +10;
`totalBagsSaved` and `totalOrdersCount` are different numbers and must never be
labelled interchangeably. Never expire points silently. The charity donation
(0.95% of subtotal, from platform margin) is a shared achievement, and the
current goal in the `TSHIRTS -> PANTS -> SHOES -> CHILDREN_STUDIES -> MEDICINE`
rotation is named explicitly - vague "we donate a portion" reads as
greenwashing.

**Referrals.** State both sides of the reward before the share. Show status
honestly: sent, signed up, first order completed. Never spam contacts, never
auto-send, never require contact-list access to share a link.

---

## 17. Visual Quality Rules

### Every screen must have

- **Clear hierarchy** - one primary action, an obvious entry point for the eye.
- **Intentional whitespace** - space is a design element, not leftover.
- **Consistent alignment** - everything on a shared grid; no optical drift.
- **Limited visual noise** - every element earns its place.
- **Consistent component language** - the same thing looks the same everywhere.
- **Predictable interaction** - §14.2 conventions, no bespoke gestures.
- **A strong primary action** - unmistakable without reading.
- **Appropriate content density** - dense for merchant tools, generous for
  consumer flows.

### Never

- Arbitrary colours - no raw hex, no `bg-[#...]`, no near-misses.
- Arbitrary spacing - no `p-[13px]`, no off-grid values.
- Random border radii - `rounded-[7px]` is a defect.
- Excessive shadows - more than two stacked layers is unreadable.
- Excessive gradients - flat grounds; gradients only where they carry meaning.
- Unnecessary glass effects - §7.5.
- Decorative elements without purpose - §1.3.
- Inconsistent icon sizes - the fixed set in §5.2.
- Visually competing primary actions - if two look equal, neither is primary.
- Generic dashboard cards without hierarchy - a grid of identical stat tiles
  with no ranking is a data dump, not a dashboard. Lead with the number that
  drives a decision.
- More than two emphasis colours in one view.
- `h-screen` on a dashboard shell - `fixed inset-0`.
- A table on mobile - cards.
- Placeholder-as-label.
- The em dash.

---

## 18. Pre-Completion Self-Review

**Mandatory before reporting any UI work complete.** Run it as a separate pass
with a different brief - re-reading your own diff confirms the intent you
already had. Do not grade the work; list what is missing.

### Visual

- [ ] Spacing values come from §4; no arbitrary values
- [ ] Type sizes and roles come from §3.2 / §3.4
- [ ] Alignment consistent; nothing optically drifting
- [ ] Hierarchy clear; one primary action
- [ ] Colours are tokens; zero raw hex
- [ ] Contrast verified against §2.3 / §2.4 / §2.6 - **measured, not assumed**
- [ ] Radius from §6.1; nested radii decrease inward
- [ ] Elevation from §7; no shadow on flat sections or disabled controls

### UX

- [ ] Task is clear without instructions
- [ ] Interaction follows a §14.2 convention
- [ ] Feedback within 100ms of every action
- [ ] Loading state exists and matches final dimensions
- [ ] Error state exists, is translated and actionable
- [ ] Empty state exists and names which of the three empties it is
- [ ] Success state carries the next action

### Engineering

- [ ] Shared components reused; nothing re-implemented locally
- [ ] No duplicate component introduced
- [ ] No arbitrary colours
- [ ] No arbitrary spacing unless justified in §19
- [ ] No unnecessary CSS; no dead utility classes
- [ ] Responsive behaviour per §9.2, not just breakpoint prefixes
- [ ] No new allocations in render; memoised children get stable props
- [ ] `staleTime` set on every query
- [ ] Only `transform`/`opacity` animated
- [ ] Images have explicit dimensions

### Accessibility

- [ ] Fully keyboard operable, in visual order
- [ ] Visible focus ring on every interactive element; no bare `outline-none`
- [ ] Every control has an accessible name
- [ ] Contrast measured, both themes
- [ ] Touch targets >= 44px with >= 8px separation
- [ ] Semantic HTML; landmarks; one `<h1>`; no skipped levels
- [ ] Nothing communicated by colour alone
- [ ] `prefers-reduced-motion` honoured

### Localization

- [ ] Verified in **English**
- [ ] Verified in **French** - layout tolerates ~30% longer strings
- [ ] Verified in **Arabic** - actually rendered, not inferred
- [ ] **RTL** verified; logical properties throughout; physical values justified
- [ ] Keys added to all three locales plus namespace arrays, same commit
- [ ] Currency as TND via the shared formatter

### Domain coverage

- [ ] **Both** order chains handled (pickup and delivery), every terminal state
- [ ] All four `authProvider` values considered where auth is touched
- [ ] `isEmailVerified`, `status`, `role` variants considered
- [ ] Payment success / failure / timeout / duplicate-webhook handled
- [ ] `establishmentId` handled as string **or** populated object
- [ ] Profile image resolved `profileImage > avatar > null`

---

## 19. Known Exceptions and Decisions

**Every intentional deviation lives here. Nothing is hidden.** An undocumented
deviation is a defect. Entries are append-only: when a decision is reversed,
append the reversal with its reason rather than editing the original.

### Status legend

`OPEN` - live defect, fix pending. `ACCEPTED` - deliberate, permanent.
`UNRESOLVED` - needs a human decision. `PLANNED` - agreed, scheduled.

---

**E1. Dark mode does not render.** `RESOLVED 2026-08-24` `globals.css` hardcoded
`body { @apply bg-white text-gray-900 }` and shipped a `.dark` block
byte-identical to `:root`, so `text-primary` measured 1.84:1. Fixed: body now
uses `bg-background text-foreground`, and seven `.dark` tokens were repointed at
the §2.6 ramp (`--primary`, `--primary-foreground`, `--accent`,
`--accent-foreground`, `--destructive`, `--destructive-foreground`, `--ring`).
`:root` was left untouched, and every value was confirmed in the compiled
bundle.

**Still open, light mode only:** `--accent-foreground` is white on coral =
**3.38**, an AA failure on `Button variant="ghost"` hover. Per §2.4 it should be
dark ink. Not changed in that pass, which was scoped to dark mode; it is a
one-token fix.

**E2. `destructive` has no compliant foreground.** `UNRESOLVED` (light mode)
_Dark mode was fixed 2026-08-24_ - `--destructive` is now `error-300` with dark
ink (6.54). The light-mode question below is untouched. White on
`destructive #EF4343` is 3.78 (fails); dark ink is 5.17 (passes) but a red
button with dark text reads wrong. Darkening the fill to `error-600 #C62828`
gives 5.62 with white text. **Needs a design decision** between: (a) dark ink on
the current red, (b) darken the fill and keep white text. Recommendation: (b).
Not actioned - this is a brand call, not an engineering one.

**E3. `warning` and `info` have no accessible tint shade.** `ACCEPTED` Neither
ramp contains a shade reaching 4.5:1 on its own 10% tint (best: `warning-600`
2.80, `info-600` 4.15). Rather than invent hex values, both use the **solid
fill + dark ink** pattern (§2.5), which passes at 7.22 and 6.25. Revisit only if
a tinted variant becomes a hard requirement; that would need `warning` to shift
toward deep-orange, a hue change requiring brand sign-off.

**E4. `border` is 1.24:1 against white.** `UNRESOLVED` WCAG 1.4.11 requires 3:1
for boundaries that identify a control. The current `border`/`input` token does
not meet it, so input boundaries are technically non-compliant. Most design
systems accept this and rely on label, placement and focus ring as the
affordance. **Needs a decision:** darken the input border specifically, or
document acceptance with the compensating affordances named. Not actioned.

**E5. Tailwind numeric spacing keys are overridden.** `RESOLVED 2026-08-24` The
override of keys 0-10 is removed and replaced with the named tokens in §4.1;
Tailwind's default n x 4px scale is restored. The default `<Button>` renders
40px again and `sm` (36px) is no longer taller than `lg` (44px).

4,223 Category A/D utilities across 140 app files were remapped to the named
token rendering the identical pixel, so no layout moved; 801 kept their numeric
key because no named token matches their value exactly. Categories B and C
changed by design. 65 Button height workarounds and 12 sub-floor touch targets
were removed as part of the same migration.

Guarded going forward by `scripts/spacing-snapshot.mjs` and
`src/__tests__/design/spacing-scale.test.ts`. Full detail, including seven
unresolved visual cases, in
[`SPACING_MIGRATION_REPORT.md`](./SPACING_MIGRATION_REPORT.md).

**§4.2 now describes the code**, not a target.

**E6. Web and mobile radius scales are transposed.** `PLANNED` Web has `md` 12 /
`lg` 8; mobile has `md` 8 / `lg` 12. §6.1 adopts the mobile scale as canonical.
Web must migrate, which also means `--radius` moves from `0.5rem` to `0.75rem`
so `rounded-lg` resolves to 12px. This is a visible change to every card and
button. Sequence it **after** E5 to keep visual diffs readable.

**E7. `.glass` is defined as a general dashboard utility.** `OPEN` (needs a
design decision) Re-verified 2026-08-24: **76 usages**, all merchant dashboard
cards, in the shape `class='glass rounded-2xl p-[24px] shadow-soft'` -
`impact-cards`, `analytics-page`, `inventory-page`, `campaign-side-panel`,
`leaderboard`, `esg`, `community`.

**Not actioned deliberately.** Removing `backdrop-filter` is not a refactor, it
changes what 76 cards look like, and those routes sit behind auth so no
screenshot baseline could prove the outcome. This needs a design call between
accepting the repaint cost and restyling the dashboard.
`backdrop-filter: blur(20px) saturate(140%)` in `globals.css`. Per §7.5 it is
permitted only on the fixed header and modal overlays. Current usage on
scrolling dashboard surfaces is a performance defect.

**E8. `xs` and `2xl` breakpoints have zero usages.** `ACCEPTED` Declared in
`tailwind.config.ts` but never used. `xs` (360px) is kept as the documented
floor for testing even though no utility targets it; `2xl` (1536px) is kept
because §9.2 caps content at `max-w-7xl`, so there is deliberately nothing to
change above 1280px. **Neither should be removed, and neither should be reached
for without a specific reason.**

**E9. Web marketing is white-grounded; mobile is cream-grounded.** `ACCEPTED`
Deliberate. Cream reads warmer in-hand on a phone; white reads cleaner behind
marketing photography. Web dashboards use cream via `.bg-dashboard`. Do not
harmonise without a product decision.

**E10. Mobile uses platform font faces, not Quicksand/Comfortaa.** `ACCEPTED`
`SF Pro` on iOS, `Roboto` on Android. Correct for native feel and performance;
not a divergence to fix.

**E11. Raw hex permitted in two places.** `ACCEPTED` `opengraph-image.tsx`
(Satori does not run Tailwind) and `partner-kit` print/swatch styles (the hex
_is_ the content). Everywhere else, 221 raw hex occurrences and 92 arbitrary
colour classes remain `OPEN` - see `DESIGN_AUDIT_REPORT.md` V5-V7.

**E12. `font-display` and `font-playfair` are aliases.** `ACCEPTED` Both resolve
to `font-heading` (Comfortaa) so the ~58 existing dashboard usages keep working.
Deliberately pointed at the heading face so no screen gets a display font of its
own. Not for new code.

**E13. Button `sm` at 36px is below the 44px touch floor.** `ACCEPTED` Permitted
in dense desktop contexts only, and **only** with padding bringing the hit area
to 44px. Mobile currently uses 32px for button `sm`
(`spacing.ts sizing.button.sm`); aligning to 36px is deferred with E6.

**E14. Input `md` is 44px while Button `md` is 40px.** `ACCEPTED` Deliberate,
per §5.1: an input must accommodate a caret and label relationship in addition
to being a touch target.

**E15. `text-warning` / `text-secondary` banned on light grounds.** `ACCEPTED`
2.70 and 2.42 respectively - they fail even the 3:1 non-text threshold. This
constrains marketing design and is accepted as the cost of AA compliance.

**E16. 961 usages of fractional spacing keys.** `OPEN` `1.5`/`2.5`/`3.5`
(388/219/354). These were never overridden, so developers migrated toward them
to escape the broken integer scale. They are not wrong today, but after E5 lands
they should be reviewed - many will read more clearly as named tokens.

**E18. The `accent` ramp diverges between web and mobile.** `OPEN` 7 of 10 steps
differ. Only `50` (`#FFF5F4`), `500` (`#F55449`) and `900` (`#751A13`) agree.
Web's ramp is a tint/shade progression from `500`; mobile's `300` (`#F04535`) is
a distinct brand coral rather than a tint. Both `accent-700` values pass AA on
the coral tint (6.83 / 5.13), so nothing is broken today, but a component ported
between platforms silently changes colour at every non-500 step. **Never quote a
non-500 accent value without naming the platform.** Unifying requires a brand
decision about whether `accent-300` is a tint or a second coral. Not actioned.

_Found while verifying this document against source, after
`DESIGN_AUDIT_REPORT.md` was written; recorded there as V19._

**E19. `ThemeProvider` persisted to `localStorage`.** `RESOLVED 2026-08-24` The
theme now lives in a first-party cookie (`foodwaste-theme`, `SameSite=Lax`, one
year) and is applied by a small script in `<head>` that runs before first paint,
so dark-mode users no longer get a white flash on every navigation.

The cookie is deliberately **not** read server-side: `app/[locale]/layout.tsx`
is statically generated and `next/headers` would force every route to render
dynamically. The pre-paint script achieves the same result without that cost.
See `lib/theme-script.ts`.

**E20. Mobile exports a 26-colour unconstrained palette.** `CONSTRAINED`
`harmonious` (12), `categories` (8) and `dietary` (6) are exported from
`apps/mobile/src/design-system/tokens/colors.ts` with no usage limit, against
§2.9's "at most two emphasis colours".

**Constraint, effective now:** these three groups are for **data marks and
category identity only** - chart series, category chips, dietary badges. Never a
surface, a CTA, a border, or body text. Any other use is a §20 governance event.
Pruning unused members is a follow-up, not a blocker.

**E21. Physical text alignment on `<body>` is deliberate.** `ACCEPTED` `<body>`
carries `isRTL ? 'text-right' : 'text-left'`, which looks like exactly the
physical value §10.1 bans. It is kept on purpose.

`text-align: start` is **not** equivalent for inline-level boxes: substituting
it moved every `inline-flex` child - Radix's `TabsList` among them - to the
wrong edge in Arabic. The RTL screenshot baselines caught it, it was reverted,
and it is recorded here so nobody re-attempts the swap. This is the documented
justification §10.2 requires.

**E22. Radix menus need a `DirectionProvider`.** `RESOLVED 2026-08-25` Radix
resolves reading direction from its own React context, not from the `dir`
attribute on `<html>`, and it portals menu content onto `document.body`. Without
a provider it defaulted to LTR, so Select and DropdownMenu content laid out
left-to-right inside an otherwise correct RTL page - the check indicator sat on
the opposite edge from the padding reserved for it.

Fixed by wrapping the provider tree in
`<DirectionProvider dir={locale.direction}>` (`app-providers.tsx`), threaded
from the server layout. `@radix-ui/react-direction` is now a direct pinned
dependency (1.1.2) rather than relied on transitively.

Verified in the RTL baselines at all three viewports: Select items are
right-aligned with the check on the right, the trigger chevron mirrors, and
`TabsList` reverses so the active tab is rightmost. No LTR baseline moved.

> A stale screenshot baseline made this look viewport-dependent mid-diagnosis -
> desktop appeared unfixed while mobile and tablet mirrored. Deleting the
> baselines and regenerating showed all three correct. When an RTL result looks
> inconsistent across viewports, regenerate before theorising.

> **Numbering note.** E17 and E18 are out of sequence, and the original E16
> (theme persistence) and E18 (mobile palette) were overwritten by a later edit
> that reused those numbers. They are restored above as E19 and E20 rather than
> renumbered, because §19 is append-only and renumbering would break every
> existing reference.

**E17. Visual coverage has not been performed.** `OPEN` No route has been opened
in a browser as part of authoring this document. All values are static analysis
plus computed contrast plus compiled-CSS measurement. **No claim in this
document about how a rendered screen looks has been visually verified.** A
per-route pass at 360/768/1280, in three locales and both themes, is
outstanding.

**Update 2026-08-24.** Partly superseded. All 22 public routes have now been
opened in a real browser and reviewed - see `UX_VISUAL_AUDIT.md`. The 45
authenticated routes remain unopened, so the claim still holds for those.

---

## 20. Governance Rule

**When a new design decision is introduced and is likely to be reused, it does
not get implemented only in the page.**

The sequence is fixed:

1. **Ask whether it belongs in the system.** Will a second screen plausibly need
   this? If yes, it is a system decision, not a page decision.
2. **If reusable: add or update the token / component rule first.**
3. **Update this document** - the token table, the component section, and §19 if
   it creates an exception.
4. **Then implement the UI using the new standard.**

If it is genuinely one-off, it still gets an entry in §19 with the
justification. **"One-off" is a claim that needs recording, not a way to skip
recording.**

### What counts as a governance event

- A colour, spacing, radius, shadow or duration value that does not already
  exist.
- A new component, or a new variant/size of an existing one.
- A new interaction pattern not in §14.2.
- A deliberate deviation from any rule in this document.
- A change to a shared primitive in `packages/ui` or `components/ui`.

### What does not

- Composing existing components in a new arrangement.
- Page-specific copy, imagery or content layout that uses only existing tokens.

### Keeping this document true

**This document must evolve with the product.** A rule that no longer describes
the code is worse than no rule, because it is trusted. When implementation and
this document diverge, either fix the code or update §19 with the exception -
never leave the contradiction silent.

Re-run the audit (`DESIGN_AUDIT_REPORT.md`) after any change to
`tailwind.config.ts`, `globals.css`, or the mobile token files.

---

## 21. Contradictions Found and Resolved

This document was compared line by line against `CLAUDE.md`, the
`.claude/rules/*.md` files, the shipped implementation, and
`DESIGN_AUDIT_REPORT.md`. Contradictions found are listed with their resolution
and the evidence behind it. **Where no evidence decides the question, the entry
is marked UNRESOLVED and no choice was made.**

### Resolved by evidence

**C1. Spacing scale.** `.claude/rules/ui-ux.md` documents
`space-3 = 16px, space-4 = 24px … space-10 = 96px` as the standard. §4.2 of this
document requires Tailwind's numeric keys to keep their defaults.
**Resolution:** the rule file describes the current _defect_, not the standard.
Evidence: `DESIGN_AUDIT_REPORT.md` Part 1 (default `4` = 16px, current = 24px;
`Button sm` renders taller than `Button lg`). **Action: correct `ui-ux.md`.**

**C2. Radius scale.** `ui-ux.md` states `rounded-md = 12px`,
`rounded-xl = 20px`, `rounded-2xl = 24px` (the web values). §6.1 adopts the
mobile scale (`md` 8, `xl` 16, `2xl` 20). **Resolution:** unified on the mobile
scale because it is the conventional ramp and because `md`/`lg` are currently
_transposed_ between platforms, so a ported component silently changes shape.
Tracked as §19-E6 `PLANNED`. **Action: correct `ui-ux.md` when E6 lands, not
before** - the rule file correctly describes web today.

**C3. Font families.** `ui-ux.md` states body is Inter and `font-heading`
resolves to Playfair Display, with a paragraph asserting Playfair is the only
display face. **Resolution:** the code loads **Quicksand** and **Comfortaa**
(`app/[locale]/layout.tsx:2`), and `font-playfair`/`font-display` are aliases of
`font-heading` (`tailwind.config.ts:118-119`). The code wins. **Action: correct
`ui-ux.md`.** Audit V11.

**C4. Component availability.** `ui-ux.md` lists `progress`, `table`, `command`
and `popover` as available. **Resolution:** none exists in either
`apps/web/src/components/ui/` or `packages/ui/src/components/`, verified by file
existence. `avatar`, `sheet` and `tooltip` exist **only** in `packages/ui`, so a
web import following the documented path fails. `textarea` exists and is
undocumented. **Action: correct `ui-ux.md`.** Audit V12.

**C5. `secondary` colour.** `ui-ux.md` gives `secondary` as `#FFA000`;
`globals.css:14` defines `--secondary: 41 47% 56%` (`#C4A25A`). **Resolution:**
both values exist - `#FFA000` is `secondary-700` in the mobile ramp, `#C4A25A`
is the web `secondary` token. The rule file conflated a ramp step with the
semantic token. The semantic token is `#C4A25A`. **Action: correct `ui-ux.md`.**
Audit V13.

**C6. Status badge pattern.** `ui-ux.md` and the previous `DESIGN.md` both
specify `bg-X/10 text-X border-X`. §2.5 replaces it with a solid fill.
**Resolution:** the tint pattern **fails AA for 7 of 8 status colours** at 12px
semibold (measured: warning 2.45, secondary 2.25, info 2.82, accent 3.01,
destructive 3.31, error 4.28, success 4.49; only primary passes at 8.95). This
is not a preference, it is a compliance failure. **Action: correct `ui-ux.md`
and migrate badge usages.**

**C7. Raw hex.** `CLAUDE.md:460` states "Never use raw hex values".
**Resolution:** the rule stands, with exactly two accepted exceptions
(`opengraph-image.tsx`, `partner-kit`) documented in §19-E11. The remaining 221
occurrences and 92 arbitrary colour classes are open defects, not exceptions. No
contradiction in principle; a large gap in practice.

**C8. Foreground colours in `globals.css`.** `--accent-foreground` and
`--destructive-foreground` are both white, contradicting §2.4. **Resolution:**
measured at 3.38 and 3.78 against their fills - both are live AA failures. §2.4
is correct; the CSS is wrong. `accent` is resolved (dark ink, 5.78);
`destructive` is not - see below.

### Unresolved - require a human decision

**U1. `destructive` foreground (§19-E2).** No compliant option preserves both
the red fill and white text. Choices: dark ink on the current red (5.17), or
darken the fill to `error-600 #C62828` and keep white (5.62). This is a brand
call. **No change made.**

**U2. `border` contrast (§19-E4).** `border`/`input` is 1.24:1 against white,
below the 3:1 that WCAG 1.4.11 requires for a control boundary. Either darken
the input border or formally accept with compensating affordances named. **No
change made.**

**U3. Mobile button `sm` (§19-E13).** Mobile uses 32px; §5.1 standardises 36px.
Whether to change mobile or carve out a platform exception is deferred to the E6
migration. **No change made.**

### Claims this document does not make

Per §19-E17: **no route was opened in a browser while authoring this document.**
Every value here is static analysis, computed contrast, or a measurement of the
compiled CSS. Nothing in this document asserts how a rendered screen actually
looks, and no visual coverage is claimed. The outstanding work is a per-route
pass at 360/768/1280, in `en`/`fr`/`ar`, in both themes.

---

## 22. Change Log

Append-only. Record what changed and why, so a future reader can tell a
deliberate decision from a drift.

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-24 | Rewritten as the governance system. Colour rules rebuilt on measured contrast; §2.5 badge pattern replaced after the tint pattern failed AA for 7/8 statuses; spacing moved to named tokens per §4.2; radius unified on the mobile scale (§6.1, E6); §19 and §21 added. Supersedes the descriptive version at `DESIGN.v2.bak.md` and the original at `DESIGN.md.bak`. |
