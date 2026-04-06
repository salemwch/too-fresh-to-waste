# Orders Module Documentation

> **Module:** `src/orders/` | **Status:** Production Ready | **Last Updated:** January 15, 2026

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Business Logic (TGTG Model)](#business-logic-tgtg-model)
4. [File Structure](#file-structure)
5. [Key Features](#key-features)
6. [API Endpoints](#api-endpoints)
7. [Database Schema](#database-schema)
8. [Security Features](#security-features)
9. [Background Jobs](#background-jobs)
10. [Integration Points](#integration-points)
11. [Error Handling](#error-handling)
12. [Testing](#testing)

---

## Overview

The Orders module implements the complete order lifecycle for the "Too Good To Go" (TGTG) business model, managing surplus food orders from creation through pickup confirmation. It orchestrates payment processing, inventory management, loyalty rewards, gamification, and automatic donation calculations.

### Core Responsibilities

- ✅ Order creation with atomic inventory reservation
- ✅ TGTG payment flow: PENDING → RESERVED → PICKED_UP (escrow model)
- ✅ Time-based cancellation policy (1-hour protection window)
- ✅ Pickup verification with QR code + 6-digit code
- ✅ Brute-force protection (5 failed attempts → lockout)
- ✅ Automatic order expiration with refund processing
- ✅ Loyalty points awarding (10 points per bag)
- ✅ Gamification integration (friend referrals, purchase streaks, business referrals)
- ✅ Donation tracking (1% of order total)
- ✅ Merchant payout ledger creation

---

## Architecture

### Module Dependencies

```typescript
OrdersModule
├── imports
│   ├── CommonModule (logging, sanitization, security guards)
│   ├── DonationsModule (forwardRef - donation recording)
│   ├── PaymentModule (forwardRef - PayoutService, RefundService)
│   ├── LoyaltyModule (forwardRef - loyalty points, gamification)
│   └── MongooseModule.forFeature (Order, Offer, Establishment, User, Payment)
├── controllers
│   └── OrdersController (23 endpoints)
├── providers
│   ├── OrdersService (core business logic)
│   ├── QueryComplexityGuard (prevent NoSQL injection)
│   ├── RegexSecurityUtil (ReDoS protection)
│   └── PickupThrottlerGuard (rate limiting for pickup)
└── exports
    ├── OrdersService
    └── MongooseModule.forFeature([Order])
```

### Design Patterns

- **Repository Pattern**: Mongoose models as data access layer
- **DTO Pattern**: Validation and sanitization via class-validator decorators
- **Transaction Pattern**: MongoDB sessions for atomicity
- **State Machine**: Order status transitions with validation
- **CRON Pattern**: Automated background jobs for expiration

---

## Business Logic (TGTG Model)

### Order Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      ORDER STATE MACHINE                        │
└─────────────────────────────────────────────────────────────────┘

PENDING (payment initiated)
   │
   ├──[Payment Success]──→ RESERVED (money held in escrow)
   │                          │
   │                          ├──[Merchant confirms ready]──→ READY_FOR_PICKUP
   │                          │                                  │
   │                          │                                  ├──[Pickup confirmed]──→ PICKED_UP (final)
   │                          │                                  │                           │
   │                          │                                  │                           └──→ Payment status: HELD → EARNED
   │                          │                                  │                                Merchant payout ledger created
   │                          │                                  │
   │                          ├──[Consumer cancels >1hr before]──→ CANCELLED + REFUNDED
   │                          │
   │                          └──[Pickup window expires]──────────→ EXPIRED + REFUNDED
   │
   └──[Payment Failed]──────────────────────────────────────────→ CANCELLED

Legacy Support:
- CONFIRMED status maintained for backward compatibility (aliases to RESERVED)
```

### Key Business Rules

#### 1. Order Creation (order.service.ts:303)

- **Phone Verification Required**: Users must have verified phone number to place orders
- **Minimum Booking Window**: 30 minutes from now (prevents last-minute orders)
- **Maximum Booking Window**: 30 days (inventory planning constraint)
- **Inventory Validation**: Atomic check-and-reserve using MongoDB transactions
- **Time Slot Validation**: Ensures pickup slot is available and not fully booked
- **Donation Calculation**: 1% of total order goes to community food relief
  - Formula: `total * 0.01` (derived from 20% platform fee \* 5% donation percentage)

#### 2. Cancellation Policy (order.service.ts:886)

**RESERVED Orders (Consumer Cancellation):**

- ✅ **Full Refund**: Cancel >1 hour before pickup start time
- ❌ **No Cancellation**: Within 1 hour of pickup (protects merchants)
- 🔄 **Automatic Refund**: Processed via `RefundService.processCancelledOrderRefund()`

**Merchant Cancellation:**

- Merchants can cancel at any time (no refund to consumer)
- Contact support required for edge cases

**Legacy Orders (PENDING/CONFIRMED):**

- Standard cancellation flow (backward compatibility)

#### 3. Order Expiration (order.service.ts:131, 207)

**Two Expiration Mechanisms:**

**A. Merchant-Approved Expiration** (Cron: Every 10 minutes)

- Runs: `expireApprovedOrdersCron()`
- Target: Orders with `merchantApprovedExpiration: true` past `scheduledDate`
- Action: Release inventory, mark as EXPIRED
- Batch Processing: 100 orders per batch (prevent memory issues)

**B. Automatic RESERVED Order Expiration** (Cron: Every 10 minutes)

- Runs: `expireReservedOrdersWithRefundCron()`
- Target: RESERVED orders past `expiresAt` (24 hours after pickup end time)
- Action:
  1. Release reserved inventory
  2. Process automatic refund via `RefundService.processExpiredOrderRefund()`
  3. Mark as EXPIRED
- Batch Processing: 50 orders per batch (smaller due to refund API calls)
- Refund Retry: Failed refunds automatically scheduled for retry

#### 4. Pickup Confirmation (order.service.ts:692)

**TGTG Payment Release Flow:**

1. Validate pickup code or QR code (6-digit numeric code)
2. Check order status (RESERVED, READY_FOR_PICKUP, or CONFIRMED)
3. Verify merchant ownership
4. **Transaction Steps:**
   - Update order status to PICKED_UP
   - Update inventory: `reservedQuantity → soldQuantity`
   - Update payment status: HELD → EARNED
   - Create `MerchantPayoutLedger` entry (75% merchant / 25% platform)
5. **Post-Transaction (Non-Blocking):**
   - Award loyalty points: 10 points per bag
   - Update gamification metrics:
     - Friend referral bag count
     - Purchase streak tracking
     - Business referral order count

**Security:**

- Rate limited: 5 attempts per 60 seconds (PickupThrottlerGuard)
- Failed attempts tracked (order.service.ts:1292)
- Lockout after 5 failed attempts (pickupLocked flag)

---

## File Structure

```
orders/
├── order.controller.ts              # 23 HTTP endpoints (CRUD + specialized)
├── order.service.ts                 # 1362 lines - Core business logic
├── order.module.ts                  # Module definition + dependency injection
├── order.md                         # This file - Technical documentation
├── README.md                        # High-level overview
├── DTO/
│   ├── create-order.dto.ts          # Order creation validation (205 lines)
│   │   ├── OrderItemDto             # Item with offerId + quantity
│   │   ├── PickupTimeSlotDto        # Time slot (HH:MM format)
│   │   ├── CreateOrderDto           # Main order DTO (30min-30day validation)
│   │   ├── ConfirmPickupDto         # Pickup code + QR code
│   │   ├── UpdateOrderStatusDto     # Status transition DTO
│   │   ├── CancelOrderDto           # Cancellation reason (5-500 chars)
│   │   └── OrderQueryDto            # Filtering + pagination
│   └── update-order.dto.ts          # Legacy (deprecated)
├── schemas/
│   └── order.schema.ts              # 498 lines - MongoDB schema + 18 indexes
├── guards/
│   └── pickup-throttler.guard.ts    # Rate limiting for pickup endpoint
└── README.md                        # Module overview (legacy)
```

---

## Key Features

### 1. Order Creation with Atomic Transactions

**File:** `order.service.ts:303`

```typescript
async create(createOrderDto: CreateOrderDto, customerId: string): Promise<OrderDocument> {
  const session = await this.orderModel.db.startSession();

  await session.withTransaction(async () => {
    // 1. Validate customer (phone verification required)
    // 2. Validate establishment
    // 3. Validate and reserve inventory
    // 4. Calculate pricing (subtotal, fees, donation)
    // 5. Generate metadata (orderNumber, QR code, pickup code)
    // 6. Save order
    // 7. Populate relations
  });

  // 8. Create donation record asynchronously (outside transaction)
}
```

**Features:**

- MongoDB transaction for atomicity
- Phone verification enforcement (order.service.ts:314)
- Inventory reservation: `reservedQuantity += quantity`
- Time slot booking: `currentOrders += 1`
- Donation calculation: 1% of total

### 2. Pickup Security & Brute-Force Protection

**Throttling:** `guards/pickup-throttler.guard.ts`

- Key format: `pickup-{ip}-{orderId}-{userId}`
- Limit: 5 attempts per 60 seconds
- Scope: Per-order, per-user, per-IP

**Lockout Mechanism:** `order.service.ts:1292`

```typescript
private async trackFailedPickupAttempt(orderId: string, userId: string): Promise<void> {
  const newAttemptCount = (order.failedPickupAttempts || 0) + 1;
  const shouldLock = newAttemptCount >= MAX_FAILED_PICKUP_ATTEMPTS; // 5

  if (shouldLock) {
    // Lock order, log security event, require manual unlock
  }
}
```

**Unlock Endpoint:** `PATCH /orders/:id/unlock-pickup` (Merchant/Admin only)

### 3. Loyalty & Gamification Integration

**Loyalty Points** (order.service.ts:807):

- 10 points per bag purchased
- Awarded on pickup confirmation
- Non-blocking: Errors logged but don't fail pickup

**Gamification** (order.service.ts:831):

- **Friend Referral Tracking**: Update bag count for referred users
- **Purchase Streak**: Track consecutive order days, award bonus points
- **Business Referral**: Track orders for merchants referred by users

### 4. Donation System Integration

**Calculation** (order.service.ts:350):

```typescript
const donationAmount = this.donationsService
  ? parseFloat((total * 0.01).toFixed(3)) // 1% of total
  : 0;
```

**Recording** (order.service.ts:408):

```typescript
// Asynchronous donation creation (outside transaction)
await this.donationsService.createDonation({
  userId: customerId,
  orderId: finalOrder._id,
  amount: finalOrder.donationAmount,
  currency: 'TND',
  metadata: { platform: 'mobile' },
});
```

### 5. Order Statistics & Analytics

**Endpoint:** `GET /orders/stats` (Admin/Merchant)

**Aggregation Pipeline** (order.service.ts:1041):

```typescript
return {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  confirmedOrders: number;
  readyOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
}
```

### 6. QR Code & Pickup Code Generation

**QR Code** (order.service.ts:469):

```typescript
private generateQRCode(): string {
  return crypto.randomBytes(20).toString('hex'); // 40-char hex
}
```

**Pickup Code** (order.service.ts:473):

```typescript
private generatePickupCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
}
```

**QR Code Retrieval:** `GET /orders/:id/qr-code`

- Returns QR code data + Base64 QR image (via qrcode library)

---

## API Endpoints

### Consumer Endpoints

| Method | Path                        | Description               | Auth              | Rate Limit |
| ------ | --------------------------- | ------------------------- | ----------------- | ---------- |
| POST   | `/orders`                   | Create order              | Consumer          | 10/min     |
| GET    | `/orders`                   | List orders (paginated)   | Consumer          | 50/min     |
| GET    | `/orders/my-orders`         | Consumer's orders         | Consumer          | 50/min     |
| GET    | `/orders/:id`               | Get order details         | Consumer/Merchant | 100/min    |
| GET    | `/orders/:id/receipt`       | Get order receipt         | Consumer          | 50/min     |
| GET    | `/orders/:id/qr-code`       | Get QR code + pickup code | Consumer          | 50/min     |
| PATCH  | `/orders/:id/cancel`        | Cancel order              | Consumer          | 5/min      |
| POST   | `/orders/:id/extend-pickup` | Request pickup extension  | Consumer/Admin    | 5/min      |

### Merchant Endpoints

| Method | Path                                   | Description                   | Auth           | Rate Limit   |
| ------ | -------------------------------------- | ----------------------------- | -------------- | ------------ |
| GET    | `/orders/merchant-orders`              | Merchant's orders             | Merchant       | 50/min       |
| PATCH  | `/orders/:id/status`                   | Update order status           | Merchant/Admin | 20/min       |
| PATCH  | `/orders/:id/confirm-pickup`           | Confirm pickup                | Merchant       | **5/60s** ⚠️ |
| PATCH  | `/orders/:id/unlock-pickup`            | Unlock pickup-locked order    | Merchant/Admin | 5/min        |
| PATCH  | `/orders/approve-expiration`           | Approve orders for expiration | Merchant       | 10/min       |
| PATCH  | `/orders/:id/approve-pickup-extension` | Approve pickup extension      | Merchant       | 10/min       |

### Admin Endpoints

| Method | Path                     | Description                 | Auth           | Rate Limit |
| ------ | ------------------------ | --------------------------- | -------------- | ---------- |
| GET    | `/orders/stats`          | Order statistics            | Admin/Merchant | 10/min     |
| GET    | `/orders/admin/pending`  | List pending orders         | Admin          | 20/min     |
| DELETE | `/orders/:id`            | Soft delete order           | Admin          | 5/min      |
| POST   | `/orders/update-expired` | Manually trigger expiration | Admin          | 1/min      |

### Status Transitions

```typescript
private isValidStatusTransition(oldStatus: OrderStatus, newStatus: OrderStatus): boolean {
  const allowedTransitions = {
    [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]: [OrderStatus.READY_FOR_PICKUP, OrderStatus.CANCELLED],
    [OrderStatus.READY_FOR_PICKUP]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
    [OrderStatus.PICKED_UP]: [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]: [],
    [OrderStatus.EXPIRED]: [],
    [OrderStatus.REFUNDED]: [],
  };
}
```

---

## Database Schema

### Order Schema (order.schema.ts)

**Collections:** `orders`

**Key Fields:**

```typescript
{
  orderNumber: string;           // Unique: ORD-{timestamp}-{random}
  customerId: ObjectId;          // Ref: User
  establishmentId: ObjectId;     // Ref: Establishment
  merchantId: ObjectId;          // Ref: User
  items: OrderItem[];            // Array of order items
  status: OrderStatus;           // Enum: PENDING, RESERVED, CONFIRMED, etc.
  paymentStatus: PaymentStatus;  // Enum: PENDING, HELD, PAID, etc.
  pickupDetails: {
    timeSlot: { startTime, endTime },
    scheduledDate: Date,
    actualPickupTime?: Date,
    qrCode: string,              // Unique 40-char hex
    pickupCode: string,          // 6-digit code
    instructions?: string
  },
  pricing: {
    subtotal: number,
    discountAmount: number,
    taxAmount: number,
    serviceFee: number,
    total: number,
    currency: string
  },
  donationAmount: number,        // 1% of total
  expiresAt?: Date,              // 24 hours after pickup end time

  // Security fields
  failedPickupAttempts: number,  // Default: 0
  pickupLocked: boolean,         // Default: false
  pickupLockedAt?: Date,
  pickupLockedReason?: string,

  // Timestamps
  createdAt: Date,
  updatedAt: Date,
  reservedAt?: Date,
  confirmedAt?: Date,
  pickedUpAt?: Date,
  cancelledAt?: Date,
  expiredAt?: Date
}
```

### Indexes (18 Total)

**Base Indexes:**

```typescript
{ customerId: 1, createdAt: -1 }            // Customer order history
{ merchantId: 1, status: 1 }                // Merchant order filtering
{ establishmentId: 1, status: 1 }           // Establishment tracking
{ status: 1, expiresAt: 1 }                 // Expiration cron jobs
{ orderNumber: 1 } (unique)                 // Order lookup
{ 'pickupDetails.qrCode': 1 } (unique)      // QR verification
{ 'pickupDetails.pickupCode': 1 }           // Pickup code lookup
{ 'paymentDetails.stripePaymentId': 1 }     // Payment reconciliation
```

**Enterprise Optimization Indexes:**

```typescript
{ customerId: 1, status: 1, createdAt: -1 } // Filtered history
{ paymentStatus: 1, createdAt: -1 }         // Payment reconciliation
{ 'paymentDetails.method': 1, createdAt: -1 } // Payment analytics
{ isDeleted: 1, deletedAt: 1 } (sparse)     // Soft delete recovery
{ 'pickupDetails.scheduledDate': 1, status: 1 } // Pickup window queries
{ isRated: 1, status: 1, pickedUpAt: 1 }    // Review reminders
{ 'establishmentAddress.coordinates.coordinates': '2dsphere' } // Geolocation
{ donationPoolId: 1, createdAt: -1 } (sparse) // Donation tracking
{ 'pickupExtensionRequest.approved': 1 } (sparse) // Extension management
```

### Pre-Save Middleware (order.schema.ts:461)

```typescript
OrderSchema.pre('save', function (next) {
  // Set expiration for RESERVED/CONFIRMED orders
  if (!this.expiresAt) {
    const pickupDate = new Date(this.pickupDetails.scheduledDate);
    const endTime = this.pickupDetails.timeSlot.endTime.split(':');
    pickupDate.setHours(parseInt(endTime[0]), parseInt(endTime[1]), 0, 0);
    this.expiresAt = new Date(pickupDate.getTime() + 24 * 60 * 60 * 1000); // +24h
  }

  // Track timestamp changes per status
  if (this.isModified('status')) {
    switch (this.status) {
      case OrderStatus.RESERVED:
        this.reservedAt = new Date();
        break;
      case OrderStatus.PICKED_UP:
        this.pickedUpAt = new Date();
        break;
      // ...
    }
  }
});
```

---

## Security Features

### 1. Input Sanitization (DTO Decorators)

**File:** `DTO/create-order.dto.ts`

```typescript
export class CreateOrderDto {
  @SanitizeObjectId()           // Remove non-hex characters
  @IsMongoId()
  establishmentId: string;

  @SanitizeText()               // HTML entity encoding
  @IsNotProfane()               // Profanity filter
  @Length(0, 500)
  customerNotes?: string;

  @SanitizeEnum(['stripe', 'paypal', 'apple_pay', 'google_pay'])
  @IsEnum([...])
  paymentMethod: string;
}
```

### 2. Query Complexity Guard

**File:** `order.controller.ts:134`

```typescript
@Get()
@UseGuards(QueryComplexityGuard)
@QueryComplexity({
  maxNestingDepth: 2,
  maxOrConditions: 5,
  maxRegexConditions: 2
})
async findAll(...) { }
```

### 3. ReDoS Protection (Regex Security)

**File:** `order.service.ts:560`

```typescript
if (filters.search) {
  const safeRegex = this.regexSecurityUtil.buildSafeRegexQuery(filters.search);

  if (safeRegex) {
    query.$or = [{ orderNumber: safeRegex }, { items: { $elemMatch: { offerTitle: safeRegex } } }];
  } else {
    this.appLogger.warn(`Invalid search pattern blocked: ${filters.search}`);
  }
}
```

### 4. Pickup Rate Limiting

**File:** `guards/pickup-throttler.guard.ts`

- Custom throttler extending `ThrottlerGuard`
- Tracking key: `pickup-{ip}-{orderId}-{userId}`
- Limit: 5 requests per 60 seconds
- Custom error message for user guidance

### 5. Authorization Guards Chain

**Controller Level:**

```typescript
@Controller('orders')
@UseGuards(JwtAuthGuard)              // Step 1: Verify JWT token
export class OrdersController {

  @Post()
  @UseGuards(RolesGuard)             // Step 2: Check user role
  @Roles(UserRole.CONSUMER)          // Step 3: Enforce role
  async create(...) { }
}
```

**Service Level (order.service.ts:492):**

```typescript
async findById(orderId: string, userId?: string, userRole?: UserRole) {
  // Resource ownership verification
  if (userId && userRole !== UserRole.ADMIN) {
    const isCustomer = order.customerId._id.toString() === userId;
    const isMerchant = order.merchantId._id.toString() === userId;

    if (!isCustomer && !isMerchant) {
      throw new ForbiddenException('Access denied');
    }
  }
}
```

---

## Background Jobs

### 1. Merchant-Approved Order Expiration

**Cron:** Every 10 minutes
**File:** `order.service.ts:131`

```typescript
@Cron(CronExpression.EVERY_10_MINUTES)
async expireApprovedOrdersCron() {
  // Target: Orders with merchantApprovedExpiration = true
  // Action: Release inventory + mark EXPIRED
  // Batch Size: 100 orders
}
```

### 2. RESERVED Order Expiration with Refund

**Cron:** Every 10 minutes
**File:** `order.service.ts:207`

```typescript
@Cron(CronExpression.EVERY_10_MINUTES)
async expireReservedOrdersWithRefundCron() {
  // Target: RESERVED orders past expiresAt
  // Action: Release inventory + process refund + mark EXPIRED
  // Batch Size: 50 orders (smaller due to API calls)
  // Retry: Failed refunds scheduled for automatic retry
}
```

### Performance Optimizations

**Batch Processing Pattern:**

```typescript
while (true) {
  const orders = await this.orderModel
    .find(query)
    .select('_id items') // Only required fields
    .lean() // Plain objects (50% memory reduction)
    .limit(BATCH_SIZE)
    .exec();

  if (orders.length === 0) break;

  for (const order of orders) {
    // Process order
  }

  if (orders.length < BATCH_SIZE) break;
}
```

---

## Integration Points

### 1. Payments Module (PaymentModule)

**Injected Services:**

- `PayoutService` - Create merchant payout ledger entries
- `RefundService` - Process automatic refunds for expired/cancelled orders

**Integration Points:**

- Order creation: Payment intent creation
- Pickup confirmation: Payment status HELD → EARNED
- Cancellation: Refund processing
- Expiration: Automatic refund

### 2. Loyalty Module (LoyaltyModule)

**Injected Services:**

- `LoyaltyService` - Award points on order completion
- `GamificationService` - Track referrals and streaks

**Integration Points:**

- Pickup confirmation: Award 10 points per bag
- Friend referral tracking: Update bag count
- Purchase streak: Track consecutive order days
- Business referral: Track orders for referred merchants

### 3. Donations Module (DonationsModule)

**Integration Points:**

- Order creation: Calculate 1% donation amount
- Post-transaction: Create donation record

### 4. Offers Module (Via Schema)

**Integration Points:**

- Order creation: Check availability and reserve inventory
- Pickup confirmation: Transfer `reservedQuantity → soldQuantity`
- Cancellation/Expiration: Release `reservedQuantity`

### 5. Establishments Module (Via Schema)

**Integration Points:**

- Order creation: Validate establishment and fetch details
- Order display: Populate establishment info

### 6. Users Module (Via Schema)

**Integration Points:**

- Order creation: Validate customer (phone verification)
- Order display: Populate customer/merchant info

---

## Error Handling

### Custom Exception Filter

**File:** `order.controller.ts:45`

```typescript
@Catch()
export class OrderExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    // Log full error details
    this.logger.error(`Order error: ${errorMessage}`, ...);

    // Map exceptions to HTTP responses
    if (exception instanceof BadRequestException) { status = 400; }
    if (exception instanceof NotFoundException) { status = 404; }
    if (exception instanceof ConflictException) { status = 409; }

    // Return structured error
    response.status(status).json({
      statusCode: status,
      message,
      details,
      timestamp: new Date().toISOString(),
      path: request.url
    });
  }
}
```

### Business Rule Exceptions

**Phone Verification Required (order.service.ts:314):**

```typescript
if (!customer.phoneNumber || !customer.isPhoneVerified) {
  throw new BadRequestException({
    message: 'Phone verification required to place orders',
    code: 'PHONE_VERIFICATION_REQUIRED',
    requiresPhoneSetup: !customer.phoneNumber,
    requiresPhoneVerification: !!customer.phoneNumber && !customer.isPhoneVerified,
  });
}
```

**Cancellation Window Closed (order.service.ts:915):**

```typescript
if (hoursUntilPickup < 1) {
  throw new BadRequestException({
    message: 'Cannot cancel order within 1 hour of pickup time',
    code: 'CANCELLATION_WINDOW_CLOSED',
    pickupStartTime: pickupStartTime.toISOString(),
    hoursRemaining: Math.max(0, hoursUntilPickup).toFixed(2),
  });
}
```

**Pickup Locked (order.service.ts:707):**

```typescript
if (order.pickupLocked) {
  throw new ForbiddenException({
    message: 'Order pickup is locked due to too many failed attempts',
    code: 'PICKUP_LOCKED',
    lockedAt: order.pickupLockedAt,
    reason: order.pickupLockedReason,
    contactSupport: true,
  });
}
```

---

## Testing

### Running Tests

```bash
# Unit tests
pnpm test orders

# Integration tests
pnpm test:e2e orders

# Specific test file
pnpm test -- order.service.spec.ts

# Watch mode (TDD)
pnpm test:watch orders
```

### Test Coverage Targets

| Component        | Target | Notes                 |
| ---------------- | ------ | --------------------- |
| OrdersService    | 80%+   | Core business logic   |
| OrdersController | 75%+   | Endpoint coverage     |
| DTO Validation   | 100%   | Critical for security |

### Key Test Scenarios

1. **Order Creation:**
   - Valid order with inventory reservation
   - Insufficient inventory (conflict)
   - Invalid time slot
   - Phone verification required
   - Donation calculation

2. **Cancellation:**
   - Cancel within 1 hour (rejected)
   - Cancel after 1 hour (full refund)
   - Cancel PICKED_UP order (rejected)

3. **Pickup Confirmation:**
   - Valid pickup code
   - Invalid pickup code (failed attempt tracking)
   - 5 failed attempts (order lockout)
   - Unlock pickup-locked order

4. **Expiration:**
   - RESERVED order expires (automatic refund)
   - Merchant-approved expiration (no refund)
   - Batch processing (memory efficiency)

5. **Security:**
   - ReDoS protection (malicious regex)
   - Rate limiting (pickup endpoint)
   - Authorization (resource ownership)

---

## Related Documentation

- [Backend CLAUDE.md](../../CLAUDE.md) - Backend architecture overview
- [Payments Module](../payments/README.md) - Payment processing integration
- [Loyalty Module](../loyalty/README.md) - Loyalty points and gamification
- [Donations Module](../donations/README.md) - Donation system
- [API Documentation](http://localhost:3000/api/v1/api-docs) - Swagger UI

---

## Changelog

| Version | Date         | Changes                             |
| ------- | ------------ | ----------------------------------- |
| v3.0.0  | Jan 15, 2026 | TGTG escrow model (RESERVED status) |
| v2.5.0  | Dec 20, 2025 | Gamification integration            |
| v2.4.0  | Dec 10, 2025 | Pickup brute-force protection       |
| v2.3.0  | Dec 1, 2025  | Automatic expiration with refunds   |
| v2.2.0  | Nov 21, 2025 | Loyalty points integration          |
| v2.1.0  | Nov 15, 2025 | Time-based cancellation policy      |
| v2.0.0  | Nov 1, 2025  | Donation integration                |

---

## Owners & Maintainers

**Primary Owner:** Backend Core Team
**Contact:** backend-core@toofreshtowaste.com
**Slack:** #backend-core

---

**Last Updated:** January 15, 2026
**Next Review:** April 15, 2026
