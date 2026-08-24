# DESIGN_AUDIT_REPORT.md

**Scope:** `apps/web`, `packages/ui`, `apps/mobile/src/design-system` **Date:**
2026-08-24 **Status:** Evidence gathered 2026-08-24. **Remediation pass 1
applied the same day** - see [Remediation status](#remediation-status). Findings
are left as originally written; the status table records what has since changed.
**Companion:** [`DESIGN.md`](./DESIGN.md) is the standard; this file is the gap
analysis against it.

---

## Remediation status

Pass 1 (2026-08-24) fixed the highest-confidence foundational items. V1 was
deliberately **not** touched.

| ID  | Status               | Note                                            |
| --- | -------------------- | ----------------------------------------------- |
| V1  | **OPEN**             | Deferred on purpose. Its own PR, per Part 3     |
| V2  | **FIXED**            | body -> `bg-background text-foreground`         |
| V3  | **FIXED**            | 7 `.dark` tokens repointed; `:root` untouched   |
| V4  | **FIXED**            | input/textarea/select -> `text-md md:text-base` |
| V5  | OPEN                 | Not in scope for pass 1                         |
| V6  | OPEN                 | Not in scope for pass 1                         |
| V7  | OPEN                 | Not in scope for pass 1                         |
| V8  | **FIXED** (18 sites) | Count corrected from 20 - see the V8 entry      |
| V9  | OPEN                 | Not in scope for pass 1                         |
| V10 | OPEN                 | Not in scope for pass 1                         |
| V11 | **FIXED**            | `ui-ux.md` fonts corrected                      |
| V12 | **FIXED**            | `ui-ux.md` component list corrected             |
| V13 | **FIXED**            | `ui-ux.md` `secondary` -> `#C4A25A` (2 places)  |
| V14 | FIXED (earlier)      | `DESIGN.md` rewritten                           |
| V15 | OPEN                 | Sequenced after V1                              |
| V16 | OPEN                 | Not in scope for pass 1                         |
| V17 | OPEN                 | Not in scope for pass 1                         |
| V18 | OPEN                 | Not in scope for pass 1                         |
| V19 | OPEN                 | Needs a brand decision                          |

**Verification after pass 1:** `type-check` clean; `lint` clean (pre-existing
warnings only, none on touched lines); **840/840 tests pass**; production build
succeeds; every new utility class confirmed present in the compiled CSS.

**One residual from V3:** light-mode `--accent-foreground` is still white on
coral (3.38, AA failure). Out of scope for a dark-mode fix; tracked in
`DESIGN.md` §19-E1.

---

## Executive summary

19 findings. Three are P0 and block a production release.

The headline finding (**V1**) is that `tailwind.config.ts` overwrites Tailwind's
numeric spacing keys `0`-`10`, while every primitive in
`apps/web/src/components/ui/` and `packages/ui/` was authored against Tailwind's
default scale. The result ships today: the default `<Button>` renders **96px
tall**, and `size="sm"` (80px) renders **taller than** `size="lg"` (44px).

A full census found **3,777 occurrences** on the 8 changed keys. My previous
estimate of "~700" was a spot-check of eight class names, not a census; it was
wrong and is superseded by the numbers here.

The migration is **not** a single mechanical remap. The census shows three
distinct intents mixed across those 3,777 sites, and they need opposite
treatment. See [Part 1.6](#16-migration-strategy).

| Rank   | Count | Meaning                    | Total effort |
| ------ | ----- | -------------------------- | ------------ |
| **P0** | 3     | Must fix before production | 4-7 days     |
| **P1** | 7     | Should fix                 | 6-9 days     |
| **P2** | 9     | Nice to have / hygiene     | 3-4 days     |

### On screenshots

**Not captured.** The Chrome extension is not connected in this environment
(`tabs_context_mcp` returned "Browser extension is not connected"). I did not
retry.

In place of screenshots I produced a **self-contained visual repro** whose CSS
rules are copied verbatim from the shipped bundle:

```text
<scratchpad>/repro.html
```

Open it in any browser. It renders identical markup twice, once under the
shipped rules and once under Tailwind defaults, side by side. For V1 the
computed CSS values quoted below are stronger evidence than a screenshot anyway,
because they are the values the browser actually applies.

---

## Part 1 - V1: the spacing collision, proven

## 1.1 The exact source

`apps/web/tailwind.config.ts`, lines **142-155**, inside `theme.extend`:

```ts
      spacing: {
        // 8pt grid system
        0: '0',
        0.5: '2px',
        1: '4px',
        2: '8px',
        3: '16px',
        4: '24px',
        5: '32px',
        6: '40px',
        7: '48px',
        8: '64px',
        9: '80px',
        10: '96px',
      },
```

Because these keys sit in `theme.extend.spacing` and **collide with keys
Tailwind already defines**, extend does not add to the scale here, it replaces
those twelve entries. Keys Tailwind defines that are _not_ listed (`1.5`, `2.5`,
`3.5`, `11`, `12`, `14`, `16`, `20`, `24`, `28`, `32`, ...) keep their default
values.

## 1.2 Default vs current, resolved by Tailwind itself

Produced with `tailwindcss/resolveConfig` (Tailwind **3.4.19**), not by reading
the file:

| Key   | Tailwind default | Current  | Status          |
| ----- | ---------------- | -------- | --------------- |
| `0`   | `0px`            | `0`      | same            |
| `0.5` | `0.125rem` (2px) | `2px`    | same            |
| `1`   | `0.25rem` (4px)  | `4px`    | same            |
| `1.5` | `0.375rem` (6px) | `6px`    | **(untouched)** |
| `2`   | `0.5rem` (8px)   | `8px`    | same            |
| `2.5` | `0.625rem`(10px) | `10px`   | **(untouched)** |
| `3`   | `0.75rem` (12px) | **16px** | **CHANGED**     |
| `3.5` | `0.875rem`(14px) | `14px`   | **(untouched)** |
| `4`   | `1rem` (16px)    | **24px** | **CHANGED**     |
| `5`   | `1.25rem` (20px) | **32px** | **CHANGED**     |
| `6`   | `1.5rem` (24px)  | **40px** | **CHANGED**     |
| `7`   | `1.75rem` (28px) | **48px** | **CHANGED**     |
| `8`   | `2rem` (32px)    | **64px** | **CHANGED**     |
| `9`   | `2.25rem` (36px) | **80px** | **CHANGED**     |
| `10`  | `2.5rem` (40px)  | **96px** | **CHANGED**     |
| `11`  | `2.75rem` (44px) | `44px`   | **(untouched)** |
| `12`  | `3rem` (48px)    | `48px`   | **(untouched)** |
| `16`  | `4rem` (64px)    | `64px`   | **(untouched)** |
| `20`  | `5rem` (80px)    | `80px`   | **(untouched)** |
| `24`  | `6rem` (96px)    | `96px`   | **(untouched)** |

**8 keys changed. 4 keys were re-declared at their existing value (no-ops).**

## 1.3 The scale is non-monotonic

Sorting every key numerically and listing the value it resolves to:

```text
0    0.5   1    1.5   2    2.5   3     3.5   4    5    6    7    8    9    10    11    12
0px  2px   4px  6px   8px  10px  16px  14px  24px 32px 40px 48px 64px 80px 96px  44px  48px
                                  ↓     ↑                                  ↓      ↑
                              INVERSION                               INVERSION
```

Two inversions:

- **`3` (16px) -> `3.5` (14px)** - the half-step is _smaller_ than the whole
  step.
- **`10` (96px) -> `11` (44px)** - a 52px cliff. Everything from `11` up is on
  the default scale, so the ramp restarts.

A spacing scale that does not increase monotonically cannot be reasoned about.
This is the mechanism behind every symptom below.

## 1.4 Proof it ships (compiled CSS)

Build freshness first, so this cannot be dismissed as a stale artifact:

```text
apps/web/tailwind.config.ts              2026-08-23 02:57:38
apps/web/.next/static/css/db895c3d949f822d.css  2026-08-23 22:04:17   <- newer
```

Rules from that bundle (expanded from the minified source by Prettier when this
file was formatted; selectors and values are unchanged):

```css
.h-10 {
  height: 96px;
}
.h-9 {
  height: 80px;
}
.h-11 {
  height: 2.75rem;
} /* 44px - untouched key */
.p-6 {
  padding: 40px;
}
.px-4 {
  padding-left: 24px;
  padding-right: 24px;
}
.size-4 {
  width: 24px;
  height: 24px;
}
.rounded-md {
  border-radius: 12px;
}
.text-sm {
  font-size: 12px;
  line-height: 1.4;
}
.text-base {
  font-size: 14px;
  line-height: 1.5;
}
```

## 1.5 Components affected

| Component        | File                                  | Class       | Intended | **Actual** |
| ---------------- | ------------------------------------- | ----------- | -------- | ---------- |
| `Button` default | `components/ui/button.tsx:23`         | `h-10 px-4` | 40px     | **96px**   |
| `Button` sm      | `components/ui/button.tsx:24`         | `h-9 px-3`  | 36px     | **80px**   |
| `Button` lg      | `components/ui/button.tsx:25`         | `h-11 px-8` | 44px     | 44px       |
| `Button` icon    | `components/ui/button.tsx:26`         | `h-10 w-10` | 40x40    | **96x96**  |
| `Button` svg     | `components/ui/button.tsx:8`          | `size-4`    | 16px     | **24px**   |
| `Input`          | `components/ui/input.tsx:10`          | `h-10`      | 40px     | **96px**   |
| `SelectTrigger`  | `components/ui/select.tsx:20`         | `h-10`      | 40px     | **96px**   |
| `TabsList`       | `components/ui/tabs.tsx:17`           | `h-10`      | 40px     | **96px**   |
| `CardHeader`     | `components/ui/card.tsx` (`p-6`)      | `p-6`       | 24px     | **40px**   |
| `CardContent`    | `components/ui/card.tsx` (`p-6 pt-0`) | `p-6`       | 24px     | **40px**   |
| `CardFooter`     | `components/ui/card.tsx` (`p-6 pt-0`) | `p-6`       | 24px     | **40px**   |
| `Textarea`       | `components/ui/textarea.tsx:10`       | `px-3 py-2` | 12/8px   | **16/8px** |

**Button `sm` (80px) is 36px taller than Button `lg` (44px).** That single fact
is the clearest statement of the bug.

### Corroborating evidence: developers have been compensating

If the primitives rendered as intended, nobody would need to override them.
Counts across `apps/web/src`:

| Pattern                          | Count | Reading                                                   |
| -------------------------------- | ----- | --------------------------------------------------------- |
| `size='sm'` on `<Button>`        | 138   | the size that renders at 80px                             |
| `h-7 text-xs` (manual override)  | 19    | forcing 48px because `sm` is 80px                         |
| `h-7 px-*`                       | 30    | same                                                      |
| `h-8 text-xs`                    | 23    | same                                                      |
| `h-7` total                      | 151   | overwhelmingly on `<Button size='sm'>`                    |
| arbitrary values `p-[..px]` etc. | 333   | escaping the scale entirely                               |
| fractional keys `1.5/2.5/3.5`    | 961   | reaching past the integer keys to reach the default scale |

Representative (`admin/analytics/page.tsx:404`):

```tsx
<Button size='sm' variant='outline' className='h-7 text-xs'>
```

`size='sm'` sets `h-9` (80px); the author then hand-patches `h-7` (48px). The
workaround is the symptom.

**961 usages of `1.5`/`2.5`/`3.5`** is the strongest indirect signal. Those keys
were never overridden, so they behave like normal Tailwind. In a healthy
codebase `3.5` is rare; here it is used 354 times, comparable to `size-4`.
Developers found the untouched keys and migrated toward them.

## 1.6 Migration strategy

**A blind remap would be wrong.** The 3,777 sites carry three different intents,
and preserving current pixels is correct for only one of them.

Category census (validated regex, `N.5` variants excluded):

| Key       | now -> after | `size-N` | square `h-N w-N` | layout (p/m/gap/space) | dims (h/w) | positioning |
| --------- | ------------ | -------- | ---------------- | ---------------------- | ---------- | ----------- |
| `3`       | 16 -> 12     | 71       | 39               | 833                    | 112        | 7           |
| `4`       | 24 -> 16     | 104      | 107              | 657                    | 273        | 29          |
| `5`       | 32 -> 20     | 32       | 36               | 253                    | 104        | 0           |
| `6`       | 40 -> 24     | 9        | 29               | 301                    | 91         | 9           |
| `7`       | 48 -> 28     | 8        | 41               | 42                     | 196        | 0           |
| `8`       | 64 -> 32     | 16       | 20               | 243                    | 119        | 3           |
| `9`       | 80 -> 36     | 7        | 2                | 17                     | 40         | 1           |
| `10`      | 96 -> 40     | 16       | 28               | 92                     | 78         | 14          |
| **TOTAL** |              | **263**  | **302**          | **2,438**              | **1,013**  | **63**      |

### Category A - layout spacing (2,438 sites): REMAP to preserve pixels

`p-*`, `m-*`, `gap-*`, `space-*`. These were tuned by eye against the current
render. Preserve the rendered value:

| Current | Renders | Replace with | Renders |
| ------- | ------- | ------------ | ------- |
| `3`     | 16px    | `4`          | 16px    |
| `4`     | 24px    | `6`          | 24px    |
| `5`     | 32px    | `8`          | 32px    |
| `6`     | 40px    | `10`         | 40px    |
| `7`     | 48px    | `12`         | 48px    |
| `8`     | 64px    | `16`         | 64px    |
| `9`     | 80px    | `20`         | 80px    |
| `10`    | 96px    | `24`         | 96px    |

> **The remap must be applied in a single simultaneous pass**, not sequentially.
> A naive sequential `3->4` then `4->6` double-migrates everything that started
> at `3`. Use one regex pass with a lookup table, or rename via a temporary
> sentinel.

Targets `12`, `16`, `20`, `24` are untouched keys already resolving to
48/64/80/96px, so existing usages of those keys are unaffected and the remap
converges on them safely.

### Category B - icon idiom (565 sites): do NOT remap

`size-4` and square `h-4 w-4` are the universal lucide/shadcn idiom for a
**16px** icon. These were copied from documentation and snippets that assume the
default scale. They currently render at 24px, which nobody chose.

Leaving them alone means they snap to their intended size once the override is
removed. That is a **visible change and a corrective one**. It needs design
sign-off, not silent preservation - preserving 24px would cement the bug
permanently.

### Category C - component dimensions (1,013 sites): review individually

`h-*` / `w-*` on boxes. Mixed intent, and the 196 `h-7` sites are largely the
button workaround documented in 1.5. Correct treatment is to **delete the
workaround** and let the fixed `Button` size apply, not to remap `h-7` to `h-12`
and freeze a 48px button.

### Category D - positioning (63 sites): remap to preserve

Same table as Category A.

### Sequencing

1. Land the config change plus the Category A + D remap in **one commit**, since
   both must be atomic to keep the layout stable.
2. Category B in a **second commit**, reviewed visually - it is the only
   deliberate visual change.
3. Category C in a **third commit**, per route group.

### Migration risk: **HIGH**

- Touches 277 files in app code.
- No visual-regression test exists in the repo, so nothing automated will catch
  a mistake. Type-check and unit tests will pass regardless: these are string
  class names.
- `packages/ui` is consumed by both web and mobile; changing it needs
  `pnpm build:deps`.
- Mitigations: do it in its own PR with nothing else in it; screenshot the top
  20 routes at 360/768/1280 before and after; consider adding Playwright
  snapshots first.

### Estimated effort: **4-6 days**

| Task                                       | Effort   |
| ------------------------------------------ | -------- |
| Codemod for Category A + D, with tests     | 0.5 day  |
| Config change + `components/ui` validation | 0.5 day  |
| Visual QA, 79 routes x 3 breakpoints       | 2 days   |
| Category B design review and sign-off      | 0.5 day  |
| Category C per-route cleanup               | 1-2 days |

---

## Part 2 - Violations register

Every finding lists: severity, evidence, file path, exact fix, migration risk,
effort. "Screenshot" is omitted throughout for the reason given in the summary.

---

## P0 - Must fix before production

### V1. Spacing scale collision

- **Severity:** P0
- **File:** `apps/web/tailwind.config.ts:142-155`
- **Evidence:** [Part 1](#part-1---v1-the-spacing-collision-proven) in full.
- **Exact fix:** Remove the numeric override; re-express the 8pt ramp as named
  keys so intent is explicit at the call site and the numeric scale returns to
  Tailwind's default:

  ```ts
  spacing: {
    xxs: '2px', xs: '4px', sm: '8px', md: '16px', lg: '24px',
    xl: '32px', '2xl': '40px', '3xl': '48px', '4xl': '64px',
    '5xl': '80px', '6xl': '96px',
  },
  ```

  This mirrors `apps/mobile/src/design-system/tokens/spacing.ts`, which already
  uses exactly these names. Then apply the Category A/D codemod.

- **Migration risk:** HIGH
- **Effort:** 4-6 days

### V2. Dark mode is wired but cannot work

- **Severity:** P0
- **File:** `apps/web/src/app/globals.css:62`
- **Evidence:** `darkMode: 'class'` is set (`tailwind.config.ts:5`),
  `ThemeProvider` writes `.dark` onto `<html>`
  (`components/providers/theme-provider.tsx:31`), and a complete `.dark`
  variable block exists (`globals.css:29-48`). But line 62 is:

  ```css
  body {
    @apply bg-white text-gray-900;
  }
  ```

  Unconditional. Toggling dark yields a white page carrying dark-mode component
  variables. Only **13** `dark:` usages exist across 5 files.

- **Exact fix:**

  ```css
  body {
    @apply bg-background text-foreground;
  }
  ```

- **Migration risk:** LOW - one line. Watch for pages that assumed a white body.
- **Effort:** 15 min + 1h verification

### V3. Light and dark share identical brand tokens

- **Severity:** P0 (WCAG AA failure)
- **File:** `apps/web/src/app/globals.css:12-17` vs `:35-40`
- **Evidence:** Byte-identical across `:root` and `.dark`:

  ```
  --primary   light: 186 41% 20%   dark: 186 41% 20%
  --secondary light: 41 47% 56%    dark: 41 47% 56%
  --accent    light: 4 90% 62%     dark: 4 90% 62%
  --ring      light: 186 41% 20%   dark: 186 41% 20%
  ```

  Computed (WCAG 2.x relative luminance) against the dark ground
  `--background: 180 100% 3%` = `#000F0F`:

  | Pairing                        | Ratio    | Required | Result   |
  | ------------------------------ | -------- | -------- | -------- |
  | `text-primary` on dark ground  | **1.84** | 4.5      | **FAIL** |
  | `primary-300` on dark ground   | 7.39     | 4.5      | pass     |
  | `--secondary` on dark ground   | 8.06     | 4.5      | pass     |
  | `primary-500` on white (light) | 10.63    | 4.5      | pass     |

  Every teal link, icon and focus ring is effectively invisible in dark mode.
  Mobile already handles this: `darkThemeColors.primary = primary[300]`.

- **Exact fix:** in the `.dark` block:

  ```css
  --primary: 186 40% 52%; /* primary-300 -> 7.39:1 */
  --primary-foreground: 186 41% 11%;
  --ring: 186 40% 52%;
  ```

  `--secondary` at 8.06 is fine; `--accent` needs the same treatment checked.

- **Migration risk:** LOW - additive, light mode untouched.
- **Effort:** 30 min + 2h verification

---

## P1 - Should fix

### V4. Inputs are 14px on mobile, triggering iOS zoom-on-focus

- **Severity:** P1
- **Files:** `components/ui/input.tsx:10`, `components/ui/textarea.tsx:10`,
  `components/ui/select.tsx:20`
- **Evidence:** All use `text-base md:text-sm`, authored to mean 16px mobile /
  14px desktop. Compiled: `.text-base{font-size:14px}`,
  `.text-sm{font-size:12px}`. So it renders **14px / 12px**. iOS Safari zooms
  the viewport when a focused input is under 16px and does not zoom back out.
  `SelectTrigger` is worse: bare `text-sm` = 12px everywhere.
- **Exact fix:** `text-md md:text-base` on all three (16px / 14px).
- **Migration risk:** LOW - three primitives, no layout change beyond line
  height.
- **Effort:** 30 min

### V5. 221 raw hex values + 92 arbitrary colour classes

- **Severity:** P1
- **Evidence:** 221 `#rrggbb` occurrences across 30 files; 92 arbitrary colour
  classes (`bg-[#f9f3f0]`, `text-[#5F6D6D]`).

  | File                                 | Count | Verdict                                   |
  | ------------------------------------ | ----- | ----------------------------------------- |
  | `(kit)/partner-kit/page.tsx`         | 80    | **Legitimate** - print/PDF swatch content |
  | `parcless-bag/ParclessBagClient.tsx` | 38    | Violation, see V6                         |
  | `(admin)/admin/users/page.tsx`       | 9     | Violation                                 |
  | `(admin)/admin/health/page.tsx`      | 8     | Violation                                 |
  | `components/layout/Footer.tsx`       | 6     | Violation, see V7                         |
  | `(admin)/admin/dashboard/page.tsx`   | 6     | Violation                                 |
  | `app/[locale]/opengraph-image.tsx`   | 4     | **Legitimate** - Satori, no Tailwind      |

  `components/sections/Section2.tsx:22,43` uses `bg-[#f9f3f0]` and
  `text-[#5F6D6D]` where `bg-brand-cream` already exists.

- **Exact fix:** map each to its token; add an ESLint rule banning
  `#[0-9a-fA-F]{6}` in `className`, with `partner-kit` and `opengraph-image`
  allowlisted.
- **Migration risk:** MEDIUM - some hex values have no exact token and need a
  design decision.
- **Effort:** 2-3 days

### V6. `parcless-bag` ships an undocumented parallel palette

- **Severity:** P1
- **File:**
  `app/[locale]/(marketing)/parcless-bag/_components/ParclessBagClient.tsx`
- **Evidence:** `#F2EBD9`, `#7FA896`, `#C05F4A`, `#3D6B5C`, `#3A4F48` appear in
  no token file in the repo. One marketing page has forked the brand.
- **Exact fix:** map to existing tokens, or promote to `brand.*` with contrast
  measurements and a product decision.
- **Migration risk:** MEDIUM - visual change to a live marketing page.
- **Effort:** 0.5 day

### V7. Off-brand and near-miss colours

- **Severity:** P1
- **Files:** `components/layout/Footer.tsx`, `components/layout/Header.tsx:121`
- **Evidence:** `Footer.tsx` uses `#FF1C74` (magenta-pink, present nowhere in
  the system) and `#FF7950`. `Header.tsx:121` uses `fill='#FF7979'`, a 6-unit
  near-miss of `brand-coral #FF7973`. Near-misses read as two brands.
- **Exact fix:** `#FF7979` -> `brand-coral`. `#FF1C74` and `#FF7950` need a
  decision: token or delete.
- **Migration risk:** LOW
- **Effort:** 1h

### V8. 18 interactive elements with no focus indicator (corrected from 20)

- **Severity:** P1 (WCAG 2.4.7 failure)
- **Evidence:** 26 `outline-none` without a ring. **Six are false positives** -
  `components/ui/select.tsx:112` and `dropdown-menu.tsx:22,76,92,115` use
  Radix's `focus:bg-accent`, a valid indicator, and `ParclessBagClient.tsx:585`
  uses `focus:border-secondary`. **20 have no focus treatment at all:**

  | File                                             | Lines                                            |
  | ------------------------------------------------ | ------------------------------------------------ |
  | `components/layout/Header.tsx`                   | 230, 292, 306, 313, 317, 439, 495, 514, 521, 529 |
  | `(merchant)/merchant/establishment/page.tsx`     | 1002, 1218, 1233                                 |
  | `components/sections/Section5.tsx`               | 82, 171                                          |
  | `app/[locale]/(marketing)/page.tsx`              | 201, 207                                         |
  | `components/sections/Newsletter.tsx`             | 90                                               |
  | `components/dashboard/user-nav.tsx`              | 32                                               |
  | `(merchant-onboarding)/merchant-signup/page.tsx` | 661                                              |

  **Ten of the eighteen are in `Header.tsx`** - the first interactive region on
  every page, so a keyboard user hits the dead zone immediately.

  **Correction, found during remediation:** two further false positives surfaced
  once each site was opened rather than pattern-matched. `Newsletter.tsx:90`
  carries `focus:outline-primary-500` on the input **and**
  `focus-within:outline-2` on its wrapper, covering the `sm+` breakpoint where
  the input's own outline is disabled. `establishment/page.tsx:1002` sits inside
  a wrapper (line 978) that already has `focus-within:ring-2`. Both were
  correctly built. **The real count is 18.** The grep that produced the original
  number excluded only `focus:ring`/`focus-visible:ring`, so it missed
  `focus:outline-*` and wrapper-level `focus-within`.

- **Exact fix:** append
  `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to
  each. On the teal header the ring needs an offset colour that clears 3:1.
- **Migration risk:** LOW - additive.
- **Effort:** 2-3h

### V9. RTL: physical directional utilities outnumber logical

- **Severity:** P1
- **Evidence:** Arabic is a supported production locale.

  | Physical          | Count   | Logical          | Count   |
  | ----------------- | ------- | ---------------- | ------- |
  | `ml-`             | 12      | `ms-`            | 26      |
  | `mr-`             | 13      | `me-`            | 92      |
  | `pl-`             | 36      | `ps-`            | 17      |
  | `pr-`             | 22      | `pe-`            | 12      |
  | `left-`           | 67      | `start-`         | 16      |
  | `right-`          | 56      | `end-`           | 13      |
  | **Sum**           | **206** |                  | **176** |
  | `text-left/right` | **26**  | `text-start/end` | 65      |

  `left-`/`right-` (123) is the highest risk: absolutely-positioned elements do
  not mirror, so overlays and badges land on the wrong side in Arabic.

- **Exact fix:** mechanical substitution to logical properties; add the
  `tailwindcss/no-arbitrary-value`-style lint or a custom rule banning physical
  directionals.
- **Migration risk:** MEDIUM - each site needs an RTL visual check; a few may be
  intentionally physical (e.g. a LTR-locked code block).
- **Effort:** 2 days

### V10. Icon-button accessible names incomplete

- **Severity:** P1
- **Evidence:** 165 `<button>` elements, **91** `aria-label` attributes, and
  some of those 91 are on non-buttons. 55 `<Image>`/`<img>` against 56 `alt=`.
  This establishes that a gap exists; it does not measure it, because a button
  with visible text needs no label.
- **Exact fix:** per-file pass; add `jsx-a11y/control-has-associated-label` to
  ESLint to prevent regression.
- **Migration risk:** LOW
- **Effort:** 1-2 days (audit dominates)

---

## P2 - Nice to have

### V11. `.claude/rules/ui-ux.md` documents the wrong fonts

- **Severity:** P2 (P1 for anyone building from it)
- **File:** `.claude/rules/ui-ux.md`
- **Evidence:** States body is Inter and `font-heading` resolves to Playfair
  Display, with a paragraph explaining Playfair is the only display face. The
  code loads **Quicksand** (sans) and **Comfortaa** (heading) via
  `next/font/google` (`app/[locale]/layout.tsx:2`); `font-playfair` and
  `font-display` are now aliases of `font-heading`
  (`tailwind.config.ts:118-119`).
- **Exact fix:** update the rule file to match; note the aliases as deprecated.
- **Risk:** NONE. **Effort:** 30 min

### V12. `ui-ux.md` lists components that do not exist

- **Severity:** P2
- **Evidence:** Verified by file existence:

  | Component  | `apps/web/src/components/ui` | `packages/ui/src/components` |
  | ---------- | ---------------------------- | ---------------------------- |
  | `progress` | no                           | no                           |
  | `table`    | no                           | no                           |
  | `command`  | no                           | no                           |
  | `popover`  | no                           | no                           |
  | `avatar`   | no                           | **yes**                      |
  | `sheet`    | no                           | **yes**                      |
  | `tooltip`  | no                           | **yes**                      |
  | `textarea` | **yes**                      | no                           |

  Four claimed components exist nowhere. Three exist only in `packages/ui`, so a
  web import following the documented path fails. `textarea` exists and is
  undocumented.

- **Exact fix:** correct the list; state which package each lives in.
- **Risk:** NONE. **Effort:** 15 min

### V13. `secondary` means two different colours

- **Severity:** P2
- **Evidence:** `ui-ux.md` lists `secondary` as `#FFA000`. `globals.css:14`
  defines `--secondary: 41 47% 56%` (a gold, roughly `#C9A227`).
- **Exact fix:** pick one, update the other.
- **Risk:** LOW. **Effort:** 15 min

### V14. Previous `DESIGN.md` documented the spacing scale as working

- **Severity:** P2
- **Evidence:** Listed the 8pt grid with no mention of the collision, so every
  reader inherited V1. Preserved at `DESIGN.md.bak`.
- **Exact fix:** done - rewritten 2026-08-24 with Section 5.3.
- **Risk:** NONE. **Effort:** complete

### V15. Radius scales are transposed between web and mobile

- **Severity:** P2
- **Files:** `apps/web/tailwind.config.ts:157-166`,
  `apps/mobile/src/design-system/tokens/spacing.ts`

  | Key   | Web                       | Mobile   |
  | ----- | ------------------------- | -------- |
  | `sm`  | 4px                       | 4px      |
  | `md`  | **12px**                  | **8px**  |
  | `lg`  | **8px** (`var(--radius)`) | **12px** |
  | `xl`  | 20px                      | 16px     |
  | `2xl` | 24px                      | 20px     |

  `md` and `lg` are swapped. A component ported either direction silently
  changes shape.

- **Exact fix:** align on one scale, most likely mobile's (it is the
  conventional ramp). Web's `lg` is pinned to `var(--radius)` for shadcn, so
  reconcile that too.
- **Risk:** MEDIUM - changes rounding on every card and button.
- **Effort:** 0.5 day

### V16. `ThemeProvider` persists to `localStorage`

- **Severity:** P2
- **File:** `components/providers/theme-provider.tsx:15,37,53`
- **Evidence:** `STORAGE_KEY = 'foodwaste-theme'` read in a mount effect. Not
  readable during SSR, so dark-mode users get a light flash on every load. The
  project preference is cookies for UI state.
- **Exact fix:** move to a cookie, read it in the server layout, and stamp the
  class on `<html>` before hydration.
- **Risk:** LOW. **Effort:** 2-3h

### V17. `.glass` uses `backdrop-filter` as a general dashboard utility

- **Severity:** P2
- **File:** `apps/web/src/app/globals.css` (`.glass`)
- **Evidence:** `backdrop-filter: blur(20px) saturate(140%)`, introduced as part
  of the "new merchant dashboard design system". On a scrolling surface this
  forces a repaint of everything behind it each frame.
- **Exact fix:** restrict to the fixed header and modal overlays.
- **Risk:** LOW. **Effort:** 1h

### V18. Mobile exports a 26-colour unconstrained palette

- **Severity:** P2
- **File:** `apps/mobile/src/design-system/tokens/colors.ts`
- **Evidence:** `harmonious` exports 12 colours (rose, violet, amber, emerald,
  azure, magenta, sunset, sage, lavender, peach, mint), plus 8 `categories` and
  6 `dietary`. No documented usage limits, against a "at most two emphasis
  colours" rule.
- **Exact fix:** constrain to data-visualisation and category chips, or prune.
- **Risk:** LOW. **Effort:** 0.5 day

---

### V19. The `accent` colour ramp diverges between web and mobile

- **Severity:** P2
- **Files:** `apps/web/tailwind.config.ts` (accent block) vs
  `apps/mobile/src/design-system/tokens/colors.ts` (accent block)
- **Evidence:** 7 of 10 steps differ. Only `50`, `500` and `900` agree.

  | Step  | Web       | Mobile    | Same?                                |
  | ----- | --------- | --------- | ------------------------------------ |
  | `50`  | `#FFF5F4` | `#FFF5F4` | yes                                  |
  | `100` | `#FFE7E5` | `#FFE0DD` | no                                   |
  | `200` | `#FFCFCB` | `#FFC4BF` | no                                   |
  | `300` | `#FFB7B1` | `#F04535` | **no - not even the same lightness** |
  | `400` | `#FF9F97` | `#FF5A52` | no                                   |
  | `500` | `#F55449` | `#F55449` | yes                                  |
  | `600` | `#C4433A` | `#E03D31` | no                                   |
  | `700` | `#93322C` | `#C02D22` | no                                   |
  | `800` | `#62221D` | `#9B2219` | no                                   |
  | `900` | `#751A13` | `#751A13` | yes                                  |

  Web's ramp is a conventional tint/shade progression around `500`. Mobile's
  `300` is a **distinct brand coral** (`#F04535`), not a tint, so the two files
  disagree about what `accent-300` even means.

  **No compliance failure:** both `accent-700` values clear AA on the coral tint
  (web 6.83, mobile 5.13), and both `accent-400` values clear AA on the dark
  ground (web 9.91, mobile 6.36).

- **Impact:** a component ported between platforms silently changes colour at
  every non-500 step. Any documentation quoting a non-500 accent value is
  ambiguous unless it names the platform.
- **Exact fix:** requires a brand decision - is `accent-300` a tint of coral or
  a second coral? Once decided, align both files and add a token-parity test.
- **Migration risk:** MEDIUM - changes onboarding and highlight surfaces on one
  platform.
- **Effort:** 0.5 day after the decision.

> **Provenance.** Found _after_ this report was first written, while verifying
> `DESIGN.md` §2.1 against source. §2.1 originally asserted the ramps were
> "defined identically"; that claim was false for `accent` and has been
> corrected. Recorded in `DESIGN.md` §19-E18.

---

## Part 3 - Ranking and sequencing

| ID  | Title                         | Rank | Risk   | Effort |
| --- | ----------------------------- | ---- | ------ | ------ |
| V1  | Spacing scale collision       | P0   | HIGH   | 4-6 d  |
| V2  | Dark mode body override       | P0   | LOW    | 15 min |
| V3  | Identical light/dark tokens   | P0   | LOW    | 30 min |
| V4  | iOS input zoom                | P1   | LOW    | 30 min |
| V5  | Raw hex / arbitrary colours   | P1   | MEDIUM | 2-3 d  |
| V6  | parcless-bag parallel palette | P1   | MEDIUM | 0.5 d  |
| V7  | Off-brand / near-miss colours | P1   | LOW    | 1 h    |
| V8  | 20 missing focus indicators   | P1   | LOW    | 2-3 h  |
| V9  | RTL physical directionals     | P1   | MEDIUM | 2 d    |
| V10 | Icon-button labels            | P1   | LOW    | 1-2 d  |
| V11 | Rule file: wrong fonts        | P2   | NONE   | 30 min |
| V12 | Rule file: phantom components | P2   | NONE   | 15 min |
| V13 | `secondary` ambiguity         | P2   | LOW    | 15 min |
| V14 | Stale DESIGN.md               | P2   | NONE   | done   |
| V15 | Radius transposition          | P2   | MEDIUM | 0.5 d  |
| V16 | localStorage theme            | P2   | LOW    | 2-3 h  |
| V17 | `.glass` overuse              | P2   | LOW    | 1 h    |
| V18 | Unconstrained mobile palette  | P2   | LOW    | 0.5 d  |

## Recommended PR sequence

| PR  | Contents           | Why this order                                             |
| --- | ------------------ | ---------------------------------------------------------- |
| 1   | V2 + V3            | Two small CSS edits; dark mode goes from broken to working |
| 2   | V4                 | Three primitives; removes iOS zoom across every form       |
| 3   | V8                 | Additive, no visual change, closes a WCAG failure          |
| 4   | V11 + V12 + V13    | Fix the docs before more work is built on them             |
| 5   | **V1 (a)**         | Config + Category A/D codemod. **Nothing else in this PR** |
| 6   | **V1 (b)**         | Category B icon snap-back. Deliberate visual change        |
| 7   | **V1 (c)**         | Category C per route group                                 |
| 8   | V7, V6, V5         | Token migration, once spacing has settled                  |
| 9   | V9, V10            | RTL and a11y passes, per route group                       |
| 10  | V15, V16, V17, V18 | Consistency and hygiene                                    |

**PRs 5-7 must contain nothing but the migration.** At 3,777 call sites any
unrelated edit is invisible in review.

**Before PR 5, add visual-regression coverage.** There is none today, and it is
the only thing that would catch a bad remap - type-check and unit tests pass
either way, because these are string class names.

---

## Part 4 - Method and limits

## Reproduction

```bash
# Resolved spacing scale, default vs current
node -e "const rc=require('tailwindcss/resolveConfig');console.log(rc({content:[]}).theme.spacing)"

# What actually shipped
grep -ho '\.h-10{[^}]*}' apps/web/.next/static/css/*.css

# Usage census (validated regex, excludes N.5 variants)
node <scratchpad>/count.cjs
node <scratchpad>/categorize.cjs

# Visual repro
start <scratchpad>/repro.html
```

## Counting method

Counts come from a Node script using `(?<![\w-])-?(prefix)-(key)(?![\w.])` over
all non-test `.tsx`/`.ts` under `apps/web/src` (277 app files, 13
`components/ui`) and `packages/ui/src` (15).

**A naive `grep -o "\bsize-3\b"` over-counts by 107**, because `.` is a non-word
character, so the pattern matches the `size-3` prefix inside `size-3.5`. Every
number in this report uses the lookahead-guarded regex, which excludes
fractional variants. Figures in the earlier revision of `DESIGN.md` that were
derived from the naive grep are superseded here.

## Corrections to my own earlier figures

| Claim                     | Earlier | Corrected | Cause                                          |
| ------------------------- | ------- | --------- | ---------------------------------------------- |
| V1 blast radius           | ~700    | **3,777** | Earlier was a spot-check of 8 class names      |
| V8 missing focus rings    | 26      | **20**    | 6 were Radix `focus:bg` / `focus:border`       |
| `text-primary` dark ratio | 1.86    | **1.84**  | Manual arithmetic; recomputed                  |
| `primary-300` dark ratio  | 7.1     | **7.39**  | Same                                           |
| `aria-label` count        | 114     | **91**    | Earlier pattern also matched `aria-labelledby` |
| `text-left/right`         | 0       | **26**    | Earlier pattern required a trailing suffix     |
| Logical-property total    | 178     | **176**   | Regex boundary fix                             |

Every documented palette figure reproduced exactly: `#017C6E` on white 5.11, on
cream 4.65, on `#1E4448` 2.08, beside `#FFA000` 2.50, `#757575` on white 4.61.

## What this audit did NOT do

- **No screenshots.** Browser extension not connected. `repro.html` is provided
  instead.
- **No route-by-route visual pass.** 79 routes were not opened in a browser at
  360/768/1280, in three locales, in two themes. Findings are static analysis
  plus compiled-CSS measurement.
- **V10 is not sized.** It establishes a gap exists (165 buttons, 91
  `aria-label`), not how many buttons are actually unlabelled. A button with
  visible text needs no label.
- **No runtime contrast audit.** Ratios were computed for specific token pairs,
  not sampled from rendered pages, so a low-contrast pairing created by an
  arbitrary colour class would not appear here.
- **Mobile was read but not measured.** `apps/mobile` tokens were read for
  cross-platform comparison (V15, V18); no React Native screens were audited.

## Note on the `.next` build

The compiled CSS was built 2026-08-23 22:04, after the last change to
`tailwind.config.ts` at 02:57 the same day, so it reflects current config. It
was **not** rebuilt as part of this audit, because rebuilding would modify
artifacts and the brief was proof without modification. To reconfirm
independently: `pnpm --filter @foodwaste/web build`, then re-run the `grep` in
Part 1.4.
