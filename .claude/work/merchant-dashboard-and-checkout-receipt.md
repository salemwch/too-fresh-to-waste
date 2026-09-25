---
status: in-review
scope: cross-app
gate:
  pnpm --filter @foodwaste/mobile type-check && pnpm --filter @foodwaste/mobile
  test && pnpm --filter @foodwaste/web type-check && pnpm --filter
  @foodwaste/web test && pnpm --filter @foodwaste/web check:design
---

## Intent

Make the money a customer and a merchant see readable and complete: the mobile
checkout shows a full receipt (original price, discount, subtotal, delivery fee,
total), and the merchant web dashboard shows the commission card under every
location filter, explains its balances, shows today's sales across both payment
methods, and surfaces the freeze-streak call to action when it should. The Gifts
page offers merchants supplies they actually buy (packaging etc.).

## Constraints

- Pricing parity: checkout lines must equal what the backend stores
  (`discountAmount = (original - discounted) * qty`, rounded to 3 dp).
- DESIGN.md is binding for every UI value; no invented tokens.
- Translations atomic across en / fr / ar (mobile and web).
- Cash orders: money is collected by the merchant in store; the platform only
  holds online-payment money. Any "balance" must keep that distinction.

## Tasks & Acceptance

- [x] Mobile checkout receipt: original, discount, subtotal, fee, total, badge
      below total. `checkoutPricing.test.ts` + snapshot matrix.
- [x] Mobile Order Details uses the same labels and hides original price when
      there is no discount. `OrderPricingCard.test.tsx`.
- [x] Mobile Search list/toggle translated; ratchet lowered.
- [x] Web: commission card renders under "All locations".
- [x] Web: freeze-streak CTA - root cause found (by design: hidden once listed
      today).
- [x] Web: payments card - today's sales (cash + online) + explained balances.
- [x] Web: Gifts page - no internet offer; six supply categories with examples,
      how-it-works, no prices.

## Decisions

- 2026-09-24: Checkout's savings badge moved below the total; between rows it
  read as a second deduction of the Discount row's amount.
- 2026-09-24: Remaining ~92 hardcoded English strings in mobile are NOT fixed
  here. `hardcodedStrings.test.ts` already records that they need a native
  French/Arabic review in their own change; this work only lowers the ratchet.
- 2026-09-24: `orders.price` / `orders.finalPrice` removed (no remaining
  reader); Order Details now uses `checkout.originalPrice` / `common.subtotal`.

- 2026-09-24: Commission card under "All locations" fixed with a backend
  all-locations statement + per-location `dueByEstablishment`.
- 2026-09-24: Freeze-streak CTA is hidden by design once `listedToday` is true
  (the screenshot shows "Offre publiée aujourd'hui"). Not a trial issue. No
  change.
- 2026-09-24: Today's-sales backend (`GET /orders/merchant-today-sales`) built
  and tested. Web card PAUSED: its "you keep" line depends on the settlement
  model, which the user asked to settle first - see
  `commission-settlement-model.md` (draft).

- 2026-09-24: Today's-sales web card built on the corrected model (profit =
  received - commission recorded today, from each order's frozen decision). The
  earlier "19% of every sale" version of the backend was rewritten first.
- 2026-09-24: Gifts page keeps the owner's in-progress removal of the internet
  perk and adds hygiene + branding; still no prices (a number reads as a
  promise).

## Open questions

- (non-blocking) Arabic rendering of the "-18.00" discount value is unverified
  on device.
