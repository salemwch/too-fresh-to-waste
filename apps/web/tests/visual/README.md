# Visual Regression Testing

Playwright screenshot tests for `apps/web`. They exist because the design system
has failure modes nothing else in this repo can see: a Tailwind class that emits
no CSS, a token whose light and dark values are identical, a spacing scale that
silently re-values `p-4` everywhere. Type-check and Jest pass through all of
them - these are strings and colours, not types.

Paired with `scripts/spacing-snapshot.mjs`, which covers what the
_class-to-pixel mapping_ does. This suite covers what the **rendered page**
does.

---

## Quick reference

```bash
# Run the whole suite (builds the app, starts a server, tears both down)
pnpm --filter @foodwaste/web test:visual

# Accept new renders as the baseline - only after reviewing the diff
pnpm --filter @foodwaste/web test:visual:update

# Open the HTML report with side-by-side diffs from the last run
pnpm --filter @foodwaste/web test:visual:report

# Interactive runner, useful while writing specs
pnpm --filter @foodwaste/web test:visual:ui

# One-time, per machine and in CI: fetch the browser binary
pnpm --filter @foodwaste/web test:visual:install
```

Narrow a run while iterating:

```bash
npx playwright test --project=desktop-light-en          # one matrix cell
npx playwright test components                          # one spec
npx playwright test --grep "dialog"                     # one test
npx playwright test --project=mobile-light-ar --headed  # watch it happen
```

---

## The matrix

Twelve projects, named `{viewport}-{theme}-{locale}`:

|             | 360 (mobile) | 768 (tablet) | 1280 (desktop) |
| ----------- | ------------ | ------------ | -------------- |
| light, `en` | yes          | yes          | yes            |
| dark, `en`  | yes          | yes          | yes            |
| light, `ar` | yes (RTL)    | yes (RTL)    | yes (RTL)      |
| light, `fr` | yes          | yes          | yes            |

**Why not the full 3 x 2 x 3 cross product.** Eighteen cells is more runs than
signal. Theme and direction are independent - a dark RTL bug is a dark bug or an
RTL bug, and both axes are already covered. French differs from English only in
string length, which is a layout concern, so it is covered at every viewport in
one theme. Adding a cell is cheap if a real bug ever escapes through one.

The three viewports come from `DESIGN.md` §9.1. 360px is the documented floor.

---

## What is covered

**`components.spec.ts`** - the shared primitives, via a dedicated harness route.
Button (6 variants x 4 sizes x disabled x Arabic), Input, Textarea, Select
(closed, disabled, **open menu**), Card, Badge including the order-status set,
Alert, Separator, Tabs, Dialog (**open**), plus focus rings on Button and Input.

Each section is screenshotted individually rather than as one long page. When
Button changes, the Button baseline fails and nothing else does; a single
full-page baseline would go red for any change anywhere and tell you nothing.

**`routes.spec.ts`** - three public routes (`/`, `/login`, `/food-waste-facts`)
in all three locales. These catch what a harness page cannot: the real header,
real navigation, real translated copy at real lengths.

### The harness route

`src/app/[locale]/visual-harness/page.tsx` renders every primitive in every
variant and state on one page. Real product routes cannot do this - a Button's
disabled state and a Select's open menu appear on no single page, and the states
that do appear are tangled up with live data.

It is **gated on `NEXT_PUBLIC_VISUAL_HARNESS=1`** and returns 404 otherwise.
That variable is set only by the Playwright `webServer` command and is declared
in `turbo.json`'s build env so Turborepo does not strip it. It also carries
`robots: { index: false }`.

> The folder is `visual-harness`, not `__visual`. **App Router treats any folder
> starting with `_` as private and excludes it from routing entirely** - the
> route silently did not exist, with no error anywhere.

---

## How determinism is enforced

Four layers, all load-bearing.

**1. `playwright.config.ts`**

- `animations: 'disabled'` freezes CSS animations and transitions at their end
  state.
- `caret: 'hide'` stops the text cursor blinking through a focused-input shot.
- `deviceScaleFactor: 1` and `scale: 'css'` keep baselines machine-independent.
- `timezoneId: 'Africa/Tunis'` pins date rendering.
- `maxDiffPixelRatio: 0.01` absorbs font-hinting noise between machines without
  absorbing a real 1px layout shift, which moves far more pixels than that.
- `retries: 0` - a flake here means the harness is wrong, and retrying hides it.

**2. `fixtures.ts`, before first paint**

`addInitScript` seeds `localStorage` _before any document script runs_:

- `cookie-consent: 'accepted'` - otherwise the consent banner is in every shot.
- `foodwaste-theme: light|dark` - this is how the theme is actually switched.

Seeding after navigation would render the banner and the light theme first and
then remove them, and a screenshot taken in that window differs every run.

`page.clock.install()` freezes time at a fixed instant. A stylesheet kills any
remaining animation, transition and smooth-scrolling.

**3. `settle()`**

`networkidle` is not enough. `next/font` self-hosts, so fonts can still be
swapping after the network goes quiet, and a shot taken then captures the
fallback face with different metrics. `settle()` awaits `document.fonts.ready`
and then one `requestAnimationFrame`, so any layout caused by the font swap has
been committed.

**4. The harness page itself** - no dates, no randomness, no network, no locale
lookups. Fixed copy, including one fixed Arabic string.

---

## Baselines

```
tests/visual/__screenshots__/
  desktop-light-en/
    components.spec.ts/
      button.png
      form.png
      ...
    routes.spec.ts/
      home.png
  desktop-dark-en/
  mobile-light-ar/
  ...
```

One directory per project, then per spec file. **Baselines are committed** -
they are the contract. Diffs and traces from a failed run go to
`tests/visual/.output/` and `playwright-report/`, both gitignored.

### Updating them

`test:visual:update` rewrites every baseline in range. It is a blunt instrument:
it will happily accept a regression.

1. Run the suite and let it fail.
2. `test:visual:report` and look at the side-by-side diff for each failure.
3. Only if every change is intended, update - and narrow the scope:
   `npx playwright test --project=desktop-light-en components --update-snapshots`
4. Review the changed `.png` files in the diff before committing.

**A baseline update is a design decision.** Say in the commit message what
changed visually and why.

---

## Server management

`webServer` runs `pnpm build && pnpm start`, a **production build** - not
`next dev`, which injects the error overlay and hot-reload client, recompiles on
first request, and does not run CSS through the shipping pipeline.

**`reuseExistingServer` is `false` by default**, and that is deliberate. The
failure mode when a stale server is reused is silent and expensive: it holds the
previous build, so after any source change it serves HTML referencing a CSS
bundle whose hash no longer exists. **The page renders completely unstyled**,
and every screenshot fails for a reason unrelated to the change - or worse, gets
accepted as a new baseline. This happened while building this suite; the symptom
was a 976px baseline against a 1264px render, which is the viewport minus the
browser's default body margin.

Set `VISUAL_REUSE_SERVER=1` to opt in while iterating on the specs themselves,
where the app build is not moving.

Because each run rebuilds, a full suite takes several minutes. That is the cost
of correctness here.

---

## Adding coverage

**A new primitive:** add it to the harness page in the right `<Section>`, then
add its name to `SECTIONS` in `components.spec.ts`. If it needs interaction to
show its interesting surface, add it to `harness-client.tsx` with a stable
`data-visual-*` hook - never select on Radix's internal markup.

**A new route:** add it to `ROUTES` in `routes.spec.ts`. It must be public, and
deterministic - no live data, no relative timestamps that the frozen clock does
not already pin.

Then generate baselines for the new test only and **look at the PNGs** before
committing them.

---

## CI

**This suite is deliberately not wired into `.github/workflows/ci.yml` yet**,
and adding it before the step below would produce a permanently red job.

The baselines committed here were generated on **Windows / Chromium**. CI runs
`ubuntu-latest`, where FreeType renders text with different hinting and
antialiasing. Those differences exceed `maxDiffPixelRatio` on text-heavy shots,
so every baseline would fail on the first CI run for a reason that has nothing
to do with the code.

A gate that always fails is a gate nobody reads - the same failure mode as the
`pnpm audit --recursive` invocation recorded in `.claude/rules/dependencies.md`,
which exited non-zero on every run for months because pnpm 10 has no such flag.

**To enable it properly:**

1. Regenerate the baselines on Linux, once, and commit them from there - either
   in a container (`mcr.microsoft.com/playwright:v1.62.1-jammy`) or via a
   one-off workflow run with `--update-snapshots` that opens a PR.
2. Delete the Windows-generated baselines in the same commit. Do not keep both:
   whichever platform did not generate them will fail.
3. Then add the job:

```yaml
visual:
  name: Visual regression
  runs-on: ubuntu-latest
  container: mcr.microsoft.com/playwright:v1.62.1-jammy
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with: { node-version: 24.11.1, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter @foodwaste/web test:visual
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: apps/web/playwright-report/
        retention-days: 7
```

The `container:` line is what makes it reproducible - it pins the exact browser
and font stack the baselines were generated against. Running bare on
`ubuntu-latest` will drift when GitHub updates the runner image.

---

## Known gaps

These are real and are not claimed as covered.

- **Authenticated routes are not covered.** Merchant and admin dashboards are
  the densest UI in the product and the most likely to regress, but they need a
  seeded session and a backend. That needs a fixture that logs in against a
  seeded test database, which does not exist yet. This is the highest-value next
  step.
- **Below the fold is not covered.** Route screenshots are viewport-only,
  because these pages carry marquees, lazy images and intersection-observer
  reveals below the fold; a full-page baseline would measure those rather than
  the layout. Pin them individually, then switch to `fullPage: true`.
- **One browser.** Chromium only. Safari and Firefox render text and form
  controls differently; adding them multiplies baselines and would mostly catch
  browser differences rather than our regressions.
- **`AlertTitle`, `CardDescription` and `CardFooter` are untested** because
  `alert.tsx` and `card.tsx` define but never export them. They are unreachable
  dead code, not a coverage gap this suite can close.
- **Baselines are machine-generated on Windows/Chromium.** A different OS may
  produce sub-pixel text differences beyond `maxDiffPixelRatio`. If CI disagrees
  with local, generate baselines in CI - do not raise the threshold until it
  stops complaining.
