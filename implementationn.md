Update payment flow to match Too Good To Go model:

**CHANGE**: After payment success, set order status to `RESERVED` and payment
status to `HELD` (not COMPLETED). Money stays in platform account.

**ADD**: Pickup validation endpoint that changes order to `PICKED_UP`, payment
to `EARNED`, and creates MerchantPayoutLedger entry (75% to merchant, 25%
platform fee, status PENDING_SETTLEMENT).

**ADD**: monthly payout cron job (Mondays) that finds all PENDING_SETTLEMENT
entries, groups by merchant Id and names , transfers money for each one with
their ID and name to their bank, marks as PAID_OUT.

**ADD**: Expiry handler cron job that finds expired RESERVED orders, triggers
SMT refund, changes status to EXPIRED, releases inventory.

**ADD**: MerchantPayoutLedger schema with: merchantId, orderId, amount,
platformFee, status, earnedAt, paidOutAt, transferRef.

**REQUIREMENTS**: Atomic transactions, idempotency, rate limiting on pickup
validation, audit logs, refund retry logic, only merchant of that offer can
validate pickup.

Review existing code in order.service.ts, payments.service.ts and implement.
Follow Clean Architecture + production-ready error handling.
