---
status: draft
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

The instant a sale completes for commission purposes - the same instant
`CommissionService` records as `commission.appliedAt`:

| Fulfilment                 | Moment                                                         |
| -------------------------- | -------------------------------------------------------------- |
| `deliveryMode: 'delivery'` | `driverPickedUpAt` (the driver collecting from the merchant)   |
| pickup                     | `pickedUpAt`, falling back to `pickupDetails.actualPickupTime` |

`scripts/audit-commission-cutoff.ts` imports this expression instead of its own
copy, so the audit and the earnings can never disagree about which side of the
cutoff an order is on.

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

A refunded sale leaves the earnings of the period it was completed in. A refund
before completion never was a sale: it has no commission moment and appears in
no tab. Pending, failed, cancelled and expired orders appear in none.

### Per-order earned amount - three explicit cases

| Case                    | Condition                                                          | Earned                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Current model        | `commission` present                                               | `commission.merchantAmount` - the full food price on NORMAL, `subtotal - settled` on SETTLEMENT                                                   |
| 2. Legacy compatibility | no `commission`, moment **before** `COMMISSION_MODEL_EFFECTIVE_AT` | `pricing.merchantAmount` if persisted, else `round3(subtotal * 0.81)`, named `LEGACY_PRE_CUTOFF_MERCHANT_SHARE` and reachable only from this case |
| 3. Integrity failure    | no `commission`, moment **at or after** the cutoff                 | not an earning: the order is in the Being-verified population, contributes 0 to every total, and is logged                                        |

The cutoff comes from `COMMISSION_MODEL_EFFECTIVE_AT` via `ConfigService`
(parsed by `commission-cutoff.util.ts`). Outside production it may be unset:
then the model is inactive, every order without a decision is case 2, and none
is case 3 - which is what `CommissionService` already does.

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

When the Being-verified population is non-empty, the request logs one error:
`merchant earnings: N post-cutoff sales without a commission decision`, with the
merchant id and up to 20 order ids (Sentry picks up `logger.error`). One line
per request, not per order. `pnpm audit:commission-cutoff` keeps exiting 1 on
the same orders, since it uses the same moment. When the decision is restored,
the order moves back to Earnings on the next request with its persisted amount -
nothing is cached per order.

## API

All merchant endpoints take `period` (default `month`) and the existing optional
`establishmentId`.

| Endpoint                             | Returns                                                                                                                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /orders/merchant-sales-summary` | `{ period, from, to, currency, total: { orders, earned }, channels: { cashStore, cashDelivery, online: { orders, earned } }, commission: { rate, accrued, settled }, unverifiedOrders }`     |
| `GET /orders/merchant-sales-chart`   | `{ period, granularity, slots: [{ start, orders, earned }] }`, gap-filled, Tunis-time slot starts                                                                                            |
| `GET /payments/stats` (merchant)     | the summary's `total`, `channels` and `unverifiedOrders` - produced by the same function, not a copy                                                                                         |
| `GET /payments/my-merchant-payments` | adds `period` and `tab = earnings \| refunded \| verifying` (default `earnings`); every row carries `earned`, the payment-method line, `commissionMoment`, and for the other tabs the reason |

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
- Cutoff unset (non-production): no order is case 3.

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
post-cutoff order; ignore the cutoff; put the period in the held-money query
key.

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

## Open questions

- None blocking. Non-blocking: whether mobile needs any of this - no mobile
  screen reads these endpoints today.
