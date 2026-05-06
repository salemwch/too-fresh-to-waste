/**
 * Order Domain Events
 * Events emitted by the orders module for cross-module communication
 *
 * @module common/events
 */

/**
 * Emitted when an order is successfully completed
 * Listeners: Loyalty (award points), Donations (process round-up), Analytics, Notifications
 */
export class OrderCompletedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly merchantId: string,
    public readonly offerId: string,
    public readonly totalAmount: number,
    public readonly completedAt: Date,
    public readonly metadata?: {
      itemCount?: number;
      isFirstOrder?: boolean;
      paymentMethod?: string;
    },
    /** Bag price before delivery fee — used for charity calculation (5% of platform cut) */
    public readonly subtotalAmount: number = totalAmount,
  ) {}
}

/**
 * Emitted when an order is created
 * Listeners: Inventory (reserve items), Notifications (confirmation)
 */
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly merchantId: string,
    public readonly offerId: string,
    public readonly createdAt: Date,
  ) {}
}

/**
 * Emitted when an order is cancelled
 * Listeners: Inventory (release items), Payments (refund), Notifications
 */
export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly cancelledAt: Date,
  ) {}
}
