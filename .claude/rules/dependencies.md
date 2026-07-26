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

**Correction (2026-07-26).** The first version of this note claimed "the sole
path is `eslint > minimatch > brace-expansion` — a devDependency that never
ships". That was wrong, and it is the kind of wrong that matters: the
justification for accepting an advisory rested on it. `pnpm why brace-expansion`
run at the **workspace root** shows only dev paths, because the root has no
production dependencies. Run it per app with `-P` and the backend has two:

```
geoip-lite > rimraf 2.7.1 > glob 7.2.3 > minimatch 3.1.5 > brace-expansion
minimatch 10.2.5 > brace-expansion
```

Always check `pnpm why <pkg> -P` **inside each app**, never only at the root.

Current resolution — a version-scoped split rather than one global pin:

```jsonc
"brace-expansion@^5":          "^5.0.8",  // anything already on v5
"minimatch@^10>brace-expansion": "^5.0.8", // v10 uses the namespace API
"minimatch@^3>brace-expansion":  "^2.1.2"  // v3 calls expand() as a function
```

This patches the backend's direct `minimatch 10` production path and leaves
`^2.1.2` only where minimatch 3.x requires it. The residual exposure is:

- `eslint > minimatch 3` — devDependency, never ships.
- `geoip-lite > rimraf > glob 7 > minimatch 3` — **production dependency, but
  `rimraf` is required only by `geoip-lite/scripts/updatedb.js`**, the manual
  database-refresh script. `lib/geoip.js`, the runtime entry, never loads it,
  and the glob pattern is geoip-lite's own hardcoded path. No request-path
  reachability, no attacker-controlled input.

Recorded in `pnpm.auditConfig.ignoreGhsas` on that basis.

## Accepting an advisory

Never leave one silently unfixed. Add it to `pnpm.auditConfig.ignoreGhsas` so
`pnpm audit` reports it as explicitly ignored, and record here **why**: which
paths are affected, whether it ships to users, and what the fix would break.
Re-check when the blocking constraint changes (e.g. the ESLint 9 migration
should let `brace-expansion` move to v5 everywhere — revisit then).

**"It's dev-only" is a claim, not an assumption.** Prove it with
`pnpm why <pkg> -P` inside every app before writing it down. A root-level check
proves nothing: the workspace root has no production dependencies, so every path
it can show you is a dev path.

**Prefer a scoped override to a blanket accept.** If one consumer blocks the
patched version, pin the old version _for that consumer_ and take the fix
everywhere else, rather than leaving the whole tree on the vulnerable release.
pnpm supports `parent>child`, `pkg@range`, and `parent@range>child` selectors.

## Never

- Floating `latest`.
- Bumping a major to silence an auditor without testing the consumers.
- Resolving a `pnpm-lock.yaml` merge conflict by taking either side. Regenerate
  it from the merged manifests — a stale branch's lockfile will quietly revert
  security bumps that landed on master.
