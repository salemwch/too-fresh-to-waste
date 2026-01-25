# Orders Module - Event Analysis for MVP

**Date:** 2026-01-23
**Question:** Does orders module need EventBusService improvements for MVP?

---

## Current State: ✅ **ALREADY USING EventBusService**

### Publisher Status

**File:** `src/orders/order.service.ts`

**Line 22:** ✅ Already imports EventBusService
```typescript
import { EventBusService } from '../common/services/event-bus/event-bus.service';
```

**Line 128:** ✅ Already injected in constructor
```typescript
constructor(
  private readonly eventBus: EventBusService,
  // ...
) {}
```

**Line 782-796:** ✅ Already emitting events
```typescript
await this.eventBus.emit(
  'order.completed',
  new OrderCompletedEvent(
    orderId,
    order.customerId._id.toString(),
    order.merchantId._id.toString(),
    order.items[0]?.offerId.toString() || '',
    order.pricing?.total || 0,
    new Date(),
    {
      itemCount: totalBags,
      isFirstOrder: false,
    },
  ),
);
```

---

## Events Published (1 event)

### ✅ order.completed
- **Published in:** `confirmPickup()` method (line 782)
- **When:** Customer picks up order at merchant
- **Routing:** EventBusService → RabbitMQ (`foodwaste.events` exchange)

**Listeners (2 active):**
1. ✅ `donations/listeners/order-events.listener.ts` - Creates 1% donation
2. ✅ `loyalty/listeners/order-events.listener.ts` - Awards loyalty points (10 per bag)

**Both listeners migrated to RabbitMQ with idempotency protection** ✅

---

## Events Defined But NOT Published (2 events)

**File:** `src/common/events/order.events.ts`

### 1. ❌ order.created
**Definition exists:**
```typescript
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly merchantId: string,
    public readonly offerId: string,
    public readonly createdAt: Date,
  ) {}
}
```

**Expected use case:**
- Emit when order is created (after payment)
- Listeners: Inventory (reserve items), Notifications (confirmation email)

**Status:** ❌ Not emitted in `create()` method

---

### 2. ❌ order.cancelled
**Definition exists:**
```typescript
export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly cancelledAt: Date,
  ) {}
}
```

**Expected use case:**
- Emit when order is cancelled
- Listeners: Inventory (release items), Payments (refund), Notifications

**Status:** ❌ Not emitted in `cancelOrder()` method

---

## Critical for MVP?

### ✅ order.completed - **CRITICAL (Already Working)**

**Why critical:**
- Triggers 1% donation (financial operation)
- Awards loyalty points (user reward)
- Both listeners have idempotency protection

**Status:** ✅ Fully implemented and tested

**Impact if missing:** 🔴 Users don't get donations or points (critical business logic)

---

### 🟡 order.created - **NICE-TO-HAVE (Not Critical)**

**Why nice-to-have:**
- Useful for analytics (order creation rate)
- Could send confirmation email
- Could update inventory tracking

**Status:** ❌ Not implemented

**Impact if missing:** 🟡 No automated confirmation emails, manual analytics (acceptable for MVP)

**Workaround:** Confirmation emails sent synchronously in `create()` method

---

### 🟡 order.cancelled - **NICE-TO-HAVE (Not Critical)**

**Why nice-to-have:**
- Useful for analytics (cancellation rate)
- Could send cancellation notification
- Could trigger inventory release (if implemented)

**Status:** ❌ Not implemented

**Impact if missing:** 🟡 No automated cancellation notifications, manual refunds (acceptable for MVP)

**Workaround:** Refunds handled synchronously in `cancelOrder()` method

---

## Who's Listening to Order Events?

### ✅ Active Listeners (2)

**1. Donations Module**
- **File:** `src/donations/listeners/order-events.listener.ts`
- **Event:** `order.completed`
- **Action:** Creates donation (1% of order total)
- **Status:** ✅ Migrated to RabbitMQ with idempotency

**2. Loyalty Module**
- **File:** `src/loyalty/listeners/order-events.listener.ts`
- **Event:** `order.completed`
- **Action:** Awards points (10 points per bag) + updates gamification
- **Status:** ✅ Migrated to RabbitMQ with idempotency

### ❌ Missing Listeners (Potential Use Cases)

**For order.created:**
- Inventory module (reserve items) - Not implemented
- Notifications module (send confirmation email) - Done synchronously
- Analytics module (track order creation) - Manual tracking

**For order.cancelled:**
- Inventory module (release items) - Not implemented
- Payments module (process refund) - Done synchronously
- Notifications module (send cancellation email) - Not implemented
- Analytics module (track cancellation rate) - Manual tracking

---

## Comparison: What Works vs What's Missing

| Event | Defined? | Published? | Has Listeners? | Critical for MVP? | Status |
|-------|----------|------------|----------------|-------------------|--------|
| `order.completed` | ✅ Yes | ✅ Yes | ✅ Yes (2) | ✅ CRITICAL | ✅ Working |
| `order.created` | ✅ Yes | ❌ No | ❌ No | 🟡 Nice-to-have | ⏭️ Skip MVP |
| `order.cancelled` | ✅ Yes | ❌ No | ❌ No | 🟡 Nice-to-have | ⏭️ Skip MVP |

---

## Recommendation for MVP

### ✅ **NO ACTION NEEDED - Orders Module Ready for MVP**

**Reasons:**
1. ✅ **Critical flow works** - `order.completed` event triggers donations + loyalty
2. ✅ **EventBusService integrated** - Already using RabbitMQ
3. ✅ **Idempotency protected** - No duplicate donations/points
4. 🟡 **Missing events not critical** - `order.created` and `order.cancelled` are for analytics/notifications

**Impact of current state:**
- ✅ Financial operations protected (donations, points)
- ✅ Main user journey works (order → pickup → rewards)
- 🟡 No automated order/cancellation notifications (acceptable)
- 🟡 Analytics must be tracked manually (acceptable)

---

## Optional: Add Missing Events (v2)

### If you want order.created event (1 hour):

**File:** `src/orders/order.service.ts`

Find the `create()` method (around line 200-300), after order is saved:

```typescript
async create(createOrderDto: CreateOrderDto, userId: string) {
  // ... create order logic ...

  const savedOrder = await order.save();

  // ✅ ADD THIS: Emit order.created event
  try {
    await this.eventBus.emit(
      'order.created',
      new OrderCreatedEvent(
        savedOrder._id.toString(),
        userId,
        savedOrder.merchantId.toString(),
        savedOrder.items[0]?.offerId.toString() || '',
        new Date(),
      ),
    );
    this.appLogger.log(`Order created event emitted for order ${savedOrder._id}`, 'OrderService.Events');
  } catch (eventError) {
    this.appLogger.error(`Failed to emit order created event`, 'OrderService.Events');
  }

  return savedOrder;
}
```

**Listeners to create:**
- Notifications listener → Send confirmation email
- Analytics listener → Track order creation rate

---

### If you want order.cancelled event (1 hour):

**File:** `src/orders/order.service.ts`

Find the `cancelOrder()` method, after order is cancelled:

```typescript
async cancelOrder(orderId: string, cancelDto: CancelOrderDto, userId: string) {
  // ... cancel order logic ...

  await order.save();

  // ✅ ADD THIS: Emit order.cancelled event
  try {
    await this.eventBus.emit(
      'order.cancelled',
      new OrderCancelledEvent(
        orderId,
        userId,
        cancelDto.reason,
        new Date(),
      ),
    );
    this.appLogger.log(`Order cancelled event emitted for order ${orderId}`, 'OrderService.Events');
  } catch (eventError) {
    this.appLogger.error(`Failed to emit order cancelled event`, 'OrderService.Events');
  }

  return order;
}
```

**Listeners to create:**
- Notifications listener → Send cancellation confirmation
- Analytics listener → Track cancellation rate

---

## Testing Order Events

### Test order.completed (Already Working)

```bash
# Create and complete an order
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"offerId": "673e...", "quantity": 1}],
    "pickupSlotStart": "2025-11-21T18:00:00Z",
    "pickupSlotEnd": "2025-11-21T19:00:00Z"
  }'

# Confirm pickup
curl -X POST http://localhost:3000/api/v1/orders/:orderId/confirm-pickup \
  -H "Authorization: Bearer $MERCHANT_TOKEN"

# Check RabbitMQ queues
curl -u admin:rabbitmq_dev_password http://localhost:15672/api/queues/%2Ffoodwaste/foodwaste.donations.order-completed
curl -u admin:rabbitmq_dev_password http://localhost:15672/api/queues/%2Ffoodwaste/foodwaste.loyalty.order-completed

# Verify donation created
GET http://localhost:3000/api/v1/donations/pool

# Verify points awarded
GET http://localhost:3000/api/v1/loyalty/account
```

---

## Summary

### Current Status: ✅ **PRODUCTION READY FOR MVP**

| Component | Status | Notes |
|-----------|--------|-------|
| **EventBusService** | ✅ Integrated | Line 22, 128 |
| **order.completed** | ✅ Publishing | Line 782-796 |
| **Donations Listener** | ✅ Working | With idempotency |
| **Loyalty Listener** | ✅ Working | With idempotency |
| **order.created** | ⏭️ Skip MVP | Not critical |
| **order.cancelled** | ⏭️ Skip MVP | Not critical |

### Decision: ✅ **NO CHANGES NEEDED FOR MVP**

**Reasoning:**
- Critical business logic (donations + loyalty) works
- Idempotency protected
- Missing events are for analytics/notifications (nice-to-have)
- Can add in v2 (2 hours total work)

---

**Prepared By:** Claude Sonnet 4.5
**Date:** 2026-01-23
**Decision:** NO ACTION NEEDED ✅
