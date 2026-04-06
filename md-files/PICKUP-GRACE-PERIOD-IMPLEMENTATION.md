# Pickup Grace Period - Professional Implementation Guide

## Business Requirements

- **Base grace period:** 30 minutes after pickup window ends
- **Extension option:** Customer can request +15 min (merchant approval)
- **Payment handling:** Held in escrow during grace, refunded if not picked up
- **Pickup code validity:** Works throughout grace period + extensions

---

## Option 1: Smart Grace Period (RECOMMENDED)

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Order Lifecycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  RESERVED → GRACE_PERIOD → PICKED_UP ✅                     │
│                    ↓                                          │
│                 EXPIRED → REFUNDED ❌                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Database Changes

#### 1. Add new fields to Order schema

```typescript
// apps/food-waste-backend/src/orders/schemas/order.schema.ts

export enum OrderStatus {
  PENDING = 'pending',
  RESERVED = 'reserved',
  CONFIRMED = 'confirmed',
  GRACE_PERIOD = 'grace_period', // ✅ NEW - In 30-min grace window
  READY_FOR_PICKUP = 'ready_for_pickup',
  PICKED_UP = 'picked_up',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
}

export interface GracePeriodDetails {
  startedAt: Date; // When grace period began
  baseExpiresAt: Date; // Base 30-min deadline
  extensionRequested: boolean; // Customer requested extension
  extensionRequestedAt?: Date; // When extension was requested
  extensionApproved?: boolean; // Merchant decision
  extensionApprovedAt?: Date; // When merchant approved
  finalExpiresAt: Date; // Final deadline (with extensions)
  notificationsSent: string[]; // ['15_min_warning', 'merchant_approved']
}

@Schema({ timestamps: true })
export class Order {
  // ... existing fields ...

  @Prop({
    type: {
      startedAt: { type: Date, required: true },
      baseExpiresAt: { type: Date, required: true },
      extensionRequested: { type: Boolean, default: false },
      extensionRequestedAt: Date,
      extensionApproved: { type: Boolean, default: null },
      extensionApprovedAt: Date,
      finalExpiresAt: { type: Date, required: true },
      notificationsSent: { type: [String], default: [] },
    },
  })
  gracePeriodDetails?: GracePeriodDetails;
}
```

---

### Backend Implementation

#### 2. Update pickup code validation

```typescript
// apps/food-waste-backend/src/orders/order.service.ts

async confirmPickup(
    orderId: string,
    confirmDto: ConfirmPickupDto,
    userId: string,
    userRole: UserRole
): Promise<OrderDocument> {
    const order = await this.findById(orderId);

    // ✅ NEW: Grace period pickup code validation
    if (confirmDto.pickupCode) {
        const now = new Date();

        // Check if we're in grace period
        if (order.status === OrderStatus.GRACE_PERIOD && order.gracePeriodDetails) {
            const gracePeriod = order.gracePeriodDetails;

            // Check final deadline (base + any extensions)
            if (now > gracePeriod.finalExpiresAt) {
                throw new BadRequestException({
                    message: 'Pickup window has expired. Order has been automatically refunded.',
                    code: 'GRACE_PERIOD_EXPIRED',
                    expiredAt: gracePeriod.finalExpiresAt,
                });
            }

            // ✅ Code is valid - allow pickup
            this.logger.log(
                `Pickup code validated during grace period. Order: ${orderId}, Time remaining: ${Math.round((gracePeriod.finalExpiresAt.getTime() - now.getTime()) / 60000)} minutes`
            );
        }
        // Standard pickup window validation
        else if (order.status === OrderStatus.RESERVED) {
            const pickupEnd = new Date(order.pickupDetails.scheduledDate);
            const [h, m] = order.pickupDetails.timeSlot.endTime.split(':').map(Number);
            pickupEnd.setHours(h, m, 0, 0);

            // ✅ CHANGED: Reduced from 2 hours to 30 minutes
            const codeExpiresAt = new Date(pickupEnd.getTime() + 30 * 60 * 1000); // 30 min

            if (now > codeExpiresAt) {
                throw new BadRequestException({
                    message: 'Pickup code has expired',
                    code: 'CODE_EXPIRED',
                    expiresAt: codeExpiresAt,
                });
            }
        }
    }

    // ... rest of validation logic ...

    // Update order status to PICKED_UP
    order.status = OrderStatus.PICKED_UP;
    order.paymentStatus = OrderPaymentStatus.PAID; // ✅ Release payment to merchant
    order.pickupDetails.actualPickupTime = new Date();

    await order.save();

    // Trigger payment settlement
    await this.settleOrderPayment(order);

    return order;
}
```

#### 3. Automatic grace period activation

```typescript
// apps/food-waste-backend/src/orders/order.service.ts

/**
 * Cron job: Check for orders entering grace period
 * Runs every 5 minutes
 */
@Cron('*/5 * * * *') // Every 5 minutes
async activateGracePeriods(): Promise<void> {
    const now = new Date();

    // Find RESERVED orders past their pickup window end
    const ordersEnteringGrace = await this.orderModel
        .find({
            status: OrderStatus.RESERVED,
            'pickupDetails.scheduledDate': { $lte: now },
        })
        .exec();

    for (const order of ordersEnteringGrace) {
        const pickupEnd = new Date(order.pickupDetails.scheduledDate);
        const [h, m] = order.pickupDetails.timeSlot.endTime.split(':').map(Number);
        pickupEnd.setHours(h, m, 0, 0);

        // Check if pickup window just ended
        if (now >= pickupEnd && now < new Date(pickupEnd.getTime() + 5 * 60 * 1000)) {
            const baseExpiresAt = new Date(pickupEnd.getTime() + 30 * 60 * 1000); // +30 min

            order.status = OrderStatus.GRACE_PERIOD;
            order.gracePeriodDetails = {
                startedAt: now,
                baseExpiresAt,
                extensionRequested: false,
                finalExpiresAt: baseExpiresAt,
                notificationsSent: [],
            };

            await order.save();

            // Send push notification
            await this.notifyGracePeriodStarted(order);

            this.logger.log(
                `Order ${order._id} entered grace period. Expires at ${baseExpiresAt.toISOString()}`
            );
        }
    }
}

/**
 * Notify customer that grace period has started
 */
private async notifyGracePeriodStarted(order: OrderDocument): Promise<void> {
    const customerId = order.customerId.toString();
    const expiresAt = order.gracePeriodDetails.finalExpiresAt;
    const minutesLeft = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    await this.notificationService.sendPushNotification({
        userId: customerId,
        title: '⏰ Pickup Reminder',
        body: `You have ${minutesLeft} minutes left to pickup your order!`,
        data: {
            type: 'grace_period_started',
            orderId: order._id.toString(),
            expiresAt: expiresAt.toISOString(),
        },
    });
}
```

#### 4. Extension request handling

```typescript
// apps/food-waste-backend/src/orders/order.controller.ts

@Post(':id/request-extension')
@UseGuards(JwtAuthGuard)
async requestPickupExtension(
    @Param('id') orderId: string,
    @GetUser() user: SafeUserResponse,
) {
    const result = await this.ordersService.requestPickupExtension(
        orderId,
        user.userId,
    );

    return {
        message: 'Extension request sent to merchant',
        data: result,
    };
}

@Post(':id/approve-extension')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT, UserRole.ADMIN)
async approvePickupExtension(
    @Param('id') orderId: string,
    @GetUser() user: SafeUserResponse,
    @Body() dto: { approved: boolean; reason?: string },
) {
    const result = await this.ordersService.approvePickupExtension(
        orderId,
        user.userId,
        dto.approved,
        dto.reason,
    );

    return {
        message: dto.approved ? 'Extension approved' : 'Extension denied',
        data: result,
    };
}

// apps/food-waste-backend/src/orders/order.service.ts

async requestPickupExtension(
    orderId: string,
    customerId: string,
): Promise<OrderDocument> {
    const order = await this.findById(orderId);

    // Validate customer ownership
    if (order.customerId.toString() !== customerId) {
        throw new ForbiddenException('Not your order');
    }

    // Validate order is in grace period
    if (order.status !== OrderStatus.GRACE_PERIOD) {
        throw new BadRequestException({
            message: 'Order is not in grace period',
            code: 'NOT_IN_GRACE_PERIOD',
        });
    }

    // Check if already requested
    if (order.gracePeriodDetails.extensionRequested) {
        throw new BadRequestException({
            message: 'Extension already requested',
            code: 'ALREADY_REQUESTED',
        });
    }

    // Mark as requested
    order.gracePeriodDetails.extensionRequested = true;
    order.gracePeriodDetails.extensionRequestedAt = new Date();
    await order.save();

    // Notify merchant
    await this.notifyMerchantExtensionRequest(order);

    this.logger.log(`Extension requested for order ${orderId}`);
    return order;
}

async approvePickupExtension(
    orderId: string,
    merchantId: string,
    approved: boolean,
    reason?: string,
): Promise<OrderDocument> {
    const order = await this.findById(orderId);

    // Validate merchant ownership
    if (order.merchantId.toString() !== merchantId) {
        throw new ForbiddenException('Not your order');
    }

    // Validate order state
    if (order.status !== OrderStatus.GRACE_PERIOD) {
        throw new BadRequestException('Order is not in grace period');
    }

    if (!order.gracePeriodDetails.extensionRequested) {
        throw new BadRequestException('No extension request to approve');
    }

    const now = new Date();
    order.gracePeriodDetails.extensionApproved = approved;
    order.gracePeriodDetails.extensionApprovedAt = now;

    if (approved) {
        // Add 15 minutes to final deadline
        const currentDeadline = order.gracePeriodDetails.finalExpiresAt;
        order.gracePeriodDetails.finalExpiresAt = new Date(
            currentDeadline.getTime() + 15 * 60 * 1000
        );

        this.logger.log(
            `Extension approved for order ${orderId}. New deadline: ${order.gracePeriodDetails.finalExpiresAt.toISOString()}`
        );
    } else {
        this.logger.log(`Extension denied for order ${orderId}. Reason: ${reason}`);
    }

    await order.save();

    // Notify customer
    await this.notifyCustomerExtensionDecision(order, approved, reason);

    return order;
}
```

#### 5. Auto-expire orders after grace period

```typescript
/**
 * Cron job: Expire orders past grace period
 * Runs every 5 minutes
 */
@Cron('*/5 * * * *')
async expireGracePeriodOrders(): Promise<void> {
    const now = new Date();

    const expiredOrders = await this.orderModel
        .find({
            status: OrderStatus.GRACE_PERIOD,
            'gracePeriodDetails.finalExpiresAt': { $lte: now },
        })
        .exec();

    for (const order of expiredOrders) {
        try {
            // Update order status
            order.status = OrderStatus.EXPIRED;
            order.expiredAt = now;
            await order.save();

            // Trigger automatic refund
            await this.refundService.processAutomaticRefund(order._id.toString(), {
                reason: 'Order not picked up within grace period',
                type: 'grace_period_expiration',
            });

            // Release reserved offer quantities
            await this.releaseOfferQuantities(order);

            // Notify customer
            await this.notifyOrderExpired(order);

            this.logger.log(
                `Order ${order._id} expired after grace period. Refund initiated.`
            );
        } catch (error) {
            this.logger.error(
                `Failed to expire order ${order._id}: ${error.message}`,
                error.stack
            );
        }
    }

    if (expiredOrders.length > 0) {
        this.logger.log(`Expired ${expiredOrders.length} orders past grace period`);
    }
}
```

---

### Frontend Implementation

#### 6. Grace period UI component

```typescript
// apps/mobile/src/features/orders/components/GracePeriodBanner.tsx

import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from '@/design-system/components/atoms';
import { Clock, AlertCircle } from 'lucide-react-native';

interface GracePeriodBannerProps {
    order: Order;
    onRequestExtension: () => void;
}

export const GracePeriodBanner: React.FC<GracePeriodBannerProps> = ({
    order,
    onRequestExtension,
}) => {
    const [timeLeft, setTimeLeft] = useState<string>('');

    useEffect(() => {
        const updateTimer = () => {
            const now = Date.now();
            const deadline = new Date(order.gracePeriodDetails.finalExpiresAt).getTime();
            const diff = deadline - now;

            if (diff <= 0) {
                setTimeLeft('Expired');
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [order.gracePeriodDetails.finalExpiresAt]);

    const canRequestExtension =
        !order.gracePeriodDetails.extensionRequested &&
        order.gracePeriodDetails.extensionApproved !== true;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Clock size={20} color="#F59E0B" />
                <Text style={styles.title} weight="semibold">
                    Grace Period Active
                </Text>
            </View>

            <Text style={styles.timer} weight="bold">
                {timeLeft}
            </Text>

            <Text style={styles.subtitle}>
                Pickup your order before time runs out
            </Text>

            {order.gracePeriodDetails.extensionRequested &&
            order.gracePeriodDetails.extensionApproved === null ? (
                <View style={styles.pendingBox}>
                    <AlertCircle size={16} color="#6B7280" />
                    <Text style={styles.pendingText}>
                        Extension request pending merchant approval
                    </Text>
                </View>
            ) : order.gracePeriodDetails.extensionApproved === true ? (
                <View style={styles.approvedBox}>
                    <Text style={styles.approvedText}>
                        ✅ Merchant approved +15 min extension
                    </Text>
                </View>
            ) : canRequestExtension ? (
                <Button
                    variant="outline"
                    size="small"
                    onPress={onRequestExtension}
                    style={styles.button}
                >
                    Request +15 Min Extension
                </Button>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 16,
        color: '#92400E',
        marginLeft: 8,
    },
    timer: {
        fontSize: 32,
        color: '#B45309',
        textAlign: 'center',
        marginVertical: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#92400E',
        textAlign: 'center',
        marginBottom: 12,
    },
    button: {
        borderColor: '#F59E0B',
    },
    pendingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    pendingText: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 6,
    },
    approvedBox: {
        padding: 8,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
    },
    approvedText: {
        fontSize: 14,
        color: '#065F46',
        textAlign: 'center',
    },
});
```

---

## Option 2: Fixed 30-Min Grace (Simpler)

**Pros:** Simpler implementation, clear expectations
**Cons:** Less flexible, may frustrate late customers

### Changes:

1. **No extension system** - just 30 min flat
2. **Simpler schema** - no extension fields needed
3. **Auto-refund after 30 min** - no merchant intervention

```typescript
// Simplified grace period validation
if (order.status === OrderStatus.GRACE_PERIOD) {
  const pickupEnd = new Date(order.pickupDetails.scheduledDate);
  const [h, m] = order.pickupDetails.timeSlot.endTime.split(':').map(Number);
  pickupEnd.setHours(h, m, 0, 0);

  const graceExpiresAt = new Date(pickupEnd.getTime() + 30 * 60 * 1000); // Fixed 30 min

  if (new Date() > graceExpiresAt) {
    throw new BadRequestException({
      message: 'Pickup window expired. Order has been refunded.',
      code: 'GRACE_PERIOD_EXPIRED',
    });
  }
}
```

---

## Option 3: Tiered Grace Period

**Pros:** Flexible, incentivizes prompt pickup
**Cons:** Complex payment logic

### Structure:

- **0-15 min late:** Full refund if not picked up
- **15-30 min late:** 80% refund if not picked up (20% platform fee)
- **30+ min:** No refund, order expired

```typescript
interface TieredGracePeriod {
    tier: 'full_refund' | 'partial_refund' | 'no_refund';
    refundPercentage: number;
    deadline: Date;
}

// Calculate tier based on elapsed time
function calculateGraceTier(order: Order): TieredGracePeriod {
    const now = Date.now();
    const pickupEnd = /* calculate pickup end */;
    const elapsed = now - pickupEnd.getTime();

    if (elapsed < 15 * 60 * 1000) {
        return { tier: 'full_refund', refundPercentage: 100, deadline: /* +15 min */ };
    } else if (elapsed < 30 * 60 * 1000) {
        return { tier: 'partial_refund', refundPercentage: 80, deadline: /* +30 min */ };
    } else {
        return { tier: 'no_refund', refundPercentage: 0, deadline: pickupEnd };
    }
}
```

---

## Option 4: SMS Verification Override

**Pros:** Works even if pickup code lost, secure
**Cons:** SMS costs, requires phone verification

### Flow:

1. Customer arrives late (after grace expired)
2. Merchant can send SMS with new temporary code (valid 5 min)
3. Customer receives: "Your pickup code: 789456 (valid 5 min)"
4. System validates temporary code
5. Order marked as picked up

```typescript
async sendEmergencyPickupCode(
    orderId: string,
    merchantId: string,
): Promise<void> {
    const order = await this.findById(orderId);

    // Validate merchant ownership
    if (order.merchantId.toString() !== merchantId) {
        throw new ForbiddenException('Not your order');
    }

    // Generate temporary code (5 min validity)
    const tempCode = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    order.emergencyPickupCode = {
        code: tempCode,
        expiresAt,
        generatedBy: merchantId,
    };
    await order.save();

    // Send SMS to customer
    await this.smsService.send({
        to: order.customer.phoneNumber,
        body: `Your emergency pickup code: ${tempCode} (valid 5 minutes)`,
    });

    this.logger.log(`Emergency code sent for order ${orderId}`);
}
```

---

## Comparison Matrix

| Feature              | Option 1: Smart Grace | Option 2: Fixed 30min | Option 3: Tiered | Option 4: SMS Override |
| -------------------- | --------------------- | --------------------- | ---------------- | ---------------------- |
| **Complexity**       | Medium                | Low                   | High             | Medium                 |
| **Flexibility**      | ⭐⭐⭐⭐⭐            | ⭐⭐⭐                | ⭐⭐⭐⭐         | ⭐⭐⭐⭐⭐             |
| **Merchant Control** | Yes                   | No                    | No               | Yes                    |
| **Dev Time**         | 2-3 days              | 1 day                 | 3-4 days         | 2 days                 |
| **User Experience**  | ⭐⭐⭐⭐⭐            | ⭐⭐⭐⭐              | ⭐⭐⭐           | ⭐⭐⭐⭐               |
| **Cost**             | Free                  | Free                  | Free             | SMS fees               |

---

## 🏆 Recommendation: Option 1 (Smart Grace Period)

**Why:**

- Best balance of automation + human decision
- Merchant can help struggling customers
- Clear communication throughout
- Professional UX (similar to Uber, DoorDash)
- No extra costs

**Implementation Timeline:**

- Day 1-2: Backend schema + validation changes
- Day 3: Cron jobs + notification system
- Day 4-5: Frontend UI + testing

---

## Testing Checklist

```
✅ Pickup code works during base 30-min grace
✅ Extension request sends notification to merchant
✅ Merchant approval extends deadline correctly
✅ Payment stays HELD during grace period
✅ Auto-refund triggers after final deadline
✅ Offer quantities released on expiration
✅ Push notifications sent at key moments:
   - Grace period started (30 min left)
   - 15 min warning
   - 5 min warning
   - Extension approved/denied
   - Order expired + refunded
✅ Customer can still pickup after extension
✅ Pickup code validation handles all edge cases
```

---

**Ready to implement?** Let me know which option you prefer and I'll provide the complete code files!
