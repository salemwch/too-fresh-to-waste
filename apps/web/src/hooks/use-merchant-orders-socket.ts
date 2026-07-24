'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { z } from 'zod';
import { WebSocketEvents } from '@foodwaste/shared';
import { useAuthStore } from '@/lib/auth';
import { dashboardKeys } from './use-merchant-dashboard';
import { useNotificationStore } from '@/lib/notification-store';
import type { MerchantOrder } from '@/types/dashboard';

// ─── Zod schemas for incoming WebSocket payloads ──────────────────────────────
// Must match OrderStatus in src/types/dashboard.ts
const orderStatusValues = [
  'pending',
  'pending_payment',
  'reserved',
  'confirmed',
  'ready_for_pickup',
  'picked_up',
  'completed',
  'cancelled',
  'expired',
  'refunded',
] as const;

const orderStatusPayloadSchema = z.object({
  event: z.string().optional(),
  data: z.object({
    orderId: z.string().min(1),
    status: z.enum(orderStatusValues),
    previousStatus: z.enum(orderStatusValues).optional(),
    customerId: z.string().optional(),
    merchantId: z.string().optional(),
    establishmentId: z.string().optional(),
    message: z.string().optional(),
  }),
  timestamp: z.string().optional(),
});

const newOrderPayloadSchema = z.object({
  event: z.string().optional(),
  data: z
    .object({
      orderId: z.string().min(1),
      orderNumber: z.string(),
      customerName: z.string().optional(),
      pricing: z.object({ total: z.number() }).optional(),
    })
    .optional(),
  // Fallback — direct fields when payload arrives unwrapped
  orderId: z.string().optional(),
  orderNumber: z.string().optional(),
  customerName: z.string().optional(),
  pricing: z.object({ total: z.number() }).optional(),
});

/**
 * In proxy mode (NEXT_PUBLIC_API_URL = /api/v1), cookies are bound to the
 * Vercel domain. Socket.IO must connect to the SAME origin so cookies are
 * sent. Vercel rewrites /socket.io/* to the backend.
 *
 * In direct mode or local dev, connect to the backend directly.
 */
const isProxyMode =
  typeof window !== 'undefined' && (process.env['NEXT_PUBLIC_API_URL'] ?? '').startsWith('/');

const BACKEND_WS_URL = isProxyMode
  ? undefined // same origin — browser connects to Vercel, which proxies /socket.io/* to backend
  : (process.env['NEXT_PUBLIC_WS_URL'] ?? 'http://localhost:3000');

/**
 * Connects to the NestJS WebSocket gateway and listens for order events.
 *
 * - `order:status_updated` → patches TanStack Query cache in place.
 * - `order:new`            → invalidates the orders list, adds an entry to the
 *                            notification store (badge + dropdown), and fires a
 *                            Sonner toast.
 *
 * Auth flow:
 * 1. Connect with `auth: { token }` in the handshake so the guard can verify.
 * 2. On connect, emit `join_room` → WebSocketAuthGuard sets socket.isAuthenticated.
 * 3. Emit `authenticate` → populates the `userSockets` map so `sendToUser()` works.
 *
 * Mount this hook in the merchant layout so the socket persists across page
 * navigations and the header notification bell stays in sync.
 */
export function useMerchantOrdersSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    // In proxy mode, connect to same origin so cookies flow naturally.
    // Vercel rewrites handle /socket.io/* → backend for HTTP polling.
    // Vercel does NOT support WebSocket upgrade, so force polling-only in proxy mode.
    const socket = BACKEND_WS_URL
      ? io(BACKEND_WS_URL, {
          withCredentials: true,
          transports: ['polling', 'websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 30000,
        })
      : io({
          withCredentials: true,
          transports: ['polling'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 2000,
          reconnectionDelayMax: 30000,
        });

    socketRef.current = socket;

    const joinRoom = () => {
      socket.emit(WebSocketEvents.JOIN_ROOM, { room: 'merchant_dashboard' });
    };

    socket.on('connect', joinRoom);

    socket.on(WebSocketEvents.ORDER_STATUS_UPDATED, (raw: unknown) => {
      const parsed = orderStatusPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[WS] Invalid order:status_updated payload:', parsed.error.issues);
        }
        return;
      }
      const { orderId, status } = parsed.data.data;

      // Patch the order in every merchant-orders cache page.
      queryClient.setQueriesData<{ orders: MerchantOrder[]; meta: unknown }>(
        { queryKey: dashboardKeys.all, exact: false },
        old => {
          if (!old?.orders) return old;
          return {
            ...old,
            orders: old.orders.map(o => (o._id === orderId ? { ...o, status } : o)),
          };
        },
      );

      void queryClient.invalidateQueries({
        queryKey: [...dashboardKeys.all, 'order', orderId],
      });
    });

    socket.on(WebSocketEvents.ORDER_NEW, (raw: unknown) => {
      const parsed = newOrderPayloadSchema.safeParse(raw);
      if (!parsed.success) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[WS] Invalid order:new payload:', parsed.error.issues);
        }
        return;
      }
      const data = parsed.data.data ?? parsed.data;
      const orderId = data.orderId ?? '';
      const orderNumber = data.orderNumber ?? '';
      const customerName = data.customerName ?? 'Customer';
      const total = data.pricing?.total ?? 0;

      // 1. Refresh the active orders list in TanStack Query cache.
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.merchantOrders(),
      });

      // 2. Add to the in-app notification store (bell badge + dropdown entry).
      if (orderId) {
        useNotificationStore.getState().addNewOrder({
          id: orderId,
          orderNumber,
          customerName,
          total,
          createdAt: new Date().toISOString(),
        });
      }

      // 3. Show a Sonner toast visible from any merchant page.
      toast.success(`New order #${orderNumber}!`, {
        description: 'New order created! Check it.',
        duration: 6000,
      });
    });

    socket.on('connect_error', err => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MerchantOrdersSocket] connect_error:', err.message);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, queryClient]);
}
