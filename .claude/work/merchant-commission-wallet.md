---
status: in-progress
scope: cross-app
gate:
  pnpm --filter @foodwaste/backend check:all && pnpm --filter @foodwaste/web
  type-check && pnpm --filter @foodwaste/mobile test
---

## Intent

Stop deducting 19% from every merchant order. Instead, pay the merchant the
**full price** on almost every order, accrue the 19% commission into a
per-merchant balance, and collect that balance from a later order. The take rate
is unchanged at 19%; only the **shape** of collection changes.

The product goal is psychological, not financial: a merchant who receives 100%
on most orders and never hands over cash or pays an invoice is dramatically
easier to acquire and retain than one who watches 19% shaved off every line.

**This must never read as a deduction, a penalty, or a surprise.** A merchant
who feels robbed on one order is worth less than the commission collected from
it.

---

## Constraints

### Financial invariant (non-negotiable)

Long-run platform take **must equal exactly 19% of food subtotal**, identical to
`PLATFORM_FOOD_SHARE` today. Any rule that discards accrued balance, or that
skips accrual on a settlement order, silently lowers the real take rate to ~16%.
Proven during design:

```
skip accrual on settlement orders → 1 free bag per 6.26 orders → 15.97%
accrue on every order            → 1 free bag per 5.26 orders → 19.00%
```

**Accrual happens on EVERY order, before the settlement check, with no
exception.** This is the single most important line in the change.

### Existing code this must respect

| Thing                         | Where                                               | Note                                            |
| ----------------------------- | --------------------------------------------------- | ----------------------------------------------- |
| `PLATFORM_FOOD_SHARE = 0.19`  | `orders/utils/order-pricing.util.ts:57`             | Do not change                                   |
| `MERCHANT_FOOD_SHARE = 0.81`  | same file                                           | Do not change                                   |
| `calculateFoodRevenueSplit()` | same file                                           | Splits `subtotal`, never `total`                |
| `MerchantPayoutLedger`        | `payments/schemas/merchant-payout-ledger.schema.ts` | Per-order, 81/19, monthly payout                |
| `WalletTransaction`           | `payments/schemas/wallet-transaction.schema.ts`     | `SALE`/`REFUND`/`PAYOUT` per establishment      |
| Settlement hook               | `orders/order.service.ts:1318`                      | `createLedgerEntry` on pickup confirm           |
| Donation                      | `subtotal * 0.19 * 0.05`                            | Must follow the **accrual**, not the collection |

Delivery economics are **out of scope**. The delivery fee is distance-based and
split with the driver (`delivery-fee.util.ts`); merchants have no part in it.
Only the food `subtotal` is touched.

### Hard rules

- Never split `pricing.total`. Only `pricing.subtotal`.
- The customer must never be able to tell a settlement order from a normal one.
  Same price, same loyalty points, same pickup code, same reviews, same support.
- The driver is paid normally on a settlement order. Delivery is unaffected.
- No technical text reaches the merchant. Every state needs a translated string
  in `en` / `fr` / `ar`.

---

## The algorithm

Per establishment, one balance: `commissionDue` (TND, never negative).

```ts
// 1. ALWAYS accrue first. No branch, no exception.
commissionDue += round(subtotal * PLATFORM_FOOD_SHARE);

// 2. Only settle once the balance is worth a settlement event.
let settled = 0;
if (commissionDue >= SETTLEMENT_THRESHOLD) {
  const cap = round(subtotal * MAX_SETTLEMENT_SHARE_OF_ORDER);
  settled = round(Math.min(commissionDue, cap));
  commissionDue = round(commissionDue - settled);
}

// 3. What the merchant is credited for this order.
const merchantAmount = round(subtotal - settled);
```

### Constants (new, in `order-pricing.util.ts`)

```ts
/** Balance at which settlement begins. Below this, merchant gets 100%. */
export const SETTLEMENT_THRESHOLD = 5.0;

/** Never take more than this share of a single order. Merchant is never paid 0. */
export const MAX_SETTLEMENT_SHARE_OF_ORDER = 0.5;
```

### Why the 50% cap

Without it, a settlement order pays the merchant **zero**. A zero payout with a
customer standing at the counter is the single worst moment this design can
produce. The cap guarantees the merchant always receives at least half of every
order, and costs the platform nothing - unsettled balance simply carries to the
next order. Collection is slower; the total is identical.

### Worked example (5.000 TND bags, threshold 5.000, cap 50%)

| #   | Subtotal | +19%  | Balance | Settled | **Merchant gets** | Balance after |
| --- | -------- | ----- | ------- | ------- | ----------------- | ------------- |
| 1   | 5.000    | 0.950 | 0.950   | 0       | **5.000**         | 0.950         |
| 2   | 5.000    | 0.950 | 1.900   | 0       | **5.000**         | 1.900         |
| 3   | 5.000    | 0.950 | 2.850   | 0       | **5.000**         | 2.850         |
| 4   | 5.000    | 0.950 | 3.800   | 0       | **5.000**         | 3.800         |
| 5   | 5.000    | 0.950 | 4.750   | 0       | **5.000**         | 4.750         |
| 6   | 5.000    | 0.950 | 5.700   | 2.500   | **2.500**         | 3.200         |
| 7   | 5.000    | 0.950 | 4.150   | 0       | **5.000**         | 4.150         |
| 8   | 5.000    | 0.950 | 5.100   | 2.500   | **2.500**         | 2.600         |

Accrued over 8 orders = 7.600. Collected = 5.000. Carried = 2.600.
`5.000 + 2.600 = 7.600` - **nothing is lost**. Long-run take = 19%.

---

## Merchant experience - the part that decides whether this works

### Language rules (all three locales)

| Never say                          | Always say                                      |
| ---------------------------------- | ----------------------------------------------- |
| deducted, withheld, taken, charged | **settled**, _réglé_, **تسوية**                 |
| commission owed, debt, balance due | **commission to settle**, _commission à régler_ |
| you received 0                     | (impossible - the 50% cap prevents it)          |

The merchant's own word for the balance must never be "wallet" in a way that
implies he **has** that money. He **owes** it. Label it `Commission to settle` /
`Commission à régler` / `عمولة للتسوية`.

### Order list

Every order shows the **full price** as the headline number. Always.

```
Order #1247                         10.000 TND
Sale                                10.000
Commission settled                  −2.500
Paid to you                          7.500
```

On a non-settlement order the middle line is absent and `Paid to you` equals the
sale. That is the common case and it must look clean, not like something is
missing.

### No surprises - this is the critical requirement

The settlement amount must be **computed and shown when the order is accepted**,
not when the driver arrives. The worst possible failure of this design is a
driver handing over less cash than expected with a customer present.

Merchant order-detail screen, from acceptance onward:

> This order settles **2.500 TND** of your commission. You receive **7.500
> TND**.

### Dashboard

A persistent, calm card - not a warning, not red:

> **Commission to settle: 3.200 TND** Settles automatically from upcoming
> orders. You never pay us directly. `[ See how this works ]`

### Monthly statement - the trust anchor

Identical to any normal commission, which is the point:

```
Sold this month          35.000 TND
Commission (19%)          6.650 TND
Received                 28.350 TND
```

One tap expands to the per-order settlements that produced the 6.650. Full
transparency at the aggregate level is what prevents resentment at the line
level.

---

## Admin experience

### New page: `/[locale]/(admin)/admin/merchants/commission`

Table, one row per establishment, server-paginated, sortable on every numeric
column:

| Column                        | Source                                        |
| ----------------------------- | --------------------------------------------- |
| Establishment / merchant      | `Establishment`, `User`                       |
| **Commission to settle**      | `commissionDue`                               |
| GMV (period)                  | sum of `pricing.subtotal`                     |
| Commission accrued (period)   | sum of accruals                               |
| Commission collected (period) | sum of settlements                            |
| **Effective rate**            | collected ÷ GMV - alarms if drifting from 19% |
| Orders since last settlement  | derived                                       |
| Last settlement               | date + order link                             |

### Filters (fast triage is the requirement)

- Balance range (min / max)
- Effective rate outside a tolerance band around 19% - **this is the alarm that
  catches the 16% bug in production**
- Establishment, city, geozone
- Date range
- Preset chips: `High balance`, `Never settled`, `Stale > 30d`, `Rate drift`

### Also

- CSV export of the filtered set
- Per-merchant drill-down: full `CommissionLedger` history, every accrual and
  settlement with its order link
- Admin manual adjustment (write-off, correction) - **always** writes an audit
  entry with actor and reason. Never a silent balance edit.

### Platform-level reconciliation card

`total accrued − total collected = sum(commissionDue)` across all merchants. If
this identity ever breaks, the ledger has lost money. Surface it, red, on
`/admin/payments`.

---

## Website copy

`You keep 81% of every bag` is now wrong and must change in three locales, three
places each:

| File                            | Keys                                             |
| ------------------------------- | ------------------------------------------------ |
| `apps/web/src/messages/en.json` | `166` (`what`), `280` (`share`), `3390` (`body`) |
| `apps/web/src/messages/fr.json` | `166`, `280`, `3394`                             |
| `apps/web/src/messages/ar.json` | `166`, `280`, `3382`                             |

Also
`apps/web/src/components/dashboard/merchant/__tests__/impact-cards.test.tsx:16`
carries an `81%` comment that will need revisiting.

### Candidate messaging (needs a decision - see Open questions)

**A - Full price, honest**

> You get the full price on almost every bag. You never pay us directly.

**B - Zero cash**

> No invoices. No cash out of pocket. We take our share from one order, not
> every order.

**C - Simple**

> Keep the full price. Commission settles itself.

All three are true and survive an accountant. **Do not** write anything implying
the merchant pays less than 19% - he does not, and a merchant who works that out
stops trusting everything else on the page.

---

## Edge cases - every one needs a test

| Case                                              | Required behaviour                                                                                                 |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Refund of a **settlement** order                  | Reverse both: credit the merchant back, restore `commissionDue` by the settled amount, reverse the accrual         |
| Refund of a **normal** order                      | Reverse the accrual only                                                                                           |
| Partial refund                                    | Accrual and settlement both scale to the refunded share                                                            |
| Order cancelled before pickup                     | No accrual, no settlement - hook is on pickup confirm                                                              |
| Merchant leaves with positive balance             | Write off, audit entry, do not chase. Report as churn loss                                                         |
| Merchant leaves with zero balance                 | Nothing                                                                                                            |
| First-ever order                                  | Balance 0, no settlement possible, merchant gets 100%                                                              |
| `subtotal` smaller than threshold                 | Cap still applies; settlement is partial                                                                           |
| Very large order                                  | Cap prevents it absorbing the whole balance at once                                                                |
| Two orders confirmed concurrently                 | **Must be atomic.** `$inc` inside the existing `session.withTransaction()`, never read-modify-write                |
| PM2 cluster double-processing                     | Idempotency by `orderId`, same pattern as `findByOrderId` at `order.service.ts:1316`                               |
| Donation pool                                     | Follows the **accrual** (`subtotal * 0.19 * 0.05`), never the settlement, or charity numbers drift from commission |
| Cash orders (`cash_on_pickup`, `pay_on_delivery`) | See Open question 2 - direction of money flow differs                                                              |

---

## Tasks & Acceptance

### Phase 1 - Backend core

- [ ] Add `SETTLEMENT_THRESHOLD`, `MAX_SETTLEMENT_SHARE_OF_ORDER` to
      `order-pricing.util.ts` - acceptance: exported, documented, not env-magic
- [ ] Add `calculateCommissionSettlement(subtotal, commissionDue)` pure
      function - acceptance: unit-tested across the full table above, plus
      zero/huge/cap boundaries
- [ ] Add `commissionDue` to `Establishment` schema with `default: 0` -
      acceptance: `required` alone is not enough (see CLAUDE.md); existing docs
      must hydrate to 0 on read
- [ ] New `CommissionLedger` collection - append-only, one entry per accrual and
      per settlement, `orderId` indexed, unique on `(orderId, type)` -
      acceptance: idempotent under replay
- [ ] Wire into `order.service.ts` settlement hook (~line 1318), inside the
      existing transaction - acceptance: `$inc`, atomic, idempotent
- [ ] Adjust `createLedgerEntry` so `merchantAmount = subtotal − settled` -
      acceptance: `MerchantPayoutLedger` still reconciles to the bank payout
- [ ] **Invariant test**: simulate 1,000 orders of mixed prices; assert
      `collected / GMV` converges to 0.19 ± 0.005 and
      `accrued − collected == commissionDue`

### Phase 2 - Merchant UX

- [ ] Order list + detail show full price headline, settlement as its own line
- [ ] Settlement shown at **acceptance**, not at handover
- [ ] Dashboard `Commission to settle` card
- [ ] Monthly statement with expandable settlement history
- [ ] All strings in `en` / `fr` / `ar`, RTL verified
- [ ] `DESIGN.md` §18 pre-completion self-review

### Phase 3 - Admin

- [ ] `/admin/merchants/commission` page + API endpoint
- [ ] All filters above, server-side, indexed
- [ ] CSV export
- [ ] Per-merchant drill-down
- [ ] Reconciliation identity card on `/admin/payments`
- [ ] Manual adjustment with mandatory audit entry

### Phase 4 - Web copy

- [ ] Replace the three `81%` keys in all three locale files
- [ ] `pnpm --filter @foodwaste/web test` (includes `__tests__/seo`)
- [ ] Re-check meta descriptions still ≤ ~160 chars (en/fr)

---

## Decisions

**2026-09-20 - Accrue on every order, including settlement orders.** Rejected:
skipping accrual on the settlement order, which felt intuitive ("that bag
belongs to the app, why charge commission on it?"). Proven to yield 15.97%
instead of 19% - one free bag per 6.26 orders instead of per 5.26. The accrual
is a counter, not a charge; adding it makes the platform collect _more_, sooner.

**2026-09-20 - Partial settlement with a 50% cap, rather than a whole free
bag.** Rejected: waiting for the balance to reach a full bag price and taking
that entire order. It pays the merchant zero on that order, which is the worst
psychological moment available, and it wastes balance when the settled bag is
cheaper than the accrued amount. Partial settlement never discards balance and
never pays zero.

**2026-09-20 - Deduct, never reset to zero.** Resetting the balance after
settlement discards accrued commission and creates a gaming vector: list one
cheap item when the balance is high and wipe the whole balance with it.

**2026-09-20 - Merchant economics are unchanged; do not market otherwise.**
Analysis during design showed this model is arithmetically identical to a 19%
cash commission for both sides (81 bags paid out of 100 either way). The earlier
premise that the merchant "effectively pays 9.5% because a bag only costs him
COGS" is false - COGS is incurred on every bag regardless of who pays for it, so
it cancels. The real benefits are cash-flow shape, no invoicing, no collections,
and no change-making. Marketing must claim only those.

---

## Open questions

**1. (Blocking Phase 4 only) Which website message - A, B or C?** Brand
decision. Everything else can proceed.

**2. RESOLVED 2026-09-20 - which payment flows this applies to.** Verified in
code rather than assumed. `createLedgerEntry` has exactly **one** call site
(`order.service.ts:1318`), guarded by
`if (payment?.status === PaymentStatus.HELD)`. Cash orders have no `Payment`
document at all, so they fall through to the `else` branch at
`order.service.ts:1343`, which **only logs**.

> **Finding: cash orders currently generate no commission whatsoever.** No
> `MerchantPayoutLedger` entry, no `WalletTransaction`. The merchant keeps 100%
> of the cash and the platform records nothing. This is a pre-existing revenue
> gap, independent of this change, and this change is what closes it.

Resulting rule - **accrue everywhere, settle only where the platform controls
the money**:

| Flow                            | Accrue 19%? | Can settle?                                 | Why                                                      |
| ------------------------------- | ----------- | ------------------------------------------- | -------------------------------------------------------- |
| Online (`konnect`, HELD→EARNED) | Yes         | **Yes** - withhold from payout              | Platform holds the funds                                 |
| `pay_on_delivery`               | Yes         | **Yes** - driver remits, platform withholds | Money passes through the driver                          |
| `cash_on_pickup`                | **Yes**     | No                                          | Customer pays the merchant directly; nothing to withhold |

`cash_on_pickup` accrues and carries. The balance is collected from the
merchant's next online or delivery order. This is safe because the balance is
never discarded, and it is a strict improvement on today, where those orders
yield zero.

**3. (Non-blocking) Tunisian accountant sign-off.** Narrowed during design. The
earlier "you become a food reseller" concern was overstated and is withdrawn:
goods pass merchant → customer directly, the platform never takes possession,
and keeping sale proceeds against an existing debt is a set-off, not a resale.
What remains is bookkeeping: commission is a taxable service needing an invoice
even when settled by set-off, and the merchant books revenue on a settlement
order despite receiving less cash. Does not block build.

---

## Progress log

**2026-09-20 - Phase 1 (backend core) complete and verified.**

| Item                                                    | Where                                                             |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `SETTLEMENT_THRESHOLD`, `MAX_SETTLEMENT_SHARE_OF_ORDER` | `orders/utils/order-pricing.util.ts`                              |
| `calculateCommissionSettlement()`                       | same file                                                         |
| `Establishment.commissionDue` (`default: 0`)            | `establishments/schemas/establishment.schema.ts`                  |
| `CommissionLedger` (append-only, unique `orderId+type`) | `payments/schemas/commission-ledger.schema.ts`                    |
| `CommissionService` (apply + reverse)                   | `payments/services/commission.service.ts`                         |
| Order hook, inside the existing transaction             | `orders/order.service.ts` ~1318                                   |
| Refund reversal                                         | `admin/services/order-management.service.ts` (`adminIssueRefund`) |
| `pricing.merchantAmount` / `pricing.commissionSettled`  | `orders/schemas/order.schema.ts`                                  |

Verified: `check:ts` clean; 313 backend tests pass; `verify:indexes:strict` 0
missing / 0 mismatched; mutation check (skip the accrual) fails 12 tests.

**2026-09-20 - Phase 4 (web copy) complete.** `81%` and every "free to join"
claim removed across `en` / `fr` / `ar`. French written first per
`.claude/rules/seo.md`. The hero trust list dropped from three items to two,
which required editing the hardcoded array in `(marketing)/page.tsx` as well as
the locale files. 685 i18n + SEO tests pass.

---

## Decisions (continued)

**2026-09-20 - `MERCHANT_EARNINGS_EXPR` needed a stored value, not a formula.**
It computed `subtotal * 0.81` and fed three dashboards
(`analytics.service.ts:652`, `order.service.ts:1770`, `:1965`). Under this model
merchant earnings are `subtotal - settled`, so every one of them would have
under-reported by 19% - silently, with no test failing. Resolved by
denormalising `pricing.merchantAmount` onto the order at settlement and reading
it via `$ifNull`, falling back to the flat formula for orders that predate the
model. `pricing.merchantAmount` therefore has **no schema default**: a default
of 0 would make `$ifNull` match and report every historical order as zero.

**2026-09-20 - "Free to join" removed everywhere, not just the hero.**
`subscriptionStatus` is `'trial' | 'paid' | 'suspended'` with `trialEndsAt`, so
joining is free but staying is not. Found in five places across three locales,
including a ticker item and two CTA footnotes on the companies page.

**2026-09-20 - Rejected "you keep 100% of the commission" as website copy.**
Factually false: the commission is the platform's 19% and the merchant never
keeps it. Shipped "you keep 100% of the **price** on most bags", which is true,
carries the same "100%" hook, and survives an accountant.

---

## Open questions (continued)

**4. (Blocking nothing yet, but it shapes the copy) What should
`MAX_SETTLEMENT_SHARE_OF_ORDER` be?**

The cap sets how often a settlement happens:
`settlements / orders = 0.19 / cap`.

| Cap           | Orders paying full price | Merchant's worst order |
| ------------- | ------------------------ | ---------------------- |
| 0.5 (current) | 62%                      | keeps half             |
| 0.67          | 72%                      | keeps a third          |
| 0.8           | 76% - "3 out of 4 bags"  | keeps a fifth          |
| 1.0           | 81% - "4 out of 5 bags"  | **keeps nothing**      |

A smaller cap means gentler hits, more often. Website copy currently says "most
bags", which stays true at any value in this table. Left at 0.5 pending a call.

---

## Progress log (continued)

**2026-09-20 - Phase 3 (admin) and Phase 2 (merchant UX) complete.**

| Item          | Where                                                             |
| ------------- | ----------------------------------------------------------------- |
| Admin API     | `admin/controllers/commission-management.controller.ts` + service |
| Admin page    | `/[locale]/(admin)/admin/commission` + ledger sheet               |
| Merchant API  | `GET /payments/my-commission/:establishmentId`                    |
| Merchant card | `components/dashboard/merchant/commission-card.tsx`               |
| i18n          | `adminCommission` + `dashboard.commission`, all three locales     |

**2026-09-20 - Publish gate closed (out of original scope, found while verifying
an assumption).** `PATCH /offers/:id {"status":"active"}` bypassed the
establishment-approval check that `PATCH /offers/:id/status` enforces. Decision
extracted to `offers/utils/publish-gate.util.ts` so both routes share it.

---

## Decisions (continued)

**2026-09-20 - CORRECTION: the approval gate does exist. An earlier note here
was wrong.** This file previously recorded that "offers are blocked only when
`subscriptionStatus === 'suspended'`; there is no `isVerified` check", and that
a merchant could therefore trade without admin approval. That was based on
reading `validateEstablishmentOwnerOnly` alone.

It is wrong. `create()` produces a **draft** (`OfferStatus.DRAFT` is the schema
default and `create()` does not override it), and publishing goes through
`updateStatus()` → `validateEstablishmentOwnership`, which **does** require
`EstablishmentStatus.ACTIVE`. `approveEstablishment` is the only thing that sets
it. The draft-only variant is deliberate and documented in its own docblock:
unapproved merchants may prepare listings, not sell.

What was genuinely missing was narrower: `update()` accepted `status` from the
DTO and spread it into `findByIdAndUpdate` with no approval check, so the
guarded route could simply be avoided. Fixed above.

**2026-09-20 - Admin and merchant views are deliberately different products.**
Admin needs drift detection, so the reconciliation delta leads and the effective
rate is coloured by whether it hit 19%. A merchant needs to understand what they
were paid, so the month leads (sold / commission / received, which reconciles to
the flat rate like any ordinary arrangement) and the outstanding balance is
muted, last, and never coloured. Same data, opposite hierarchy.

---

## Open questions (continued)

**5. `MAX_SETTLEMENT_SHARE_OF_ORDER` is still 0.5.** See question 4. Unchanged
pending a product call; the shipped copy stays true at any value.

**6. Website copy.** The owner intends to replace the merchant-facing line with
"you keep 100% of the commission". That claim is false - the commission is the
platform's 19% and the merchant keeps none of it - and was not written into the
repo. Current shipped copy is "you keep 100% of the price on most bags". Exact
locations recorded for a manual edit: `hero.trust.share`, `…wins.merchant.what`,
`audienceSplit.merchant.body` in all three locale files.

**7. No test covers the admin commission aggregations.** They are read-only
Mongo pipelines; a mocked `aggregate` would assert pipeline shape rather than
behaviour, which `.claude/rules/testing.md` explicitly does not count. Needs an
integration test against a real Mongo, not a unit test.
