---
status: in-progress
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

- 2026-09-28 (Task 15 - merchants never receive delivery money, senior review
  before implementation):

  **Full `OrderSchema` money/payment classification** (KEEP or STRIP from a
  MERCHANT/LOCATION_MANAGER order view; the schema-driven test in
  `orders/utils/__tests__/merchant-order-view-schema-coverage.spec.ts` enforces
  this list stays exhaustive):

  | Path                                                               | KEEP/STRIP       | Reason                                                                                                                     |
  | ------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
  | `deliveryFee` (top-level)                                          | STRIP            | The driver's/platform's delivery fee                                                                                       |
  | `driverEarnings`                                                   | STRIP            | The driver's share of the delivery fee                                                                                     |
  | `platformDeliveryCommission`                                       | STRIP            | The platform's share of the delivery fee                                                                                   |
  | `pricing.deliveryFee`                                              | STRIP            | Same as above, denormalised onto pricing                                                                                   |
  | `pricing.total`                                                    | STRIP            | Customer-paid total = food + delivery                                                                                      |
  | `pricing.subtotal`                                                 | KEEP             | Food price after discount - the merchant's own                                                                             |
  | `pricing.discountAmount`                                           | KEEP             | Informational, never subtracted                                                                                            |
  | `pricing.taxAmount`                                                | KEEP             | Always 0; kept in data, never shown (no Tax row)                                                                           |
  | `pricing.merchantAmount`                                           | KEEP             | What this order paid the merchant                                                                                          |
  | `pricing.commissionSettled`                                        | KEEP             | Outstanding commission taken against balance, food-side accounting                                                         |
  | `paymentDetails.amount`                                            | STRIP            | What the customer paid (food + delivery)                                                                                   |
  | `paymentDetails.processingFee`                                     | STRIP            | Gateway cost, platform money                                                                                               |
  | `paymentDetails.stripePaymentIntentId`                             | STRIP            | Gateway reference, not the merchant's                                                                                      |
  | `paymentDetails.transactionId`                                     | STRIP            | Gateway reference, not the merchant's                                                                                      |
  | `paymentDetails.method`/`.currency`                                | KEEP             | Not money-bearing                                                                                                          |
  | `paymentSession` (whole object)                                    | STRIP            | Customer's payment link + gateway reference - data minimisation                                                            |
  | `commission` (whole object)                                        | KEEP             | The merchant's own frozen commission decision, never delivery money                                                        |
  | `driverInstruction.payMerchant`                                    | KEEP             | Verified food-only: `buildMerchantPickupCash` sets it to `commission.merchantAmount` (`drivers/utils/driver-cash.util.ts`) |
  | `driverInstruction.frozenAt`                                       | KEEP             | Timestamp, not money                                                                                                       |
  | `driverInstruction.collectFromCustomer`                            | STRIP            | `expectedCash` = `pricing.total` for COD - food + delivery                                                                 |
  | `driverInstruction.driverKeeps`                                    | STRIP            | The driver's delivery-fee share                                                                                            |
  | `paymentControl.collector`                                         | KEEP             | Actor enum (MERCHANT/DRIVER/PAYMENT_GATEWAY), not an amount                                                                |
  | `items.unitPrice`/`.totalPrice`/`.originalPrice`/`.discountAmount` | KEEP             | Food prices, always the merchant's own                                                                                     |
  | `donationAmount`                                                   | KEEP             | From platform margin, not delivery - out of scope, noted                                                                   |
  | `collectionStartTime`/`collectionEndTime`                          | KEEP             | Driver-pool query timestamps; match the classifier regex only via the substring "collect" in "collection"                  |
  | `estimatedDistanceKm`                                              | KEEP (not money) | Distance, not money; does not match the classifier regex                                                                   |

  **Route/emit surface enumerated** (every MERCHANT/LOCATION_MANAGER-reachable
  handler that returns an order, orders, or a receipt, plus every socket emit
  found by
  `grep -rn "sendToUser\|emitTo\|server.to(" apps/food-waste-backend/src`):

  | Route/emit                                                                                                                                                                            | Action                                                                                                                                                                                                                                               |
  | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `GET /orders`                                                                                                                                                                         | STRIP for MERCHANT/LOCATION_MANAGER. No `@Roles` guard at all - any authenticated caller reaches it (buildQuery scopes MERCHANT to their own orders); returns raw `OrderLean[]` with no DTO. Found during Step 1, not named in the plan's file list. |
  | `GET /orders/merchant-orders`                                                                                                                                                         | STRIP unconditionally (MERCHANT/LOCATION_MANAGER only, never ADMIN)                                                                                                                                                                                  |
  | `GET /orders/:id`                                                                                                                                                                     | Branch on `req.user.role`: STRIP for MERCHANT/LOCATION_MANAGER, keep for ADMIN and the customer                                                                                                                                                      |
  | `PATCH /orders/:id/status`                                                                                                                                                            | Branch on role (returns the raw order, no DTO)                                                                                                                                                                                                       |
  | `PATCH /orders/:id/confirm-pickup`                                                                                                                                                    | Branch on role (no `@Roles` guard at all on this route)                                                                                                                                                                                              |
  | `PATCH /orders/:id/cancel`                                                                                                                                                            | Branch on role (no `@Roles` guard at all on this route)                                                                                                                                                                                              |
  | `PATCH /orders/:id/unlock-pickup`                                                                                                                                                     | Branch on role                                                                                                                                                                                                                                       |
  | `GET /orders/:id/receipt`                                                                                                                                                             | Branch on role; the hand-built `receipt` object embeds the full `order.pricing`                                                                                                                                                                      |
  | `GET /orders/:id/qr-code`                                                                                                                                                             | Excluded - no money field in the response                                                                                                                                                                                                            |
  | `PATCH /orders/approve-expiration`                                                                                                                                                    | Excluded - returns a Mongo `UpdateResult`                                                                                                                                                                                                            |
  | `PATCH /orders/:id/approve-pickup-extension`                                                                                                                                          | Excluded - returns `{ message }`                                                                                                                                                                                                                     |
  | `GET /orders/merchant-customer-locations`                                                                                                                                             | Excluded - returns `{ city, count }`                                                                                                                                                                                                                 |
  | `GET /orders/stats`, `/merchant-revenue-chart`, `/merchant-today-sales`                                                                                                               | Excluded - Task 16 removes these; out of scope here                                                                                                                                                                                                  |
  | `GET /orders/merchant-sales-summary`, `/merchant-sales-chart`, `GET /payments/my-merchant-payments`, `/my-commission`, `/my-commission/:id`, `/my-wallet`, `/stats` (merchant branch) | Excluded - confirmed food-only: grepped `apps/food-waste-backend/src/merchant-sales` and `payments`, no reference to `pricing.total`/`pricing.deliveryFee`                                                                                           |
  | `DELETE /orders/:id`, `POST /orders/update-expired`, `GET /orders/admin/pending`                                                                                                      | Excluded - ADMIN only; the domain rule restricts MERCHANT/LOCATION_MANAGER only                                                                                                                                                                      |
  | Order export (CSV/PDF)                                                                                                                                                                | Excluded - no such endpoint exists in this codebase                                                                                                                                                                                                  |
  | `order.service.ts` `notifyMerchantNewOrder` (`sendToUser(..., 'order:new', ...)`)                                                                                                     | Fixed: payload sent `pricing: { total: order.pricing.total }` (customer total, live path) → now `pricing: { subtotal: order.pricing.subtotal }`                                                                                                      |
  | `websocket/gateways/order.gateway.ts` `notifyNewOrder`/`notifyOrderStatusChange`                                                                                                      | Not wired to any call site today (grepped: no reference outside the file). Fixed anyway for defence in depth - `notifyNewOrder`'s `total` param and message text removed.                                                                            |
  | Notification templates (`order_confirmed`, `queueNotification` in `notifyMerchantNewOrder`)                                                                                           | Excluded - grepped, no money placeholder interpolated                                                                                                                                                                                                |

  **Backend additions beyond stripping** (both required for the web order
  detail's "Your earnings" row to work at all - `order.commission` was never
  reaching a merchant before this task):
  - `common/utils/query-optimization.util.ts` `ORDER_DETAIL_FIELDS`: added
    `'commission'` to the projection (`findById` never returned it before).
  - `orders/DTO/order-response.dto.ts`: added `CommissionResponseDto` and an
    optional `commission` field to `MerchantOrderResponseDto` only (never on
    `ConsumerOrderResponseDto` - a customer has no use for it).

  **Web consumers grepped and fixed** (`grep -rn` for `pricing.total`,
  `pricing.deliveryFee`, `paymentDetails.amount`, `deliveryFee`,
  `driverEarnings`, `platformDeliveryCommission`, `driverInstruction`,
  `paymentSession` under `apps/web/src`, excluding `/admin/` and `/driver`):
  - `merchant/orders/page.tsx`: list row (`OrderCard`) showed `pricing.total` →
    `pricing.subtotal`; detail money block rebuilt per plan Step 6 (Original
    value / Discount / Food price / Your earnings, no Tax/delivery-fee/total
    rows, no invented `?? 0`).
  - `types/dashboard.ts`: `OrderPricing` no longer declares `deliveryFee`/
    `total`; `OrderPaymentDetails` no longer declares `amount`; `MerchantOrder`
    gained an optional `commission?: { merchantAmount: number }`.
  - `hooks/use-merchant-orders-socket.ts`: the `order:new` Zod schema required
    `pricing.total` - since the backend now sends only `pricing.subtotal`, every
    event would have failed validation silently. Schema updated to
    `pricing: { subtotal }`; a dedicated test
    (`hooks/__tests__/use-merchant-orders-socket-schema.test.ts`) feeds both
    shapes through the real exported schema.
  - `lib/notification-store.ts` + `components/dashboard/notification-panel.tsx`:
    found, not named in the plan - the merchant notification bell rendered
    `€{n.total.toFixed(2)}` (the customer's delivery-inclusive total, wrong
    currency symbol too). Renamed the field to `foodPrice`, fed from
    `pricing.subtotal`, rendered with `formatCurrency(..., 'TND')`.
  - Admin types (`types/admin.ts`) and admin pages: untouched, per the domain
    rule (ADMIN keeps the full order).

- 2026-09-28 (Task 15b, user decision - moving the held balance off the
  Dashboard): the user asked to remove the online balance from the merchant
  Dashboard. Asked "remove entirely, or move to Payments", the user chose: move
  "Money TFTW currently holds" (Available for payout / Awaiting pickup) to the
  top of the Payments page, and remove it from the Dashboard. Food-only
  re-verified before the move: `payments/services/konnect-order.service.ts`
  credits `pendingBalance` with `pricing.subtotal` for PICKUP online orders only
  (delivery orders never touch the wallet), and `processPickupConfirmation`
  moves it to `availableBalance` as `merchantAmount` - so the figures carry no
  delivery money and "Awaiting pickup" stays an accurate label. `useMyWallet()`
  and `dashboardKeys.myWallet` are unchanged and still live in
  `use-merchant-dashboard.ts` (smallest blast radius) - only where the balance
  renders moved, as its own `HeldBalanceCard` at the top of `payments-page.tsx`.
  This supersedes the "## Web" section above, which still describes "Money TFTW
  currently holds" as living on the Dashboard inside `EarningsCard` - that text
  is intentionally left as written, this entry is the current truth.
  `EarningsCard` is now purely the period figure: total earned, order count, the
  three payment-method lines, the unverified-orders notice, and commission - no
  live balance on it any more.

- 2026-10-03 (Task 17 fix wave, A1 - user decision, delivery earnings count at
  driver pickup): a delivery order counts as earned at its commission moment
  (`driverPickedUpAt`, when the commission is recorded and the merchant is paid
  by the driver), not at `DELIVERED`. It stays counted when the delivery later
  fails (`OUT_FOR_DELIVERY -> CANCELLED` with a commission decision) or is stuck
  in `OUT_FOR_DELIVERY` (the `STALE_UNDELIVERED` case); it leaves the earnings
  population only when the status is `REFUNDED`. Figures never change after the
  fact because inclusion no longer waits for `DELIVERED` - a 23:50 Tunis pickup
  delivered at 00:10 the next day lands in, and stays in, the pickup day's slot.
  - Investigated as asked: does `CommissionService.reverseForOrder` (called by
    `driver-cash.service.ts` `undoSale` for `RETURNED_TO_MERCHANT`) take the
    order out of earnings? No - it only adjusts the establishment's
    `commissionDue` balance and writes a ledger `REVERSAL` row; it never touches
    `order.commission` on the order document itself, which is the only thing
    `merchant-sales.expressions.ts` reads. So a `CANCELLED` delivery counts the
    same regardless of recovery (`RETURNED_TO_MERCHANT`, `UNRECOVERABLE` or
    `RECOVERABLE_PENDING`) - nothing distinguishes them in the earnings
    calculation. This is pre-existing `CommissionService` behaviour, not
    something this task changes; it is recorded here because extending the
    populations to `CANCELLED` surfaces it for the first time.
  - Code: `COMMISSION_COMPLETED_STATUSES` in `merchant-sales.expressions.ts` now
    also includes `OUT_FOR_DELIVERY` and `CANCELLED`. A delivery `CANCELLED`
    before driver pickup has no `driverPickedUpAt`, so it has no commission
    moment and is filtered out by the moment check regardless of being in this
    list - confirmed by `order.service.ts`'s own transition table, which never
    allows a pickup order to go `PICKED_UP -> CANCELLED` (only `-> REFUNDED`),
    so the newly-included `CANCELLED` status is reachable only through the
    delivery driver-cash failure path.
  - Tests: `merchant-sales.expressions.integration.spec.ts` (population-level:
    `OUT_FOR_DELIVERY` counts, `CANCELLED` after pickup counts, `CANCELLED`
    before pickup stays out) and `merchant-sales.integration.spec.ts`
    (summary/chart/rows-level: same three cases, the 23:50/00:10 boundary, and
    the four invariants with these rows mixed in).

- 2026-10-03 (Task 17 fix wave, A2 - user decision, order detail "Your earnings"
  matches Payments exactly): `GET /orders/:id` now exposes an
  `earnings: { amount, verifying }` block on `MerchantOrderResponseDto`, built
  by a new `orderEarningsFor()` in `merchant-sales.expressions.ts` - a plain-JS
  mirror of the same three cases `salesCaseExpr`/`EARNED_MILLIMES_EXPR` use in
  the Mongo pipeline (CURRENT = `commission.merchantAmount`; LEGACY =
  `pricing.merchantAmount` else `round3(subtotal * 0.81)`; UNVERIFIED = no
  amount, `verifying: true`), never a second formula. REFUNDED is
  `{ amount: null, verifying: false }`. The field is entirely absent when the
  order has no commission moment yet (not picked up / not collected from the
  merchant). Gated identically to `commission` (MERCHANT / LOCATION_MANAGER /
  ADMIN - `isMerchantSide` in `OrdersController.findOne`).
  - Test (testing.md rule 6, one table drives both sides so they cannot drift):
    `merchant-order-earnings.integration.spec.ts` runs a `describe.each` table
    of orders through the real Mongo aggregation (`salesBaseStages`) and through
    `orderEarningsFor` and asserts the same amount from both, for every case
    plus REFUNDED, no-moment-yet, and a CANCELLED-after-pickup delivery (A1
    parity).

- 2026-10-03 (Task 17 fix wave, A3 - Payments establishment scope):
  `GET /payments/stats` now honours `establishmentId` exactly like
  `merchant-sales-summary`/`-chart` and `my-merchant-payments`, and a
  LOCATION_MANAGER can call it too, pinned to `assignedEstablishmentId` whatever
  `establishmentId` they send. Extracted the pin into one function,
  `salesScopeForRequest` (`merchant-sales.scope.ts`), used by both
  `OrdersController.salesScope` and `PaymentController.getPaymentStats` - the LM
  pin now has exactly one definition instead of two that could drift (also sets
  up A12's controller-seam tests).
  - Before this fix, `GET /payments/stats` built its scope with
    `salesScopeFor(UserRole.MERCHANT, req.user.userId)` unconditionally - it
    silently dropped an explicit `?establishmentId=`, and a LOCATION_MANAGER
    could not call it at all (`@Roles` excluded the role entirely).
  - Test: `merchant-sales.integration.spec.ts` drives `PaymentController`
    directly and asserts stats equal the summary for a merchant scoped to one
    establishment, and for a LOCATION_MANAGER pinned to their assignment
    (ignoring a different id they send) and with no assignment at all (zero,
    never every merchant). Mutation-checked: reverting the controller to the old
    unconditional `salesScopeFor(UserRole.MERCHANT, ...)` call turned all three
    new tests red; reapplying the fix turned them green again.

- 2026-10-03 (Task 17 fix wave, A4 - integrity report once per scope per window,
  not per request): two fixes, both touching
  `MerchantSalesService.reportUnverified`:
  - The Analytics comparison window never reports. `summaryForRange` gained an
    `options?: { report?: boolean }` (default `true`); `getBusinessMetrics`
    passes `report: false` only for the comparison-window call - a verifying
    order the merchant cannot even see (it is outside their selected period)
    must not page anyone a second time for the same underlying order the
    current-period call already reported.
  - Reports are deduped per `(scope, period)` for a fixed one-hour window
    (`REPORT_DEDUPE_TTL_SECONDS`), agreed across every PM2 worker via a new
    `CacheService.acquireOnce(key, ttlSeconds)` (`SET key val NX EX ttl` -
    atomic, so exactly one caller within the window wins; fails open on a Redis
    outage rather than silently swallowing a real integrity failure). The dedupe
    key is `merchant-sales:unverified-report:<scope>:<period>`; the figure
    itself (`unverifiedOrders`) is never suppressed, only the Sentry/ logger
    report.
  - Before this fix, every Dashboard summary fetch, every Payments stats fetch,
    and both Analytics windows independently sent a Sentry `captureMessage` +
    `logger.error` for the same unverified orders.
  - Tests: `merchant-sales-report-dedupe.integration.spec.ts` (new, against real
    Redis, the same pattern as
    `auth/__tests__/login-attempt-limit.integration.spec.ts`) - two calls for
    the same scope/period produce one report; a different scope or period
    reports independently. `business-metrics-earnings.integration.spec.ts`'s
    existing "two reports" test is corrected to assert exactly one (the current
    period's, labelled with the real preset) - the comparison window never
    reports. `cache.service.acquire-once.spec.ts` (new, unit) covers
    `acquireOnce` itself: wins when free, loses when held, fails open on a Redis
    error.
  - Mutation-checked: disabling the dedupe check (always `shouldReport = true`,
    calling `acquireOnce` only for its side effect) turned the "two calls -> one
    report" test red; reverting restored it. Reverting the comparison-window
    `report: false` back to the default turned the "comparison window never
    reports" test red; reapplying it restored it. Both reverted cleanly
    afterward.
  - The other integration suites that construct `MerchantSalesService` manually
    (`merchant-sales.integration.spec.ts`,
    `business-metrics-earnings.integration.spec.ts`) now pass a
    `cache: { acquireOnce: jest.fn().mockResolvedValue(true) }` stub so their
    existing per-call report assertions (ids, count, label) are unaffected by
    the new dedupe - the dedupe itself is proven only by the dedicated suite
    against real Redis.

- 2026-10-03 (Task 17 fix wave, A5 - cap the verifying id accumulator): the
  `$group` stage in `MerchantSalesService.compute` no longer `$push`es every
  verifying order id into one accumulator document (unbounded for `period=all`
  - a merchant's whole history). `SalesGroupRow`/`summariseSalesGroups` no
    longer carry ids at all, only the count (`unverifiedOrders`). When that
    count is above 0 and the request is allowed to report (A4), a second, cheap
    query
    (`$match: { _population: 'verifying' } -> $project: { _id: 1 } -> $limit: 20`)
    fetches at most `MAX_REPORTED_IDS` ids - no MongoDB 5.2+ `$firstN` needed.
    `reportUnverified`'s own `.slice(0, MAX_REPORTED_IDS)` stays as defense in
    depth.
  - Test: the existing "caps orderIds at 20" integration test is strengthened to
    assert exactly 20 (not merely `<= 20`) with no duplicates. Mutation-
    checked: widening the new query's `$limit` to 1000 and replacing
    `reportUnverified`'s own slice with the raw (uncapped) id list turned this
    test red (22 ids returned); reverting restored it green.

- 2026-10-03 (Task 17 fix wave, A6 - period=today at exact Tunis midnight ->
  400): `AnalyticsUtil.validateAnalyticsFilters` rejected `start >= end`
  unconditionally, so a server-resolved `today` range at exactly Tunis midnight
  (`resolveSalesPeriod` returns `from === to === now`) failed its own "start
  before end" check with 400 `INVALID_FILTERS` - the existing
  `resolvedFromPeriod` flag only ever skipped the 2-year cap, never this one.
  Added a second flag, `allowZeroWidthRange`, set alongside `skipMaxRangeCheck`
  whenever `resolvedFromPeriod === true`; a genuinely reversed range
  (`start > end`) is still always rejected, and a client-supplied custom
  `dateRange` with `start === end` is still rejected too - only the server's own
  zero-width instant is allowed through.
  - Test: `business-metrics-zero-width-range.spec.ts` (same harness as
    `business-metrics-period-cap.spec.ts` - no DB touched, so a service missing
    `orderModel` is enough; getting `InternalServerErrorException` instead of
    `BadRequestException` proves validation passed rather than merely not
    throwing). Covers: a genuine client-supplied zero-width range still 400s;
    the identical range is accepted once `resolvedFromPeriod` is set; a
    server-resolved but reversed range is still rejected (defensive).
    Mutation-checked: removing the new `allowZeroWidthRange` flag from the call
    site turned the acceptance test red; restoring it turned it green.

- 2026-10-03 (Task 17 fix wave, A7 - MerchantOrderResponseDto declares stripped
  fields as present): `MerchantOrderResponseDto` inherited
  `ConsumerOrderResponseDto`'s `pricing` (with `deliveryFee`/`total`),
  `paymentDetails` (with `amount`) and `paymentSession` unchanged, even though
  `toMerchantOrderView`'s `STRIP_PATHS` removes exactly those fields from every
  real merchant/location-manager response before it reaches the DTO - the DTO's
  own declared shape lied about what it actually carries.
  - `MerchantOrderResponseDto` could not simply override `pricing`/
    `paymentDetails` with a narrower type while still extending
    `ConsumerOrderResponseDto` for them - TypeScript correctly refuses a
    subclass that removes required fields from an inherited property (that is
    not a valid subtype). Restructured: a new `BaseOrderResponseDto` carries
    everything the two shapes share; `ConsumerOrderResponseDto` and
    `MerchantOrderResponseDto` both extend it directly and declare
    `pricing`/`paymentDetails`/`paymentSession`/`pickupDetails` independently as
    siblings, not one narrowing the other. `MerchantPricingResponseDto` (no
    `deliveryFee`/`total`) and `MerchantPaymentDetailsResponseDto` (no `amount`)
    mirror `STRIP_PATHS`; `paymentSession` is simply never `@Expose()`'d on the
    merchant side (`STRIP_PATHS` has it as a bare top-level key).
  - Found during this fix, not asked for: `OrdersController.findOne` already had
    a latent bug this change exposed rather than introduced. `isMerchantSide`
    (`MERCHANT || LOCATION_MANAGER || ADMIN`) picked `MerchantOrderResponseDto`
    for ADMIN too, while the `view` for ADMIN was left un-stripped (full
    order) - before this fix the two DTOs happened to expose the same pricing
    fields, so ADMIN got the full data anyway; after the honest strip, ADMIN
    would have lost `deliveryFee`/`total` through the same DTO a merchant uses.
    Fixed in the same commit: ADMIN now bypasses every order DTO on this route
    entirely (returns the plain, un-stripped view plus `earnings`), matching
    `forRole`'s existing ADMIN branch elsewhere in this controller. Caught
    immediately by the existing `test/security/merchant-order-money.spec.ts` row
    "still sends the delivery fee to ADMIN", which went red the moment the DTO
    was corrected.
  - Test: `merchant-order-response-dto-money.spec.ts` (new) runs
    `MerchantOrderResponseDto` directly against a full, un-stripped order
    fixture (no `toMerchantOrderView` in between) - the DTO's own declaration is
    what is under test, not the upstream strip. Asserts none of the four
    `STRIP_PATHS` fields appear, every food-only field still does, and
    `ConsumerOrderResponseDto` is untouched (still gets everything). A sanity
    assertion ties the fixture's four fields to `STRIP_PATHS` itself, so the
    test and the source of truth cannot silently diverge.

- 2026-10-03 (Task 17 fix wave, A8 - commission accrued semantics, investigated
  per the brief): can a SETTLEMENT decision carry `accrued > 0`? Yes, for the
  pre-cutoff (LEGACY) engine - checked against the code, not assumed.
  `calculateCommissionSettlement` (`order-pricing.util.ts`) accrues 19% on
  **every** order regardless of whether it also settles; `kind` becomes
  `'SETTLEMENT'` purely because `settled > 0`, independent of `accrued`. The V2
  model's `decideCommission` (`commission-model.util.ts`) is different by
  construction: a SETTLEMENT there accrues exactly 0, a NORMAL settles exactly
  0 - mutually exclusive. `MerchantSalesService`'s
  `accruedMillimes`/`settledMillimes` were already correct as written: an
  unfiltered sum of `commission.accrued`/`commission.settled` across every
  Earnings row, with no kind filter - that is what "Commission recorded" and
  "paid off" must mean to reconcile to the truth regardless of which engine
  produced the decision. The defect was only in how this was described:
  - **Definitions (above, left as originally written per this spec's own
    convention of never rewriting a shipped section - see the 2026-09-28 Task
    15b entry for the precedent)**: "`commission.accrued` (NORMAL) and
    `commission.settled` (SETTLEMENT)" reads as if the two are kind-exclusive
    contributions. They are only exclusive for the V2 model; a LEGACY SETTLEMENT
    row contributes to both. The correct description: both figures are the
    unfiltered sum of `commission.accrued`/`commission.settled` over every
    Earnings row, for whichever engine or kind produced the decision.
  - The integration test titled "commission sums the NORMAL rows only" was
    renamed to say what the code does (sums across every row, not by kind), and
    its comment now says explicitly why its own SETTLEMENT fixture shows 0
    accrued (the V2 model's own construction, not a filter in the aggregation).
  - Added `merchant-sales.summarise.spec.ts`: "a LEGACY SETTLEMENT row
    contributes both its own accrual and its settlement" with a realistic seed
    (`accrued: 1.9, settled: 6` on the same row) - the case lens3 found missing,
    proving the unfiltered-sum behavior directly rather than only by coincidence
    of an all-V2 fixture table.

- 2026-10-03 (Task 17 fix wave, A9 - spec corrections, append-only):
  - L3 #3: Spec `:182-184` claims `getOrderStats` and `getRevenueChart` "read
    the shared population and amount". `getRevenueChart` was deleted in Task 16;
    `getOrderStats` reads no earnings at all - only status counts and bags by
    `createdAt`. These endpoints were never migrated to `merchant-sales`.
  - L3 #4: Spec `:454-455` (Task 15 decision) says "`ORDER_DETAIL_FIELDS`: added
    `'commission'` to the projection". This was reversed in the Task 15 fix
    round after review found it leaked the commission ledger to consumers.
    `commission` is loaded through a separate `ORDER_COMMISSION_FIELD` via
    `findById`'s `includeCommission` opt-in. Same entry: `notifyNewOrder`
    (`:448`) was described as "fixed anyway"; Task 16 removed it entirely.
  - L3 #5: Spec `:80-81` says an unknown period returns 400 `INVALID_PERIOD`.
    The actual code returns the generic `VALIDATION_ENUM` code from
    `strictValidation()` / `@IsIn(SALES_PERIODS)`. `INVALID_PERIOD` is used only
    by `admin-analytics.controller.ts`.
  - L3 #6: Spec `:151-154` says the integrity report carries
    `{ code, merchantId, count, period, orderIds }`. There is no top-level
    `merchantId`; the actual shape is
    `{ code, scope: { merchantId } | { kind, establishmentIds }, count, period, orderIds }`.
  - L3 #10: `order.controller.ts:230` comment said LOCATION_MANAGER was "scoped
    to their own orders by buildQuery". The LM branch of `buildQuery` adds no
    scope filter today. Comment corrected; tracked in orders-authz.

- 2026-10-03 (Task 17 fix wave, A13 + Part B):
  - A13: `SalesPeriod`/`SALES_PERIODS`/`SalesGranularity`/`PaymentLine`/
    `LineTotals`/`MerchantSalesSummary`/`MerchantSalesChart`/`EarningsRow`/
    `EarningsTab`/`EARNINGS_TABS`/`EarningsRowsPage` moved to
    `packages/shared/src/types/merchant-sales.types.ts`. Backend's
    `merchant-sales.types.ts`/`merchant-sales.period.ts` now import from
    `@foodwaste/shared` and re-export, so no existing backend import site needed
    to change. `apps/web/src/types/payments.ts` is now a re-export of the same
    module - closes the "Backend type <-> frontend type" gap this file's own
    `registration-chains.md` entry named as having no automated proof for this
    pair.
  - B1: `CommissionCard` removed from the Dashboard page and the merchant barrel
    export (file and its test kept, per instruction, for a possible future use -
    nothing currently imports it). A new `SettlementBalanceCard`
    (`apps/web/src/components/dashboard/merchant/payments/settlement-balance-card.tsx`)
    renders the same `useCommissionStatement()` data on the Payments page, above
    the period-scoped stats, period-independent like `HeldBalanceCard` (same
    reasoning: a live balance does not belong next to a period figure - this is
    the same product decision as the 2026-09-28 entry above, now applied to the
    commission statement too, not only the wallet). Copy: "Covered by your next
    orders" / "TFTW's share from your completed sales. It is taken from upcoming
    eligible orders - you never pay us directly."
  - B2: `usePaymentStats`/`useMerchantEarningsRows` now read
    `activeEstablishmentId` from `useAuthStore` and pass it through
    (`paymentsService.getStats`/`getMyPayments` gained an optional
    `establishmentId` param) - the backend route already accepted it
    (`MerchantSalesQueryDto.establishmentId`); only the web side was not sending
    it.
  - B3: order-detail "Your earnings" now reads `order.earnings` (A2's
    `{ amount, verifying }`) instead of deriving from `order.commission`, which
    could not distinguish "not yet decided" (verifying) from "nothing owed"
    (refunded). New key `merchantOrders.yourEarningsVerifying`.
  - B4: trend-chart empty state now checks every slot for zero activity (the
    `slots.length === 0` branch was unreachable - `salesSlots` always returns >=
    1 slot); RTL reverses the slot order for `ar`; the notification bell hides
    the food price entirely for `null`/`0` instead of fabricating "0.000 TND"
    and now passes the viewer's locale to `formatCurrency`; `formatDateShort`
    (used by Payments row dates) is pinned to `Africa/Tunis`; Payments
    stats/rows keep last-good data with an inline error banner on a background
    refetch failure instead of blanking the screen; the "Rescued" KPI delta is
    hidden (not "0%") when `originalValue` is 0; `EarningsCard` distinguishes
    "no sales" from "all sales unverified" (new key `earnings.allUnverified`);
    the order-status socket handler now invalidates sales summary/chart, order
    stats, business metrics and payment stats/rows by key prefix, since a status
    change can create/settle/reverse a commission decision; `EarningsCard`
    gained a divider before the commission `dl`, restoring the separator the old
    `CommissionCard` had.

## Open questions

- None blocking. Non-blocking: whether mobile needs any of this - no mobile
  screen reads these endpoints today.
- Non-blocking (2026-10-03): `commission-card.tsx` and its test are now unused
  dead code (nothing imports `CommissionCard` after B1). Left in place per the
  task instruction rather than deleted; a future pass should either delete both
  or find it a new home.
