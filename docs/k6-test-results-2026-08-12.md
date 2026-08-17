# k6 Test Results — 2026-08-12

## What was built

A complete k6 performance and concurrency testing suite for the Too Fresh To
Waste backend, designed around two principles:

1. **Load tests** (`journeys/`) model real users with think-time and measure
   latency — they don't assert correctness.
2. **Functional tests** (`smoke/`) assert correctness with no think-time — they
   don't measure latency.

Suites compose these into CI gates and capacity profiles.

## Suites available

| Suite           | File                    | Purpose                                           | CI gate? |
| --------------- | ----------------------- | ------------------------------------------------- | -------- |
| **gate**        | `suites/gate.js`        | Per-endpoint latency regression                   | Yes      |
| **concurrency** | `suites/concurrency.js` | Correctness under simultaneous requests           | Yes      |
| **capacity**    | `suites/capacity.js`    | Find the breakpoint (ramp to failure)             | No       |
| **soak**        | `suites/soak.js`        | 2h — leaks, pool exhaustion, token refresh        | No       |
| **spike**       | `suites/spike.js`       | Burst survival and recovery                       | No       |
| **rate-limit**  | `suites/rate-limit.js`  | Asserts the throttler still fires                 | Yes      |
| **smoke**       | `smoke/all-modules.js`  | Post-deploy functional check (9 endpoint modules) | No       |

## What was run and results

### Environment

- **Host**: Windows 10, Docker Desktop (WSL2)
- **Stack**: `docker compose up -d mongodb mongo-init redis backend`
- **MongoDB**: single-node replica set (rs0) — required for transactions
- **Payment provider**: `PAYMENT_PROVIDER=stub` (deterministic, no external
  calls)
- **Throttle**: `THROTTLE_LIMIT=10000` (load-test override)
- **Database**: clean (wiped before run)

### Concurrency suite — PASS (all 18 assertions)

**HTTP-level assertions (k6)**

| #   | Scenario                          | VUs | Result                                                |
| --- | --------------------------------- | --- | ----------------------------------------------------- |
| 1   | Last bag race                     | 50  | Exactly 1 order accepted, 49 refused cleanly (no 5xx) |
| 2   | Duplicate webhook                 | 20  | All 20 acked, only 1 processed                        |
| 3   | Duplicate pickup confirmation     | 5   | At most 1 succeeded                                   |
| 4   | Concurrent order completions      | 20  | All landed without error                              |
| 5   | Concurrent donation contributions | 20  | All landed, rotation fired once                       |

**Database-level assertions (verify-loadtest-invariants.ts)**

| #   | Invariant                                          | Result |
| --- | -------------------------------------------------- | ------ |
| 1   | No offer has negative stock                        | PASS   |
| 2   | Every paid order has a matching paid attempt       | PASS   |
| 3   | No attempt was paid twice                          | PASS   |
| 4   | Platform transactions balance to order totals      | PASS   |
| 5   | No duplicate referrals per friend                  | PASS   |
| 6   | Referral bonuses match completed referrals         | PASS   |
| 7   | No pool lists the same completed goal twice        | PASS   |
| 8   | Each goal has at most one pool per season          | PASS   |
| 9   | Funded pool capped at target                       | PASS   |
| 10  | Overflow carried forward correctly                 | PASS   |
| 11  | Exactly one ACTIVE pool exists                     | PASS   |
| 12  | Goal sequence is contiguous                        | PASS   |
| 13  | Season numbers are monotonically increasing        | PASS   |
|     | Total donation amount matches sum of contributions | INFO   |

### Donation rotation verified live

The concurrency suite exercised real donation rotation under load:

- ~7 concurrent order completions crossed the TSHIRTS target simultaneously
- Exactly one rotation occurred (atomic ACTIVE→FUNDED compare-and-set)
- TSHIRTS pool: capped at 3000/3000 TND (FUNDED)
- PANTS pool: created at goalIndex 1, holding 0.486 TND overflow
- `completedGoals` correctly carried forward

## Bugs found and fixed

| Bug       | Severity     | Description                                                       | Fix                                                           |
| --------- | ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------- |
| **BUG-1** | Medium       | Duplicate friend referrals under concurrent registrations         | Atomic `findOneAndUpdate` with `$ne` filter                   |
| **BUG-2** | Medium       | Referral bonus paid twice when two pickups confirmed together     | `$inc` on positional element + atomic PENDING→COMPLETED claim |
| **BUG-3** | **Critical** | Donation pool double-rotation credits money nobody donated        | Atomic ACTIVE→FUNDED CAS; overflow from pre-image             |
| **BUG-4** | **Critical** | Docker image has no zstd binary — zero MongoDB queries work       | `pnpm -r rebuild` + build-time `.node` assertion              |
| **BUG-5** | High         | PM2 cluster creates N duplicate ACTIVE donation pools             | Unique partial index + E11000 tolerance                       |
| **BUG-6** | **Critical** | Online payment settlement always throws (missing `ordered: true`) | Add `ordered: true` to multi-doc `create()` in transaction    |
| **BUG-7** | Medium       | Dashboard templates duplicated on cluster boot                    | `updateOne` + `$setOnInsert` + upsert                         |

Additionally: stub payment service had a 1000× amount inflation (double
`toMillimes()` call), which would have made every stubbed payment fail silently.

## Files changed (4 commits)

### Commit 1 — `fix: resolve 7 concurrency bugs` (11 files)

- `src/common/utils/mongo.utils.ts` — shared `isDuplicateKeyError` helper
- `src/donations/donations.service.ts` — atomic rotation, E11000 tolerance
- `src/donations/schemas/donation-pool.schema.ts` — unique partial index
- `src/analytics/services/dashboard.service.ts` — upsert for templates
- `src/loyalty/services/gamification.service.ts` — atomic referral ops
- `src/payments/services/konnect-order.service.ts` — `ordered: true`
- `scripts/migrations/dedupe-active-donation-pools.ts` — dedupe migration
- 4 regression test files

### Commit 2 — `feat: payment provider factory` (8 files)

- `src/subscription/services/payment-provider.factory.ts` — factory
- `src/subscription/services/stub-payment.service.ts` — stub provider
- `src/subscription/services/konnect.service.ts` — interface extraction
- `src/subscription/subscription.module.ts` — factory wiring
- `Dockerfile` — recursive rebuild + artefact assertion
- `docker-compose.yml` — env var passthrough
- `package.json` — seed/verify scripts
- Factory spec (26 tests)

### Commit 3 — `feat: k6 suite` (41 files)

- `tests/k6/` — entire suite (lib, config, journeys, smoke, suites, fixtures)
- `scripts/seed-loadtest.ts` — fixture seeder with HTTP-driven settlement
- `scripts/verify-loadtest-invariants.ts` — database invariant checker
- Deleted old non-functional scaffold

### Commit 4 — `ci: perf-concurrency gate` (3 files)

- `.github/workflows/backend-ci-cd.yml` — index-before-boot + concurrency step
- `CLAUDE.md` — cluster race, envelope, login docs
- `.gitignore` — k6 results directory

## How to run

```bash
# 1. Start stack
docker compose up -d mongodb mongo-init redis backend

# 2. Create indexes (must happen before backend processes first boot)
DATABASE_URL="mongodb://admin:password123@localhost:27017/foodwaste?authSource=admin&replicaSet=rs0&directConnection=true" \
  pnpm --filter @foodwaste/backend db:create-indexes

# 3. Seed fixtures
ALLOW_LOADTEST_SEED=true PAYMENT_PROVIDER=stub \
  pnpm --filter @foodwaste/backend seed:loadtest

# 4a. Regression gate
k6 run tests/k6/suites/gate.js --env ENV=docker

# 4b. Concurrency correctness
k6 run tests/k6/suites/concurrency.js --env ENV=docker

# 5. Verify database invariants (required after concurrency suite)
pnpm --filter @foodwaste/backend verify:loadtest-invariants
```

On Windows: `.\tests\k6\run.ps1 gate` or `.\tests\k6\run.ps1 concurrency` wraps
steps 4+5.

## What's not yet done

| Item                                       | Why                                           | Next step                                       |
| ------------------------------------------ | --------------------------------------------- | ----------------------------------------------- |
| **Threshold calibration**                  | No staging environment yet                    | Run gate 3× on staging, set p95×1.3             |
| **Capacity/soak/spike runs**               | Need staging (not meaningful on local Docker) | Provision staging on Render + Atlas             |
| **Production Dockerfile check**            | Unknown if Render uses this Dockerfile        | Confirm build method; BUG-4/6 affect prod if so |
| **`pointsHistory`/`friendReferrals` caps** | Unbounded embedded arrays (16MB limit)        | Follow-up: cap with `$push`+`$slice` or extract |
