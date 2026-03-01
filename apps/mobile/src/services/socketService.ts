/**
 * Socket.IO Client Service — Singleton
 * Manages a single WebSocket connection for real-time updates.
 *
 * Usage:
 *   socketService.connect();
 *   socketService.on('community:bag_updated', handler);
 *   socketService.disconnect();
 */

import { io, Socket } from 'socket.io-client';
import { environment } from '@/config/environment';
import { Logger } from '@/utils/logger';

const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY_MS = 2000;

class SocketService {
  private socket: Socket | null = null;

  /** Connect to the WebSocket server and join the global room. */
  connect(): void {
    if (this.socket?.connected) {
      Logger.debug('[SocketService] Already connected');
      return;
    }

    const url = environment.api.websocketUrl;
    Logger.info('[SocketService] Connecting', { url });

    this.socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectionDelay: RECONNECT_DELAY_MS,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      Logger.info('[SocketService] Connected', { id: this.socket?.id });
      // Join global room for public broadcasts (community goal, etc.)
      this.socket?.emit('join_room', { room: 'global' });
    });

    this.socket.on('disconnect', (reason: string) => {
      Logger.warn('[SocketService] Disconnected', { reason });
    });

    this.socket.on('connect_error', (error: Error) => {
      Logger.warn('[SocketService] Connection error', { message: error.message });
    });
  }

  /** Subscribe to a typed event. */
  on<T = unknown>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback as (...args: unknown[]) => void);
  }

  /** Unsubscribe from an event. */
  off(event: string, callback?: (...args: unknown[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
    } else {
      this.socket?.off(event);
    }
  }

  /** Disconnect and clean up. */
  disconnect(): void {
    if (this.socket) {
      Logger.info('[SocketService] Disconnecting');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /** Whether the socket is currently connected. */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

/** Singleton instance */
export const socketService = new SocketService();
