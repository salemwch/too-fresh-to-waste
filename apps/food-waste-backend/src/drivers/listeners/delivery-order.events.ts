import { OrderDocument } from '../../orders/schemas/order.schema';

/**
 * Emitted by OrdersService once a delivery-mode order is committed and visible
 * to the driver pool. Consumed by DriversModule to push the order to nearby
 * online drivers.
 *
 * An event rather than a direct call: OrdersModule already owns the Order model
 * that DriversModule reads, so injecting DriversService into OrdersService would
 * close a module cycle.
 */
export const DELIVERY_ORDER_CREATED = 'order.delivery.created';

export interface DeliveryOrderCreatedEvent {
  order: OrderDocument;
}
