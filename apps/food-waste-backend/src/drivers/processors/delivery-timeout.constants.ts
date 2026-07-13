/**
 * Shared between DriversService (which schedules) and DeliveryTimeoutProcessor
 * (which consumes). Kept in its own file so the service does not have to import
 * the processor and create a cycle.
 */
export const DELIVERY_TIMEOUT_QUEUE = 'driver-delivery-timeouts';
export const DELIVERY_TIMEOUT_JOB = 'auto-unassign-stale-delivery';

export interface DeliveryTimeoutJobData {
  orderId: string;
  driverId: string;
}
