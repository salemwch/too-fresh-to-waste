import type { AdminOrderStatus } from '@/types/admin';

/**
 * Badge styling per order status, shared by every admin surface that renders a
 * status chip (orders table, order sheet, driver order history).
 *
 * Centralised deliberately: the delivery statuses were added to the orders
 * page only, so any other screen showing `driver_assigned` fell through to the
 * neutral grey fallback. One map means a new status is styled everywhere at
 * once.
 */
export const ORDER_STATUS_COLORS: Record<AdminOrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_payment: 'bg-amber-50 text-amber-700 border-amber-200',
  reserved: 'bg-violet-50 text-violet-700 border-violet-200',
  confirmed: 'bg-sky-50 text-sky-700 border-sky-200',
  ready_for_pickup: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  picked_up: 'bg-teal-50 text-teal-700 border-teal-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  driver_assigned: 'bg-blue-50 text-blue-700 border-blue-200',
  out_for_delivery: 'bg-blue-50 text-blue-700 border-blue-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
  expired: 'bg-gray-100 text-gray-500 border-gray-200',
  refunded: 'bg-sky-50 text-sky-700 border-sky-200',
};

export const ORDER_STATUS_FALLBACK_COLOR = 'bg-gray-100 text-gray-600 border-gray-200';

export function orderStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status as AdminOrderStatus] ?? ORDER_STATUS_FALLBACK_COLOR;
}
