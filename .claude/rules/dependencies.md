# Dependency & Vulnerability Policy

## Bumping for a security advisory

1. **Stay inside the current major.** A security patch is not an upgrade. Take
   the lowest patched version within the major already in use
   (`npm view <pkg>@<major> version`). Majors move on their own schedule.
2. **Transitive packages** go through `pnpm.overrides` in the root
   `package.json`, not by adding a direct dependency.
3. **Split by major when the lines diverge** — e.g. `body-parser@^1` and
   `body-parser@^2` have separate patched versions and need separate entries.
4. **Verify after every bump**: `pnpm audit`, `pnpm type-check`, all three test
   suites, and a `pnpm --filter @foodwaste/web build`. A lockfile change can
   break things no type-checker will catch.

## Cross-major overrides are the dangerous case

If an advisory has no fix inside the current major, the bump is a breaking
change wearing a security hat. Test the consumers, not just the build.

**Worked example — `brace-expansion` (GHSA-mh99-v99m-4gvg):** the advisory's
affected range covers every version below 5.0.8, so pinning the patched 2.x
release does not clear it. v5 is a dual ESM/CJS package that exports a namespace
object, while ESLint 8's bundled `minimatch` calls `expand(...)` as a bare
function — so the override that satisfied the auditor broke linting entirely
(`TypeError: expand is not a function`). Type-check and tests both passed; only
running ESLint caught it.

Resolution: pinned `^2.1.2` (the patched release for the 2.x line) and recorded
the advisory in `pnpm.auditConfig.ignoreGhsas`. Justification: the sole path is
`eslint > minimatch > brace-expansion` — a devDependency that never ships, and
the "unbounded expansion" input is our own lint config.

## Accepting an advisory

Never leave one silently unfixed. Add it to `pnpm.auditConfig.ignoreGhsas` so
`pnpm audit` reports it as explicitly ignored, and record here **why**: which
paths are affected, whether it ships to users, and what the fix would break.
Re-check when the blocking constraint changes (e.g. the ESLint 9 migration
should let `brace-expansion` move to v5 — revisit then).

## Never

- Floating `latest`.
- Bumping a major to silence an auditor without testing the consumers.
- Resolving a `pnpm-lock.yaml` merge conflict by taking either side. Regenerate
  it from the merged manifests — a stale branch's lockfile will quietly revert
  security bumps that landed on master.
