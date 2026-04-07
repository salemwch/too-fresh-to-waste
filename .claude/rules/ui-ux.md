# UI/UX Design Standards

## Design System Reference

### Colors

| Token                                 | Hex          | Usage                       |
| ------------------------------------- | ------------ | --------------------------- |
| `primary-500` / `hsl(var(--primary))` | #005250      | Brand primary, CTAs, links  |
| `accent-500` / `hsl(var(--accent))`   | #F55449      | Danger, highlights, badges  |
| `secondary` / `hsl(var(--secondary))` | #FFA000      | Warnings, secondary actions |
| `hsl(var(--background))`              | white / dark | Page background             |
| `hsl(var(--card))`                    | white / dark | Card backgrounds            |
| `hsl(var(--muted))`                   | gray-100     | Subtle backgrounds          |
| `hsl(var(--muted-foreground))`        | gray-500     | Placeholder text            |
| `hsl(var(--border))`                  | gray-200     | Dividers, input borders     |
| `success`                             | #2E7D32      | Confirmed, paid             |
| `error`                               | #D32F2F      | Errors, destructive         |
| `warning`                             | #F57C00      | Pending, expiring           |

**Rule**: Never use raw hex values in components. Use Tailwind tokens or CSS
variables.

### Spacing (8pt grid)

```
space-0.5 = 2px  |  space-1 = 4px  |  space-2 = 8px  |  space-3 = 16px
space-4 = 24px   |  space-5 = 32px |  space-6 = 40px  |  space-7 = 48px
space-8 = 64px   |  space-9 = 80px |  space-10 = 96px
```

### Typography

```
text-xs = 10px   |  text-sm = 12px  |  text-base = 14px  |  text-md = 16px
text-lg = 18px   |  text-xl = 20px  |  text-2xl = 24px   |  text-3xl = 28px
text-4xl = 32px  |  text-5xl = 36px |  text-6xl = 42px   |  text-7xl = 48px
```

- Body: `font-sans` (Inter)
- Headings/brand: `font-heading` (Korolev) — use sparingly, marketing only
- Mono: `font-mono`

### Border Radius

```
rounded-xs = 2px | rounded-sm = 4px | rounded = 8px (default)
rounded-md = 12px | rounded-xl = 20px | rounded-2xl = 24px | rounded-full
```

Use `var(--radius)` (maps to `rounded-lg`) for shadcn component consistency.

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

**Available components**: button, card, badge, input, label, select, separator,
skeleton, avatar, progress, dialog, dropdown-menu, tabs, sheet, alert, tooltip,
table, command, popover.

---

## Accessibility Non-Negotiables

- Contrast ratio ≥ 4.5:1 for normal text, 3:1 for large/UI elements
- All interactive elements keyboard-focusable with visible focus ring
- No `outline: none` without replacement
- `aria-label` on icon-only buttons
- `alt` on all `<img>` / `<Image>` tags

---

## i18n & RTL (Arabic)

- Use logical CSS properties: `ps`/`pe` not `pl`/`pr`, `ms`/`me` not `ml`/`mr`
- Text direction handled by `next-intl` — never hardcode `dir`
- Currency: always format as TND

---

## App-Specific Patterns

### Status Badges

```tsx
// Order status colors
PENDING → bg-warning/10 text-warning border-warning
CONFIRMED → bg-primary/10 text-primary border-primary
COMPLETED → bg-success/10 text-success border-success
CANCELLED → bg-destructive/10 text-destructive border-destructive
EXPIRED → bg-muted text-muted-foreground border-border
```

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
