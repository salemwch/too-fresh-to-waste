# Payments module

Online payments (Konnect), the merchant wallet, the merchant payout ledger, and
the commission-settlement model.

## Commission-settlement model

Owned by
[`.claude/work/commission-settlement-model.md`](../../../../.claude/work/commission-settlement-model.md).
In one paragraph: a NORMAL sale pays the merchant in full and adds 19% of the
food subtotal to `Establishment.commissionDue`. A SETTLEMENT sale adds nothing;
the merchant supplies the food at a reduction of `min(commissionDue, subtotal)`,
and that part of the customer's payment is TFTW's. Only a sale whose payment
TFTW controls (`order.paymentControl.controlledBy === 'TFTW'`) can settle.

| Piece                                            | Where                                     |
| ------------------------------------------------ | ----------------------------------------- |
| The rule (pure)                                  | `orders/utils/commission-model.util.ts`   |
| Who controls the money (set at creation)         | `orders/utils/payment-control.util.ts`    |
| Applying it: balance, ledger, `order.commission` | `services/commission.service.ts`          |
| Cutoff `COMMISSION_MODEL_EFFECTIVE_AT`           | `config/commission-cutoff.util.ts`        |
| Merchant statement (per location / all)          | `services/merchant-commission.service.ts` |
| Audit of the cutoff                              | `scripts/audit-commission-cutoff.ts`      |

Before the cutoff, the original engine runs unchanged, only for online payments
HELD at pickup. At or after it, the new model runs for every completed sale.

## Two balances, never mixed

- `commissionDue` - what the merchant owes TFTW. Moves only through
  `commission_ledger` rows (ACCRUAL / SETTLEMENT / REVERSAL / ADJUSTMENT),
  append-only, unique per `(orderId, type)`.
- Merchant payout - what TFTW owes the merchant. Source of truth:
  `MerchantPayoutLedger`, written for online **pickup** orders only. Delivery
  merchants are paid in cash by the driver at pickup (see `drivers/README.md`).

The merchant wallet (`MerchantWallet`) mirrors online pickup sales: the full
subtotal goes to pending at payment; at pickup exactly that amount leaves
pending and `merchantAmount` becomes available. Never 81%.

## Open question

`createSaleRecords` still books platform revenue (`NET_COMMISSION`) and the
charity donation at 19% / 5% per online sale, at payment time. Whether that
basis should follow the commission-settlement model is a product decision,
recorded in the work file.
