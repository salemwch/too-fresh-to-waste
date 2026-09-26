---
status: in-review
scope: backend
gate:
  pnpm --filter @foodwaste/backend check:all && pnpm --filter @foodwaste/backend
  test:db
---

## Intent

TFTW earns 19% of every NORMAL food sale without ever taking money from the
merchant's pocket. Each NORMAL sale records 19% into a per-establishment
obligation (`commissionDue`). That obligation is later recovered **in food**: a
SETTLEMENT order is one where the merchant supplies food for less than its price
(or for nothing), TFTW sells it, and the customer's money for the difference is
TFTW's. This file is the domain model the implementation must follow.

Status history: `draft` -> `ready-for-dev` (2026-09-24, round 3) -> back to
`draft` (2026-09-24, round 4): the settlement rule was corrected and the driver
cash model was added, with three open questions below.

## Glossary

| Term                    | Meaning                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Sale value              | `order.pricing.subtotal`. Food only. The delivery fee is never part of the commission base.                   |
| `commissionDue`         | `Establishment.commissionDue`. The accumulated 19% obligation to TFTW. Per location, never pooled.            |
| Merchant payout balance | What TFTW owes the merchant from sales whose money TFTW holds. Source of truth: `MerchantPayoutLedger`.       |
| `controlledBy`          | Who holds the customer's payment: `TFTW` or `MERCHANT`. Set once at order creation.                           |
| NORMAL                  | A sale the merchant is paid for in full. Accrues 19%.                                                         |
| SETTLEMENT              | A TFTW-controlled sale the merchant supplies at a reduction, to recover `commissionDue`. Accrues **nothing**. |
| `settled`               | The reduction: `min(commissionDue, subtotal)`. The part of the customer's payment that is TFTW's.             |
| `merchantAmount`        | What the merchant is paid for the order: `subtotal - settled`.                                                |
| Threshold               | `SETTLEMENT_THRESHOLD` = 5.000 TND. Below it, no order settles.                                               |
| Driver float            | TFTW's working cash, issued to a driver (e.g. 50 TND) and kept by them day to day. Never the driver's money.  |
| Cutoff                  | `COMMISSION_MODEL_EFFECTIVE_AT`. Sales before it are never re-accrued.                                        |

**Two balances, never mixed.** `commissionDue` is what the merchant owes TFTW.
The merchant payout balance is what TFTW owes the merchant. They meet only
inside a SETTLEMENT order, where `settled` reduces the first instead of feeding
the second.

## Rules

1. **Kind is decided first**, from `controlledBy` and the balance _before_ the
   order:
   - `controlledBy == MERCHANT` -> always NORMAL.
   - `controlledBy == TFTW` and `commissionDue >= threshold` -> SETTLEMENT.
   - otherwise NORMAL. Eligibility is read from `controlledBy`, **never** from
     `paymentMethod`.
2. **NORMAL:** `accrued = round3(subtotal * 0.19)`, `settled = 0`,
   `merchantAmount = subtotal`, `commissionDue += accrued`.
3. **SETTLEMENT:** `accrued = 0`, `settled = min(commissionDue, subtotal)`,
   `merchantAmount = subtotal - settled`, `commissionDue -= settled`. A
   SETTLEMENT order is not a new commission-generating sale: it converts
   commission already earned on earlier NORMAL sales into cash.
4. **Never both.** No order both accrues and settles.
5. A settlement never takes `commissionDue` below zero.
6. **Merchant payout ledger:** receives `merchantAmount` for a TFTW-controlled
   order **only when TFTW pays the merchant later**. A merchant paid on the spot
   (cash at the counter, or by a driver from the float) gets no payout entry -
   they have been paid. See the open question on online delivery.
7. **Cutoff:** the rule applies only to sales whose commission moment (below) is
   `>= COMMISSION_MODEL_EFFECTIVE_AT`. Earlier sales keep their current state.
8. The customer always receives the full offer and always pays the full price.
   Only the allocation of that payment changes between NORMAL and SETTLEMENT.

### Consequence, stated once

TFTW's commission is 19% **of NORMAL sales**. Settlement food is paid for by
that commission, so it is not itself charged. Measured against _all_ food sold
through the platform (NORMAL + SETTLEMENT), the long-run share is
`0.19 / 1.19 = 15.97%`. `commission-settlement.spec.ts` currently treats this
rule as a bug ("collects 16%, not 19%"); it is now the intended rule, and that
suite is rewritten in step 1 to assert it.

## Payment control (who holds the money)

Resolved once, at order creation, stored as `order.paymentControl`, never
re-derived.

| `paymentMethod`    | Family | `collector`     | `controlledBy` | Can settle |
| ------------------ | ------ | --------------- | -------------- | ---------- |
| `cash_on_pickup`   | CASH   | MERCHANT        | MERCHANT       | never      |
| `pay_on_delivery`  | CASH   | DRIVER          | TFTW           | yes        |
| `online` (Konnect) | ONLINE | PAYMENT_GATEWAY | TFTW           | yes        |
| anything else      | -      | -               | rejected       | -          |

`stripe`, `paypal`, `apple_pay`, `google_pay` pass DTO validation but nothing
charges them (G8): rejected at creation, never defaulted.

## Cash movements per flow

`f` = delivery fee, `d` = driver share of it (`DELIVERY_DRIVER_SHARE`, 0.8),
`p = f - d` = platform share.

| Flow                       | Merchant is paid                       | Customer pays            | TFTW's money from the order          |
| -------------------------- | -------------------------------------- | ------------------------ | ------------------------------------ |
| Pickup, cash, NORMAL       | `subtotal` by the customer             | `subtotal` to merchant   | none (19% accrues)                   |
| Pickup, online, NORMAL     | `subtotal` via payout ledger           | `subtotal` to TFTW       | none (19% accrues)                   |
| Pickup, online, SETTLEMENT | `merchantAmount` via payout ledger     | `subtotal` to TFTW       | `settled`                            |
| Delivery, cash, NORMAL     | `subtotal` by driver, from float       | `subtotal + f` to driver | `p` (driver keeps `d`)               |
| Delivery, cash, SETTLEMENT | `merchantAmount` by driver, from float | `subtotal + f` to driver | `settled + p`                        |
| Delivery, online           | see open question Q2                   | `subtotal + f` to TFTW   | NORMAL `p`; SETTLEMENT `settled + p` |

Worked through, with `f = 4`, `d = 3.20`, `p = 0.80`:

- NORMAL 10: driver float 50 -> pays merchant 10 -> 40 -> collects 14 -> 54. Of
  the 4 above float: 3.20 is the driver's, **0.80 is owed to TFTW**.
- SETTLEMENT, due 5, sale 10: pays merchant 5 -> 45 -> collects 14 -> 59. Of the
  9 above float: 3.20 driver, **5.80 owed to TFTW** (5 settled + 0.80).
- SETTLEMENT, due 57, sale 57: pays merchant 0 -> 50 -> collects 61 -> 111. Of
  the 61 above float: 3.20 driver, **57.80 owed to TFTW** (57 + 0.80).

(`d` is shown as kept from cash - see Q3.)

## Commission moment

The instant the order's kind is decided and `commissionDue` moves. It must be
the moment **the merchant is paid and hands over the food**, because that is
when the merchant settles: once a driver has paid 5 for 10 worth of food, the
merchant has already given the reduction and cannot be asked again.

- Pickup: pickup confirmation (`pickedUpAt`).
- Delivery: the driver collecting from the merchant - see Q1.

## Driver cash ledger (new: `driver_cash_ledger`)

One row per pay-on-delivery order, plus float and handover movements.
Append-only; corrections are new rows.

Per-order record:

| Field                                            | Meaning                                                  |
| ------------------------------------------------ | -------------------------------------------------------- |
| `orderId`, `driverId`                            |                                                          |
| `paidToMerchant`                                 | `merchantAmount`, paid from the float at the merchant    |
| `expectedCash`                                   | `pricing.total` = `subtotal + f`, what the customer owes |
| `collectedCash`                                  | what the driver confirms receiving from the customer     |
| `driverKeeps`                                    | `d` (see Q3)                                             |
| `dueToTftw`                                      | `collectedCash - paidToMerchant - driverKeeps`           |
| `handedOverCash`                                 | allocated from handover batches                          |
| `outstandingCash`                                | `dueToTftw - handedOverCash`                             |
| `collectedAt`, `handedOverAt`, `handoverBatchId` |                                                          |
| `status`                                         | see below                                                |

Status:

```
EXPECTED ──driver confirms payment──> COLLECTED ──batch covers dueToTftw──> HANDED_OVER
   │                                     │  └──batch covers part──> PARTIALLY_HANDED_OVER ──rest──> HANDED_OVER
   │                                     └──collectedCash < expectedCash──> SHORT (admin-visible)
   └──delivery failed──> VOID (float paid to merchant is recorded as a TFTW loss, see Q4)
```

Float movements: `FLOAT_ISSUED`, `FLOAT_RETURNED`, with amount and admin actor.

Handover batch: one per handover,
`{ batchId, driverId, amount, receivedBy, receivedAt }`, allocated oldest-first
across the driver's COLLECTED / PARTIALLY_HANDED_OVER rows. Any unallocated
remainder or shortfall is recorded on the batch, never silently dropped.

**Revenue recognition.** TFTW's `settled` and `p` on a pay-on-delivery order are
a **receivable from the driver** until the row is HANDED_OVER. Dashboards and
reports show them as "collected by driver, not yet handed over", never as cash
received. `commissionDue` still moves at the commission moment (the merchant has
settled); what waits for handover is TFTW's cash, not the merchant's balance.

### Reconciliation report (admin)

Per driver and in total, for a period:

| Expected | Collected | Handed over | Outstanding | Float issued | Float returned |
| -------- | --------- | ----------- | ----------- | ------------ | -------------- |

Flagged rows: `collectedCash != expectedCash`; any batch with unallocated or
missing cash; COLLECTED older than a configurable age (e.g. 24 h); a driver's
`float + outstanding` above a limit. Every flag is visible to admin; none is
auto-resolved.

## Worked examples - commission (threshold 5)

| #   | Due before | Sale               | Controlled | Kind       | Accrued | Settled | Merchant paid | Due after |
| --- | ---------- | ------------------ | ---------- | ---------- | ------- | ------- | ------------- | --------- |
| 1   | 0          | 10 cash_on_pickup  | MERCHANT   | NORMAL     | 1.90    | 0       | 10            | 1.90      |
| 2   | 20.00      | 10 cash_on_pickup  | MERCHANT   | NORMAL     | 1.90    | 0       | 10            | 21.90     |
| 3   | 0          | 10 online          | TFTW       | NORMAL     | 1.90    | 0       | 10            | 1.90      |
| 4   | 3.00       | 10 online          | TFTW       | NORMAL     | 1.90    | 0       | 10            | 4.90      |
| 5   | 4.99       | 10 online          | TFTW       | NORMAL     | 1.90    | 0       | 10            | 6.89      |
| 6   | 5.00       | 10 online          | TFTW       | SETTLEMENT | 0       | 5.00    | 5.00          | 0         |
| 7   | 20.00      | 10 online          | TFTW       | SETTLEMENT | 0       | 10.00   | 0             | 10.00     |
| 8   | 57.00      | 57 pay_on_delivery | TFTW       | SETTLEMENT | 0       | 57.00   | 0             | 0         |
| 9   | -3.00      | 10 online          | TFTW       | NORMAL     | 1.90    | 0       | 10            | -1.10     |
| 10  | 5.00       | 10 pay_on_delivery | TFTW       | SETTLEMENT | 0       | 5.00    | 5.00          | 0         |
| 11  | 3.00       | 10 pay_on_delivery | TFTW       | NORMAL     | 1.90    | 0       | 10            | 4.90      |
| 12  | 5.00       | 10 cash_on_pickup  | MERCHANT   | NORMAL     | 1.90    | 0       | 10            | 6.90      |
| 13  | 0          | 10 + 4 fee online  | TFTW       | NORMAL     | 1.90    | 0       | 10            | 1.90      |

#10 vs #12: same cash, amount and balance; only the collector differs.

Refunds (`delta = (settled - accrued) * r`, unchanged formula - one term is
always 0 now):

| #   | Refund of | Delta  | Due after |
| --- | --------- | ------ | --------- |
| R1  | #1, r 1   | -1.90  | 0         |
| R2  | #6, r 1   | +5.00  | 5.00      |
| R3  | #7, r 1   | +10.00 | 20.00     |
| R4  | #6, r 0.5 | +2.50  | 2.50      |

## State transitions

### Order commission state (post-cutoff only)

```
          MERCHANT, or TFTW with due < 5           refund r
 NONE ──────────────────────────────────> NORMAL ───────────> REVERSED / PARTIALLY_REVERSED
   │          TFTW with due >= 5                   refund r
   └────────────────────────────────────> SETTLEMENT ───────> REVERSED / PARTIALLY_REVERSED
```

Forbidden:

| Transition                                | Guard                                        |
| ----------------------------------------- | -------------------------------------------- |
| Accrue on a SETTLEMENT order              | rule 3/4, pure function returns `accrued: 0` |
| Settle on a NORMAL order                  | rule 2/4                                     |
| Settle a MERCHANT-controlled order        | rule 1                                       |
| Settle below the threshold                | rule 1                                       |
| Settle more than the balance or the sale  | `min(commissionDue, subtotal)`               |
| Apply the same order twice                | unique `(orderId, type)` ledger index        |
| Apply before the cutoff                   | rule 7                                       |
| Re-classify `controlledBy` after creation | written once                                 |
| Edit amounts after writing                | REVERSAL / ADJUSTMENT rows only              |

### `commissionDue`

| Event                           | Change                      |
| ------------------------------- | --------------------------- |
| ACCRUAL (NORMAL)                | `+ accrued`                 |
| SETTLEMENT                      | `- settled`                 |
| REVERSAL (refund, ratio r)      | `+ (settled - accrued) * r` |
| ADJUSTMENT (admin, with reason) | signed, audited             |

## Invariants

Per order with `order.commission`:

- NORMAL => `settled == 0`, `accrued == round3(subtotal * 0.19)`,
  `merchantAmount == subtotal`.
- SETTLEMENT => `accrued == 0`, `0 < settled <= subtotal`,
  `settled <= dueBefore`, `merchantAmount == subtotal - settled`,
  `controlledBy == TFTW`, `dueBefore >= 5`.
- `merchantAmount + settled == subtotal` always.
- `dueAfter == dueBefore + accrued - settled`.
- `appliedAt >= COMMISSION_MODEL_EFFECTIVE_AT`.

Per establishment:

- `commissionDue == sum(balanceDelta)` over its ledger rows.
- `sum(accrued) == 0.19 * sum(subtotal of NORMAL orders)` (to rounding),
  post-cutoff.

Per driver (cash ledger):

- `dueToTftw == collectedCash - paidToMerchant - driverKeeps` on every row.
- `sum(batch amounts) == sum(handedOverCash) + recorded unallocated remainder`.
- Cash the driver should hold ==
  `float issued - float returned + sum(outstandingCash)`.

## Gaps (verified 2026-09-24)

- **G1** cash sales never accrue (pickup path accrues only for HELD payments).
- **G2** `markDelivered` has no money effects at all.
- **G3** wallet uses 81% (`konnect-order.service.ts`).
- **G4** payout fallback uses 81% (`PayoutService.createLedgerEntry`).
- **G5** no explicit order kind.
- **G6** no reversal for merchant-controlled refunds.
- **G7** wallet move outside the pickup transaction.
- **G8** DTO accepts payment methods nothing charges.
- **G9** no stored `controlledBy`.
- **G10** the current engine accrues on settling orders
  (`calculateCommissionSettlement`), which the corrected rule forbids.
- **G11** no driver float, driver cash ledger, handover or reconciliation
  exists.
- **G12** nothing tells a driver how much to pay the merchant.
- **G13** (fixed 2026-09-24) `CLAUDE.md` said "driver 3.00 / platform 1.00"; now
  documents distance bands and `DELIVERY_DRIVER_SHARE`.

## Tests & Acceptance

### Written now (red until implementation) - `orders/__tests__/commission-model.spec.ts`

State 2026-09-24: both files written and **red for the intended reason** -
`commission-model.util` / `payment-control.util` do not exist yet, and
`COMMISSION_MODEL_EFFECTIVE_AT` is not declared (8 of 14 env cases fail: the
required and rejection cases; the 6 acceptance / keep-instant / dev-absent cases
pass, proving the rejections are not vacuous). Because `check:ts` covers tests,
the backend type-check is red until step 0-1 lands.

- [x] T0 `resolvePaymentControl`: the three supported methods; every DTO value
      placed or rejected; unsupported and empty values rejected.
- [x] T1 `decideCommission({ subtotal, commissionDue, controlledBy })`: examples
      #1-#13; #10 vs #12; never both accrue and settle; MERCHANT never settles
      for due in {0, 4.99, 5, 100}; boundary 4.999 / 5.000; zero subtotal; no
      `paymentMethod` input; refunds R1-R4; seeded property run asserting every
      invariant above after every event, and the 0.19-of-NORMAL identity.
- [x] T1b env: `COMMISSION_MODEL_EFFECTIVE_AT` required in production, offset
      required, unparseable rejected -
      `config/__tests__/env-validation-commission-cutoff.spec.ts`.

### After Q1-Q4

- [ ] T2 real MongoDB: cash pickup, online pickup NORMAL / SETTLEMENT, delivery
      NORMAL / SETTLEMENT at the commission moment; cutoff either side;
      concurrent confirmation counted once; refunds; ledger conservation.
- [ ] T4 driver cash ledger: the three worked flows above to the millime;
      COLLECTED stays a receivable until handover; partial handover; SHORT;
      unallocated batch remainder; reconciliation totals and every flag.
- [ ] T1c audit report; T3 dashboard.

## Implementation order (after test review)

0. `resolvePaymentControl` + `paymentControl` at creation; reject unsupported
   (G8, G9).
1. `decideCommission`; `CommissionService` uses it; rewrite
   `commission-settlement.spec.ts` for the corrected rule (G10).
2. `order.commission`; cutoff env; backfill from existing ledger rows; audit
   script.
3. Shared `applyCommission(order, moment, session)` at pickup and at the
   delivery commission moment (G1, G2).
4. Driver cash ledger, float, handover batches, reconciliation (G11, G12).
5. Wallet / payout use `merchantAmount`, inside the transaction (G3, G4, G7).
6. Merchant-controlled refund reversal (G6). 7. Dashboard (T3). Fix CLAUDE.md
   (G13).

## Decisions

- 2026-09-24: The settling sale accrues its own 19% (product owner). The "does
  not accrue" rule is rejected: it collects ~16% over time.
- 2026-09-24: Cash sales accrue 19% and are always NORMAL (product owner).
- 2026-09-24: Normal online sale pays the merchant 100%, not 81% (product
  owner).
- 2026-09-24: `MerchantPayoutLedger` is the source of truth for what the
  merchant is owed; the 81% wallet card is not (product owner).
- 2026-09-24: Explicit `order.commission` metadata instead of inferring from
  ledger rows (product owner).
- 2026-09-24: Settlement eligibility is `controlledBy`, never `paymentMethod`.
  `pay_on_delivery` is TFTW-controlled (the driver collects for TFTW) and
  settles like online. The draft line "cash sales are always NORMAL" is
  superseded: only merchant-collected cash is (product owner).
- 2026-09-24: No retroactive accrual; the model applies from
  `COMMISSION_MODEL_EFFECTIVE_AT`; historical orders keep their state (product
  owner).
- 2026-09-24: Unsupported payment methods are rejected rather than defaulted
  (engineering). The cutoff env var is required in production with an explicit
  offset (engineering). Its value is chosen by the product owner only - no
  example date is hardcoded anywhere (product owner).
- **2026-09-24 (reversal of the first decision above): a SETTLEMENT order does
  NOT accrue 19%.** NORMAL adds 19%; SETTLEMENT subtracts `settled`; never both
  on one order (product owner). Reason given: a settlement order converts
  commission already earned into cash; it is not a new commission-generating
  sale. Consequence recorded: 19% of NORMAL sales, 15.97% of all food sold.
  `commission-settlement.spec.ts` changes from treating this as a bug to
  asserting it.
- 2026-09-24: Driver cash is part of the money model, not an ops TODO. Drivers
  run on a TFTW float; a driver cash ledger with handover batches and an admin
  reconciliation report is required (product owner).
- 2026-09-24: The delivery fee split comes from the existing `splitDeliveryFee`
  / `DELIVERY_DRIVER_SHARE`, not a fixed 3 / 1 (product owner: "we already have
  how much the delivery takes").
- 2026-09-24: Delivery fee split changed from 67 / 33 to **driver 80% / platform
  20%** (product owner). Shipped separately from this model: default in
  `packages/shared` and `env.validation.ts`; new orders only - each order stores
  the split it was created with.

## Progress

- 2026-09-24 **Step 0 done** - `orders/utils/payment-control.util.ts`;
  `paymentControl` stored at creation; unsupported methods and method /
  fulfilment mismatches rejected before anything is written.
- 2026-09-24 **Step 1 done** - `orders/utils/commission-model.util.ts`
  (`decideCommission`, `commissionReversalDelta`); `CommissionService` runs V2
  at or after the cutoff and the unchanged LEGACY engine before it (online HELD
  pickups only); idempotency probes ACCRUAL **and** SETTLEMENT rows;
  `order.commission` frozen in the same transaction.
- 2026-09-24 **Step 2 partly done** - `COMMISSION_MODEL_EFFECTIVE_AT` declared,
  parsed by `config/commission-cutoff.util.ts` (rejects no-offset, date-only,
  rolled-over dates), in `.env.example`. Backfill + audit script pending.
- 2026-09-24 **Step 3, pickup half done** - pickup confirmation applies
  commission for every pickup; `pickedUpAt` now actually written (it was never
  set on this path: findOneAndUpdate skips the pre-save hook).
- Gates: backend `check:ts` clean; unit 2064 / 2064; integration 96 / 96;
  mutation-checked: V2 accrue-on-settlement, MERCHANT settling, idempotency.
- 2026-09-24 **Step 2 done** - `scripts/migrations/backfill-payment-control.ts`
  (dry run by default; phase 1 paymentControl via
  `orders/utils/legacy-payment-control.util.ts`, phase 2 LEGACY
  `order.commission` copied from existing ledger rows only) and
  `scripts/audit-commission-cutoff.ts` (read-only, exits 1 on post-cutoff orders
  missing a decision). Both dry-run against the local database: 2470 orders
  classified, 0 anomalies; audit groups reconcile to all completed orders.
- 2026-09-24 **Step 3 delivery half + Step 4 done** - `DriverCashService`
  (`drivers/services/driver-cash.service.ts`): merchant pickup / delivered /
  failed as single transactions; frozen `driverInstruction`; float, signed
  handover batches, recovery resolution, reconciliation with flags; admin routes
  `admin/driver-cash/*` (ADMIN only). Pure rules
  `drivers/utils/driver-cash.util.ts`. Collections `driver_delivery_cash`,
  `driver_cash_handovers`, `driver_float_movements`.
- 2026-09-24 **Step 5 done** - wallet: pickup sale credits the FULL subtotal to
  pending, delivery credits nothing; pickup confirmation moves exactly the SALE
  amount out of pending and `merchantAmount` into available, INSIDE the pickup
  transaction (was after it, errors only logged); refund reverses the SALE
  amount. `CreateLedgerDto.commissionSettlement` is now required - the 81%
  fallback is gone and the compiler enforces it.
- 2026-09-24 **Step 6 done** - admin refund of a non-Konnect completed sale is
  recorded as an in-person refund: status REFUNDED, commission reversed, audit
  log `offline: true`. Previously rejected outright.
- Gates at this point: backend check:ts 0 errors; lint 0 errors on touched
  files; prettier clean on touched files (the backend-wide check:format fails on
  ~2600 pre-existing files, unrelated); unit 2125 / 2125; integration 123 / 123
  (12 suites); READMEs added for drivers and payments.
- 2026-09-24 **Step 7 done**:
  - Mobile driver: `DeliveryMoneyCard` (frozen instruction), `ConfirmCashSheet`
    (confirmed `collectedCash`; short warned, over blocked, online = 0),
    `ReportProblemSheet` (reason + food outcome; merchant fault -> returned
    only); "Pay the merchant now" alert at pickup; strict amount parser (comma,
    Arabic-Indic digits, 3 decimals).
  - Backend safety fix found while building it: a collected order can no longer
    be unassigned (manual -> 409, timeout job skips it) - releasing it stranded
    the float payment and made the next driver's pickup fail on the unique cash
    record. Flagged as STALE_UNDELIVERED in reconciliation instead.
  - Web merchant: `TodaySalesCard` (cash + online; profit = received - recorded
    commission, read from each order's frozen decision); wallet card copy
    corrected (pending moves on pickup CONFIRMATION, not "window closes") with
    info disclosures; InfoDisclosure component (DESIGN.md §13.12).
  - Web admin: `/admin/drivers/cash` - KPIs, per-driver reconciliation with
    flags, handover / float dialogs (signed amounts), pending-recovery
    decisions.
- Final gates 2026-09-24: backend check:ts 0, unit 2130, integration 126, lint 0
  / prettier clean on touched files; web type-check 0, 1299 tests, check:design
  clean (baseline regenerated deliberately after each reviewed diff); mobile
  type-check 0, 2476 tests, 430 snapshots.
- **Not yet done (why in-review, not done):** the adversarial review lenses
  (`.claude/rules/adversarial-review.md`); on-device check of the driver sheets
  and RTL rendering; native-speaker review of the new fr / ar copy.

## Deploy checklist (not done - needs the product owner)

1. Choose and set `COMMISSION_MODEL_EFFECTIVE_AT` in the production env.
2. Set (or delete) `DELIVERY_DRIVER_SHARE` in the production env - 0.8.
3. `pnpm --filter @foodwaste/backend db:create-indexes` against production.
4. `pnpm --filter @foodwaste/backend migration:backfill-payment-control` (dry
   run), review, then `:execute`.
5. After release: `audit:commission-cutoff` must exit 0.

## Final decisions for delivery (2026-09-24, product owner)

1. **Decision moment.** NORMAL / SETTLEMENT is decided automatically at the
   driver's pickup from the merchant (`DRIVER_ASSIGNED -> OUT_FOR_DELIVERY`),
   and frozen with every money figure the driver needs (`order.commission`,
   `order.driverInstruction`). Never recalculated on re-open. The driver sees
   `PAY MERCHANT: x.xx TND` and follows it. Implementation note: frozen inside
   `markPickedUp`'s transaction rather than at acceptance - freezing at
   acceptance would need the settlement reserved and released whenever a driver
   drops the order, a race on the balance. The cutoff for delivery is compared
   against `driverPickedUpAt`.
2. **Every delivery, online or cash: the driver pays the merchant
   `merchantAmount` immediately from the TFTW float.** No merchant payout entry
   for any delivery order - the merchant has been paid. The payout ledger is for
   online **pickup** orders only.
3. **The driver keeps their 80% of the delivery fee from the cash collected.**
   Reconciliation separates food money, driver earnings, TFTW delivery revenue
   and TFTW settlement. The driver keeps the float between periods.
4. **Failed delivery after the merchant was paid** - see "Failed deliveries".

Operational rule, in order: backend decides and freezes at merchant pickup ->
driver pays merchant from float -> driver delivers -> customer pays per method
-> driver keeps 80% of the fee, TFTW 20% -> SETTLEMENT adds no 19%, NORMAL adds
19%.

## Driver cash (implemented in step 4)

Per delivery order, one `DriverDeliveryCash` record (fields as listed under
"Driver cash ledger" above), created at merchant pickup:

```
paidToMerchant   = merchantAmount                        (from float)
expectedCash     = pay_on_delivery ? pricing.total : 0   (online: TFTW already has it)
driverKeeps      = driverEarnings (80% of fee)           (kept from cash)
dueToTftw        = collectedCash - paidToMerchant - driverKeeps
outstandingCash  = dueToTftw - handedOverCash            (signed)
```

`outstandingCash > 0`: the driver holds TFTW money. `< 0`: TFTW owes the driver
(an online delivery drained the float and paid no cash - the float must be
replenished and the 80% paid). Handover batches are signed the same way.

Worked, fee 4 (driver 3.20, TFTW 0.80):

| Order                               | Paid merchant | Collected | Driver keeps | dueToTftw | = TFTW delivery + settlement     |
| ----------------------------------- | ------------- | --------- | ------------ | --------- | -------------------------------- |
| COD NORMAL 10                       | 10            | 14        | 3.20         | 0.80      | 0.80 + 0                         |
| COD SETTLEMENT, due 5, 10           | 5             | 14        | 3.20         | 5.80      | 0.80 + 5                         |
| COD SETTLEMENT, due 57, 57          | 0             | 61        | 3.20         | 57.80     | 0.80 + 57                        |
| Online NORMAL 10 (customer paid 14) | 10            | 0         | 3.20         | -13.20    | TFTW holds 14: 14 - 13.20 = 0.80 |
| Online SETTLEMENT, due 5, 10        | 5             | 0         | 3.20         | -8.20     | 14 - 8.20 = 5.80                 |

Statuses: `EXPECTED` (merchant paid, not delivered) -> `COLLECTED` (delivered,
not reconciled) -> `PARTIALLY_HANDED_OVER` -> `HANDED_OVER` (outstanding 0);
`SHORT` (collected < expected, still reconcilable, always flagged); `FAILED`
(delivery failed - see below).

## Failed deliveries

A failure after merchant pickup requires
`deliveryFailure = { reason, faultParty, recovery }`; the order becomes
CANCELLED (no new OrderStatus - adding one ripples through three apps).

| reason                                                         | faultParty |
| -------------------------------------------------------------- | ---------- |
| CUSTOMER_REFUSED / CUSTOMER_UNREACHABLE / CUSTOMER_UNAVAILABLE | CUSTOMER   |
| MERCHANT_FAULT                                                 | MERCHANT   |
| DRIVER_FAULT                                                   | DRIVER     |

| recovery             | Commission                 | Driver cash                                     | TFTW loss booked       |
| -------------------- | -------------------------- | ----------------------------------------------- | ---------------------- |
| RECOVERABLE_PENDING  | unchanged                  | merchant payment still out of the float         | none yet               |
| RETURNED_TO_MERCHANT | reversed (sale undone)     | merchant returns `paidToMerchant` to the driver | none                   |
| UNRECOVERABLE        | stands (CUSTOMER / DRIVER) | merchant payment stays spent                    | `paidToMerchant` (COD) |

- MERCHANT fault must end RETURNED_TO_MERCHANT (the merchant cannot keep money
  for food they failed to supply); CUSTOMER / DRIVER fault may end either way.
- Online vs pay-on-delivery differ: on an online order TFTW already holds the
  customer's payment, so an UNRECOVERABLE loss is netted against it in the
  report and never booked as a cash shortfall; whether the customer is refunded
  stays with the existing admin refund flow (a customer-fault failure does not
  auto-refund).

## Open questions

### Resolved 2026-09-24 (kept for history)

- **Q1 - delivery commission moment.** The driver pays the merchant
  `merchantAmount` at the counter, so the kind must be decided before the driver
  pays - proposed: at the driver's pickup from the merchant
  (`DRIVER_ASSIGNED -> OUT_FOR_DELIVERY`), in the same transaction that shows
  the driver the amount to pay. The cutoff for delivery would then compare
  against that moment, not `deliveredAt`.
- **Q2 - online-paid delivery.** The customer already paid TFTW. Does the driver
  still pay the merchant from the float at the counter, or is the merchant paid
  through the payout ledger (driver pays nothing)?
- **Q3 - driver share.** Does the driver keep `d` from the collected cash at
  handover, or hand over everything above the float and get paid `d` separately?
- **Q4 - failed delivery after the merchant was paid.** Customer refuses or is
  unreachable after the driver paid the merchant: the merchant's NORMAL sale
  stands (19% accrues), and the food and the float money paid are TFTW's loss?

Q1-Q4 answered - see "Final decisions for delivery" and "Failed deliveries".

### Still open

- (blocking for release) The value of `COMMISSION_MODEL_EFFECTIVE_AT`.
- (non-blocking) **Platform revenue and donation basis.** `createSaleRecords`
  still books NET_COMMISSION and the 5% charity donation at 19% of each ONLINE
  sale, at payment time. Under the model TFTW earns 19% of NORMAL sales (cash
  included) when they complete, and nothing extra on SETTLEMENT sales. Left
  unchanged pending a decision - it feeds the donation pools.
- (non-blocking, defaulted) **Driver pay on a failed delivery.** Nothing was
  collected, so there is no cash to keep 80% from. Implemented as
  `driverKeeps = 0` on a FAILED record and flagged in reconciliation, so any
  compensation is an explicit admin adjustment, never an automatic payout.
- (non-blocking) Driver cash remittance: a `pay_on_delivery` driver holds TFTW's
  money until it is handed over - now recorded by the driver cash ledger.
- (non-blocking) Is 5 TND still the right threshold?
