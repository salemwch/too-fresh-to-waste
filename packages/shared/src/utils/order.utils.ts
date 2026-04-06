/**
 * Order domain utilities — shared across backend, mobile, and web.
 *
 * Handles the `string | PopulatedEstablishment` union on `order.establishmentId`
 * and the `string | PopulatedOffer` union on `order.items[].offerId`.
 */

import { isActiveOrderStatus, isHistoryOrderStatus } from '../types/order.types';

import type { Order } from '../types/order.types';

/** Extract the establishment display name from an order */
export function getEstablishmentName(order: Order): string {
  if (typeof order.establishmentId === 'object' && order.establishmentId?.name) {
    return order.establishmentId.name;
  }
  return 'Restaurant';
}

/** Extract the first establishment image URL from an order (or undefined) */
export function getEstablishmentImage(order: Order): string | undefined {
  if (
    typeof order.establishmentId === 'object' &&
    Array.isArray(order.establishmentId.images) &&
    order.establishmentId.images.length > 0
  ) {
    return order.establishmentId.images[0];
  }
  return undefined;
}

/** Extract the first offer image URL from the first order item (or undefined) */
export function getOfferImage(order: Order): string | undefined {
  const firstItem = order.items?.[0];
  if (!firstItem) return undefined;
  const offerId = firstItem.offerId;
  if (
    typeof offerId === 'object' &&
    offerId !== null &&
    Array.isArray(offerId.images) &&
    offerId.images.length > 0
  ) {
    return offerId.images[0];
  }
  return undefined;
}

/** Returns true if the order is considered active (in-progress) */
export function isActiveOrder(order: Order): boolean {
  return isActiveOrderStatus(order.status);
}

/** Returns true if the order belongs to history (terminal state) */
export function isHistoryOrder(order: Order): boolean {
  return isHistoryOrderStatus(order.status);
}
