---
status: done
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:all && pnpm --filter @foodwaste/web
  type-check && pnpm --filter @foodwaste/web test
---

## Intent

The merchant web dashboard currently shows "revenue" everywhere as the **gross**
amount customers paid (`order.pricing.total`), not what the merchant actually
keeps. The platform takes a 19% commission on the food line
(`MERCHANT_FOOD_SHARE = 0.81` in `orders/utils/order-pricing.util.ts`), so a
merchant looking at "Earned Revenue" or the Analytics "Revenue" KPI is seeing a
number ~19-24% higher than what lands in their pocket, with no way to tell.

This work adds a correct, clearly-labelled **net earnings** figure (per day /
week / month, matching the existing date-range pickers) alongside the existing
gross number where gross is still legitimately needed, and surfaces the
merchant's existing (but currently admin-only) wallet balance so "how much
money" also answers "when do I get paid."

Bundled in: a pre-existing correctness bug in the merchant payout **ledger**
(distinct from the wallet) that was found while tracing this — it splits
`pricing.total` instead of `pricing.subtotal`, handing the merchant 81% of the
delivery fee on delivery orders. Fixed here because it's small, isolated, and
directly adjacent — not because it was asked for.

## Constraints

- **Never repurpose `totalRevenue`/`revenue` to mean net.** It is still used for
  the "Revenue Rescued" discount-% calculation
  (`(originalValue − grossPaid) / originalValue`) and for "average order value"
  (a basket-size metric, not an earnings metric). Both must keep reading the
  gross number unchanged. Net earnings is a new, additive field: `totalEarnings`
  (stats) / `earnings` (chart) / `totalEarnings` (business metrics).
- **Settlement splits `subtotal`, never `total`.** This is the existing
  invariant documented at the top of `order-pricing.util.ts` and covered by
  `payments/__tests__/payout-split-base.spec.ts` for the wallet path. The new
  `totalEarnings`/`earnings` fields and the ledger bugfix must both use
  `pricing.subtotal × MERCHANT_FOOD_SHARE`, never `pricing.total`.
- **One formula, one place.** Three call sites need the same merchant-earnings
  arithmetic (`getOrderStats`, `getRevenueChart`,
  `calculateCurrentBusinessMetrics`) — factor a single Mongo-aggregation
  expression in `order-pricing.util.ts` rather than hand-copying
  `{ $multiply: ['$pricing.subtotal', 0.81] }` three times.
- **`MerchantWallet.merchantId`** already stores the merchant's `userId`
  directly (denormalized) — no need to resolve establishments first for the
  wallet-balance endpoint.
- Follow `.claude/rules/web.md` #4 (`dashboardKeys` factory for all new query
  keys), #13 (parallel en/fr/ar translation updates in the same commit).

## Tasks & Acceptance

### Backend

- [x] Add `MERCHANT_EARNINGS_EXPR` (or equivalent helper) to
      `orders/utils/order-pricing.util.ts` — acceptance: used by all three call
      sites below, no duplicated `$multiply` literal.
- [x] `order.service.ts: getOrderStats()` — add `totalEarnings` to the
      aggregation and `OrderStatsResponse`. Acceptance: for a completed delivery
      order with subtotal 20 / deliveryFee 4 / total 24, `totalEarnings` = 16.2,
      not 19.44.
- [x] `order.service.ts: getRevenueChart()` — add `earnings` per bucket to
      `RevenueChartResponse`. Acceptance: gap-filled buckets (existing
      `fillChartGaps` behavior) still zero-fill `earnings` too.
- [x] `analytics.service.ts: calculateCurrentBusinessMetrics()` — switch the
      revenue source from `Payment.amount` aggregation to the same
      `Order.pricing` formula as the other two, add `totalEarnings` to
      `BusinessMetrics`. `averageOrderValue` stays derived from the existing
      gross `totalRevenue`, unchanged.
- [x] Fix the ledger bug: `order.service.ts:1312`
      `orderTotal: order.pricing.total` → `order.pricing.subtotal`;
      `payout.service.ts: createLedgerEntry()` replace
      `orderTotal * MERCHANT_SHARE` with `calculateFoodRevenueSplit(subtotal)`.
      Acceptance: a ledger-path test (same shape as `payout-split-base.spec.ts`)
      proves a delivery order's `merchantAmount` is 81% of subtotal, not total —
      this is the exact gap the existing test's own comment flags as uncovered.
- [x] New endpoint `GET /payments/my-wallet` (merchant-scoped, optional
      `establishmentId` query param following the existing pattern) →
      `{ availableBalance, pendingBalance, currency }`, summed across all of the
      merchant's establishments when no `establishmentId` is given. Acceptance:
      a merchant cannot read another merchant's wallet by establishment ID
      (ownership check, same pattern as `establishments.controller.ts:282`).

### Frontend

- [x] `types/dashboard.ts` — add `totalEarnings` to `OrderStatsResponse`,
      `earnings` to `RevenueChartItem`, `totalEarnings` to `BusinessMetrics`,
      new `MerchantWallet` response type.
- [x] `impact-cards.tsx` — "Earned Revenue" card reads `stats.totalEarnings`.
      `savingsPercent` calculation is untouched (still reads
      `stats.totalRevenue`).
- [x] `analytics-page.tsx` `KpiCards` — "Revenue" card reads
      `data.totalEarnings`; relabel title to make the net framing explicit (e.g.
      "My Earnings").
- [x] `analytics-page.tsx` `RevenueChart` — `dataKey` switches to `earnings`;
      title/subtitle relabeled to match.
- [x] No change to `TrendChart` (main dashboard) — confirmed it plots
      `bagCount`, not revenue, despite sharing the revenue-chart query.
- [x] No change to `OrdersChart`, `averageOrderValue`, "Revenue Rescued" card.
- [x] New `dashboardKeys.myWallet(estId?)` query key + `useMyWallet()` hook in
      `use-merchant-dashboard.ts`, following the existing hook conventions
      (staleTime, `activeEstablishmentId` scoping).
- [x] New small `WalletBalanceCard` component (or extend an existing panel —
      decide at implementation time which reads more consistently with
      `DESIGN.md` card patterns) showing available + pending balance.
- [x] `en.json` / `fr.json` / `ar.json` — updated together for every relabeled
      key and the new wallet card copy.

## Decisions

- **Additive fields, not a rename** — `totalRevenue` (gross) and `totalEarnings`
  (net) coexist; chosen because `totalRevenue` already has a second consumer
  (`savingsPercent`) that must stay gross. Confirmed with user.
- **Net earnings computed fresh from `Order.pricing`**, not read from
  `MerchantPayoutLedger.merchantAmount` — chosen because the ledger has the
  known total-vs-subtotal bug; computing independently means the new feature is
  correct even before/regardless of the ledger fix landing cleanly. Confirmed
  with user.
- **Ledger bug fixed in this same change**, not filed separately — small,
  isolated, financially-adjacent to what's already being touched. Confirmed with
  user (initially asked whether to defer it; user chose to fix now).
- **Wallet balance view added to this build** (`GET /payments/my-wallet` +
  card), not deferred — directly extends "his money" to include _when_ he gets
  paid, reuses existing correctly-maintained data
  (`MerchantWallet`/`KonnectOrderService` path), moderate added scope. Confirmed
  with user over three other candidate additions (earnings-statement export,
  monthly earnings goal, pickup/delivery earnings split), all deferred as
  separate follow-ups.
- **`TrendChart` (main dashboard) is out of scope** — verified by reading the
  component: it plots `bagCount` from the revenue-chart response, titled
  "Resources Saved," not money. No change needed despite consuming the same
  query.
- **`averageOrderValue` stays gross** — it's a basket-size metric (how much a
  customer typically spends), not an earnings metric; swapping it to net would
  answer a different question than its label asks.
- **`MERCHANT_EARNINGS_EXPR` needed a `$round(..., 3)` wrapper** beyond the
  plan's literal `{ $multiply: ['$pricing.subtotal', MERCHANT_FOOD_SHARE] }`
  snippet, to avoid IEEE-754 float drift (e.g. `20 * 0.81 = 16.200000000000003`
  without it). Confirmed via final whole-branch review.
- **`apps/web/scripts/spacing-baseline.json` needed regenerating**
  (`check:spacing --write`) because `WalletBalanceCard`'s new (but fully reused,
  pre-approved) classes triggered the spacing-drift gate - verified to contain
  zero unrelated drift, only physical-to-logical key renames at identical pixel
  values. Confirmed via final whole-branch review.
- **Several new frontend tests use `.toBeTruthy()`/`.toBeNull()` instead of
  `.toBeInTheDocument()`**, because `@testing-library/jest-dom` is not installed
  anywhere in this monorepo. Confirmed via final whole-branch review.
- **The full manual UI walkthrough (seeded merchant login, live rendered
  numbers, Arabic RTL check) was never performed** - no seeded merchant test
  account exists in this environment. All automated gates (backend `check:all`,
  web type-check/lint/test) are clean, but nobody has looked at the actual
  rendered page. Confirmed via final whole-branch review.

## Open questions

None blocking on the work above. Deferred, non-blocking follow-ups raised during
scoping: downloadable earnings statement export, monthly earnings goal
(mirroring the existing bags-saved goal), pickup vs delivery earnings breakdown.

Raised by the final whole-branch review, explicitly **not** fixed in that pass -
each needs a human decision before anyone acts on it:

- Every `MerchantPayoutLedger` row written before this branch's fix still holds
  the old, incorrectly-split amount (`total × 0.81` instead of
  `subtotal × 0.81`) and is still `PENDING_SETTLEMENT` - will be paid out at the
  wrong amount by the next monthly payout run unless someone decides whether to
  backfill-correct those rows, accept the discrepancy, or something else.
- `WalletBalanceCard` (added in this branch) can structurally only ever show
  money from online (Konnect) orders - a merchant who only takes cash-on-pickup
  will see a permanent `0.00 / 0.00` sitting directly above an "Earned Revenue"
  card that correctly counts their cash earnings, with copy ("moves to available
  once the pickup window closes") that will never come true for them. Needs a
  decision: caveat the copy, hide the card for cash-only merchants, or accept as
  a known v1 limitation.
- `POST /analytics/business-metrics` (a pre-existing endpoint, not modified by
  this branch except to add the new `totalEarnings` field) has no server-side
  merchant-scoping - any authenticated pro-tier user can pass another merchant's
  `establishmentId` and read their business metrics, and a merchant with no
  active establishment set sees platform-wide totals instead of their own. This
  branch put a first-person "My Earnings" label on top of that endpoint's
  output, making the pre-existing gap more consequential. Separately,
  `apps/food-waste-backend/src/analytics/services/analytics.service.ts`'s
  `fetchRealTimeMetrics` method (untouched by this branch) filters `Payment` by
  `status: 'paid'`, which does not exist in `PaymentStatus` - so the admin
  real-time dashboard's "revenue today" figure is permanently zero. Both are
  pre-existing bugs outside this branch's scope; flagging here so they aren't
  lost.

## Resolutions (follow-up session, 2026-09-04)

All three open questions above and the wallet copy gap were decided and closed
in a follow-up session:

- **Legacy ledger rows: backfilled.** User chose to correct rather than accept
  the discrepancy. `scripts/migrations/backfill-payout-ledger-subtotal-split.ts`
  (dry-run by default,
  `pnpm migration:backfill-ledger-subtotal-split[:execute]`), scoped to
  `PENDING_SETTLEMENT` rows only - `PAID_OUT` is a reconciliation decision, not
  a data-correction one, and stays untouched. Verified against seeded local
  data: corrects a delivery-order row, leaves an already-correct pickup-order
  row alone, skips (never guesses at) a row whose order no longer resolves, and
  never touches a `PAID_OUT` row. Has not yet been run with `--execute` against
  the real database - that's an operational step for whoever owns the production
  deploy, not something run from this session.
- **`WalletBalanceCard` cash-order blind spot: copy reworded.** User chose to
  clarify now rather than hide the card or accept as a v1 limitation. Retitled
  "Payout Balance" → "Online Payout Balance" (all 3 locales), which correctly
  scopes the existing notes without adding new UI.
- **`POST /analytics/business-metrics` scoping gap: fixed.** Restricted to
  `MERCHANT`/`LOCATION_MANAGER` via `RolesGuard` (previously any
  `ProSubscriptionGuard`-passing consumer could call it). `establishmentIds` is
  now resolved server-side from ownership/assignment -
  `AnalyticsService.resolveEffectiveEstablishmentIds()` - client input can only
  narrow within what the caller owns, never expand past it, and an empty
  resolved set returns a zero-valued response instead of falling through to an
  unfiltered (platform-wide) query. Covered by
  `analytics/services/__tests__/business-metrics-scoping.spec.ts` and
  `analytics/controllers/__tests__/business-metrics-scoping.spec.ts`.
- **`fetchRealTimeMetrics` stuck-at-zero: fixed.** `status: 'paid'` →
  `{ $in: [PaymentStatus.EARNED, PaymentStatus.COMPLETED] }`, matching the same
  pair `getAdminPaymentStats` already uses. Covered by
  `analytics/services/__tests__/real-time-revenue-today.spec.ts`.

Full backend suite verified clean after all four changes: 93/93 suites,
1580/1580 tests, `check:ts` clean.
