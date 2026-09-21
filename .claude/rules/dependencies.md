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
`^2.1.2` only where minimatch 3.x requires it.

**Second correction (2026-07-28).** The note above was still incomplete: it
audited the backend and stopped. `pnpm why brace-expansion -P` in
**apps/mobile** shows two more paths through `react-native 0.81`, which no one
had looked at. The rule says to check every app; that means every app, not "the
app the alert mentioned".

The `geoip-lite` path is now **gone**, and it was fixable rather than acceptable
— `geoip-lite@2` dropped `rimraf` entirely (deps are chalk, iconv-lite,
ip-address, lazy, yauzl). Upgrading 1.4.10 → 2.0.3 removed 179 packages and with
them the last production path to `minimatch 3`. Its only API surface here is
`lookup(ip)`, unchanged; `engines` requires Node ≥ 24 and the repo is on 24.x.
The now-dead `geoip-lite>ip-address` override was removed with it, since v2
already requires `^10.2.0`.

Current residual exposure, verified per app with `-P`:

- **backend production — clean.** Only
  `minimatch 10.2.5 > brace-expansion 5.0.8`.
- **web production — clean.** `@sentry/nextjs > glob 13 > minimatch 10 > 5.0.8`.
- `eslint 8 > minimatch 3` — devDependency, never ships.
- `react-native 0.81 > @react-native/codegen > glob 7 > minimatch 3` and
  `… > chromium-edge-launcher > rimraf 3 > glob 7 > minimatch 3` — listed as
  production deps of `react-native`, but they are **build-time** tooling
  (codegen, Metro). They do not enter the JS bundle shipped in the APK. Not
  fixable from here: it needs a react-native release that drops glob 7.

So nothing that runs in production is affected any more, and the remaining paths
take no attacker-controlled brace patterns — they glob hardcoded build paths.
Still recorded in `pnpm.auditConfig.ignoreGhsas`, now on much narrower grounds.

**The audit gate itself was broken.** CI ran
`pnpm audit --audit-level=high --recursive` and `security:check` ran
`pnpm audit --recursive`; pnpm 10 has no `--recursive` flag for `audit`, so both
exited 1 with "Unknown option" instead of auditing anything. A gate that always
fails is a gate nobody reads. Fixed — plain `pnpm audit` at the root already
covers every workspace package through the shared lockfile.

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

## A `parent>child` selector only covers the majors you name (2026-08-03)

`brace-expansion` GHSA-rgw5-rvv9-x895 (a different advisory from the
`GHSA-mh99-v99m-4gvg` above) needed `>=5.0.9` on the v5 line and `>=2.1.4` on
v2. The overrides in place named two consumers:

```jsonc
"minimatch@^3>brace-expansion":  "^2.1.2",
"minimatch@^10>brace-expansion": "^5.0.8"
```

Bumping just those two left `brace-expansion@2.1.2` in the tree, because
`minimatch@5.1.9`, `minimatch@8.0.7` and `minimatch@9.0.9` are also in there and
no selector named them. `pnpm why` on the app looked clean — it showed the
patched copies — while the vulnerable one sat under majors nobody had thought to
enumerate.

**Prefer a version-scoped selector (`pkg@range`) over `parent>child` when the
fix applies to every consumer of a major.** `brace-expansion@^2` covers 3, 5, 8,
9 and anything added later; `parent>child` silently covers only what you list.
Reach for `parent>child` when one specific consumer needs holding back, which is
what it is for. Grep the lockfile to confirm:

```bash
grep -oE "brace-expansion@[0-9]+\.[0-9]+\.[0-9]+" pnpm-lock.yaml | sort -u
```

Resolved in the same pass, all patch-level inside their existing majors:
`socket.io-parser >=4.2.7` (production, via `socket.io`), `ip-address >=10.3.1`
(production, via `geoip-lite`), `fast-uri >=4.1.2` (dev, via `commitlint`).
`pnpm audit` is clean, so `ignoreGhsas` still lists only `GHSA-mh99-v99m-4gvg`.

**These bumps were safe for the reason the earlier one was not.** The override
that broke ESLint crossed a major (v2 → v5, where v5 exports a namespace object
and minimatch 3 calls `expand()` as a function). Everything here stays inside
the major it was already on, so no API surface moves. That distinction is the
thing to check before deciding how much verification a bump needs — not the
severity label.

## Never

- Floating `latest`.
- Bumping a major to silence an auditor without testing the consumers.
- Resolving a `pnpm-lock.yaml` merge conflict by taking either side. Regenerate
  it from the merged manifests — a stale branch's lockfile will quietly revert
  security bumps that landed on master. Then run `pnpm check:lockfile`: a
  resolution that matches neither manifest fails `--frozen-lockfile` on CI and
  Vercel while passing every local type-check and test, because those read
  `node_modules`, never the lockfile.
- Editing any `package.json` without regenerating the lockfile in the same
  commit (`pnpm fix:lockfile && git add pnpm-lock.yaml`). See "A manifest edit
  is not done until the lockfile is regenerated" in CLAUDE.md.
- Passing `--no-frozen-lockfile` to make a failing deploy install. It ships a
  tree that differs from the committed lockfile.

## `image-size` has no patched version at all (2026-08-11)

Dependabot raised six high alerts; four were patch-level bumps inside their
existing majors and were taken as such — `js-yaml` 3.15.0 → `^3.15.1` and 4.3.0
→ `^4.3.1` (both already had version-scoped overrides pinned at exactly the
vulnerable release), and a new `nanoid@^3` → `^3.3.17`, which also collapsed two
copies (3.3.12 and 3.3.16) into one 3.3.18.

`image-size` is different: `pnpm audit` reports `Patched versions <0.0.0` for
GHSA-5p2g-fcmc-qvqq and GHSA-w3rx-r6r6-pgpr, i.e. **no released version fixes
it**. There is nothing to bump to, so the only options are accepting it or
removing the dependency — and it is not ours to remove.

Verified per app with `-P`, as the rule above demands rather than assuming:

- **web production — not present.** No path.
- **backend production — not present.** No path.
- **mobile — one path**, via `react-native 0.81`, its
  `@react-native/community-cli-plugin`, then `metro-config` and `metro`.
  Build-time tooling, exactly like the `minimatch 3` paths recorded above: Metro
  bundles the app, it does not ship inside the APK, and it reads image
  dimensions from files in the repo rather than from attacker-controlled input.

Recorded in `pnpm.auditConfig.ignoreGhsas`. Re-check when React Native ships a
Metro release that drops or replaces `image-size` — that is the only thing that
can clear it, and no override can.

## The patched version can be the breaking one (2026-09-02)

`decode-uri-component` GHSA-vcc3-ghjq-m6fr: vulnerable `<=0.4.2`, patched
`>=0.5.0`. Accepted, in `pnpm.auditConfig.ignoreGhsas`. The reasoning matters
more than the entry, because the fix looked clean by every gate this repo runs.

**Where it is.** Verified per app with `-P`, not at the root:

- **mobile production**, one path:
  `@react-navigation/native > @react-navigation/core > query-string 7.1.3 > decode-uri-component 0.2.2`
- **backend production**: no path. **web production**: no path.

So it is reachable, and reachable on attacker-supplied input: React Navigation
parses every deep link through it. A hostile `foodwaste://` or universal link
with a pathological percent-encoded query can pin the JS thread.

**Why it is accepted rather than fixed.** The impact ceiling is a hang in the
app's own process, on a link the user chose to open. No server component parses
these, nothing is disclosed, and nothing crosses a trust boundary that was not
already crossed by opening the link. That is worth less than the alternative.

**Why the override does not work.** 0.5.0 and 0.4.1 are ESM-only: their exports
map declares a single `default` condition, so there is no CJS build. But
`query-string@7.1.3` is CommonJS and does

```js
const decodeComponent = require('decode-uri-component');
```

Under 0.5.0 that binds the module namespace object, not the function, so
`decodeComponent(...)` throws `TypeError: decodeComponent is not a function` on
**every deep link carrying a query param**. In this app that is password reset
and email verification: the two flows that arrive by email and cannot be reached
any other way.

**This is the part to remember.** The override passed everything:
`pnpm install`, all three type-checks, the web production build, the release
AAB, and 2,500+ tests across backend, web and mobile. Metro bundled it happily
and the sourcemap confirmed the 0.5.0 source was embedded. Bundling is not
running: no existing test ever parsed a deep-link path, so no existing test
could execute the decoder.
`apps/mobile/src/navigation/__tests__/linking.test.ts` was written for this, and
9 of its 12 cases fail on 0.5.0 and pass on 0.2.2. Keep it. It is the only thing
standing between this override and a silently broken password reset.

**Re-check when** any of these changes, and re-run that suite as the gate:

- `@react-navigation/core` drops `query-string`, or moves to a major that
  imports the decoder rather than requiring it (7.21.1 still requires it)
- `query-string` ships a release whose CJS build interops with an ESM decoder
- `decode-uri-component` backports the fix to a CJS line

Do not raise it by bumping `query-string` alone: React Navigation pins the major
it expects, and the failure mode here is silent at build time.

## An override can hide a vulnerable pin in an app manifest (2026-09-21)

`pnpm audit` was clean. Dependabot reported three open alerts. Both were right,
and the gap between them is the thing to remember.

The alerts pointed at **`package.json`**, not `pnpm-lock.yaml`:

```
sharp  apps/mobile/package.json              "sharp": "0.35.3"    advisory: <0.35.4
joi    apps/food-waste-backend/package.json  "joi":   "17.13.4"   advisory: <17.13.6
```

Both were exact pins on vulnerable versions. The root `pnpm.overrides` forced
the installed tree to `sharp@0.35.4` and `joi@18.2.8`, so nothing vulnerable was
ever running - which is exactly why `pnpm audit` said nothing. **It reads the
resolved tree. Dependabot reads the declaration.**

That divergence is not cosmetic:

- Remove or narrow the override and the vulnerable version comes straight back,
  silently, with no gate failing.
- Anyone installing that workspace on its own gets the vulnerable version - the
  override lives in the _root_ manifest.
- The manifest is what a reader believes. A file saying `"joi": "17.13.4"` next
  to a tree running 18.2.8 means nobody can trust either.

**So when an advisory is cleared by an override, update the app manifest too.**
The override is for holding a _transitive_ dependency in place; it is not a
substitute for the direct dependency being declared correctly.

The fix here changed no resolved version at all - `git diff pnpm-lock.yaml` was
empty after regenerating, because the overrides had been producing those
versions all along. The manifests simply started telling the truth.

**Check both, because they answer different questions:**

```bash
pnpm audit                      # what is installed
grep -n '"<pkg>"' apps/*/package.json   # what is declared
```

Two further notes from the same pass:

- **Dependabot's `scope` field is not reliable.** It labelled `sharp` as
  `development`, but `pnpm why sharp -P` shows it is a production dependency of
  the backend directly and of web through `next`. Had it still been vulnerable,
  it would have shipped. Trust `pnpm why -P` per app, as the rest of this file
  already insists.
- **`joi` 17 -> 18 crossed a major and was still safe to take**, because the
  tree had been resolving to 18.x under the override for some time and the suite
  had been passing against it. The API surface in `config/env.validation.ts` is
  `string/number/boolean/object/when/ref/valid/ required/optional/exist`,
  unchanged across that major, and `config/__tests__/env-validation-*.spec.ts`
  calls `envValidationSchema.validate(...)` directly - 15 assertions that
  actually execute the schema rather than merely importing it.
