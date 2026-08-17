# k6 live-run validation — 2026-08-13

First end-to-end validation of the gate and concurrency suites against a running
stack. Six gate runs were needed; the first five each failed for a different
reason, and every one of those reasons was a real defect rather than a flaky
test.

## Environment

|          |                                                                        |
| -------- | ---------------------------------------------------------------------- |
| Stack    | `docker-compose.yml` + `docker-compose.loadtest.yml`                   |
| Backend  | PM2 cluster, 4 workers, `mem_limit: 3g`                                |
| Mongo    | single-node replica set `rs0`                                          |
| Host     | Docker Desktop on Windows, 7.8 GB VM                                   |
| Fixtures | 200 consumers, 20 merchants, 10 drivers, 20 establishments, 550 offers |

**Not a baseline.** This is a developer laptop, not staging.
`config/thresholds.js` still reads "Last baselined: NEVER" and that remains true
— the numbers below say the suite works, not what production latency should be.

## Final run — `suites/gate.js`, exit 0

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| Duration          | 3m24s                                                        |
| Iterations        | 2 747                                                        |
| HTTP requests     | 10 161 (49.7/s)                                              |
| Checks            | 100.00 %, zero failures                                      |
| `http_req_failed` | 0.00 %                                                       |
| Orders created    | 36, all 36 settled                                           |
| WebSocket         | transport / auth / namespace all 100 %                       |
| Thresholds        | 34 of 34 pass                                                |
| PM2               | 1 restart per worker (the reload), peak 630 MB, no recycling |

p95 by endpoint, in ms:

```
auth_login    536   offers_list      375   order_create    1053   merchant_orders  461
auth_me       167   offers_nearby   1785   order_detail     182   merchant_stats   253
auth_refresh  344   offers_urgent    175   payment_webhook  542   merchant_revenue 285
auth_logout    72   offer_detail     209   driver_location  123   search           103
detail        203   suggestions       97   driver_available 354   urgent           186
```

## `suites/concurrency.js` + invariant verifier — both pass

`order_accepted: 1` — exactly one of 50 simultaneous buyers wins the single-unit
offer. `unexpected_server_errors: 0`. All 155 checks pass. The verifier reports
19 invariants held, 2 informational.

## What the runs found

Each of these made a suite report success while testing nothing, which is the
failure mode the whole exercise exists to catch.

**1. Driver location returned 500 on every call.** Mongoose's schema defaults on
the nested `lastKnownLocation` subdocument strip `coordinates` and leave
`{ type: "Point" }`; the 2dsphere index rejects it. 39 of 39 checks failed —
this one at least was loud. Fixed by writing through `.collection`.

**2. The WebSocket auth timeout never closed the transport.**
`client.disconnect()` defaults to `disconnect(false)`, which sends a Socket.IO
namespace DISCONNECT and leaves TCP open. A client that keeps answering
Engine.IO pings holds a socket forever after failing authentication. Confirmed
with a raw ws client: frame at 30.0s, no close until the client gave up at 45s.

**3. `ws_namespace_connected` read 0 % while auth read 100 %.** The gateway's
connect middleware emits `authenticated` _before_ calling `next()`, so that
frame precedes the CONNECT ack. The journey closed on `authenticated` and
discarded the ack.

**4. The checkout journey had never created an order.** `GET /offers` serves
`OfferCardDto`, which has `id` and no `_id`. Every journey read `_id`, got
undefined, and hit its `if (!offer._id) return` guard. The gate recorded **25
443 of 25 443 checks passing** with zero samples on `order_create`,
`order_detail` and `payment_webhook`. Fixed with `docId()`, which accepts either
name, applied across every journey and smoke test.

**5. Orders were created and then abandoned.** `POST /orders` returns no
`paymentRef` and no `paymentSession` — the reference is the last path segment of
`payUrl`. The journey read two fields that do not exist.

**6. The seed drove the payment webhook at production.** `assertSafeTarget`
validated the database host and stopped there; `BACKEND_URL` in `.env` is the
Render URL. Production answered 404 to the stub references, which surfaced as
"Could not settle pickup order" and pointed nowhere near the cause. The guard
now covers both.

**7. PM2 recycled the cluster continuously under load.** No cgroup limit on the
backend service meant the resource detector fell back to
`max_memory_restart=512M` against a ~370 MB baseline. Seven restarts per worker
in one run, and a payment webhook that landed mid-recycle failed.

**8. Load-test env vars evaporated on every container recreate.** They existed
only as shell exports. `PAYMENT_PROVIDER` silently reverting to `konnect` is the
dangerous one — the webhook then goes to the real API and returns without
settling. `AUTH_RATE_LIMIT_THRESHOLD` reverting to 25/min killed a run at
`setup()` with "Could not authenticate any seeded user", which reads as a
missing seed. Both now live in `docker-compose.loadtest.yml`.

## Guards added so none of this can pass silently again

| Metric                          | Gate       | Catches                      |
| ------------------------------- | ---------- | ---------------------------- |
| `checkout_no_purchasable_offer` | `count==0` | empty or stale catalogue     |
| `checkout_missing_payment_ref`  | `count==0` | order created then abandoned |

`order_create_success` cannot do this job: it is a Rate, and a Rate with zero
samples satisfies `rate>0.99`.

## Known gaps

- **Thresholds are still uncalibrated.** Baseline against staging, three runs,
  then `node tests/k6/tools/baseline.js`.
- **The Docker image could not be rebuilt on this machine.** `apk add` fails
  reaching the Alpine CDN (`DNS: name does not exist`, package integrity
  errors). Both backend fixes were applied to the container's compiled output to
  validate them; the committed source is correct and the image needs a rebuild
  wherever the network permits.
- **`offers_nearby` p95 is 1785 ms** against a 3000 ms gate. It passes, but it
  is by far the slowest endpoint and the gate for it is the loosest in the file.
- **Subscription and notification submetrics recorded no samples** in the gate
  profile (`subscription_initiate`, `mark_read`, `notifications_list`). Those
  scenarios live in their own suites; worth confirming the gate's notification
  burst is reaching them.
