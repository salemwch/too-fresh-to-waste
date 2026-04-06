/**
 * WebSocket Constants — single source of truth for event names and rooms.
 *
 * Both backend (NestJS gateway) and frontend (web/mobile) import from here.
 * String literals in the frontend must NOT exist outside this file.
 *
 * Backend: apps/food-waste-backend/src/websocket/websocket.gateway.ts
 * Web:     apps/web/src/hooks/use-merchant-orders-socket.ts
 * Mobile:  (future — Socket.IO for consumer notifications)
 */

import type { UserRole } from '../enums/user.enum';

// ─── Event names ─────────────────────────────────────────────────────────────

export enum WebSocketEvents {
  // Connection lifecycle
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',

  // Order events
  ORDER_STATUS_UPDATED = 'order:status_updated',
  ORDER_NEW = 'order:new',
  ORDER_READY_FOR_PICKUP = 'order:ready_for_pickup',
  ORDER_PICKUP_REMINDER = 'order:pickup_reminder',
  ORDER_CANCELLED = 'order:cancelled',
  ORDER_EXPIRED = 'order:expired',

  // Offer events
  OFFER_NEW_NEARBY = 'offer:new_nearby',
  OFFER_UPDATED = 'offer:updated',
  OFFER_EXPIRING_SOON = 'offer:expiring_soon',
  OFFER_FEATURED = 'offer:featured',
  OFFER_SOLD_OUT = 'offer:sold_out',

  // Notification events
  NOTIFICATION_NEW = 'notification:new',
  NOTIFICATION_READ = 'notification:read',
  NOTIFICATION_BULK = 'notification:bulk',

  // System events
  SYSTEM_MAINTENANCE = 'system:maintenance',
  SYSTEM_ANNOUNCEMENT = 'system:announcement',

  // Establishment events
  ESTABLISHMENT_ONLINE = 'establishment:online',
  ESTABLISHMENT_OFFLINE = 'establishment:offline',
  ESTABLISHMENT_NEW_OFFER = 'establishment:new_offer',

  // Community goal events
  COMMUNITY_BAG_UPDATED = 'community:bag_updated',
  COMMUNITY_GOAL_COMPLETED = 'community:goal_completed',

  // Error events
  ERROR = 'error',
  UNAUTHORIZED = 'unauthorized',
  RATE_LIMITED = 'rate_limited',
}

// ─── Room definitions ────────────────────────────────────────────────────────

export interface WebSocketRoom {
  name: string;
  description: string;
  allowedRoles?: UserRole[];
  maxConnections?: number;
  requiresAuth: boolean;
}

export const WEBSOCKET_ROOMS = {
  GLOBAL: {
    name: 'global',
    description: 'Global announcements and system updates',
    requiresAuth: false,
  },
  USER_NOTIFICATIONS: {
    name: 'user_notifications',
    description: 'User-specific notifications',
    requiresAuth: true,
  },
  ORDER_UPDATES: {
    name: 'order_updates',
    description: 'Order status updates',
    requiresAuth: true,
  },
  NEARBY_OFFERS: {
    name: 'nearby_offers',
    description: 'Location-based offer updates',
    requiresAuth: true,
  },
  MERCHANT_DASHBOARD: {
    name: 'merchant_dashboard',
    description: 'Merchant business updates',
    requiresAuth: true,
  },
  ADMIN_ALERTS: {
    name: 'admin_alerts',
    description: 'Administrative alerts and monitoring',
    requiresAuth: true,
  },
} as const satisfies Record<string, WebSocketRoom>;

// ─── Shared event payload types ───────────────────────────────────────────────

/** Generic event wrapper emitted by the backend for all WS events. */
export interface WebSocketEventPayload {
  event: string;
  data: unknown;
  timestamp: Date;
  userId?: string;
  metadata?: Record<string, unknown>;
}

/** Payload shape for ORDER_STATUS_UPDATED and ORDER_CANCELLED/EXPIRED. */
export interface OrderStatusUpdatePayload {
  orderId: string;
  status: string;
  previousStatus: string;
  customerId: string;
  merchantId: string;
  establishmentId: string;
  message?: string;
  estimatedPickupTime?: Date;
  actualPickupTime?: Date;
}

/** Payload shape for OFFER_NEW_NEARBY, OFFER_UPDATED, etc. */
export interface OfferUpdatePayload {
  offerId: string;
  type: 'new' | 'updated' | 'expired' | 'sold_out' | 'featured';
  establishmentId: string;
  merchantId: string;
  coordinates?: [number, number]; // [longitude, latitude]
  title: string;
  discountPercentage: number;
  availableQuantity: number;
  expiresAt: Date;
}

/** Payload shape for NOTIFICATION_NEW and NOTIFICATION_BULK. */
export interface NotificationEventPayload {
  id: string;
  userId: string;
  type: 'order' | 'offer' | 'system' | 'merchant' | 'promotion';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  readAt?: Date;
  createdAt: Date;
}
