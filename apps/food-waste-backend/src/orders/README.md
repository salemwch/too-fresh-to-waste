# Orders Module

> **Status:** ✅ Production Ready **Owner:** Backend Core Team **Last Updated:**
> November 21, 2025

## Overview

The Orders module handles the complete lifecycle of food waste orders from
creation to pickup completion. It orchestrates offers, establishments, payments,
and donations while maintaining comprehensive audit trails and real-time status
updates via WebSockets.

---

## Responsibilities

- 📦 **Order Creation** - Validate availability, calculate pricing, reserve
  inventory
- 💳 **Payment Integration** - Process payments via Stripe/SMT with fraud
  detection
- 🎁 **Donation Calculation** - Automatic donation from platform fees to
  community pools
- 🔔 **Status Tracking** - Real-time order status updates with WebSocket
  notifications
- 📊 **Analytics** - Order statistics, revenue tracking, merchant dashboards
- 🕒 **Pickup Scheduling** - Time slot management and QR code generation
- 🔄 **Order Lifecycle** - PENDING → CONFIRMED → READY → PICKED_UP workflow
- ❌ **Cancellation & Refunds** - Handle cancellations with automated refund
  processing

---

## Architecture

### Module Structure

\`\`\` orders/ ├── controllers/ │ └── order.controller.ts # HTTP endpoints
(/orders/\*) ├── services/ │ └── order.service.ts # Core order business logic
├── schemas/ │ └── order.schema.ts # Order MongoDB model ├── DTO/ │ ├──
create-order.dto.ts # Order creation validation │ ├──
update-order-status.dto.ts # Status update validation │ ├──
cancel-order.dto.ts # Cancellation request │ └── confirm-pickup.dto.ts # Pickup
confirmation ├── interfaces/ │ └── order.interface.ts # TypeScript interfaces
├── order.module.ts # Module definition └── README.md # This file \`\`\`

### Dependencies

**Imports:**

- `CommonModule` - Logging, sanitization, security guards
- `DonationsModule` - Calculate and record platform donations
- `MongooseModule` - Database access for Order, Offer, Establishment, User
  schemas

**Exports:**

- `OrdersService` - Core order operations
- `MongooseModule.forFeature([Order])` - Order schema for other modules

**Dependency Flow:** \`\`\` OrdersModule → DonationsModule (one-way, safe ✅) →
OffersModule (via schema imports) → EstablishmentsModule (via schema imports) →
UsersModule (via schema imports) → PaymentsModule (injected when needed) \`\`\`

### Database Schemas

| Schema                     | Collection       | Purpose          | Key Indexes                                                                                |
| -------------------------- | ---------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| `Order`                    | `orders`         | Store order data | `orderNumber` (unique), `customerId` (1), `merchantId` (1), `status` (1), `createdAt` (-1) |
| `Offer` (imported)         | `offers`         | Offer details    | `_id` (1), `status` (1)                                                                    |
| `Establishment` (imported) | `establishments` | Merchant info    | `_id` (1)                                                                                  |
| `User` (imported)          | `users`          | Customer data    | `_id` (1)                                                                                  |

**Compound Indexes:** \`\`\`typescript @Index({ customerId: 1, createdAt: -1 })
// User order history @Index({ merchantId: 1, status: 1 }) // Merchant order
filtering @Index({ status: 1, pickupSlotStart: 1 }) // Pickup scheduling \`\`\`

---

## API Endpoints

### Base Path

\`\`\` /api/v1/orders \`\`\`

### Consumer Endpoints

#### POST /

**Description:** Create a new order

**Authorization:** Consumer or Merchant role

**Request:** \`\`\`typescript { "items": [ { "offerId": "offer-uuid",
"quantity": 2 } ], "pickupSlotStart": "2025-11-21T18:00:00Z", "pickupSlotEnd":
"2025-11-21T19:00:00Z", "paymentMethodId": "pm_stripe_token", "notes": "Please
prepare by 6 PM" } \`\`\`

**Response (201 Created):** \`\`\`typescript { "order": { "id": "order-uuid",
"orderNumber": "ORD-20251121-001", "customerId": "user-uuid", "merchantId":
"merchant-uuid", "establishmentId": "establishment-uuid", "items": [ {
"offerId": "offer-uuid", "offerTitle": "Baguette Sandwich", "quantity": 2,
"unitPrice": 2.5, "totalPrice": 5.0, "originalPrice": 8.0, "discountAmount": 3.0
} ], "totalAmount": 5.0, "donationAmount": 0.05, "status": "pending",
"paymentStatus": "pending", "pickupSlotStart": "2025-11-21T18:00:00Z",
"pickupSlotEnd": "2025-11-21T19:00:00Z", "createdAt": "2025-11-21T12:00:00Z" } }
\`\`\`

**Errors:**

- `400 Bad Request` - Invalid offer ID, quantity, or time slot
- `409 Conflict` - Offer unavailable or insufficient quantity
- `402 Payment Required` - Payment processing failed

---

#### GET /

**Description:** Get user's orders (paginated)

**Query Parameters:**

- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `status` (OrderStatus, optional)
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)

**Response (200 OK):** \`\`\`typescript { "orders": [ /* array of orders */ ],
"pagination": { "page": 1, "limit": 20, "total": 150, "pages": 8 } } \`\`\`

---

#### GET /:id

**Description:** Get order details by ID

**Authorization:** Order owner or merchant

**Response (200 OK):** \`\`\`typescript { "id": "order-uuid", "orderNumber":
"ORD-20251121-001", "customer": { "id": "user-uuid", "name": "John Doe",
"phone": "+21620123456" }, "establishment": { "id": "est-uuid", "name": "Bakery
ABC", "address": "123 Main St, Tunis" }, "items": [ /* order items */ ],
"totalAmount": 5.0, "status": "confirmed", "paymentStatus": "completed",
"pickupCode": "ABC123", "pickupSlotStart": "2025-11-21T18:00:00Z",
"pickupSlotEnd": "2025-11-21T19:00:00Z", "createdAt": "2025-11-21T12:00:00Z",
"updatedAt": "2025-11-21T12:05:00Z" } \`\`\`

**Errors:**

- `403 Forbidden` - Not authorized to view this order
- `404 Not Found` - Order does not exist

---

#### POST /:id/cancel

**Description:** Cancel an order

**Authorization:** Order owner only

**Request:** \`\`\`typescript { "reason": "Changed my mind", "cancelledBy":
"customer" } \`\`\`

**Response (200 OK):** \`\`\`typescript { "order": { /_ updated order with
status: "cancelled" _/ }, "refund": { "amount": 5.0, "status": "pending",
"estimatedDate": "2025-11-26T00:00:00Z" } } \`\`\`

**Business Rules:**

- Can only cancel before order is "ready_for_pickup"
- Full refund if cancelled within 1 hour of creation
- Partial refund (50%) if cancelled later
- No refund after pickup

---

### Merchant Endpoints

#### GET /merchant

**Description:** Get merchant's orders

**Authorization:** Merchant role

**Query Parameters:** Same as consumer GET /

---

#### PUT /:id/status

**Description:** Update order status

**Authorization:** Merchant (order owner) or Admin

**Request:** \`\`\`typescript { "status": "confirmed" | "ready_for_pickup" |
"picked_up" } \`\`\`

**Response (200 OK):** \`\`\`typescript { "order": { /_ updated order _/ } }
\`\`\`

**Status Transitions:** \`\`\` pending → confirmed → ready_for_pickup →
picked_up ↓ cancelled (any time before ready_for_pickup) \`\`\`

---

#### POST /:id/confirm-pickup

**Description:** Confirm customer picked up order (scan QR code)

**Authorization:** Merchant role

**Request:** \`\`\`typescript { "pickupCode": "ABC123" } \`\`\`

**Response (200 OK):** \`\`\`typescript { "order": { /_ status: "picked_up" _/
}, "message": "Pickup confirmed successfully" } \`\`\`

**Errors:**

- `400 Bad Request` - Invalid pickup code
- `409 Conflict` - Order already picked up or cancelled

---

### Admin Endpoints

#### GET /admin/stats

**Description:** Get order statistics

**Authorization:** Admin role only

**Query Parameters:**

- `merchantId` (optional) - Filter by merchant
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)

**Response (200 OK):** \`\`\`typescript { "totalOrders": 1250, "totalRevenue":
8750.50, "pendingOrders": 35, "confirmedOrders": 18, "readyOrders": 12,
"completedOrders": 1150, "cancelledOrders": 35, "averageOrderValue": 7.0,
"topMerchants": [ { "merchantId": "uuid", "name": "Bakery ABC", "orderCount":
145, "revenue": 1015.0 } ] } \`\`\`

---

## Key Services

### OrdersService

**Purpose:** Core order business logic including creation, validation, status
management

**Key Methods:**

\`\`\`typescript // Create new order async createOrder( customerId: string, dto:
CreateOrderDto, ipAddress: string, userAgent: string ): Promise<Order>

// Get order by ID with authorization check async findOrderById( orderId:
string, userId: string, userRole: UserRole ): Promise<Order>

// Get user orders with pagination async findUserOrders( userId: string, query:
OrderQueryDto ): Promise<PaginatedOrderResponse>

// Update order status (merchant action) async updateOrderStatus( orderId:
string, merchantId: string, dto: UpdateOrderStatusDto ): Promise<Order>

// Cancel order with refund processing async cancelOrder( orderId: string,
userId: string, dto: CancelOrderDto ): Promise<CancelOrderResponse>

// Confirm pickup with QR code async confirmPickup( orderId: string, merchantId:
string, dto: ConfirmPickupDto ): Promise<Order>

// Get order statistics (admin) async getOrderStats( merchantId?: string,
startDate?: Date, endDate?: Date ): Promise<OrderStatsResponse>

// Sync orders (cron job - every 5 minutes)
@Cron(CronExpression.EVERY_5_MINUTES) async syncOrders(): Promise<void> \`\`\`

**Dependencies:**

- `@InjectModel(Order)` - Order database operations
- `@InjectModel(Offer)` - Offer availability checks
- `@InjectModel(Establishment)` - Merchant details
- `@InjectModel(User)` - Customer information
- `DonationsService` - Calculate donation amounts
- `AppLoggerService` - Structured logging
- `RegexSecurityUtil` - Input sanitization

**Transaction Support:** \`\`\`typescript // Orders use MongoDB transactions for
atomicity const session = await this.orderModel.startSession(); await
session.withTransaction(async () => { // Create order // Update offer inventory
// Record donation // Process payment }); \`\`\`

---

## Configuration

### Environment Variables

\`\`\`bash

# Order Configuration

ORDER_MAX_ITEMS=10 # Max items per order (default: 10)
ORDER_MIN_PICKUP_TIME=30 # Min minutes from now (default: 30)
ORDER_MAX_PICKUP_TIME=48 # Max hours from now (default: 48)

# Cancellation Policy

ORDER_CANCEL_FULL_REFUND_WINDOW=3600 # Full refund window in seconds (1 hour)
ORDER_CANCEL_PARTIAL_REFUND_RATE=0.5 # Partial refund percentage (50%)

# Donation Configuration

ORDER_PLATFORM_FEE_PERCENTAGE=0.20 # Platform fee (20%)
ORDER_DONATION_PERCENTAGE=0.05 # Donation from fee (5%) \`\`\`

### Business Rules

**Order Creation:**

- Minimum order value: 1 DT
- Maximum 10 items per order
- Pickup slot must be within merchant's operating hours
- Pickup slot must be 30 min - 48 hours from now

**Cancellation:**

- Full refund: Within 1 hour of creation
- Partial refund (50%): After 1 hour, before "ready_for_pickup"
- No refund: After "ready_for_pickup" status

**Donation Calculation:** \`\`\`typescript // Formula: (orderTotal _
platformFee) _ donationPercentage // Example: (5 DT _ 0.20) _ 0.05 = 0.05 DT
donationAmount = (totalAmount _ 0.20) _ 0.05 \`\`\`

---

## Testing

### Running Tests

\`\`\`bash

# Unit tests

pnpm test orders

# Integration tests

pnpm test:e2e orders

# Specific test scenarios

pnpm test -- order.service.spec.ts --testNamePattern="createOrder" \`\`\`

### Test Coverage

| Component        | Target | Current |
| ---------------- | ------ | ------- |
| OrdersService    | 80%+   | 76% ⚠️  |
| OrdersController | 75%+   | 82% ✅  |
| Overall          | 80%+   | 78% ⚠️  |

**Note:** Test coverage needs improvement (tracked in backlog)

---

## Security Considerations

### Authorization

- ✅ Customers can only view/cancel their own orders
- ✅ Merchants can only manage orders for their establishments
- ✅ Admins have full access to all orders
- ✅ Resource ownership verified via `ResourceOwnershipGuard`

### Input Validation

- ✅ All DTOs validated with `class-validator`
- ✅ Offer IDs validated against database
- ✅ Quantity limits enforced
- ✅ Pickup time slots validated
- ✅ SQL/NoSQL injection prevented via Mongoose

### Payment Security

- ✅ Stripe PCI-DSS compliant integration
- ✅ Payment tokens never stored
- ✅ 3D Secure (SCA) support
- ✅ Fraud detection via Stripe Radar

### Rate Limiting

- ✅ Order creation: 10 requests / minute / user
- ✅ Status updates: 20 requests / minute / merchant
- ✅ Prevents order flooding attacks

---

## Performance

### Caching Strategy

**No Caching for Orders:**

- Orders are transactional and change frequently
- Real-time accuracy is critical
- Rely on database indexes for performance

**Cached Data:**

- Offer availability (1 minute TTL)
- Merchant details (5 minutes TTL)
- Order statistics (15 minutes TTL)

### Query Optimization

**Database Indexes:** \`\`\`typescript @Index({ orderNumber: 1 }, { unique: true
}) @Index({ customerId: 1, createdAt: -1 }) @Index({ merchantId: 1, status: 1 })
@Index({ status: 1, pickupSlotStart: 1 }) \`\`\`

**Pagination:**

- Default: 20 orders per page
- Maximum: 100 orders per page
- Uses skip/limit (cursor-based planned for v2.1)

**Lean Queries:** \`\`\`typescript // Use .lean() for read-only operations const
orders = await this.orderModel .find(filter) .lean() .select('-\_\_v -tokens')
.limit(20); \`\`\`

### Background Jobs

**Cron Jobs:** \`\`\`typescript // Sync orders every 5 minutes
@Cron(CronExpression.EVERY_5_MINUTES) async syncOrders(): Promise<void>

// Expire unclaimed orders (24 hours after pickup end)
@Cron(CronExpression.EVERY_HOUR) async expireOrders(): Promise<void> \`\`\`

---

## Error Handling

### Order Error Codes

| Code      | HTTP Status | Meaning                                    |
| --------- | ----------- | ------------------------------------------ |
| `ORD_001` | 400         | Invalid order data                         |
| `ORD_002` | 404         | Order not found                            |
| `ORD_003` | 403         | Not authorized to access order             |
| `ORD_004` | 409         | Offer unavailable or insufficient quantity |
| `ORD_005` | 409         | Invalid status transition                  |
| `ORD_006` | 402         | Payment failed                             |
| `ORD_007` | 400         | Cannot cancel order in current status      |
| `ORD_008` | 400         | Invalid pickup code                        |

---

## Monitoring & Logging

### Key Metrics

- **Order Creation Rate:** Orders per hour
- **Order Completion Rate:** Completed / Total orders
- **Cancellation Rate:** Cancelled / Total orders
- **Average Order Value:** Total revenue / Total orders
- **Payment Success Rate:** Successful payments / Total attempts
- **Pickup On-Time Rate:** Picked up within slot / Total pickups

### Alerts

- 🚨 CRITICAL: Payment success rate < 95%
- ⚠️ WARNING: Cancellation rate > 15%
- ⚠️ WARNING: Order creation rate drops > 30%

---

## Related Modules

| Module                 | Relationship | Purpose                        |
| ---------------------- | ------------ | ------------------------------ |
| `DonationsModule`      | Imports      | Calculate platform donations   |
| `OffersModule`         | Via schema   | Offer availability and pricing |
| `EstablishmentsModule` | Via schema   | Merchant information           |
| `UsersModule`          | Via schema   | Customer details               |
| `PaymentsModule`       | Injected     | Process payments               |
| `NotificationsModule`  | Injected     | Send order updates             |
| `WebSocketModule`      | Injected     | Real-time status updates       |

---

## Changelog

**v2.0.0** - Nov 21, 2025 - Donation integration with automatic calculation
**v1.5.0** - Nov 15, 2025 - Added pickup code QR generation **v1.4.0** - Nov 10,
2025 - Implemented refund processing **v1.3.0** - Nov 5, 2025 - Added WebSocket
real-time updates

---

## Owners & Support

### Primary Owner

**Team:** Backend Core Team **Contact:** backend-core@foodwaste.com **Slack:**
#backend-core

### On-Call

See [PagerDuty Schedule](https://pagerduty.com/schedules/orders)

---

## Additional Resources

- [Order Lifecycle Diagram](link)
- [Payment Integration Guide](link)
- [Merchant Order Management](link)
- [Refund Policy Documentation](link)

---

**Last Reviewed:** November 21, 2025 **Next Review Due:** February 21, 2026
