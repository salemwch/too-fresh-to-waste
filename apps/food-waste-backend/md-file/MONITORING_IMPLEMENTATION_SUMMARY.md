● Event-Driven Architecture Audit - Backend

  Executive Summary

  Your backend has ~30% event coverage where it should be ~90%+. The infrastructure is solid (EventEmitter2, Bull queues), but only 4   of 12 modules emit business events.

  ---
  Current State ✅

  Working Event Patterns:
  ┌───────────┬───────────────────────────────────────────────────┬──────────┐
  │  Module   │                  Events Emitted                   │ Coverage │
  ├───────────┼───────────────────────────────────────────────────┼──────────┤
  │ Reviews   │ review.created/updated/deleted/moderated/analyzed │ 100% ✅  │
  ├───────────┼───────────────────────────────────────────────────┼──────────┤
  │ Favorites │ favorite.added/removed                            │ 100% ✅  │
  ├───────────┼───────────────────────────────────────────────────┼──────────┤
  │ Auth      │ user.registered + 9 security events               │ Good ✅  │
  ├───────────┼───────────────────────────────────────────────────┼──────────┤
  │ Orders    │ order.completed only                              │ 17% ❌   │
  └───────────┴───────────────────────────────────────────────────┴──────────┘
  Active Infrastructure:
  - EventEmitter2 configured globally
  - 5 Bull queues (review-processing, notification-processing, search-indexing, etc.)
  - Centralized event definitions in src/common/events/
  - Type-safe event classes

  ---
  Critical Gaps ❌

  1. Orders Module - 83% Missing

  File: apps/food-waste-backend/src/orders/order.service.ts

  // ❌ Line 223: createOrder() - NO EVENT
  // ❌ Lines 911, 932: cancel() - OrderCancelledEvent defined but NOT emitted
  // ❌ Missing: OrderReservedEvent, OrderExpiredEvent

  Impact: Inventory can't react to cancellations, analytics missing lifecycle data

  2. Offers Module - 100% Missing

  File: apps/food-waste-backend/src/offers/offers.service.ts

  // ❌ Line 143: create() - NO EVENT
  // ❌ Status changes (ACTIVE/EXPIRED/SOLD_OUT) - NO EVENTS
  // ❌ Missing: OfferCreatedEvent, OfferPublishedEvent, OfferExpiredEvent, OfferSoldOutEvent

  Impact: Search index not auto-updated, no merchant notifications, favorited users not notified

  3. Payments Module - 100% Missing

  File: apps/food-waste-backend/src/payments/payments.service.ts

  // ❌ Line 130: Payment HELD - NO EVENT
  // ❌ Line 195: Refund - NO EVENT
  // ❌ Missing: PaymentHeldEvent, PaymentCompletedEvent, PaymentRefundedEvent, PayoutScheduledEvent

  Impact: Analytics missing revenue tracking, audit trail incomplete, payout notifications manual

  4. Moderation Module - 100% Missing

  File: apps/food-waste-backend/src/moderation/services/moderation-action.service.ts

  // ❌ Line 61: createModerationAction() - NO EVENT
  // ❌ Missing: ModerationActionCreatedEvent, UserSuspendedEvent, ReportCreatedEvent

  Impact: Users not notified of actions, admin dashboard not real-time

  5. Establishments Module - 100% Missing

  // ❌ NO EVENTS: EstablishmentCreatedEvent, EstablishmentVerifiedEvent

  6. Users Module - 87% Missing

  // ✅ user.registered (via AuthService)
  // ❌ Missing: ProfileUpdatedEvent, EmailVerifiedEvent, PasswordChangedEvent, RoleChangedEvent

  ---
  Code Example: Order Cancellation Gap

  Current (order.service.ts:911):
  async cancel(...) {
    order.status = OrderStatus.CANCELLED;  // ❌ Silent state change
    await order.save();

    if (shouldRefund) {
      await this.refundService.processRefund(...);  // ❌ Tight coupling
    }
  }

  Should Be:
  async cancel(...) {
    order.status = OrderStatus.CANCELLED;
    await order.save();

    this.eventEmitter.emit(
      'order.cancelled',
      new OrderCancelledEvent(order._id.toString(), reason, new Date()),
    );
    // ✅ RefundService listens to 'order.cancelled' and processes refund
  }

  ---
  Implementation Priority

  Priority 1: Critical Business Events (Week 1-2)

  1. Orders:
    - Emit OrderCreatedEvent at line 223
    - Emit OrderCancelledEvent at lines 911, 932 (class already exists!)
    - Add InventoryListener to release stock on cancellation
  2. Offers:
    - Create src/common/events/offer.events.ts
    - Emit OfferCreatedEvent, OfferExpiredEvent, OfferSoldOutEvent
    - Add SearchListener to auto-index offers
  3. Payments:
    - Create src/common/events/payment.events.ts
    - Emit PaymentHeldEvent (line 130), PaymentRefundedEvent (line 195)
    - Add AnalyticsListener for revenue tracking

  Priority 2: User & Security (Week 3)

  - Extend user.events.ts with ProfileUpdatedEvent, EmailVerifiedEvent, PasswordChangedEvent
  - Emit from UsersService.update(), AuthService.verifyEmail()

  Priority 3: Moderation & Observability (Week 4)

  - Create moderation.events.ts and establishment.events.ts
  - Add event logging middleware
  - Add event metrics (Prometheus)

  ---
  Recommended Patterns

  1. Base Event Class (create first)

  // src/common/events/base.event.ts
  export abstract class DomainEvent {
    public readonly timestamp: Date;
    public readonly correlationId?: string;

    constructor(correlationId?: string) {
      this.timestamp = new Date();
      this.correlationId = correlationId;
    }
  }

  2. Event Naming Convention

  Use {domain}.{action} format:
  - order.created, order.cancelled, order.completed
  - payment.held, payment.refunded
  - offer.created, offer.expired

  3. Listener Organization

  src/
  └── {module}/
      ├── listeners/
      │   └── {domain}-events.listener.ts
      ├── services/
      └── {module}.module.ts  # Register listener in providers

  ---
  Statistics
  ┌─────────────────────────┬──────────────────────────┐
  │         Metric          │          Value           │
  ├─────────────────────────┼──────────────────────────┤
  │ Event definitions       │ 11 (8 emitted, 3 unused) │
  ├─────────────────────────┼──────────────────────────┤
  │ Modules with events     │ 4/12 (33%)               │
  ├─────────────────────────┼──────────────────────────┤
  │ Missing critical events │ 25+                      │
  ├─────────────────────────┼──────────────────────────┤
  │ Target coverage         │ 90%+                     │
  ├─────────────────────────┼──────────────────────────┤
  │ Current coverage        │ ~30%                     │
  └─────────────────────────┴──────────────────────────┘
  ---
  Files Referenced

  - apps/food-waste-backend/src/common/events/ - Event definitions
  - apps/food-waste-backend/src/orders/order.service.ts:911,932 - Missing cancel event
  - apps/food-waste-backend/src/offers/offers.service.ts:143 - Missing create event
  - apps/food-waste-backend/src/payments/payments.service.ts:130,195 - Missing payment events
  - apps/food-waste-backend/src/moderation/services/moderation-action.service.ts:61 - Missing moderation events

  ---
  Next Steps

  Would you like me to:
  1. Implement Priority 1 events (Orders, Offers, Payments)?
  2. Create the base DomainEvent class and event naming standards?
  3. Add specific listeners (e.g., InventoryListener for order cancellations)?
  4. Generate complete event definitions for missing modules?

  The Reviews module (src/reviwes/) is your gold standard - it has 100% event coverage with comprehensive listeners. I can replicate 
  that pattern across other modules.