# Drivers module

Delivery lifecycle for drivers, and the cash that moves with every delivery.

The money rules are owned by
[`.claude/work/commission-settlement-model.md`](../../../../.claude/work/commission-settlement-model.md)
("Final decisions for delivery", "Driver cash", "Failed deliveries"). This file
says where they live in code.

## Lifecycle

```
POOL -> accept -> DRIVER_ASSIGNED -> pickup -> OUT_FOR_DELIVERY -> deliver -> DELIVERED
                                                        └────────-> fail    -> CANCELLED (+ deliveryFailure)
```

| Route (driver)                    | Service                              | Money effect (one transaction)                                                                     |
| --------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `POST drivers/orders/:id/accept`  | `DriversService.acceptOrder`         | none                                                                                               |
| `POST drivers/orders/:id/pickup`  | `DriverCashService.onMerchantPickup` | commission decided (NORMAL / SETTLEMENT); `driverInstruction` frozen; merchant paid from the float |
| `POST drivers/orders/:id/deliver` | `DriverCashService.onDelivered`      | `collectedCash` recorded; online payment HELD -> EARNED; no merchant payout (already paid)         |
| `POST drivers/orders/:id/fail`    | `DriverCashService.onFailed`         | `deliveryFailure` required; sale undone only when the food goes back to the merchant               |
| `GET drivers/cash`                | `DriversService.getCashSummary`      | read-only: float, owed by / to the driver                                                          |

`driverInstruction` (`payMerchant`, `collectFromCustomer`, `driverKeeps`) is
computed by the backend at pickup and never recalculated. The driver app shows
it; it never computes money.

## Driver cash

- The driver runs on a **TFTW float**. They pay every merchant `merchantAmount`
  from it at pickup - online and cash orders alike.
- They keep their share of the delivery fee (`DELIVERY_DRIVER_SHARE`, 80%) from
  the cash they collect.
- `DriverDeliveryCash` (one per delivery):
  `dueToTftw = collectedCash + merchantReturnedCash - paidToMerchant - driverKeeps`,
  signed. `> 0` the driver holds TFTW money; `< 0` TFTW owes the driver (an
  online delivery drains the float and brings in no cash).
- A driver-confirmed collection is a **receivable**, not cash in TFTW's account,
  until a handover batch covers it.

| Route (admin)                                  | Purpose                                             |
| ---------------------------------------------- | --------------------------------------------------- |
| `GET admin/driver-cash/reconciliation`         | expected vs collected vs handed over vs outstanding |
| `POST admin/driver-cash/drivers/:id/float`     | issue / return float (`DriverFloatMovement`)        |
| `POST admin/driver-cash/drivers/:id/handovers` | counted handover, signed, allocated oldest first    |
| `PATCH admin/driver-cash/orders/:id/recovery`  | resolve a `RECOVERABLE_PENDING` failed delivery     |

Collections: `driver_delivery_cash`, `driver_cash_handovers` (append-only),
`driver_float_movements` (append-only). Indexes are declared on the schemas;
apply with `pnpm db:create-indexes`.

## Tests

| File                                        | What it proves                                                    |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `__tests__/driver-cash.util.spec.ts`        | every worked row of the model, to the millime; allocation rules   |
| `__tests__/driver-cash.integration.spec.ts` | real transactions: once-only pickup, rollback, failures, handover |
| `drivers.service.spec.ts`                   | DriversService delegates money and keeps notifications / timeouts |
