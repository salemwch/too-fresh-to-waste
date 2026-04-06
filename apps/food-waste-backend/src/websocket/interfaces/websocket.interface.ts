/**
 * WebSocket interface re-exports.
 *
 * Event names, room definitions, and shared payload types have been moved to
 * @foodwaste/shared so the frontend can import them without depending on the backend.
 *
 * Backend-only types (AuthenticatedSocket) remain here.
 */
import type { Socket } from 'socket.io';

import type { UserRole } from '@foodwaste/shared';

// Re-export shared constants so existing backend imports still work
export {
  WebSocketEvents,
  WEBSOCKET_ROOMS,
  type WebSocketRoom,
  type WebSocketEventPayload,
  type OrderStatusUpdatePayload,
  type OfferUpdatePayload,
  type NotificationEventPayload,
} from '@foodwaste/shared';

// Backward-compatible aliases — backend code used shorter names before shared migration
export type { OrderStatusUpdatePayload as OrderStatusUpdate } from '@foodwaste/shared';
export type { OfferUpdatePayload as OfferUpdate } from '@foodwaste/shared';
export type { NotificationEventPayload as NotificationEvent } from '@foodwaste/shared';

// ─── Backend-only types ───────────────────────────────────────────────────────

/** Authenticated Socket.IO client — backend only (requires socket.io). */
export interface AuthenticatedSocket extends Socket {
  userId: string;
  email: string;
  role: UserRole;
  isAuthenticated: boolean;
}
