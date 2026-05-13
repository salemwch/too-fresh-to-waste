/**
 * Driver Service
 * API client for driver endpoints
 *
 * Handles driver order operations:
 * - Fetch available orders near driver location
 * - Accept an order
 * - Mark order as delivered
 * - Unassign from a delivery
 */

import { apiClient, unwrapBackendResponse, type BackendApiResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

/**
 * Driver-visible order with location and earnings info
 * Returned by backend driver endpoints
 */
export interface DriverAvailableOrder {
  _id: string;
  orderNumber: string;
  customerId: string;
  establishmentId: string | Record<string, any>;
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
    coordinates?: {
      type: string;
      coordinates: [number, number];
    };
  };
  establishmentAddress?: {
    street: string;
    city: string;
    coordinates?: {
      type: string;
      coordinates: [number, number];
    };
  };
  collectionStartTime: string;
  collectionEndTime: string;
  expiresAt: string;
  totalAmount: number;
  paymentDetails?: {
    method: string;
    amount: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Driver API service
 * All methods use centralized apiClient with automatic token injection
 */
export const driverService = {
  /**
   * Fetch available orders for driver near location
   * @param lat - Driver latitude
   * @param lng - Driver longitude
   * @param page - Page number (1-indexed, default: 1)
   * @param limit - Items per page (default: 20)
   */
  async getAvailableOrders(
    lat: number,
    lng: number,
    page = 1,
    limit = 20,
  ): Promise<DriverAvailableOrder[]> {
    try {
      Logger.debug('[driverService] Fetching available orders', { lat, lng, page, limit });

      const response = await apiClient.get<BackendApiResponse<DriverAvailableOrder[]>>(
        '/drivers/orders/available',
        {
          params: { lat, lng, page, limit },
        },
      );

      const orders = unwrapBackendResponse<DriverAvailableOrder[]>(response, 'getAvailableOrders');

      Logger.debug('[driverService] Available orders fetched', {
        count: orders.length,
        page,
        limit,
      });

      return orders;
    } catch (error) {
      Logger.error('[driverService] Failed to fetch available orders', undefined, error as Error);
      throw error;
    }
  },

  /**
   * Accept an available order as the driver
   * @param orderId - Order ID to accept
   */
  async acceptOrder(orderId: string): Promise<DriverAvailableOrder> {
    try {
      Logger.debug('[driverService] Accepting order', { orderId });

      const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
        `/drivers/orders/${orderId}/accept`,
      );

      const order = unwrapBackendResponse<DriverAvailableOrder>(response, 'acceptOrder');

      Logger.debug('[driverService] Order accepted', { orderId, status: order.status });

      return order;
    } catch (error) {
      Logger.error('[driverService] Failed to accept order', undefined, error as Error);
      throw error;
    }
  },

  /**
   * Mark an order as delivered
   * @param orderId - Order ID to mark delivered
   */
  async markDelivered(orderId: string): Promise<DriverAvailableOrder> {
    try {
      Logger.debug('[driverService] Marking order as delivered', { orderId });

      const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
        `/drivers/orders/${orderId}/deliver`,
      );

      const order = unwrapBackendResponse<DriverAvailableOrder>(response, 'markDelivered');

      Logger.debug('[driverService] Order marked as delivered', {
        orderId,
        status: order.status,
      });

      return order;
    } catch (error) {
      Logger.error('[driverService] Failed to mark order as delivered', undefined, error as Error);
      throw error;
    }
  },

  /**
   * Unassign from a delivery (driver cancellation)
   * @param orderId - Order ID to unassign from
   * @param reason - Optional reason for unassignment
   */
  async unassignOrder(orderId: string, reason?: string): Promise<DriverAvailableOrder> {
    try {
      Logger.debug('[driverService] Unassigning from order', { orderId, reason });

      const body = reason ? { reason } : {};
      const response = await apiClient.post<BackendApiResponse<DriverAvailableOrder>>(
        `/drivers/orders/${orderId}/unassign`,
        body,
      );

      const order = unwrapBackendResponse<DriverAvailableOrder>(response, 'unassignOrder');

      Logger.debug('[driverService] Order unassigned', {
        orderId,
        status: order.status,
      });

      return order;
    } catch (error) {
      Logger.error('[driverService] Failed to unassign from order', undefined, error as Error);
      throw error;
    }
  },
};
