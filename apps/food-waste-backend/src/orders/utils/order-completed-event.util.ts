import { OrderCompletedEvent } from '../../common/events';

/** The fields of an order the completion event reads. Populated or not. */
export interface CompletableOrder {
  _id: { toString(): string };
  customerId: { _id?: unknown; toString(): string };
  merchantId: { _id?: unknown; toString(): string };
  establishmentId?: unknown;
  items: ReadonlyArray<{ quantity: number; offerId: { toString(): string } }>;
  pricing?: { total?: number; subtotal?: number } | null;
  deliveryMode?: string;
  paymentDetails?: { method?: string } | null;
}

const idOf = (ref: unknown): string | undefined => {
  if (ref === null || ref === undefined) {
    return undefined;
  }
  const nested = (ref as { _id?: unknown })._id;
  const value = nested ?? ref;
  return (value as { toString(): string }).toString();
};

/**
 * `order.completed` for a sale the customer received - a pickup confirmed at
 * the counter, or a delivery handed over at the door. Loyalty ("Save a Bag"),
 * donations and analytics all react to it.
 *
 * Built in one place because it used to be built inline in the pickup path
 * only: a delivered order never emitted it, so delivery customers earned no
 * loyalty points and no donation was ever recorded for their orders.
 */
export function buildOrderCompletedEvent(
  order: CompletableOrder,
  completedAt: Date,
): OrderCompletedEvent {
  const totalBags = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const paymentMethod = order.paymentDetails?.method;

  return new OrderCompletedEvent(
    order._id.toString(),
    idOf(order.customerId) ?? '',
    idOf(order.merchantId) ?? '',
    order.items[0]?.offerId.toString() ?? '',
    order.pricing?.total || 0,
    completedAt,
    {
      itemCount: totalBags,
      isFirstOrder: false,
      ...(paymentMethod ? { paymentMethod } : {}),
    },
    order.pricing?.subtotal || 0,
    idOf(order.establishmentId),
  );
}
