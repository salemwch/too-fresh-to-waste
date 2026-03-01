'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/auth';
import { dashboardKeys } from './use-merchant-dashboard';
import type { MerchantOrder, OrderStatus } from '@/types/dashboard';

interface OrderStatusPayload {
  event: string;
  data: {
    orderId: string;
    status: OrderStatus;
    previousStatus: OrderStatus;
    customerId: string;
    merchantId: string;
    establishmentId: string;
    message?: string;
  };
  timestamp: string;
}

const BACKEND_WS_URL =
  (process.env['NEXT_PUBLIC_API_URL'] as string | undefined) ??
  'http://localhost:3000';

/**
 * Connects to the NestJS WebSocket gateway and listens for order status
 * updates from the backend. When the consumer confirms pickup on the mobile
 * app, the backend fires `order:status_updated` → we invalidate / patch the
 * TanStack Query cache so the orders page updates in real-time.
 *
 * Auth flow:
 * 1. Connect with `auth: { token }` in the handshake so the guard can verify.
 * 2. On connect, emit `join_room` (triggers WebSocketAuthGuard → sets socket.isAuthenticated).
 * 3. Emit `authenticate` to populate the `userSockets` map server-side so
 *    `sendToUser()` can reach this socket.
 */
export function useMerchantOrdersSocket() {
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const accessToken = useAuthStore((s) => s.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    const socket = io(BACKEND_WS_URL, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Step 1: trigger WebSocketAuthGuard on a subscribed message so the
      // guard can set socket.isAuthenticated / socket.userId.
      socket.emit('join_room', { room: 'merchant_dashboard' });
      // Step 2: populate userSockets map so sendToUser() can reach us.
      socket.emit('authenticate', { token: accessToken });
    });

    socket.on('order:status_updated', (payload: OrderStatusPayload) => {
      const { orderId, status } = payload.data ?? payload;

      // Patch the order in every merchant-orders cache page.
      queryClient.setQueriesData<{ orders: MerchantOrder[]; meta: unknown }>(
        { queryKey: dashboardKeys.all, exact: false },
        (old) => {
          if (!old?.orders) return old;
          return {
            ...old,
            orders: old.orders.map((o) =>
              o._id === orderId ? { ...o, status } : o,
            ),
          };
        },
      );

      // Also invalidate the specific order detail cache.
      void queryClient.invalidateQueries({
        queryKey: [...dashboardKeys.all, 'order', orderId],
      });
    });

    socket.on('order:new', () => {
      // New order arrived — refresh the active orders list.
      void queryClient.invalidateQueries({
        queryKey: dashboardKeys.merchantOrders(),
      });
    });

    socket.on('connect_error', (err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[MerchantOrdersSocket] connect_error:', err.message);
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken, queryClient]);
}
