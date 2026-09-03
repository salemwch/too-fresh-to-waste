---
status: ready-for-dev
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

- [ ] Add `MERCHANT_EARNINGS_EXPR` (or equivalent helper) to
      `orders/utils/order-pricing.util.ts` — acceptance: used by all three call
      sites below, no duplicated `$multiply` literal.
- [ ] `order.service.ts: getOrderStats()` — add `totalEarnings` to the
      aggregation and `OrderStatsResponse`. Acceptance: for a completed delivery
      order with subtotal 20 / deliveryFee 4 / total 24, `totalEarnings` = 16.2,
      not 19.44.
- [ ] `order.service.ts: getRevenueChart()` — add `earnings` per bucket to
      `RevenueChartResponse`. Acceptance: gap-filled buckets (existing
      `fillChartGaps` behavior) still zero-fill `earnings` too.
- [ ] `analytics.service.ts: calculateCurrentBusinessMetrics()` — switch the
      revenue source from `Payment.amount` aggregation to the same
      `Order.pricing` formula as the other two, add `totalEarnings` to
      `BusinessMetrics`. `averageOrderValue` stays derived from the existing
      gross `totalRevenue`, unchanged.
- [ ] Fix the ledger bug: `order.service.ts:1312`
      `orderTotal: order.pricing.total` → `order.pricing.subtotal`;
      `payout.service.ts: createLedgerEntry()` replace
      `orderTotal * MERCHANT_SHARE` with `calculateFoodRevenueSplit(subtotal)`.
      Acceptance: a ledger-path test (same shape as `payout-split-base.spec.ts`)
      proves a delivery order's `merchantAmount` is 81% of subtotal, not total —
      this is the exact gap the existing test's own comment flags as uncovered.
- [ ] New endpoint `GET /payments/my-wallet` (merchant-scoped, optional
      `establishmentId` query param following the existing pattern) →
      `{ availableBalance, pendingBalance, currency }`, summed across all of the
      merchant's establishments when no `establishmentId` is given. Acceptance:
      a merchant cannot read another merchant's wallet by establishment ID
      (ownership check, same pattern as `establishments.controller.ts:282`).

### Frontend

- [ ] `types/dashboard.ts` — add `totalEarnings` to `OrderStatsResponse`,
      `earnings` to `RevenueChartItem`, `totalEarnings` to `BusinessMetrics`,
      new `MerchantWallet` response type.
- [ ] `impact-cards.tsx` — "Earned Revenue" card reads `stats.totalEarnings`.
      `savingsPercent` calculation is untouched (still reads
      `stats.totalRevenue`).
- [ ] `analytics-page.tsx` `KpiCards` — "Revenue" card reads
      `data.totalEarnings`; relabel title to make the net framing explicit (e.g.
      "My Earnings").
- [ ] `analytics-page.tsx` `RevenueChart` — `dataKey` switches to `earnings`;
      title/subtitle relabeled to match.
- [ ] No change to `TrendChart` (main dashboard) — confirmed it plots
      `bagCount`, not revenue, despite sharing the revenue-chart query.
- [ ] No change to `OrdersChart`, `averageOrderValue`, "Revenue Rescued" card.
- [ ] New `dashboardKeys.myWallet(estId?)` query key + `useMyWallet()` hook in
      `use-merchant-dashboard.ts`, following the existing hook conventions
      (staleTime, `activeEstablishmentId` scoping).
- [ ] New small `WalletBalanceCard` component (or extend an existing panel —
      decide at implementation time which reads more consistently with
      `DESIGN.md` card patterns) showing available + pending balance.
- [ ] `en.json` / `fr.json` / `ar.json` — updated together for every relabeled
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

## Open questions

None blocking. Deferred, non-blocking follow-ups raised during scoping:
downloadable earnings statement export, monthly earnings goal (mirroring the
existing bags-saved goal), pickup vs delivery earnings breakdown.
