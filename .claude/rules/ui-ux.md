# UI/UX Design Standards

> **[`DESIGN.md`](../../DESIGN.md) is the single source of truth.** Where this
> file disagrees with it, `DESIGN.md` wins. This file is a quick reference for
> the web app; `DESIGN.md` §21 records every contradiction found between the two
> and how it was resolved.
>
> Known gaps still open here: the spacing block below documents the **current
> overridden** Tailwind scale (see `DESIGN.md` §19-E5), and the radius block
> documents web's scale, which `DESIGN.md` §6.1 unifies onto mobile's (§19-E6).

## Design System Reference

### Colors

| Token                                 | Hex          | Usage                         |
| ------------------------------------- | ------------ | ----------------------------- |
| `primary-500` / `hsl(var(--primary))` | #1E4448      | Brand primary, CTAs, links    |
| `accent-500` / `hsl(var(--accent))`   | #F55449      | Danger, highlights, badges    |
| `secondary` / `hsl(var(--secondary))` | #C4A25A      | Gold. Dark-ground accent only |
| `hsl(var(--background))`              | white / dark | Page background               |
| `hsl(var(--card))`                    | white / dark | Card backgrounds              |
| `hsl(var(--muted))`                   | gray-100     | Subtle backgrounds            |
| `hsl(var(--muted-foreground))`        | gray-500     | Placeholder text              |
| `hsl(var(--border))`                  | gray-200     | Dividers, input borders       |
| `success`                             | #2E7D32      | Confirmed, paid               |
| `error`                               | #D32F2F      | Errors, destructive           |
| `warning`                             | #F57C00      | Pending, expiring             |

**Rule**: Never use raw hex values in components. Use Tailwind tokens or CSS
variables.

### Spacing (8pt grid)

Named semantic tokens. Tailwind's numeric keys are **not** overridden - `p-4` is
16px, as everywhere else in the ecosystem.

```
p-xxs = 2px  | p-xs  = 4px  | p-sm  = 8px  | p-md  = 16px
p-lg  = 24px | p-xl  = 32px | p-2xl = 40px | p-3xl = 48px
p-4xl = 64px | p-5xl = 80px | p-6xl = 96px
```

Values match `apps/mobile/src/design-system/tokens/spacing.ts`. For a value with
no named token (6px, 10px, 14px, 44px) use the numeric key - it renders the
Tailwind default. Guarded by `pnpm --filter @foodwaste/web check:spacing`.

### Typography

```
text-xs = 10px   |  text-sm = 12px  |  text-base = 14px  |  text-md = 16px
text-lg = 18px   |  text-xl = 20px  |  text-2xl = 24px   |  text-3xl = 28px
text-4xl = 32px  |  text-5xl = 36px |  text-6xl = 42px   |  text-7xl = 48px
```

- Body: `font-sans` (Quicksand)
- Headings/brand: `font-heading` (Comfortaa) - the only display face on
  marketing. See "One accent, one display face" below.
- Mono: `font-mono`
- Arabic: `Noto Sans Arabic` sits in both stacks, so Arabic resolves per
  character with no locale conditional.

### Border Radius

```
rounded-xs = 2px | rounded-sm = 4px | rounded = 8px (default)
rounded-md = 12px | rounded-xl = 20px | rounded-2xl = 24px | rounded-full
```

Use `var(--radius)` (maps to `rounded-lg`) for shadcn component consistency.

> These are web's current values. `DESIGN.md` §6.1 unifies the radius scale onto
> mobile's (`md` 8px, `lg` 12px, `xl` 16px, `2xl` 20px), which transposes `md`
> and `lg`. That migration is §19-E6 and has not landed.

### Shadows

```
shadow-xs → shadow-sm → shadow → shadow-md → shadow-lg → shadow-xl → shadow-2xl
```

---

## Component Library (Web)

shadcn/ui is installed at `apps/web/src/components/ui/`. Import like:

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
```

The `cn()` utility lives at `@/lib/utils`.

**Available in `apps/web/src/components/ui/`**: alert, badge, button, card,
dialog, dropdown-menu, input, label, select, separator, skeleton, tabs,
textarea.

**Available in `packages/ui/src/components/` only**: avatar, sheet, sonner,
tooltip. Importing these from `@/components/ui/...` fails - use `@foodwaste/ui`.

**Do not exist anywhere** (previously listed here in error): `progress`,
`table`, `command`, `popover`. Build or install them before use.

---

## Accessibility Non-Negotiables

- Contrast ratio ≥ 4.5:1 for normal text, 3:1 for large/UI elements
- All interactive elements keyboard-focusable with visible focus ring
- No `outline: none` without replacement
- `aria-label` on icon-only buttons
- `alt` on all `<img>` / `<Image>` tags

---

### Banned decorations

These read as templated and are not used anywhere on the site:

- **A hairline rule beside a label.** The
  `<span className="h-px w-10 …" /> EYEBROW` pattern appeared on eight marketing
  pages in four spellings. A tracked-out, coloured label already reads as an
  eyebrow; the rule adds nothing and made every page open the same way. Removed
  2026-08-22. A hairline _under_ a card, or one joining two steps, is a
  different device and is fine.
- **Tinted radial glows behind content.** Absolutely positioned, aria-hidden
  divs carrying a coloured `radial-gradient`. They gave the brand green a yellow
  cast on one page and a coral cast on the next. Backgrounds stay flat
  `primary-500`. Gradients that carry meaning are fine: a drop shadow, a slider
  track fill.
- **The em dash `—`.** Use `-`. See `feedback_no_em_dash` in project memory.

### The second teal, #017C6E

A light-surface colour, not a second accent. Measured against the palette:

| Pairing                    | Ratio | Verdict            |
| -------------------------- | ----- | ------------------ |
| `#017C6E` on white         | 5.11  | passes AA for text |
| white on `#017C6E`         | 5.11  | passes AA for text |
| `#017C6E` on `#1E4448`     | 2.08  | fails, unusable    |
| `#017C6E` beside `#FFA000` | 2.50  | fails              |

**Use it on light sections only**: links, filled buttons with white text, active
states, icons, and data marks on white or cream. It is the interactive colour
for light surfaces, the way gold is the accent for the dark ground.

**Never on the dark teal ground.** At 2.08 it is barely visible - the two
colours are five points of lightness apart. And never adjacent to gold: 2.50
between two saturated hues reads as a clash rather than a pairing.

This keeps one system with a light and a dark half, rather than two accents
competing. Gold owns the dark ground; #017C6E owns the light one; coral stays
reserved for destructive and error states.

### One accent, one display face

Gold (`secondary`, #C4A25A) is the only accent. Coral (`accent-500`) is reserved
for destructive and error states, never decoration - two accents made the
rollout map read as a different product from the rest of the site.

`font-heading` resolves to **Comfortaa** and is the only display face on
marketing; `font-sans` is **Quicksand**. Both are rounded geometric sans, so
headings and body sit in one family of shapes. `font-display` and
`font-playfair` are kept as aliases of `font-heading` so existing dashboard
usages resolve; do not use them in new code.

Two earlier names are recorded because both failed silently: `Korolev` is
licensed and was never loaded, and `Playfair Display` was named here long after
the code moved to Comfortaa. If a heading font is named it must be in the
`next/font` imports or have an `@font-face`; check before adding one.

## i18n & RTL (Arabic)

- Use logical CSS properties: `ps`/`pe` not `pl`/`pr`, `ms`/`me` not `ml`/`mr`
- Text direction handled by `next-intl` — never hardcode `dir`
- Currency: always format as TND

---

## App-Specific Patterns

### Status Badges

**The `bg-X/10 text-X` tint pattern fails WCAG AA for 7 of 8 status colours**
(measured: warning 2.45, secondary 2.25, info 2.82, accent 3.01, destructive
3.31, error 4.28, success 4.49; only primary passes at 8.95).

Use the solid-fill pattern in `DESIGN.md` §2.5, which covers **both** order
chains and passes at every step.

### Loading States

- List items → `<Skeleton>` matching exact card dimensions
- Full page → centered spinner with `<Skeleton>` grid
- Buttons → `disabled` + spinner icon inside button

### Empty States

Always include: icon + heading + subtext + optional CTA.

```tsx
<div className='flex flex-col items-center justify-center py-10 gap-3 text-center'>
  <Icon className='size-12 text-muted-foreground' />
  <h3 className='text-md font-semibold'>No items yet</h3>
  <p className='text-sm text-muted-foreground max-w-xs'>...</p>
</div>
```

### Mobile Design System

Tokens live in `apps/mobile/src/design-system/tokens/`:

- `colors.ts` — brand palette
- `typography.ts` — font scale
- `spacing.ts` — 8pt grid
- `shadows.ts` — elevation system
- `motion.ts` — animation presets
