# DESIGN.md — Too Fresh To Waste

> Food waste reduction marketplace (Tunisia). A warm, trust-forward brand that
> pairs deep teal professionalism with coral urgency. Surfaces are clean white;
> imagery and food photography do the emotional work.

---

## Visual Identity

**Atmosphere:** Clean, trustworthy, warm. The brand sits between a civic-good
platform and a local marketplace. Teal conveys environmental responsibility;
coral injects urgency ("save it before it's gone"). White canvas keeps the UI
breathable so food photography pops.

**Design Pillars:**

1. **Trust-first** — teal primary anchors every persistent UI element (headers,
   tabs, links). Users are transacting with strangers; the palette must feel
   institutional, not playful.
2. **Urgency without anxiety** — coral accent marks time-sensitive CTAs and
   expiry badges. It draws the eye but never dominates; one coral element per
   viewport max.
3. **Food-forward** — let product photography carry the page. Typography and
   chrome recede; cards use generous image ratios.
4. **Accessibility** — WCAG AA minimum (4.5:1 body text, 3:1 large/UI). Touch
   targets >= 44px (iOS HIG) / 48px (Material).

---

## Color Palette

### Brand

| Token           | Hex       | HSL          | Role                                      |
| --------------- | --------- | ------------ | ----------------------------------------- |
| `primary-500`   | `#1E4448` | 186° 41% 20% | Brand primary — CTAs, links, active icons |
| `primary-700`   | `#112528` | 186° 41% 11% | Pressed/depth states                      |
| `primary-100`   | `#C2DDE0` | 186° 33% 82% | Hover tints, container backgrounds        |
| `primary-50`    | `#EBF3F4` | 186° 30% 94% | Subtle teal wash                          |
| `accent-500`    | `#F55449` | 4° 90% 62%   | Coral — urgent CTAs, expiry badges        |
| `accent-300`    | `#F04535` | 4° 86% 57%   | Coral highlight, onboarding accents       |
| `accent-600`    | `#E03D31` | 3° 75% 54%   | Coral pressed state                       |
| `secondary-500` | `#FFC107` | 45° 100% 52% | Warm yellow — warnings, secondary accent  |
| `secondary-700` | `#FFA000` | 38° 100% 50% | Warning pressed                           |

### Semantic

| Token     | Hex       | Usage                          |
| --------- | --------- | ------------------------------ |
| `success` | `#2E7D32` | Confirmed, completed, paid     |
| `error`   | `#D32F2F` | Errors, destructive actions    |
| `warning` | `#F57C00` | Pending, expiring soon         |
| `info`    | `#2196F3` | Informational, confirmed order |

### Surfaces (Light)

| Token               | Hex       | Usage                    |
| ------------------- | --------- | ------------------------ |
| `background`        | `#FFFFFF` | Page canvas              |
| `surface`           | `#FAFAFA` | Subtle card/section fill |
| `surface-variant`   | `#F5F5F5` | Containers, dividers     |
| `surface-container` | `#EEEEEE` | Inset panels             |

### Surfaces (Dark)

| Token               | Hex       |
| ------------------- | --------- |
| `background`        | `#121212` |
| `surface`           | `#1E1E1E` |
| `surface-variant`   | `#2C2C2C` |
| `surface-container` | `#383838` |

### Text

| Token                | Light     | Dark      |
| -------------------- | --------- | --------- |
| `on-background`      | `#212121` | `#F5F5F5` |
| `on-surface`         | `#424242` | `#EEEEEE` |
| `on-surface-variant` | `#757575` | `#BDBDBD` |
| `disabled`           | `#BDBDBD` | `#616161` |

### Borders

| Token             | Light     | Dark      |
| ----------------- | --------- | --------- |
| `outline`         | `#E0E0E0` | `#757575` |
| `outline-variant` | `#EEEEEE` | `#616161` |

### Food-Specific

| Context  | Hex       | Usage                 |
| -------- | --------- | --------------------- |
| Fresh    | `#1E4448` | Available, good time  |
| Moderate | `#FF9800` | Pickup window closing |
| Urgent   | `#F44336` | Expiring very soon    |
| Expired  | `#9E9E9E` | No longer available   |

### Order Status

| Status    | Color     |
| --------- | --------- |
| Pending   | `#FF9800` |
| Confirmed | `#2196F3` |
| Preparing | `#9C27B0` |
| Ready     | `#1E4448` |
| Completed | `#1E4448` |
| Cancelled | `#F44336` |
| Expired   | `#9E9E9E` |

### Status Badge Pattern

```
PENDING    → bg-warning/10  text-warning  border-warning
CONFIRMED  → bg-primary/10  text-primary  border-primary
COMPLETED  → bg-success/10  text-success  border-success
CANCELLED  → bg-destructive/10  text-destructive  border-destructive
EXPIRED    → bg-muted  text-muted-foreground  border-border
```

---

## Typography

### Font Stack

| Context         | Mobile (iOS / Android)  | Web                     |
| --------------- | ----------------------- | ----------------------- |
| Primary/Display | SF Pro Display / Roboto | Inter (system fallback) |
| Body            | SF Pro Text / Roboto    | Inter                   |
| Brand/Marketing | BebasNeue-Regular       | Korolev (sparingly)     |
| Monospace       | SF Mono / Roboto Mono   | ui-monospace            |

### Type Scale (shared mobile + web)

| Token  | Size | Weight  | Usage                          |
| ------ | ---- | ------- | ------------------------------ |
| `7xl`  | 48px | 700     | Hero display text              |
| `6xl`  | 42px | 700     | Display medium                 |
| `5xl`  | 36px | 600     | Display small                  |
| `4xl`  | 32px | 600     | Page titles                    |
| `3xl`  | 28px | 600     | Section headers                |
| `2xl`  | 24px | 500     | Sub-headers                    |
| `xl`   | 20px | 500     | Card titles                    |
| `lg`   | 18px | 500     | Large body, discounted price   |
| `md`   | 16px | 400–500 | Default body, title-small      |
| `base` | 14px | 400–500 | Secondary body, labels         |
| `sm`   | 12px | 400–500 | Captions, original price       |
| `xs`   | 10px | 500–600 | Badges (uppercase), tiny label |

### Line Height

Mobile uses absolute pixel values (React Native requirement). Web uses
multipliers.

| Name    | Multiplier | Usage               |
| ------- | ---------- | ------------------- |
| tight   | 1.25       | Display/headline    |
| snug    | 1.4        | Title text          |
| normal  | 1.5        | Body text (default) |
| relaxed | 1.6        | Long-form reading   |
| loose   | 1.8        | Spacious lists      |

### Letter Spacing

| Token   | Value   | Usage                   |
| ------- | ------- | ----------------------- |
| tighter | -0.5px  | Large display headlines |
| tight   | -0.25px | Medium headlines        |
| normal  | 0       | Body text (default)     |
| wide    | 0.25px  | Labels, title-small     |
| wider   | 0.5px   | Badges, uppercase text  |

---

## Spacing & Layout

### 8pt Grid

| Token | Size |
| ----- | ---- |
| `xxs` | 2px  |
| `xs`  | 4px  |
| `sm`  | 8px  |
| `md`  | 16px |
| `lg`  | 24px |
| `xl`  | 32px |
| `2xl` | 40px |
| `3xl` | 48px |
| `4xl` | 64px |
| `5xl` | 80px |
| `6xl` | 96px |

### Semantic Spacing

| Context          | Horizontal | Vertical | Gap  |
| ---------------- | ---------- | -------- | ---- |
| Screen padding   | 16px       | 24px     | —    |
| Section gap      | —          | —        | 32px |
| Card padding     | 16px       | 16px     | 8px  |
| Card margin      | 8px        | 8px      | —    |
| List item gap    | —          | —        | 8px  |
| Form field gap   | —          | —        | 16px |
| Form section gap | —          | —        | 24px |

### Border Radius

| Token  | Size   | Usage                          |
| ------ | ------ | ------------------------------ |
| `xs`   | 2px    | Tiny badges                    |
| `sm`   | 4px    | Inline tags                    |
| `md`   | 8px    | Default cards, inputs          |
| `lg`   | 12px   | Prominent cards                |
| `xl`   | 16px   | Modals, bottom sheets          |
| `2xl`  | 20px   | Feature cards                  |
| `3xl`  | 24px   | Hero panels                    |
| `full` | 9999px | Pills, avatars, circular icons |

### Touch Targets

| Size        | Px   | Usage                    |
| ----------- | ---- | ------------------------ |
| Minimum     | 44px | iOS HIG / smallest tap   |
| Comfortable | 48px | Material / standard CTA  |
| Large       | 56px | Primary floating actions |

---

## Component Sizing

### Buttons

| Size | Height | Usage                   |
| ---- | ------ | ----------------------- |
| sm   | 32px   | Inline, compact actions |
| md   | 40px   | Standard                |
| lg   | 48px   | Primary CTAs            |
| xl   | 56px   | Full-width hero CTAs    |

### Inputs

| Size | Height |
| ---- | ------ |
| sm   | 36px   |
| md   | 44px   |
| lg   | 52px   |

### Icons

| Token | Size |
| ----- | ---- |
| xs    | 12px |
| sm    | 16px |
| md    | 20px |
| lg    | 24px |
| xl    | 32px |
| 2xl   | 40px |
| 3xl   | 48px |

### Avatars

| Token | Size |
| ----- | ---- |
| xs    | 24px |
| sm    | 32px |
| md    | 40px |
| lg    | 48px |
| xl    | 64px |
| 2xl   | 80px |
| 3xl   | 96px |

---

## Elevation & Shadows

### Mobile (iOS)

| Level | Offset Y | Opacity | Radius | Usage              |
| ----- | -------- | ------- | ------ | ------------------ |
| xs    | 1px      | 0.05    | 2px    | Subtle lift        |
| sm    | 2px      | 0.10    | 3px    | Cards (resting)    |
| md    | 4px      | 0.15    | 6px    | Cards (elevated)   |
| lg    | 8px      | 0.20    | 12px   | FAB, bottom sheets |
| xl    | 12px     | 0.25    | 16px   | Modals             |
| 2xl   | 16px     | 0.30    | 24px   | Full overlays      |

### Mobile (Android)

Uses `elevation` property directly: xs=1, sm=2, md=4, lg=8, xl=12, 2xl=16.

**Gotcha:** `elevation` on a view with `borderRadius` + `overflow: 'hidden'`
renders a rectangular shadow outline. Never combine — use a parent wrapper for
shadow or skip elevation on circular views.

### Component Shadow Presets

| Component | Resting | Elevated | Pressed |
| --------- | ------- | -------- | ------- |
| Card      | sm      | md       | xs      |
| Button    | sm      | —        | none    |
| Modal     | —       | xl       | —       |
| Header    | sm      | —        | —       |
| Tab bar   | md      | —        | —       |
| FAB       | lg      | —        | —       |
| Toast     | md      | —        | —       |
| Input     | xs      | sm       | —       |

---

## Motion & Animation

### Duration

| Token   | Ms    | Usage                           |
| ------- | ----- | ------------------------------- |
| instant | 0     | Immediate state changes         |
| fast    | 150ms | Hover, press feedback           |
| normal  | 250ms | Standard transitions            |
| slow    | 350ms | Page transitions, card reveals  |
| slower  | 500ms | Loading states, complex reveals |
| slowest | 750ms | Hero animations, onboarding     |

### Easing

| Name       | Curve                                     | Usage              |
| ---------- | ----------------------------------------- | ------------------ |
| standard   | `cubic-bezier(0.4, 0, 0.2, 1)`            | Default enter/exit |
| decelerate | `cubic-bezier(0, 0, 0.2, 1)`              | Elements entering  |
| accelerate | `cubic-bezier(0.4, 0, 1, 1)`              | Elements leaving   |
| bounce     | `cubic-bezier(0.68, -0.55, 0.265, 1.55)`  | Playful feedback   |
| elastic    | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Add-to-cart        |

### Spring Configs (React Native Reanimated)

| Name     | Damping | Stiffness | Mass | Usage               |
| -------- | ------- | --------- | ---- | ------------------- |
| gentle   | 15      | 120       | 1    | Subtle movements    |
| standard | 20      | 150       | 1    | Default transitions |
| bouncy   | 10      | 120       | 1    | Playful feedback    |
| quick    | 25      | 200       | 0.8  | Snappy responses    |

### Key Animations

- **Button press:** scale(0.95), 150ms standard
- **Card reveal:** scale(0.9→1) + translateY(20→0) + fade, 350ms decelerate
- **Add to cart:** scale(1→1.2) + rotate(0→10°), 250ms elastic
- **Error shake:** translateX ±10px, 150ms × 3 cycles
- **Loading pulse:** opacity 0.5↔1, 500ms infinite

---

## Web-Specific (CSS Variables)

The web app (Next.js + Tailwind + shadcn/ui) uses HSL CSS variables:

```css
:root {
  --primary: 186 41% 20%; /* #1E4448 */
  --accent: 4 90% 62%; /* #F55449 */
  --secondary: 41 47% 56%; /* warm gold */
  --background: 0 0% 100%;
  --foreground: 180 100% 3%;
  --muted: 174 8% 93%;
  --muted-foreground: 174 8% 40%;
  --destructive: 0 84% 60%;
  --border: 174 8% 90%;
  --radius: 0.5rem;
}
```

Use `hsl(var(--primary))` in Tailwind classes. Never raw hex in web components.

### shadcn/ui Components Available

button, card, badge, input, label, select, separator, skeleton, avatar,
progress, dialog, dropdown-menu, tabs, sheet, alert, tooltip, table, command,
popover. Import from `@/components/ui/<name>`.

---

## Layout Patterns

### Mobile Navigation

```
RootNavigator
├── AuthStack  (Welcome, Onboarding, Login, Register, ...)
└── MainStack  (modals + BottomTabNavigator)
    └── BottomTabs (Home, Search, Favorites, Orders, Profile)
```

### Web Dashboard (Admin / Merchant)

```
fixed inset-0 flex flex-col     ← NOT h-screen (double-scroll bug)
├── Header (shrink-0)
└── flex flex-1 min-h-0 overflow-hidden
    ├── Sidebar
    └── main (flex-1 overflow-y-auto overscroll-contain min-h-0)
```

### Card Layouts

- **Offer card:** image (1:1 or 3:2 ratio) top, metadata below. Generous image
  area — food photography is the hero.
- **Order card:** status badge top-right, establishment + items left, price
  right.
- **Empty states:** centered icon (48px muted) + heading + subtext + optional
  CTA.

### Loading States

- **List items:** Skeleton cards matching exact card dimensions (`Animated` +
  `LinearGradient` shimmer on mobile)
- **Full page:** centered spinner + skeleton grid
- **Buttons:** `disabled` + inline spinner icon

---

## Guardrails — Do & Don't

### Do

- Use design tokens for every color, spacing, radius, and shadow value
- Let food photography carry the visual weight — keep chrome minimal
- One coral accent element per viewport (CTA or badge, not both)
- Use warm neutrals for secondary backgrounds (`#FAFAFA`, `#F5F5F5`)
- Status badges use the `bg-{status}/10 text-{status} border-{status}` pattern
- Logical CSS properties for RTL: `ps`/`pe`, `ms`/`me` (never `pl`/`pr`)
- Format currency as TND always

### Don't

- Never use raw hex values in components — tokens or CSS variables only
- Never use more than one coral CTA per card
- Never put elevation on circular views with `overflow: 'hidden'` (Android bug)
- Never use `h-screen` on dashboard wrappers (double-scroll)
- Never add gradients to the brand palette — color-block only
- Never weight display text above 700 — the scale peaks at bold
- Never skip the 8pt grid — all spacing must be a multiple of 4px or 8px
- Never use BebasNeue/Korolev for body text — display/brand headings only
- Never hardcode `dir` for RTL — let next-intl / i18n handle it

---

## i18n & RTL

- Locales: `en` (default), `fr`, `ar` (RTL)
- Currency: always TND
- Use logical CSS properties (`ps`/`pe`/`ms`/`me`)
- Text direction handled by framework (next-intl web, react-i18next mobile)

---

## Accessibility Checklist

- Contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text and UI
- All interactive elements keyboard-focusable with visible focus ring
- `aria-label` on icon-only buttons
- `alt` on all images
- Touch targets >= 44px (iOS) / 48px (Android)
- No `outline: none` without a replacement focus indicator
- Reduced-motion: respect `prefers-reduced-motion` — fall back to opacity-only
  transitions (150ms)

---

_Based on existing design tokens in `apps/mobile/src/design-system/tokens/` and
`apps/web/src/app/globals.css`. Format inspired by
[awesome-design-md](https://github.com/VoltAgent/awesome-design-md)._
