# Design System Certification

## Status: CERTIFIED WITH DOCUMENTED EXCEPTIONS

**Certification date:** 2026-09-01 **Certified commit:** `2113285`
(`chore/v1-spacing-migration`) **Full SHA:**
`211328560dc2c4a2736f1c027a75d538903528f9` **Standard:** WCAG 2.1 AA

---

## 1. Certification Scope

### Certified

- **Web design system** - certified within verified scope. All shipped CSS
  tokens, component primitives and public marketing routes pass WCAG 2.1 AA for
  text contrast (1.4.3) and non-text contrast (1.4.11) in both light and dark
  themes, across three locales (en, fr, ar/RTL) and three viewport widths
  (mobile 375, tablet 768, desktop 1280).

- **Mobile light-mode design system** - certified within verified scope. All
  colour tokens, spacing tokens, typography tokens and component styles pass
  WCAG 2.1 AA for text contrast in light mode. Device-verified on BlueStacks
  emulator across en/fr/ar at font scales 1.0/1.3/1.5/2.0x.

### Not certified

- **Mobile dark mode** - infrastructure preserved but disabled. Never verified
  on a real device. Not production-certified.
- **Authenticated web routes** - no visual baselines exist for any authenticated
  route (merchant dashboard, admin dashboard, settings). Tokens and components
  are certified; route-level visual regression coverage is not.
- **Assistive technology** - no screen reader, switch-access or voice-control
  testing has been performed. All claims are static analysis and computed
  contrast, not assistive-tech verification.

---

## 2. Passed Gates

| Gate                    | Result | Detail                                       |
| ----------------------- | ------ | -------------------------------------------- |
| Web typecheck           | PASS   | `pnpm --filter @foodwaste/web type-check`    |
| Web Jest                | PASS   | 854/854 tests                                |
| Web ESLint              | PASS   | Pre-existing warnings only, no errors        |
| Web design checks       | PASS   | `pnpm --filter @foodwaste/web check:design`  |
| Web production build    | PASS   | `pnpm --filter @foodwaste/web build`         |
| Web Playwright visual   | PASS   | 372/372 (12 viewport/theme/locale combos)    |
| Mobile typecheck        | PASS   | `pnpm --filter @foodwaste/mobile type-check` |
| Mobile Jest             | PASS   | 120 suites, 1922 tests, 422 snapshots        |
| Mobile production build | PASS   | `assembleProductionRelease`                  |

---

## 3. Accessibility Verification

All ratios computed from shipped CSS values at the certified commit using the
WCAG 2.1 relative luminance formula. Foreground values are the actual shipped
`--*-foreground` tokens, not pure white.

### 3.1 Text contrast (WCAG 1.4.3) - threshold 4.5:1

| Pairing                                                           | Theme          | Ratio | Verdict |
| ----------------------------------------------------------------- | -------------- | ----- | ------- |
| `--accent-foreground` (#000F0F) on `--accent` (#F55347)           | Light          | 5.78  | PASS    |
| `--accent-foreground` (#000F0F) on `--accent` (#FFA299)           | Dark           | 10.12 | PASS    |
| `--destructive-foreground` (#FAFAFA) on `--destructive` (#D32F2F) | Light          | 4.77  | PASS    |
| `--destructive-foreground` (#000F0F) on `--destructive` (#E57171) | Dark           | 6.45  | PASS    |
| `--destructive-foreground` (#FFFFFF) on `--destructive` (#D32F2F) | Merchant light | 4.98  | PASS    |
| `--destructive-foreground` (#F2F2F2) on `--destructive` (#7F1D1D) | Merchant dark  | 8.95  | PASS    |
| `--destructive-foreground` on `--destructive-hover` (light)       | Light          | 5.39  | PASS    |
| Dark ink on `--destructive-hover` (dark)                          | Dark           | 13.87 | PASS    |
| Mobile `success[600]` (#1B5E20) on #F0FDF4                        | Light          | 7.52  | PASS    |
| Mobile `success[600]` (#1B5E20) on #D1FAE5                        | Light          | 6.94  | PASS    |

### 3.2 Non-text contrast (WCAG 1.4.11) - threshold 3.0:1

| Pairing                                         | Theme          | Ratio | Verdict |
| ----------------------------------------------- | -------------- | ----- | ------- |
| `--input` (#758A88) on `--background` (#FFFFFF) | Light          | 3.65  | PASS    |
| `--input` (#576B6B) on `--background` (#000F0F) | Dark           | 3.46  | PASS    |
| `--input` (#576B6B) on `--card` (#081717)       | Dark           | 3.25  | PASS    |
| `--input` (#6C938C) on white                    | Merchant light | 3.39  | PASS    |
| `--input` (#447E78) on `--card` (#072C28)       | Merchant dark  | 3.22  | PASS    |
| `--input` (#447E78) on `--background` (#051F1C) | Merchant dark  | 3.69  | PASS    |

### 3.3 Automated regression gates

- `tests/visual/contrast.spec.ts` - measures computed border colour in the
  browser, asserts both inner and outer edge ratios >= 3.0 across all 6
  viewport/theme combinations.
- `apps/mobile/src/design-system/tokens/__tests__/successTextContrast.test.ts` -
  asserts `success[600]` passes 4.5 on both success surfaces.

---

## 4. Visual Regression Coverage

### Web - 192 Playwright baselines

| Suite                | Count | Components                                                                                                                                  |
| -------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `components.spec.ts` | 156   | alert, badge, button, button-focus, card, dialog-open, form, input, input-focus, select, select-open, select-open-selected, separator, tabs |
| `routes.spec.ts`     | 36    | home, login, food-waste-facts                                                                                                               |

Each baseline rendered at 3 viewports (mobile/tablet/desktop) x 4 theme/locale
combinations (light-en, dark-en, light-ar, light-fr) = 12 combos per subject.

Additionally, 180 `reveal-check.spec.ts` tests verify that long marketing pages
render all sections without invisible content.

**Limitation:** No authenticated web route has a visual baseline. Merchant
dashboard, admin dashboard and settings pages are covered by component-level
baselines only.

### Mobile - 422 Jest snapshots

12 style matrix tests resolve computed styles across the full token set. These
verify resolved style values, not rendered pixels.

---

## 5. Device Verification Coverage

### Mobile

| Dimension   | Coverage                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Device      | BlueStacks emulator (Android, arm64-v8a)                                                                              |
| Screens     | 11 screens (Home, Search, Favorites, Orders, OrderDetails, Profile, Settings, Checkout, Loyalty, Leaderboard, Driver) |
| Locales     | en, fr, ar (RTL)                                                                                                      |
| Font scales | 1.0x, 1.3x, 1.5x, 2.0x                                                                                                |
| Theme       | Light only                                                                                                            |

**Limitation:** Coverage is limited to the verified emulator/device scope.
BlueStacks pre-grants runtime permissions, so permission-gated branches are
tested via `pm revoke` before launch. No physical device testing has been
performed.

---

## 6. Production Build Verification

| Platform | Build                                                           | Result                                                         |
| -------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Web      | Next.js production build (`pnpm --filter @foodwaste/web build`) | PASS                                                           |
| Mobile   | Android production release (`assembleProductionRelease`)        | PASS                                                           |
| Mobile   | Production theme                                                | LIGHT ONLY (`DARK_MODE_ENABLED = false`, `lockToLight = true`) |

### Dev/mock isolation

- No `mock-api-server` or `DevSessionSeeder` imports exist in production entry
  points.
- `__DEV__` guards in `App.tsx` cover only Sentry config logging and native
  module debugging - no auth bypass.
- Dev session seeding in `index.js` is behind `if (__DEV__)`, a compile-time
  constant eliminated in release bundles.

---

## 7. Accepted Exceptions

These are known deviations from the design system specification that are
intentionally accepted and documented.

| ID  | Exception                                                   | Rationale                                                                                                                                          |
| --- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| E25 | Dark-mode status badge tints on mobile fail AA              | Dark mode is disabled (E27). Light pairs pass at 7.52 and 6.94. Cannot affect users in production.                                                 |
| E27 | Mobile dark mode built but gated off                        | Intentional. `DARK_MODE_ENABLED = false` in `themeRollout.ts`. Never verified on a real device. Enabling requires a full device verification pass. |
| E26 | Two mobile surfaces ignore the theme (Leaderboard, Welcome) | Deliberate brand surfaces with fixed palettes.                                                                                                     |
| E11 | Raw hex in `opengraph-image.tsx` and `partner-kit`          | Accepted as documented in DESIGN.md section 19. OG images and partner kit are not user-facing UI.                                                  |

---

## 8. Evidence Limitations

These are areas where the certification evidence is incomplete, not because of a
known failure but because the verification method does not cover them.

| Limitation                              | Detail                                                                                                                                                                                                                           |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated web route visual coverage | 192 baselines cover 13 components and 3 public routes. No authenticated route (merchant dashboard, admin dashboard, settings) has a visual baseline. Component tokens are certified; page-level layout is not regression-tested. |
| Assistive technology testing            | All contrast claims are computed from CSS values. No screen reader, keyboard-only, switch-access, or voice-control testing has been performed.                                                                                   |
| Physical device testing (mobile)        | All mobile verification was performed on BlueStacks emulator. No physical Android or iOS device testing.                                                                                                                         |
| globals.css ratio comment               | The comment previously stated 4.98 for destructive; the shipped foreground is #FAFAFA yielding 4.77. Corrected in this session. Both values pass the 4.5 threshold.                                                              |
| FINAL_DESIGN_DECISION_MATRIX.md         | Historical decision-log file. Seven pre-resolution text fragments were struck through in this session. This file is a decision record, not an authoritative status source.                                                       |

---

## 9. Deferred Improvements

These items are documented future work requiring product, brand, or design
decisions. None are certification blockers.

| ID        | Item                                             | Blocking on                                                               | Status   |
| --------- | ------------------------------------------------ | ------------------------------------------------------------------------- | -------- |
| D4        | `.glass` on 76 dashboard cards                   | Product decision - whether glassmorphism stays or is replaced             | DEFERRED |
| D5        | Accent ramp divergence between web and mobile    | Brand call - 7 of 10 accent steps differ                                  | DEFERRED |
| D6        | Radius scales transposed between web and mobile  | Design call - which scale becomes canonical                               | DEFERRED |
| D8        | Remaining `left-`/`right-` CSS offsets           | RTL migration residue - 121 absolute offsets reviewed, none affect layout | DEFERRED |
| OfferCard | OfferCard width remains unconstrained            | Product/UX decision - no snapshot coverage exists                         | DEFERRED |
| E16       | 961 fractional spacing keys in web               | Not wrong - legacy from pre-E5 era, all render Tailwind defaults          | DEFERRED |
| E18       | Accent ramp diverges at 7/10 steps web vs mobile | Needs brand alignment before either side changes                          | DEFERRED |
| E13/U3    | Mobile button `sm` is 32px vs spec 36px          | Deferred to E6 radius migration                                           | DEFERRED |
| E17       | Authenticated web route visual baselines         | Scope expansion - requires test infrastructure for auth state             | DEFERRED |

---

## 10. Historical Audit Reports

The following documents describe the codebase **before** the design system
migration and are preserved as historical evidence, not current status:

- `DESIGN_AUDIT_REPORT.md` - web audit, pre-migration baseline
- `MOBILE_DESIGN_AUDIT_REPORT.md` - mobile audit, pre-migration baseline

Current status lives in:

- `DESIGN.md` section 19 (authoritative exception status)
- `DESIGN_SYSTEM_MIGRATION_FINAL_REPORT.md` (migration outcome)
- `DESIGN_DECISIONS_PENDING.md` (decision status)
- This file (certification status)

---

## 11. Document Consistency

Verified 2026-09-01 across all six authoritative files:

| Check                                                    | Result |
| -------------------------------------------------------- | ------ |
| D1, D2, D3, D7 marked RESOLVED consistently              | PASS   |
| D4, D5, D6, D8 marked as open decisions consistently     | PASS   |
| E1, E2, E4, E31 marked RESOLVED in DESIGN.md             | PASS   |
| E25, E27 marked OPEN in DESIGN.md                        | PASS   |
| No stale blocker/unresolved claims without strikethrough | PASS   |
| Historical audit reports clearly marked as historical    | PASS   |

---

**CERTIFIED WITH DOCUMENTED EXCEPTIONS**

Certified by automated gate verification, computed contrast measurement and
document consistency audit. The certificate covers the web design system and
mobile light-mode design system within the verified scope described above. Dark
mode infrastructure is preserved but disabled and not production-certified.
