---
status: in-progress
scope: cross-app
gate:
  pnpm lint && pnpm type-check && pnpm test && pnpm --filter @foodwaste/web
  build
---

## Intent

Clear the two Snyk advisories that have no fix inside their current major:
`next@15.5.24` (1 high + 1 medium, DoS/resource-throttling, stable fix only in
16.x) and `eslint@8.57.1` (1 medium, fixed in 9.26.0). Both are major upgrades,
which `.claude/rules/dependencies.md` calls "a breaking change wearing a
security hat", so they land as two separate commits with a full gate each.

## Constraints

**Order is forced, not chosen.** `eslint-config-next@16.3.4` declares
`peerDependencies: { eslint: ">=9.0.0" }`. Next 16 cannot land until ESLint 9
does.

Verified compatible before starting, so neither blocks:

- `next-intl@4.14.2` - peer allows `^16.0.0`
- `@sentry/nextjs@10.73.0` - peer allows `^16.0.0-0`

Current lint topology (mixed, which is the actual work): | Workspace | Config |
Lint script | | --- | --- | --- | | root | `.eslintrc.js` (legacy) |
`turbo run lint` | | apps/web | `.eslintrc.json` (legacy) | `next lint` -
**removed in Next 16** | | apps/mobile | `.eslintrc.js` (legacy) |
`eslint . --ext ...` - `--ext` **removed in ESLint 9** | |
apps/food-waste-backend | `eslint.config.js` (flat) | `eslint src --fix` | |
packages/ui | (inherits) | `eslint . --ext ...` | | packages/shared | (inherits)
| `eslint . --ext ...` |

`packages/eslint-config` ships legacy presets (`base`, `react`, `react-native`,
`next`, `nest`) plus one flat preset (`flat/nest`). The flat variants of the
rest do not exist yet.

## Tasks & Acceptance

### Phase 1 - ESLint 9 [DONE]

- [x] Flat configs: root, `apps/web` (`.mjs`), `apps/mobile`. Backend was
      already flat. The shared presets stay in legacy format and are consumed
      through `FlatCompat` rather than hand-ported - they carry rule-by-rule
      reasoning in comments that a rewrite is likely to drop silently.
- [x] `--ext` removed everywhere (mobile, ui, shared); `next lint` replaced with
      the ESLint CLI in `apps/web`, which Next 16 requires regardless
- [x] Overrides for plugins that predate ESLint 9 and are pinned by
      `@react-native/eslint-config`: `eslint-plugin-ft-flow ^3.0.11` (2.x calls
      the removed `context.getAllComments`) and
      `eslint-plugin-react-native ^5.0.0` (4.x calls `context.getScope`)
- [x] All 33 React Compiler errors fixed rather than downgraded - see Decisions
- [x] `pnpm lint` green across all 7 workspaces, **0 errors**
- [x] `pnpm knip` clean - `FlatCompat` consumes plugins as config strings, which
      knip cannot resolve; recorded in `knip.config.ts` beside the equivalent
      `jest-environment-jsdom` note

### Phase 2 - Next 16

- [ ] `next`, `eslint-config-next` to 16.x; React to whatever Next 16 requires
      (currently pinned `react`/`react-dom` `19.1.0` in root `pnpm.overrides` -
      Next 16 wants 19.2)
- [ ] `next lint` replaced with the ESLint CLI in `apps/web`
- [ ] **Keep `middleware.ts`, do not rename to `proxy`.** The rename forces the
      nodejs runtime; this app does Edge JWT verification with `jose`, so the
      edge runtime is required. Documented as deliberate.
- [ ] Turbopack: Sentry injects a webpack config, and `next build` defaults to
      Turbopack in 16 and **fails** when it finds one. Either confirm Sentry's
      Turbopack support or pass `--webpack`.
- [ ] Audit `images` config against the changed defaults: `qualities` now
      `[75]`, `minimumCacheTTL` 60s -> 4h, `16` dropped from `imageSizes`
- [ ] Audit every `params`/`searchParams`/`cookies()`/`headers()` for sync
      access - the Next 15 compatibility shim is gone
- [ ] Parallel-route slots need explicit `default.js` or the build fails
- [ ] 275 prerendered routes still build

## Decisions

- Two commits, not one. A combined diff makes it impossible to tell which
  upgrade broke what, and Next 16 is the far riskier half.
- ESLint first because the peer dependency forces it, not because it is safer.
- **The 33 React Compiler errors were fixed, not downgraded to warnings.** They
  arrived with `eslint-plugin-react-hooks@7` and had never run on this codebase,
  so none were caused by the upgrade. Setting them to `warn` was the cheaper
  option and was rejected. Four patterns covered them:
  - _setState inside an effect_ (20) - moved to React's documented "adjust state
    during render" pattern, which re-runs before committing instead of painting
    a stale frame and correcting it. Several were "reset a form when a dialog
    opens" or "populate a form when a fetch resolves".
  - _impure function during render_ (5) - `Date.now()` in render, which is
    non-reproducible, a hydration hazard, and never updates. Replaced with
    `hooks/useClock.ts`: a quantised `useSyncExternalStore` clock that is stable
    across renders and ticks on the day or hour boundary.
  - _component created during render_ (5) - dynamic `<Icon />` tags resolved
    from a lookup, and two components declared inside another component's body.
    The icons became components with literal tags; the inner components became
    plain render helpers, which is what they always were.
  - _mutation / declaration order_ (3) - a `nextTaken` flag reassigned inside a
    `.map()` became a `findIndex`; a cookie write moved out of component scope
    into `lib/locale-cookie.ts`; `populateForm` moved above its caller.
- Two reusable hooks fell out of this and are the real payoff:
  `hooks/useHasMounted.ts` (replaces the `useState(false)` +
  `useEffect(() => setMounted(true))` double-render idiom in two components) and
  `hooks/useClock.ts`.

## Open questions

- Does `@sentry/nextjs@10.73` work under Turbopack builds, or is `--webpack`
  required? Blocking for Phase 2 only. Resolve by building.
