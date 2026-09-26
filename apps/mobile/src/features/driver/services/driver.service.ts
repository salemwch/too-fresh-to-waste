/**
 * Driver Service
 * API client for driver endpoints
 *
 * Covers the full delivery lifecycle:
 * - Availability: online/offline toggle, location heartbeat
 * - Pool: fetch nearby available orders, recover the active order
 * - Lifecycle: accept → pickup → deliver, or unassign back to the pool
 * - Money: past deliveries and earnings roll-up
 */

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';
import type { DeliveryFailureReason, DeliveryRecovery } from '../utils/deliveryCash';

/** Backend may return either a GeoJSON point or a plain lat/lng pair. */
type DriverCoordinates =
  { lat: number; lng: number } | { type: string; coordinates: [number, number] };

/**
 * Driver-visible order with location and earnings info.
 *
 * `status` walks CONFIRMED → driver_assigned → out_for_delivery → delivered.
 * `driver_assigned` means accepted but not yet collected; `out_for_delivery`
 * means the food is with the driver.
 */
export interface DriverAvailableOrder {
  _id: string;
  orderNumber: string;
  customerId:
    | string
    | {
        _id: string;
        firstName?: string;
        lastName?: string;
        phoneNumber?: string;
      };
  establishmentId: string | Record<string, unknown>;
  driverId: string | null;
  deliveryFee?: number;
  driverEarnings?: number;
  deliveryMode: string;
  status: string;
  items: Array<{
    offerId: string;
    offerTitle: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  deliveryAddress?: {
    street: string;
    city: string;
    postalCode: string;
    coordinates?: DriverCoordinates;
  };
  establishmentAddress?: {
    street: string;
    city: string;
    coordinates?: DriverCoordinates;
  };
  collectionStartTime: string;
  collectionEndTime: string;
  expiresAt: string;
  totalAmount: number;
  paymentDetails?: {
    method: string;
    amount: number;
  };
  driverAssignedAt?: string;
  driverPickedUpAt?: string;
  /**
   * What the driver must do with money, frozen by the backend when the order
   * was collected from the merchant. The app shows these figures and never
   * computes them. Absent before pickup.
   */
  driverInstruction?: DriverInstruction;
  /** Who holds the customer's payment - decides whether cash is collected at the door. */
  paymentControl?: {
    controlledBy: 'TFTW' | 'MERCHANT';
    collector: 'MERCHANT' | 'DRIVER' | 'PAYMENT_GATEWAY';
  };
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DriverInstruction {
  /** Pay the merchant this, from the TFTW float, at pickup. */
  payMerchant: number;
  /** Collect this from the customer at the door. 0 when they paid online. */
  collectFromCustomer: number;
  /** The driver's share of the delivery fee, kept from the cash collected. */
  driverKeeps: number;
  frozenAt: string;
}

export interface DriverProfile {
  _id: string;
  userId: string;
  idCardNumber: string;
  address: string;
  isOnline: boolean;
  lastOnlineAt?: string;
}

export interface DriverEarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  allTime: number;
  deliveriesToday: number;
  deliveriesAllTime: number;
  currency: 'TND';
}

export interface DriverOrderHistoryPage {
  orders: DriverAvailableOrder[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Surfaces the backend's own message for a failed driver action.
 *
 * Accept can fail for several distinct reasons — another driver won the race,
 * the driver is offline, or they already carry an order — and each returns a
 * different message. Showing a single hardcoded string would tell the driver
 * the wrong thing in two cases out of three.
 */
export function getDriverErrorMessage(error: unknown, fallback: string): string {
  const response = (error as { response?: { data?: { message?: unknown } } } | undefined)?.response;
  const message = response?.data?.message;

  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  // NestJS validation errors arrive as string[].
  if (Array.isArray(message) && typeof message[0] === 'string') {
    return message[0];
  }

  return fallback;
}

/**
 * Driver API service
 * All methods use centralized apiClient with automatic token injection
 */
export const driverService = {
  // ── Availability ──────────────────────────────────────────────────────────

  async getProfile(): Promise<DriverProfile> {
    const response = await apiClient.get<BackendApiResponse<DriverProfile>>('/drivers/me');
    return unwrapBackendResponse<DriverProfile>(response, 'getProfile');
  },

  /** Toggle whether the driver receives orders and push notifications. */
  async setOnlineStatus(isOnline: boolean): Promise<DriverProfile> {
    Logger.debug('[driverService] Setting online status', { isOnline });

    const response = await apiClient.patch<BackendApiResponse<DriverProfile>>('/drivers/status', {
      isOnline,
    });
    return unwrapBackendResponse<DriverProfile>(response, 'setOnlineStatus');
  },

  /**
   * Location heartbeat. Returns 204 with no body, so there is nothing to unwrap.
   * Failures are swallowed by the caller — a dropped heartbeat is not worth an
   * error toast, the next tick will retry.
   */
  async updateLocation(lat: number, lng: number): Promise<void> {
    await apiClient.post('/drivers/location', { lat, lng });
  },

  // ── Order pool ────────────────────────────────────────────────────────────

  /**
   * Available orders near the driver. The backend returns an empty list when
   * the driver is offline or already carrying an order — that is a normal
   * state, not an error.
   */
  async getAvailableOrders(
    lat: number,
    lng: number,
    page = 1,
    limit = 20,
  ): Promise<DriverAvailableOrder[]> {
    try {
      const response = await apiClient.get<BackendApiResponse<DriverAvailableOrder[]>>(
        '/drivers/orders/available',
        { params: { lat, lng, page, limit } },
      );

      return unwrapBackendResponse<DriverAvailableOrder[]>(response, 'getAvailableOrders');
    } catch (error) {
      Logger.error('[driverService] Failed to fetch available orders', undefined, error as Error);
      throw error;
    }
  },

  /**
   * The driver's in-progress delivery, if any. Called on app start so a
   * restart mid-delivery restores the active order rather than stranding it.
   */
  async getActiveOrder(): Promise<DriverAvailableOrder | null> {
    const response =
      await apiClient.get<BackendApiResponse<DriverAvailableOrder | null>>(
        '/drivers/orders/active',
      );
    return unwrapBackendResponse<DriverAvailableOrder | null>(response, 'getActiveOrder');
  },

  async getOrderHistory(page = 1, limit = 20): Promise<DriverOrderHistoryPage> {
    const response = await apiClient.get<BackendApiResponse<DriverOrderHistoryPage>>(
      '/drivers/orders/history',
      { params: { page, limit } },
    );
    return unwrapBackendResponse<DriverOrderHistoryPage>(response, 'getOrderHistory');
  },

  async getEarnings(): Promise<DriverEarningsSummary> {
    const response =
      await apiClient.get<BackendApiResponse<DriverEarningsSummary>>('/drivers/earnings');
    return unwrapBackendResponse<DriverEarningsSummary>(response, 'getEarnings');
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /** CONFIRMED → driver_assigned. Fails if another driver won the race. */
  async acceptOrder(orderId: string): Promise<DriverAvailableOrder> {
    Logger.debug('[driverService] Accepting order', { orderId });

    const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
      `/drivers/orders/${orderId}/accept`,
    );
    return unwrapBackendResponse<DriverAvailableOrder>(response, 'acceptOrder');
  },

  /** driver_assigned → out_for_delivery. The driver now has the food. */
  async markPickedUp(orderId: string): Promise<DriverAvailableOrder> {
    Logger.debug('[driverService] Marking order as picked up', { orderId });

    const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
      `/drivers/orders/${orderId}/pickup`,
    );
    return unwrapBackendResponse<DriverAvailableOrder>(response, 'markPickedUp');
  },

  /**
   * out_for_delivery → delivered. Terminal success state.
   *
   * `collectedCash` is what the driver confirms the customer paid at the door
   * (0 for an online-paid order). The backend records it against the driver's
   * cash; omitting it is recorded as an unconfirmed collection and flagged.
   */
  async markDelivered(orderId: string, collectedCash: number): Promise<DriverAvailableOrder> {
    Logger.debug('[driverService] Marking order as delivered', { orderId });

    const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
      `/drivers/orders/${orderId}/deliver`,
      { collectedCash },
    );
    return unwrapBackendResponse<DriverAvailableOrder>(response, 'markDelivered');
  },

  /**
   * The delivery failed after the food was collected (and the merchant paid).
   * Reason and what happened to the food are required; out_for_delivery → cancelled.
   */
  async failDelivery(
    orderId: string,
    input: { reason: DeliveryFailureReason; recovery: DeliveryRecovery; notes?: string },
  ): Promise<DriverAvailableOrder> {
    Logger.debug('[driverService] Reporting a failed delivery', { orderId, reason: input.reason });

    const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
      `/drivers/orders/${orderId}/fail`,
      input,
    );
    return unwrapBackendResponse<DriverAvailableOrder>(response, 'failDelivery');
  },

  /**
   * Return the order to the pool. Before pickup only: once the food is
   * collected the merchant has been paid from the float, and the backend
   * answers 409 - report a problem instead (`failDelivery`).
   */
  async unassignOrder(orderId: string, reason?: string): Promise<DriverAvailableOrder> {
    Logger.debug('[driverService] Unassigning from order', { orderId, reason });

    const body = reason ? { reason } : {};
    const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
      `/drivers/orders/${orderId}/unassign`,
      body,
    );
    return unwrapBackendResponse<DriverAvailableOrder>(response, 'unassignOrder');
  },
};
