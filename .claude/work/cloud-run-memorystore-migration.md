---
status: draft
scope: backend
gate: pnpm --filter @foodwaste/backend check:all
---

## Intent

Move the backend from Render to Google Cloud Run (`europe-west9`, Paris) and
from the hosted Redis to Memorystore for Redis, keeping the public hostname
`api.toofreshtowaste.com` so the shipped mobile build
(`apps/mobile/.env.production` hardcodes it) and the Vercel web app keep
working. Render is retired, not run alongside. Smallest correct change: no
Terraform, no Kubernetes, no new CI.

## Constraints

- MongoDB is Atlas on AWS Paris (eu-west-3), database `toofreshtowaste`, already
  indexed and seeded (2026-10-04). Atlas network access is `0.0.0.0/0` for now.
- No real users. No data to migrate from the old Redis: its Bull jobs belong to
  the old database.
- `COMMISSION_MODEL_EFFECTIVE_AT=2026-10-04T00:00:00+01:00` (owner decision,
  2026-10-04). Required at boot in production.
- Secrets only in Secret Manager, pinned to a version number, never `latest`.
- The agent never runs a command that creates, changes or deletes cloud
  resources or DNS. Those go in the runbook; the owner runs them.
- `gcloud` is not installed on the dev machine yet.

## Facts verified (code)

| Fact                                                                                    | Where                                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `PROCESS_ROLE` gates only `@Cron`; Bull processors run in every process, API included   | `common/services/cron-lock.service.ts:92`, `config/process-role.ts` |
| The worker role still binds an HTTP port                                                | `config/process-role.ts:24`                                         |
| Container listens on `PORT`, image default 3000                                         | `Dockerfile:176`, `main.ts:551`, `ecosystem.config.js:149`          |
| PM2 forks 1 process below 2 CPUs                                                        | `config/container-resources.ts:161`                                 |
| Production tries HTTPS certs, falls back to HTTP (already the Render behaviour)         | `main.ts:129-152`                                                   |
| `trust proxy` = loopback, linklocal, uniquelocal only                                   | `main.ts:181`                                                       |
| All Redis clients (Bull, RedisService, throttler, Socket.IO) take TLS from one function | `redis/redis.config.ts:153` `buildRedisTlsOptions`                  |
| No CA option exists for Redis TLS today                                                 | `redis/redis.config.ts`                                             |
| Graceful shutdown force-exits at 10 s                                                   | `main.ts:595`                                                       |

## Facts verified (Google docs)

| Fact                                                                                                                                                          | Source                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Request-based billing: CPU only during requests. Instance-based + min instances is the documented setup for background work                                   | https://docs.cloud.google.com/run/docs/configuring/billing-settings                 |
| Memorystore default `maxmemory-policy` is `volatile-lru`; `noeviction` is supported                                                                           | https://docs.cloud.google.com/memorystore/docs/redis/supported-redis-configurations |
| In-transit encryption: port 6378, client must trust the instance CA, **can only be enabled at creation and cannot be disabled**                               | https://docs.cloud.google.com/memorystore/docs/redis/manage-in-transit-encryption   |
| Direct VPC egress needs a /26+ subnet; with Cloud NAT, cold starts can be 30 s+                                                                               | https://docs.cloud.google.com/run/docs/configuring/vpc-direct-vpc                   |
| WebSockets: 60 min max timeout, session affinity is best effort, Memorystore pub/sub recommended across instances                                             | https://docs.cloud.google.com/run/docs/triggering/websockets                        |
| Domain mapping is Preview, "not production-ready", and **not available in europe-west9**. Global external Application Load Balancer is the recommended option | https://docs.cloud.google.com/run/docs/mapping-custom-domains                       |
| SIGTERM then SIGKILL after 10 s                                                                                                                               | https://docs.cloud.google.com/run/docs/container-contract                           |
| Secrets as env vars resolve at startup; pin a version; SA needs `roles/secretmanager.secretAccessor`                                                          | https://docs.cloud.google.com/run/docs/configuring/services/secrets                 |
| Behind the LB, `X-Forwarded-For` = `[supplied,]<client-ip>,<lb-ip>`                                                                                           | https://docs.cloud.google.com/load-balancing/docs/https                             |

## Decisions

2026-10-04, phase 1. Each with the alternative rejected.

1. **One Cloud Run service `tftw-backend`, `PROCESS_ROLE=all`, instance-based
   billing, min 1 / max 1, 1 vCPU / 2 GiB.** Bull processors run in every
   process, so any instance with request-based billing would stall mid-job and
   Bull would re-run the job as stalled. One always-on instance is the Render
   setup without the split, and needs no code change. Rejected: API
   (request-based) + worker split - needs Bull processors gated by role first,
   which is new code for traffic that does not exist yet. Revisit when one
   instance is not enough. 2 GiB because Render needed `starter` (2 GB) for the
   ~370 MB baseline; memory is the cheap part of the bill.
2. **Keep PM2 and the current `CMD`.** With 1 vCPU it forks exactly one process;
   it still gives memory recycling and signal handling. Rejected:
   `node dist/main.js` directly - a Dockerfile change with no gain now.
3. **Memorystore for Redis, Basic tier, 1 GB, Redis 7.2, `europe-west9`, AUTH
   on, in-transit encryption on, `maxmemory-policy=noeviction`.** `noeviction`
   because Bull loses jobs under eviction. TLS because it cannot be added later.
   Rejected: no TLS (zero code change, but irreversible); Standard HA (2x cost,
   no users); Redis Cluster / Valkey cluster mode (Bull needs a single node).
4. **Add `REDIS_TLS_CA` (PEM) to `buildRedisTlsOptions`.** One function feeds
   all four clients, so one change covers them. Chain verification against the
   instance CA is the protection; `REDIS_TLS_CHECK_SERVER_IDENTITY=false` only
   if the certificate has no IP SAN (to be checked on the real instance).
   Rejected: `REDIS_TLS_REJECT_UNAUTHORIZED=false` - encryption without
   authentication.
5. **Direct VPC egress, `private-ranges-only`, dedicated /26 subnet.** Redis is
   on a private IP; Atlas stays on the public path, so no Cloud NAT and no NAT
   cold-start penalty. Rejected: Serverless VPC Access connector (an always-on
   VM pair to pay for); static IP via Cloud NAT (only needed for a strict Atlas
   allowlist - later).
6. **Global external Application Load Balancer + serverless NEG + Google-managed
   certificate for `api.toofreshtowaste.com`; Cloud Run ingress
   `internal-and-cloud-load-balancing`.** The only GA way to keep the hostname
   in europe-west9. Rejected: domain mapping (not in this region, Preview);
   moving to europe-west1 for domain mapping (Preview, "not production-ready");
   Firebase Hosting rewrite (no WebSockets).
7. **`trust proxy` additionally trusts the LB's reserved IP, from a new
   `TRUSTED_PROXY_IPS` env var.** Behind the LB the rightmost hop is the public
   LB IP, which today's rule does not trust, so every user would share one
   `req.ip` and the per-IP login limit would lock everyone out together. Entries
   left of `<client-ip>` stay untrusted, so spoofing gains nothing. Rejected:
   `trust proxy = true` (trusts a client-supplied header). Must be proven on the
   deployed service (see Tasks).
8. **Socket.IO: request timeout 3600 s, session affinity on.** Redis adapter
   already exists (`main.ts:567`).
9. **Dedicated service account `tftw-backend-sa`** with Secret Accessor on its
   own secrets only. Rejected: default compute SA (project Editor).
10. **Build with Cloud Build from a small `cloudbuild.yaml`** (repo root
    context, `apps/food-waste-backend/Dockerfile`), image tagged with the commit
    SHA in Artifact Registry `europe-west9`; deploy by that tag. Rejected:
    `gcloud run deploy --source` (expects a root Dockerfile); GitHub continuous
    deploy (later, separately).
11. **Startup probe on `/health/liveness`** with a generous failure threshold,
    because Direct VPC can delay first connections.
12. **Commission cutoff `2026-10-04T00:00:00+01:00`** as a plain env var (not a
    secret). The new database has no orders, so every real sale uses the new
    model.
13. **2026-10-04 - Deferred until the official launch (owner decision).** The
    ~$105-110/month estimate is not justified before launch. Render and the
    current Redis stay; Render now points at the new Atlas database. Nothing in
    this plan was implemented. Resume from here at launch: re-check the cost
    table and the Google docs facts first, since both can change.

## Cost estimate (approximate, verify in the pricing calculator)

| Item                                                                         | Approx. per month               |
| ---------------------------------------------------------------------------- | ------------------------------- |
| Cloud Run, 1 vCPU / 2 GiB always on, instance-based, Tier 1, after free tier | ~ $50                           |
| Memorystore Basic 1 GB                                                       | ~ $35-40 [unverified for Paris] |
| Load balancer forwarding rule ($0.025/h)                                     | ~ $18                           |
| Secret Manager, Artifact Registry, Cloud Build                               | ~ $1-2                          |
| **Total**                                                                    | **~ $105-110**                  |

## Tasks & Acceptance

Code (agent, after approval):

- [ ] T1 `REDIS_TLS_CA` in `redis.config.ts` + `env.validation.ts` +
      `.env.example`; accepts real newlines and `\n`-escaped PEM. Tests in
      `redis.config.spec.ts`: CA present -> `ca` set on all client builders;
      absent -> unchanged; TLS off -> ignored.
- [ ] T2 `TRUSTED_PROXY_IPS` as a pure, tested function used by `main.ts:181`;
      empty -> exactly today's list; invalid entry -> boot fails (env
      validation).
- [ ] T3 `cloudbuild.yaml`.
- [ ] T4 `docs/deploy/cloud-run-runbook.md` with every gcloud command in order,
      including rollback.
- [ ] T5 Gate passes; Docker image builds; adversarial review.

Infra (owner runs the runbook):

- [ ] I1 Enable APIs, Artifact Registry, service account
- [ ] I2 VPC subnet /26 in europe-west9, Memorystore instance (decision 3)
- [ ] I3 Secrets created, versions pinned
- [ ] I4 Build + deploy `tftw-backend`; `/health/liveness` 200 on the run.app
      URL before ingress is restricted
- [ ] I5 LB + cert + DNS for `api.toofreshtowaste.com`
- [ ] I6 **Proof of decision 7:** one failed login from a known IP -> the
      AuthSecurityService log shows that IP, not the LB IP
- [ ] I7 Vercel `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` point at
      `https://api.toofreshtowaste.com` (local `apps/web/.env` still has
      `toofreshtowaste.onrender.com`); Konnect webhook URL; `CORS_ORIGINS`
- [ ] I8 `audit:commission-cutoff` exits 0
- [ ] I9 Suspend Render; after a week of green, delete `render.yaml` (ask first)

## Open questions

- (blocking) Owner accepts the ~$105-110/month estimate, or chooses to trade
  something away (see decisions 1, 3, 6).
- (non-blocking) Whether the Memorystore certificate carries an IP SAN - decides
  `REDIS_TLS_CHECK_SERVER_IDENTITY`. Checked on the real instance.
