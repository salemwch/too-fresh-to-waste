# SECURITY REMEDIATION COMPLETE FOR CURRENT VERIFIED SCOPE — 4 POST-CLOSURE ITEMS REMAIN TRACKED

**Closed:** 2026-09-10 **Owner:** repository maintainer **Scope:** the security
remediation workstream opened from a Snyk Code / Snyk Open Source review of the
monorepo, covering committed credentials, dependency advisories,
security-reporting correctness, local-stack exposure, and CI security gates.

This record is the evidence trail for the closure decision. It closes the
**current scope**. It does not assert a general security property of the system.

---

## What this closure does NOT claim

Stated plainly, because a closure record is exactly the document a future reader
will over-read:

- **Not** that the repository has zero vulnerabilities.
- **Not** that Snyk Open Source has passed. It has not run.
- **Not** that dependency security is fully verified. It is partially verified.
- **Not** that the system is universally or absolutely secure.

What it does assert is narrower and evidenced below: every finding in scope was
individually traced to source, the two genuine defects found were fixed with
tests that fail when the fix is reverted, and the named gates pass.

---

## Status

The four categories below are deliberately kept apart. Collapsing them into a
single "secure" verdict is the failure mode this record exists to prevent.

### Verified / completed

Evidence produced and reproducible; see §1, §2 and §5.

- Committed database credentials removed; no usable credential remains in the
  repository.
- Stale JWT lifetime security claim fixed and covered by mutation-checked tests.
- `io.netty` upgraded, clearing 15 of 16 Gradle advisories including one
  CRITICAL.
- `mongo-init` readiness race replaced with a deterministic condition, 11/11
  cold starts.
- All 16 High and Medium Snyk Code findings individually traced; **0 require a
  fix**; none suppressed.
- Test, type-check, lint, Semgrep, Android build and repository-integrity gates
  pass.

### Mitigations currently in place (not yet hardened)

Controls doing real work, standing in for a fix that has not landed. **Do not
remove them.**

- `REDIS_PASSWORD` and `RABBITMQ_URL` remain literals in `docker-compose.yml`.
  The exposure is closed structurally instead: MongoDB, Redis, RabbitMQ and
  Prometheus bind `127.0.0.1` only, and the three admin UIs moved to an opt-in
  overlay. **This loopback-only mitigation must be preserved until credential
  parameterisation is completed** (post-closure P1).
- The backend API port `3000` remains bound on all interfaces by design, for
  real-device testing, with the reason recorded in `docker-compose.yml`.

### Unverified

Coverage that does not exist yet. Not a pass.

- **Snyk Open Source** — `UNVERIFIED — quota unavailable`. The 19 → 4 figure is
  derived, not scanned. See §4.
- **Gradle/Android dependency tree** — never had a successful independent scan.
  Dependabot now reports advisories there, which is a reporting feed, not a
  completed scan.

### Deferred

Assessed, understood, and consciously not acted on.

- `kotlin-stdlib 2.0.21` (CVE-2020-29582, CVSS 3.3 LOW) — open against the
  resolved version, assessed as not reachable in the shipped artifact. See §3.

### Summary table

| Item                                 | Status                               |
| ------------------------------------ | ------------------------------------ |
| Production code                      | **PASS**                             |
| Snyk Code                            | **PASS**                             |
| Semgrep                              | **PASS**                             |
| Dependency security                  | **PARTIALLY VERIFIED**               |
| Snyk OSS                             | **UNVERIFIED — quota unavailable**   |
| Accepted development-only risks      | **4**, documented                    |
| Remaining actionable code findings   | **0**                                |
| `kotlin-stdlib 2.0.21`               | **DEFERRED**, justification recorded |
| Gradle/Android dependency monitoring | Covered by Dependabot                |

`Dependency security` reads PARTIALLY VERIFIED rather than PASS because the
Gradle half of the tree has never had a successful independent scan. Dependabot
now reports advisories there, but a reporting feed is not a completed scan.

---

## 1. Defects fixed

Two genuine defects were found. Both are fixed and both are covered by tests
that were mutation-checked: the test fails when the fix is reverted.

### 1.1 Committed database credentials

`foodwaste_user` / `foodwaste_password` in `scripts/mongo-init.js`, and `admin`
/ `password123` across `docker-compose.yml`, five CI steps and five integration
specs.

The credential was load-bearing rather than merely present: five integration
suites hardcoded the same string as a fallback, so the compose password could
not be changed without breaking the test suite.

All credentials now come from the environment with no defaults anywhere.
`docker-compose.yml` uses `${VAR:?message}`; `scripts/mongo-init.js` throws
rather than creating a user with a default password; integration suites resolve
`MONGO_TEST_URI` through `test/helpers/mongo-test-uri.ts`, which has no
fallback; CI generates single-run credentials with `openssl rand -hex 24` and
masks them.

**Evidence.** Isolated cold-start smoke stack: `mongo-init` exit 0, replica set
initiated, app user created with `readWrite/dbAdmin`, backend connection string
authenticates against a writable PRIMARY, and the previous `admin:password123`
fails with `MongoServerError: Authentication failed`. Compose refuses to start
when a variable is missing, naming it.

### 1.2 Stale security claim in the diagnostics reporter

`CookieSecurityUtil.getSecurityConfig` reported `refreshToken: '365 days'` while
the enforced default had moved to `30d` — a change made precisely because a
365-day refresh token is a year-long account-takeover window on a bearer
credential. A security-reporting surface stating a lifetime the system does not
use is worse than one stating nothing, because it is trusted.

The values are now derived from configuration. `src/config/token-lifetimes.ts`
is the single source of truth for both the Joi schema that _enforces_ the
lifetimes and the diagnostics that _report_ them, so the two cannot drift.
`SESSION_COOKIE_MAX_AGE_MS` was extracted from an inline literal for the same
reason.

**Why it survived so long:** the pre-existing spec asserted only
`toHaveProperty('tokenLifetime')` and never checked a value. The replacement
asserts against `envValidationSchema.validate(...).value` rather than a second
copy of the literal.

**Evidence.** Four tests pass; reverting the constant to `365d` fails the
regression guard; drifting the diagnostics one character from configuration
fails two further tests. Snyk Code confirms independently: the finding at
`cookie-security.util.ts:199` resolved with no replacement, **HIGH 14 → 13**.

### 1.3 Supporting hardening

| Change                                                                                                                                                                                                                                                                        | Evidence                                                                 |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| JWT validation now rejects known development secrets and enforces that refresh differs from access. `min(32)` alone had accepted the 42-character `dev_jwt_secret_please_change_in_production`, and the "must differ" rule was claimed in an error message but never enforced | 24 tests across `weak-secrets.spec.ts` and `env-validation-jwt.spec.ts`  |
| `io.netty` 4.1.135 → 4.1.137, clearing 15 of 16 Gradle advisories including one CRITICAL                                                                                                                                                                                      | 123 references all resolve to 4.1.137.Final; absent from the release dex |
| `mongo-init` readiness race, which failed roughly one run in two, replaced with a deterministic condition rather than retries: an authenticated connection at the container network name, which the temporary initdb mongod cannot satisfy                                    | 11/11 cold starts via `scripts/smoke-mongo-init.sh`                      |
| MongoDB, Redis, RabbitMQ and Prometheus rebound to `127.0.0.1`; Grafana, mongo-express and redis-commander moved to an opt-in overlay                                                                                                                                         | Compose validated in four scenarios                                      |
| Semgrep gate now runs on push, not pull requests only                                                                                                                                                                                                                         | Job `Semgrep SAST` in `codeql-analysis.yml`                              |
| Gradle/Android dependency monitoring added                                                                                                                                                                                                                                    | `.github/dependabot.yml`, +25/-0, 9 entries, schema-validated            |

**Note on the backend API port.** `3000` remains bound on all interfaces,
deliberately and with the reason recorded in `docker-compose.yml`:
`apps/mobile/.env.example` documents real-device testing against the host's LAN
IP. Accepted local-development exposure, not an oversight.

---

## 2. Findings triaged, not suppressed

All 16 High and Medium Snyk Code findings were individually traced to source.
**None required a code fix.** Nothing was suppressed: there is no `.snyk` policy
file, no Snyk or Semgrep rule was weakened, and no path was excluded from
scanning. The report still shows every finding.

- **12 verified false positives** — 4 NoSQL-injection reports whose tainted
  value is the MongoDB driver's own `ObjectId` return value, plus Swagger
  examples, cookie names, Keychain and storage key names, and a Tailwind regex.
- **4 accepted development-only risks** — recorded with owner and review trigger
  in [`code-scan-risk-acceptances.md`](./code-scan-risk-acceptances.md).

Full reasoning, data flows and evidence are in that document rather than
duplicated here.

**Test fixtures were not waved through.** All 68 `/test`-rule findings are LOW
and every file carrying them is a spec or test file. That they cannot reach
production was proven against real artifacts with positive controls, not
asserted: the backend `dist/` contains 528 compiled files and zero
`.spec.js`/`.test.js`, and the R8-minified release JS bundle contains none of
the test or dev literals — including `devSessionBlockedReason`, the dev guard's
own identifier, whose absence shows the module is not merely unreachable but not
shipped.

---

## 3. Deferred

**`kotlin-stdlib 2.0.21: DEFERRED`** — `SNYK-JAVA-ORGJETBRAINSKOTLIN-2393744` /
CVE-2020-29582, CVSS 3.3 LOW.

Transitive; no declaration exists, only three `force(...)` version pins. Reached
via `:react-native-gesture-handler`, `:react-native-keychain`,
`:react-native-safe-area-context`, `:react-native-webview`, and
`androidx.transition` through `com.google.android.material`.

**Justification.** The vulnerable API is removed from the shipped R8 artifact:
`Lkotlin/io/FilesKt`, `createTempDir` and the entire `Lkotlin/io/` package are
stripped, with only `Lkotlin/jvm/internal` remaining. The advisory is LOW
severity and requires local device access. Upgrading Kotlin independently would
create toolchain and compiler alignment risk, because
`gradle.properties:kotlinVersion` drives the compiler plugin as well as the
stdlib and the two must move together.

---

## 4. Unverified coverage

**`Snyk OSS: UNVERIFIED — quota unavailable`.** The monthly private-test quota
was exhausted mid-workstream. The post-netty result of 19 unique vulnerabilities
reducing to 4 is **derived** from comparing each advisory's `fixedIn` against
the versions Gradle actually resolves. It is not a scan, and OSS is not
described as clean.

To verify once quota resets:

```bash
snyk test --all-projects --severity-threshold=low \
  --json-file-output=snyk-oss-after.json
```

Compare unique vulnerability IDs, severity distribution, vulnerable-path counts,
and fixed/introduced deltas, with Gradle and pnpm reported separately.

| Ecosystem        | Independent coverage                                                                                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm / pnpm       | Covered. `pnpm audit --audit-level=high` in two CI workflows, exit 0 with 3 explicitly ignored advisories documented in `.claude/rules/dependencies.md`, plus Dependabot weekly across six directories |
| Gradle / Android | Previously uncovered. Now monitored by the new Dependabot `gradle` entry for `/apps/mobile/android`                                                                                                    |

---

## 5. Verification results

All figures below were produced by the runs recorded in this workstream.

| Gate                            | Result                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| Backend tests                   | 103 suites, 1659 tests pass                                                        |
| Mobile tests                    | 124 suites, 1935 tests, 422 snapshots pass                                         |
| Type-checks                     | backend, mobile and web clean                                                      |
| Lint                            | backend 0 errors, mobile clean                                                     |
| Semgrep                         | 17 rules, 1430 targets, 0 findings, exit 0                                         |
| Snyk Code                       | 90 total: 13 HIGH, 3 MEDIUM, 74 LOW — all High and Medium triaged, 0 require a fix |
| `pnpm audit --audit-level=high` | exit 0                                                                             |
| Android build                   | debug and R8 release both succeed                                                  |
| Android resolution              | `io.netty` 123 references at 4.1.137.Final; `kotlin-stdlib` 2.0.21                 |
| Mongo cold start                | 11/11 runs: exit 0, writable PRIMARY, app user present                             |
| Compose validation              | core stack, tools overlay, and fail-loud-when-unset all correct                    |
| Dependabot config               | YAML and schema valid, 9 entries                                                   |
| `git diff --check`              | clean                                                                              |

**Change set:** 16 files modified, 12 files added.

---

## 6. Post-closure items

Carried forward explicitly. None blocks the current scope.

1. **Run the Snyk OSS scan when quota resets**, using the command in section 4,
   and compare Gradle and pnpm separately.
2. **Re-evaluate `kotlin-stdlib`** when the React Native or Android toolchain
   changes, or if the R8 keep-rules change such that `kotlin/io/` survives
   minification.
3. **Continue Dependabot monitoring** for Gradle/Android. Review its pull
   requests rather than auto-merging: Kotlin in particular must move together
   with the compiler plugin.
4. **Re-open this workstream** if a new HIGH or CRITICAL finding appears, or if
   release or build configuration changes materially.

Two smaller items also remain outside this scope and were deliberately not
changed: `REDIS_PASSWORD` and `RABBITMQ_URL` are still literals in
`docker-compose.yml`, mitigated by loopback binding rather than parameterised;
and the `Semgrep SAST` job must be marked a required status check in branch
protection, which no workflow file can do for itself.
