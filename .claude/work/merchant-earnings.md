---
status: ready-for-dev
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:ts && backend jest + test:db && pnpm
  --filter @foodwaste/web type-check && web jest && check:design && pnpm
  check:lockfile
---

# Merchant earnings: one calculation, one period, every screen

## Intent

A merchant must see all the money their food business made - cash and online
together - for a period they choose, and see the same figure on the Dashboard,
the Payments tab, the chart and Analytics. Today the dashboard's money card only
shows online money TFTW holds (a cash-only merchant sees `0.000`), the Payments
total misses completed online sales and counts the delivery fee, and three
aggregations compute "merchant earnings" with two different fallbacks. This
replaces all of that with one backend calculation and one period selector.

## Constraints

- **One calculation.** The earnings population, the per-order amount, the
  payment-method split and the completion time are defined once, in the backend,
  and every figure is built from them. No second calculation in the browser or
  in another service.
- **Food only.** The delivery fee is the driver's (delivery financial flow) and
  never enters merchant earnings. `pricing.total` is never read.
- **Frozen decisions are the truth.** Amounts come from the persisted commission
  decision (`order.commission`), never recomputed.
- **No silent guesses after the cutoff.** A post-cutoff sale without a frozen
  decision is a data-integrity failure, excluded and reported, never estimated.
- **Server-side periods in `Africa/Tunis`.** The browser sends a period name,
  never dates.
- Existing patterns: `$match` on `merchantId` (or `establishmentId` for
  LOCATION_MANAGER, never falling through to "all"), `TimezoneUtil`, `appError`
  codes, `BackendEnvelope`, next-intl in en / fr / ar with RTL, DESIGN.md
  tokens, empty / loading / error states on every card.

## Definitions (the shared module)

New module `apps/food-waste-backend/src/orders/utils/merchant-sales.ts`. It
replaces `today-sales.util.ts`, `ORDER_MERCHANT_AMOUNT_EXPR` and
`MERCHANT_EARNINGS_EXPR`.

### Commission-completed time (`COMMISSION_MOMENT_EXPR`)

The single source of truth for when a sale completes for commission purposes. It
is defined by the business completion event on the order, not by
`commission.appliedAt`:

| Fulfilment                 | Moment                                                         |
| -------------------------- | -------------------------------------------------------------- |
| `deliveryMode: 'delivery'` | `driverPickedUpAt` (the driver collecting from the merchant)   |
| pickup                     | `pickedUpAt`, falling back to `pickupDetails.actualPickupTime` |

The cutoff boundary is exact: moment `< cutoff` is pre-cutoff; moment
`>= cutoff` with no decision is an integrity failure.

Every consumer uses this definition: the earnings population, the chart, the
Payments tabs, and `scripts/audit-commission-cutoff.ts`, which imports it
instead of its own copy. `CommissionService` does not read the order to find the
moment - its callers pass it - so the guarantee is at the two call sites, both
of which pass the same instant they write to the moment field in the same
update:

- pickup, `OrdersService.confirmPickup`: one `completedAt` for `pickedUpAt` and
  `appliedAt`;
- delivery, `DriverCashService.onMerchantPickup`: one `now` for
  `driverPickedUpAt` and `appliedAt`.

This is verified by the code today, not assumed: an integration test confirms a
pickup and a delivery through the real services and asserts
`order.commission.appliedAt` equals `COMMISSION_MOMENT_EXPR` evaluated on the
stored order. A change that lets the two drift fails it.

### Periods (`resolveSalesPeriod(period, now)`)

`period` is `today | 7d | 30d | month | all`; anything else is 400
`INVALID_PERIOD`. Returns `{ from: Date | null, to: Date, granularity }` in
`Africa/Tunis`:

| Period  | from                                | Chart granularity                      |
| ------- | ----------------------------------- | -------------------------------------- |
| `today` | today 00:00                         | hour (24 slots, 00-23)                 |
| `7d`    | 00:00 six days before today         | day (7 slots)                          |
| `30d`   | 00:00 twenty-nine days before today | day (30 slots)                         |
| `month` | the 1st, 00:00                      | day (1st to today)                     |
| `all`   | none                                | month (first sale month to this month) |

`to` is `now`. A sale is in the period when `from <= moment <= to`.

### Populations

Built on one base match: this merchant (scoped as today), `isDeleted != true`,
and a commission moment inside the period.

| Population         | Status                                | Decision                                 | Used by                                           |
| ------------------ | ------------------------------------- | ---------------------------------------- | ------------------------------------------------- |
| **Earnings**       | `PICKED_UP`, `COMPLETED`, `DELIVERED` | present, or absent and before the cutoff | every total, the chart, the default Payments tab  |
| **Refunded**       | `REFUNDED`                            | any                                      | Payments "Refunded" tab                           |
| **Being verified** | `PICKED_UP`, `COMPLETED`, `DELIVERED` | absent, at or after the cutoff           | `unverifiedOrders`, Payments "Being verified" tab |

Refunds:

- **Refunded after commission completion** (it has a moment): excluded from
  Earnings and shown in the Refunded tab, with its status and reason. Which
  period it belongs to is decided by its original commission moment, never by
  the refund timestamp.
- **Refunded before commission completion**: it was never a sale, has no moment,
  and appears in no tab.

Pending, failed, cancelled and expired orders appear in no tab.

### Per-order earned amount - three explicit cases

| Case                    | Condition                                                          | Earned                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Current model        | `commission` present                                               | `commission.merchantAmount` - the full food price on NORMAL, `subtotal - settled` on SETTLEMENT                                                   |
| 2. Legacy compatibility | no `commission`, moment **before** `COMMISSION_MODEL_EFFECTIVE_AT` | `pricing.merchantAmount` if persisted, else `round3(subtotal * 0.81)`, named `LEGACY_PRE_CUTOFF_MERCHANT_SHARE` and reachable only from this case |
| 3. Integrity failure    | no `commission`, moment **at or after** the cutoff                 | not an earning: the order is in the Being-verified population, contributes 0 to every total, and is logged                                        |

The cutoff comes from `COMMISSION_MODEL_EFFECTIVE_AT` via `ConfigService`
(parsed by `commission-cutoff.util.ts`), per environment:

| Environment | Cutoff                           | Behaviour                                                                                                                                                                     |
| ----------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| production  | required                         | fail closed: the backend refuses to boot without a valid value (already enforced in `env.validation.ts`); never falls back to the legacy model                                |
| staging     | required (**new**)               | same rule as production. Today `env.validation.ts` requires it only for `NODE_ENV=production`, so a staging deploy without it would silently run the legacy model. Fixed here |
| development | may be unset                     | unset = the model is inactive: orders without a decision are case 2, none is case 3, which is what `CommissionService` already does                                           |
| test        | injected explicitly by each test | every suite states its cutoff; both the active and the unset (inactive) behaviour are covered                                                                                 |

Commission and settlement figures (secondary on the card) come from the same
decision: `commission.accrued` (NORMAL) and `commission.settled` (SETTLEMENT); 0
for case 2.

### Payment method (exactly one per order)

| Condition                                | Line                                         |
| ---------------------------------------- | -------------------------------------------- |
| `paymentProvider === 'konnect'`          | `online` - Paid online                       |
| otherwise, `deliveryMode === 'delivery'` | `cashDelivery` - Cash collected via delivery |
| otherwise                                | `cashStore` - Cash collected in store        |

"Not Konnect" is the cash test, as today: cash orders carry no
`paymentProvider`. The three lines always sum to the total.

### Observability

When the Being-verified population is non-empty, the request reports it once
(never once per order), under the stable identifier
`MERCHANT_EARNINGS_UNVERIFIED_ORDERS`, with the structured fields
`{ code, merchantId, count, period, orderIds }` (`orderIds` capped at 20):

- a structured `logger.error`;
- an explicit `SentryService.captureMessage(..., 'error', ...)` with
  `fingerprint: ['MERCHANT_EARNINGS_UNVERIFIED_ORDERS']`, so every occurrence
  groups into one Sentry issue. `logger.error` alone does **not** reach Sentry
  here: `main.ts` registers no log integration. `captureMessage` gains an
  optional `fingerprint`; nothing else in `SentryService` changes.

`pnpm audit:commission-cutoff` keeps exiting 1 on the same orders, since it uses
the same moment. When the decision is restored, the order moves back to Earnings
on the next request with its persisted amount - nothing is cached per order.

## API

All merchant endpoints take `period` (default `month`) and the existing optional
`establishmentId`.

| Endpoint                             | Returns                                                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /orders/merchant-sales-summary` | `{ period, from, to, currency, total: { orders, earned, foodValue, originalValue }, channels: { cashStore, cashDelivery, online: { orders, earned } }, commission: { rate, accrued, settled }, unverifiedOrders }` |
| `GET /orders/merchant-sales-chart`   | `{ period, granularity, slots: [{ start, orders, earned }] }`, gap-filled, Tunis-time slot starts                                                                                                                  |
| `GET /payments/stats` (merchant)     | the summary's `total`, `channels` and `unverifiedOrders` - produced by the same function, not a copy                                                                                                               |
| `GET /payments/my-merchant-payments` | adds `period` and `tab = earnings \| refunded \| verifying` (default `earnings`); every row carries `earned`, the payment-method line, `commissionMoment`, and for the other tabs the reason                       |

Removed: `GET /orders/merchant-today-sales` (web is its only consumer; replaced
by `period=today`), the `revenue` series in the chart (`pricing.total` includes
the delivery fee), and the old merchant `getMerchantPaymentStatsFromOrders`
aggregation. `getOrderStats` ("Earned revenue" impact card), `getRevenueChart`
and `AnalyticsService.calculateCurrentBusinessMetrics` read the shared
population and amount.

**Invariants (tested):** for every period,
`sum(channels.*.earned) === total.earned`,
`sum(chart.slots.earned) === total.earned`,
`sum(earnings rows.earned) === total.earned`, and `/payments/stats` equals the
summary - each to the millime.

## Web

- `PeriodBar`: `Today | 7 Days | 30 Days | This Month | All Time`, default This
  Month, state in the URL (`?period=month`). Used by the Dashboard, Payments and
  Analytics (Analytics' `90d` option is replaced by the five). One bar per page
  drives every period-based figure on it.
- Dashboard: `TodaySalesCard` and `WalletBalanceCard` are replaced by
  `EarningsCard`:
  - **Your earnings - {period}**: total earned, order count, then the three
    payment-method lines.
  - **Money TFTW currently holds**, visually separate: Available for payout,
    Awaiting pickup. It reads the existing wallet endpoint; its query key has no
    period, so changing the period cannot change it.
  - Commission recorded and paid off by settlement orders, secondary.
  - When `unverifiedOrders > 0`: "N sales are being verified and are not
    included yet".
- Chart: earnings only, slots from the chart endpoint. Impact cards follow the
  period.
- Payments: the same `PeriodBar`, totals from `/payments/stats`, tabs Earnings
  (default) / Refunded / Being verified.
- Every new string in en / fr / ar in the same commit; the registration-chains
  test and `check:design` stay green; empty, loading and error states on every
  card; `staleTime` on every query; the period in the query key of period-based
  queries only.

## Tasks & Acceptance

- [ ] `merchant-sales.ts`: periods, moment, populations, three amount cases,
      payment-method line - unit-tested per case and per boundary.
- [ ] Audit script imports the shared moment; output unchanged on the same data.
- [ ] `env.validation.ts` requires `COMMISSION_MODEL_EFFECTIVE_AT` for `staging`
      as well as `production`; the env-validation spec covers production,
      staging, development and test.
- [ ] `SentryService.captureMessage` accepts an optional `fingerprint`; the
      unverified-orders report sends `MERCHANT_EARNINGS_UNVERIFIED_ORDERS`.
- [ ] Summary, chart, payments stats and list built on the shared module;
      `merchant-today-sales` and the two old expressions removed; every consumer
      migrated (grep proves none left).
- [ ] Real-Mongo suite: the invariants above for all five periods, plus the
      cases below.
- [ ] Web: `PeriodBar`, `EarningsCard`, chart, impact cards, Payments tabs,
      Analytics presets; en / fr / ar; RTL.
- [ ] Gates green; adversarial review lenses run; decisions recorded.

## Test strategy

**Unit (backend)**

- `resolveSalesPeriod`: each period at 00:00, 23:59 and 00:01 Tunis; the 1st of
  a month; the last day of a month; `all`; an unknown period -> 400.
- Payment method: one `describe.each` table over provider x fulfilment x method,
  each landing in exactly one line.
- Amount: case 1 NORMAL and SETTLEMENT; case 2 with and without
  `pricing.merchantAmount`; case 3 -> excluded.
- **Case 3 can never be 81%:** a post-cutoff order without a decision whose
  `subtotal * 0.81` would be a distinctive value (e.g. 12.345) - that value must
  appear in no total, no slot and no row, and `unverifiedOrders` must be 1.
- Cutoff boundary: an order whose moment is exactly the cutoff instant and has
  no decision is case 3; one millisecond earlier is case 2.
- Cutoff injected explicitly in every suite; with it unset (development) no
  order is case 3.
- Env validation: without `COMMISSION_MODEL_EFFECTIVE_AT`, `production` and
  `staging` are rejected; `development` and `test` pass.
- Refund period: a sale completed in one period and refunded in the next is in
  the first period's Refunded tab and neither period's Earnings.
- Observability: several unverified orders produce exactly one report per
  request, with the stable code, merchantId, count, period and at most 20 ids,
  and one `captureMessage` carrying the fingerprint.

**Integration (real replica set)** - seeded for two merchants: cash in store,
cash via delivery, online pickup, online delivery; NORMAL and SETTLEMENT;
refunded after completion; refunded before completion; pending, cancelled,
expired; case 2 with and without `pricing.merchantAmount`; case 3; a delivery
fee on every delivery; moments at 23:59 and 00:01 Tunis. For each of the five
periods:

- the four invariants;
- delivery fees contribute nothing;
- refunded, pending, cancelled and expired contribute nothing to Earnings;
  refunded-after-completion is in the Refunded tab, refunded-before is in none;
- case 3 is excluded, counted in `unverifiedOrders`, listed in Being verified,
  and logged once;
- restoring its decision moves it to Earnings with its persisted amount;
- a pickup confirmed through `OrdersService.confirmPickup` and a delivery picked
  up through `DriverCashService.onMerchantPickup` each store
  `commission.appliedAt` equal to `COMMISSION_MOMENT_EXPR` on the stored order;
- the other merchant's orders never appear; LOCATION_MANAGER sees only its
  establishment, and nothing without an assignment.

**Web**

- `EarningsCard`: the three lines and the total; the notice at
  `unverifiedOrders > 0`; loading / empty / error; changing the period does not
  refetch or change the held-money section.
- `PeriodBar`: default month, URL round trip, en / fr / ar and RTL.
- Payments: tabs, totals from the stats endpoint.

**Mutation checks** (each must fail a test): count `pricing.total`; include
REFUNDED; date by `createdAt`; drop a payment-method line; use 81% for a
post-cutoff order; ignore the cutoff; treat `moment == cutoff` as pre-cutoff;
date a refunded sale by its refund time; drop `staging` from the cutoff
requirement; report once per order instead of once per request; put the period
in the held-money query key.

## Decisions

- 2026-09-26: Period presets `Today | 7 Days | 30 Days | This Month | All Time`,
  default This Month, one bar per page (user).
- 2026-09-26: Card = "Your earnings" (period) + "Money TFTW currently holds"
  (live, period-independent); "Cash collected via delivery" wording; commission
  secondary (user).
- 2026-09-26: Earnings are food only, from the frozen decision, attributed to
  the commission moment, refunded excluded, the three lines reconcile (user).
- 2026-09-26: 81% only as an isolated legacy case for pre-cutoff orders without
  a decision; post-cutoff without a decision is an integrity failure, never 81%
  (user; corrects the earlier proposal of 81% as a general fallback).
- 2026-09-26: Integrity failures are excluded, counted in `unverifiedOrders`,
  shown as a notice and logged; the request never fails and no amount is assumed
  (user). Rejected: fail the request (one bad order blanks the dashboard); count
  100% (a SETTLEMENT would be over-counted).
- 2026-09-26: Payments tabs Earnings / Refunded / Being verified; the Earnings
  rows reconcile to the total (user). Rejected: one mixed list.
- 2026-09-26: The commission moment for a delivery is `driverPickedUpAt`, for a
  pickup `pickedUpAt` then `pickupDetails.actualPickupTime`, shared with the
  cutoff audit (existing model definition).
- 2026-09-26: No schema change, no new index: the moment is an expression, and
  every query matches `merchantId` / `establishmentId` and `status` first, which
  the existing `{ merchantId, status, createdAt }` and
  `{ establishmentId, status, createdAt }` indexes serve. Revisit if a
  merchant's order count makes the summary slow.
- 2026-09-26: Spec lives in `.claude/work/` (project `work-state.md` rule), not
  `docs/superpowers/specs/`.
- 2026-09-26 (engineering review, each point checked against the code):
  - Refunds: after commission completion -> Refunded tab, period by the original
    moment, never the refund time; before completion -> no tab. The first
    draft's "a refunded sale leaves the earnings of the period it was completed
    in" was ambiguous and is replaced.
  - The moment is defined by the business completion fields, not as "equal to
    `commission.appliedAt`". Verified: both commission call sites
    (`order.service.ts` confirmPickup, `driver-cash.service.ts`
    onMerchantPickup) write the moment field and `appliedAt` from one instant,
    so they are equal today; a test now holds that. Exact boundary: `< cutoff`
    pre, `>= cutoff` with no decision is an integrity failure.
  - The cutoff is required in staging too. Verified gap: `NODE_ENV` accepts
    `staging`, but the rule required the cutoff only for `production`.
    Production already fails closed.
  - Correction of the first draft: it claimed `logger.error` reaches Sentry. It
    does not (no log integration in `main.ts`). The report now calls
    `SentryService.captureMessage` explicitly, with the stable fingerprint
    `MERCHANT_EARNINGS_UNVERIFIED_ORDERS`.
- 2026-09-26: `merchant-today-sales` is removed only after a repo-wide grep
  shows no consumer left (engineering review).

- 2026-09-26 (plan review, user + engineer, checked against the code):
  - Chart: the main line is merchant earnings in TND; bags stay in the tooltip.
    (Today's chart plots bags.)
  - **A merchant never sees or receives delivery money** - no delivery fee, no
    customer total, no driver earnings, under any name ("Total revenue",
    "Customer spend", "Gross order value" all rejected). The merchant earns from
    the food they sell; delivery is its own financial flow and belongs to the
    platform. This covers every merchant screen and the API: merchant and
    location-manager responses omit `pricing.deliveryFee`, `pricing.total` and
    `driverEarnings` (data minimisation - not sent, not only hidden). Every
    merchant order route and socket event is covered by a test.
  - `pricing.subtotal` is the food price **after** the offer discount
    (`sum(discountedPrice x quantity)`, `order.service.ts` createOrder);
    `discountAmount` is `original - discounted`, informational, and is never
    subtracted from anything. So the merchant order detail shows: food items,
    Original value (`subtotal + discountAmount`), Discount (`-discountAmount`),
    Food price (`subtotal`), and after completion Your earnings (frozen
    decision). "Subtotal -> Discount -> Food price" was rejected: it implies
    `subtotal - discount`, which is wrong here.
  - Tax: `calculateOrderPricing` sets `taxAmount = 0` for every order, so no
    order has an authoritative tax amount. No Tax line is shown, nothing is
    guessed, no rate is hard-coded, and tax never enters `Your earnings`.
    `Your earnings` is TFTW's frozen merchant amount, not the merchant's
    accounting profit after their own tax obligations.
  - Analytics: "Average order value" (customer total) becomes "Average food
    value per completed order" = food price (`pricing.subtotal`) / orders, over
    the same Earnings population, from the shared summary (`total.foodValue`).
    It is not earnings per order.
  - "Revenue rescued" discount % =
    `(originalValue - foodValue) / originalValue`, both from the shared summary
    (`total.originalValue`, `total.foodValue`), so delivery never enters it and
    it covers the same orders as the earnings.
  - `commission.appliedAt` is never read as the source of truth. The planned
    equality test stays because `CommissionService.isModelActiveAt(appliedAt)`
    decides which model an order gets: if `appliedAt` drifted from the canonical
    moment, an order could get the legacy engine while the earnings treat it as
    post-cutoff (a false "being verified"). The pickup path already documents
    the two "must never disagree"; the test holds it.
  - Execution: subagent-driven, sequential, in this working tree (the plan file
    is gitignored), review between task groups; Docker Desktop started before
    the database tasks.

## Open questions

- None blocking. Non-blocking: whether mobile needs any of this - no mobile
  screen reads these endpoints today.
