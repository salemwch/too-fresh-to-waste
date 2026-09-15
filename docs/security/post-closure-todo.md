# Post-Closure TODO

**Workstream state:**
`SECURITY REMEDIATION COMPLETE FOR CURRENT VERIFIED SCOPE — 4 POST-CLOSURE ITEMS REMAIN TRACKED`
(closed 2026-09-10, see
[`closure-2026-09-10-remediation.md`](./closure-2026-09-10-remediation.md))

That wording is deliberate. The closed scope is the work that was verified, not
the whole of security hardening. Two of the four items below are unverified
coverage rather than known-clean, and one is held in place only by a mitigation
that must not be removed.

These are the only items outstanding. None blocks the closed scope. Do not
reopen the remediation workstream for these; reopen only if a new HIGH or
CRITICAL finding appears, or if release/build configuration changes materially.

Each entry records what is true today and what would finish it. No remediation
is proposed beyond what has already been established.

---

## P0 — Require the Semgrep gate in branch protection

**Status:** Not done. The job runs and blocks at ERROR severity, but it is not a
required status check, so a merge can proceed without it.

**Why still open:** A workflow file cannot mark itself required. This is a
GitHub repository setting only a maintainer with admin rights can apply.

**Trigger for completion:** Branch protection on the default branch lists
`Semgrep SAST` under required status checks.

**Relevant workflow:** `.github/workflows/codeql-analysis.yml`, job id
`semgrep`, job name **`Semgrep SAST`** (the exact context string to select). The
job-level `if:` that previously restricted it to pull requests was removed, so
it now runs on `push`, `pull_request` and `schedule`.

---

## P1 — Run the Snyk OSS scan when quota resets

**Status:** `UNVERIFIED — quota unavailable`. The monthly private-test quota was
exhausted mid-workstream.

**Why still open:** The post-remediation figure of 19 unique vulnerabilities
reducing to 4 is **derived**, computed by comparing each advisory's `fixedIn`
against the versions Gradle actually resolves. It is not a scan result.

**Trigger for completion:** The command below exits successfully and its output
is compared against the derived baseline in the closure record.

```bash
snyk test --all-projects --severity-threshold=low \
  --json-file-output=snyk-oss-after.json
```

Review **pnpm and Gradle separately**, comparing unique vulnerability IDs,
severity distribution, vulnerable-path counts, and fixed/introduced deltas.

**Do not mark OSS verified until the scan actually succeeds.** A partial or
quota-limited run is not a pass.

**Relevant files:** `.claude/rules/dependencies.md` (accepted advisories),
`docs/security/closure-2026-09-10-remediation.md` §4 (derived baseline).

---

## P1 — Parameterise the remaining Redis and RabbitMQ literals

**Status:** Still literals. Exposure is mitigated but the values are unchanged.

**Why still open:** Deliberately left during remediation. The instruction was
not to modify these credential values, so the exposure was closed structurally
instead: all four services now bind `127.0.0.1` only, and container-to-container
traffic never touches a published port.

**Preserve the loopback-only mitigation until this hardening lands.** It is the
control currently doing the work.

**Trigger for completion:** Each value below reads from the environment with no
committed default, `.env.example` documents the new variables, and the compose
stack still starts.

**Relevant file:** `docker-compose.yml`

| Line    | Literal                                                                         | Side             |
| ------- | ------------------------------------------------------------------------------- | ---------------- |
| 172     | `--requirepass redis_dev_password`                                              | Redis server     |
| 306     | `REDIS_PASSWORD: redis_dev_password`                                            | backend consumer |
| 201-202 | `RABBITMQ_DEFAULT_USER: admin` / `RABBITMQ_DEFAULT_PASS: rabbitmq_dev_password` | RabbitMQ server  |
| 310     | `RABBITMQ_URL: amqp://admin:rabbitmq_dev_password@rabbitmq:5672/foodwaste`      | backend consumer |

**Constraint to observe:** each credential appears on both a server side and a
consumer side. They must change together or the stack fails to connect. Do not
change runtime behaviour beyond the substitution.

Note that `apps/food-waste-backend/.env.example:164` also carries
`amqp://admin:rabbitmq_dev_password@localhost:5672/foodwaste` and will need the
same treatment.

---

## P2 — Re-evaluate `kotlin-stdlib 2.0.21`

**Status:** `DEFERRED`, justification recorded in the closure record §3.

**Why still open:** `SNYK-JAVA-ORGJETBRAINSKOTLIN-2393744` / CVE-2020-29582 is
open against the resolved version. It is not fixed; it is assessed as not
reachable in the shipped artifact. The vulnerable API (`Lkotlin/io/FilesKt`,
`createTempDir`, the whole `Lkotlin/io/` package) is stripped by R8 from the
release build, the advisory is CVSS 3.3 LOW requiring local device access, and
upgrading Kotlin independently would create compiler/stdlib alignment risk.

**Trigger for re-evaluation — any one of:**

1. React Native or AGP requires a Kotlin version bump, making the upgrade
   necessary anyway.
2. R8 keep-rules or `proguard-rules.pro` change such that `kotlin/io/` survives
   minification. Re-check by extracting `classes*.dex` from an
   `assembleDevRelease` build and searching for `Lkotlin/io/FilesKt` with a
   positive control (`Lkotlin/jvm/internal`) to prove the search works.
3. A call site for `createTempDir`/`createTempFile` is introduced in
   `apps/mobile`.

**Relevant files:** `apps/mobile/android/gradle.properties:69`
(`kotlinVersion=2.0.21`, drives the compiler plugin as well as the stdlib), and
`apps/mobile/android/build.gradle:160-162` (the three `force(...)` pins). These
must move together.
