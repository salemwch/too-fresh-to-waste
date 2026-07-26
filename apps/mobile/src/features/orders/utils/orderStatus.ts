/**
 * Order status → badge presentation.
 *
 * Every OrderStatus must resolve to a translated label. The map used to cover
 * ten of the thirteen, with a fallback of `labelKey: order.status` — so the
 * three delivery statuses would have rendered the raw enum value
 * ("driver_assigned") straight into the badge. Technical text must never reach
 * the user, and an exhaustiveness test now enforces that.
 *
 * Delivery is not implemented yet (pickup-only), but these statuses exist in the
 * shared enum and the backend can emit them, so they are handled rather than
 * left to the fallback.
 */

import { OrderStatus } from '@foodwaste/shared';

import type { PickupErrorCode } from '@foodwaste/shared';

export type BadgeVariant = 'warning' | 'info' | 'success' | 'error' | 'neutral';

export interface StatusBadge {
  variant: BadgeVariant;
  /** i18n key — never a raw status value. */
  labelKey: string;
}

const STATUS_BADGES: Record<OrderStatus, StatusBadge> = {
  [OrderStatus.PENDING]: { variant: 'warning', labelKey: 'orders.statusPending' },
  [OrderStatus.PENDING_PAYMENT]: { variant: 'warning', labelKey: 'orders.statusPendingPayment' },
  [OrderStatus.RESERVED]: { variant: 'info', labelKey: 'orders.statusReserved' },
  [OrderStatus.CONFIRMED]: { variant: 'info', labelKey: 'orders.statusConfirmed' },
  [OrderStatus.READY_FOR_PICKUP]: { variant: 'success', labelKey: 'orders.statusReady' },
  [OrderStatus.PICKED_UP]: { variant: 'success', labelKey: 'orders.statusPickedUp' },
  [OrderStatus.COMPLETED]: { variant: 'success', labelKey: 'orders.statusCompleted' },
  [OrderStatus.DRIVER_ASSIGNED]: { variant: 'info', labelKey: 'orders.statusDriverAssigned' },
  [OrderStatus.OUT_FOR_DELIVERY]: { variant: 'info', labelKey: 'orders.statusOutForDelivery' },
  [OrderStatus.DELIVERED]: { variant: 'success', labelKey: 'orders.statusDelivered' },
  [OrderStatus.CANCELLED]: { variant: 'error', labelKey: 'orders.statusCancelled' },
  [OrderStatus.EXPIRED]: { variant: 'error', labelKey: 'orders.statusExpired' },
  [OrderStatus.REFUNDED]: { variant: 'neutral', labelKey: 'orders.statusRefunded' },
};

/**
 * Shown for a status this build does not know — a newer backend, or a value
 * outside the enum. Deliberately a translated generic rather than the raw
 * status: an unknown value is exactly the case where echoing it leaks
 * snake_case internals into the UI.
 */
const UNKNOWN_STATUS_BADGE: StatusBadge = {
  variant: 'neutral',
  labelKey: 'orders.statusUnknown',
};

export function getStatusBadge(status: string): StatusBadge {
  return STATUS_BADGES[status as OrderStatus] ?? UNKNOWN_STATUS_BADGE;
}

/** Statuses where the confirm-pickup UI is offered. */
const CONFIRMABLE_STATUSES: ReadonlySet<string> = new Set<string>([
  OrderStatus.RESERVED,
  OrderStatus.CONFIRMED,
  OrderStatus.READY_FOR_PICKUP,
]);

export function canConfirmPickup(status: string): boolean {
  return CONFIRMABLE_STATUSES.has(status);
}

/** The order has been handed over; nothing further is expected of the user. */
export function isPickedUp(status: string): boolean {
  return status === OrderStatus.PICKED_UP || status === OrderStatus.COMPLETED;
}

/**
 * Whether the pickup window has closed.
 *
 * Two independent signals: the backend may have already marked the order
 * EXPIRED, or `expiresAt` may simply have passed while the screen is open. The
 * second is what disables the code input client-side without waiting for a
 * refetch.
 */
export function isOrderExpired(order: {
  status: string;
  expiresAt?: string | Date | null | undefined;
}): boolean {
  if (order.status === OrderStatus.EXPIRED) return true;
  if (order.expiresAt == null) return false;

  const expiresAt = new Date(order.expiresAt).getTime();
  // An unparseable date must not read as expired — that would lock a valid
  // pickup out of its own code.
  if (!Number.isFinite(expiresAt)) return false;

  return Date.now() > expiresAt;
}

/**
 * Pickup-confirmation failures → user-facing message.
 *
 * Was written out identically in OrderDetailsScreen and OrderSuccessModal. Both
 * show the same errors for the same action, so a new code added to one and not
 * the other would surface as a raw error string in whichever was missed.
 */

/** Backend pickup errors, plus the client-side "wrong code" case. */
export type InlinePickupError = PickupErrorCode | 'INVALID_CODE';

const PICKUP_ERROR_KEYS: Record<InlinePickupError, string> = {
  CODE_EXPIRED: 'orders.codeExpired',
  INVALID_CODE: 'orders.invalidCode',
  PICKUP_ALREADY_DONE: 'orders.alreadyPickedUp',
  PICKUP_LOCKED: 'orders.pickupLocked',
  ORDER_NOT_READY: 'orders.orderNotReady',
};

/** Generic fallback — never the raw error code, same reasoning as the badge. */
const UNKNOWN_PICKUP_ERROR_KEY = 'orders.pickupFailed';

export function getPickupErrorKey(error: InlinePickupError | null | undefined): string {
  if (error == null) return UNKNOWN_PICKUP_ERROR_KEY;
  return PICKUP_ERROR_KEYS[error] ?? UNKNOWN_PICKUP_ERROR_KEY;
}

/**
 * The establishment id, which arrives either as a raw id or as a populated
 * document depending on the endpoint.
 */
export function getEstablishmentId(
  establishmentId:
    | { _id?: string | undefined; id?: string | undefined }
    | string
    | null
    | undefined,
): string {
  if (typeof establishmentId === 'string') return establishmentId;
  return establishmentId?._id ?? establishmentId?.id ?? '';
}
