import { OrderStatus, PaymentStatus, PaymentMethod } from '../enums/order.enum';

export interface PickupDetails {
  scheduledTime: string;
  actualTime?: string;
  code: string;
}

export interface Order {
  id: string;
  userId: string;
  offerId: string;
  establishmentId: string;
  status: OrderStatus;
  quantity: number;
  totalAmount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  pickup: PickupDetails;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  offerId: string;
  quantity: number;
  paymentMethod: PaymentMethod;
  scheduledPickupTime?: string;
}

// ============================================================================
// Order status helpers — usable by any app that has { status: OrderStatus }
// ============================================================================

/** Statuses that represent an in-progress order */
const ACTIVE_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.PENDING,
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
]);

/** Statuses that represent a completed/terminal order */
const HISTORY_STATUSES: ReadonlySet<string> = new Set([
  OrderStatus.PICKED_UP,
  OrderStatus.CANCELLED,
  OrderStatus.EXPIRED,
  OrderStatus.REFUNDED,
]);

/** Returns true if the order status is considered "active" (in-progress) */
export function isActiveOrderStatus(status: OrderStatus): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** Returns true if the order status belongs to history (terminal) */
export function isHistoryOrderStatus(status: OrderStatus): boolean {
  return HISTORY_STATUSES.has(status);
}
