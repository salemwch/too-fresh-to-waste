import { UserRole } from '@foodwaste/shared';
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

import {
  AuthenticatedSocket,
  WebSocketEventPayload,
  WebSocketEvents,
  WEBSOCKET_ROOMS,
  OrderStatusUpdate,
  OfferUpdate,
  NotificationEvent,
} from './interfaces/websocket.interface';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private server!: Server;
  private readonly connectedClients = new Map<string, AuthenticatedSocket>();
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private readonly roomParticipants = new Map<string, Set<string>>(); // room -> Set of socketIds

  setServer(server: Server): void {
    this.server = server;
    this.setupServerListeners();
  }

  private setupServerListeners(): void {
    this.server.on('connection', (socket: Socket) => {
      this.logger.log(`Client connected: ${socket.id}`);
      // Cast socket to AuthenticatedSocket after authentication
      this.handleConnection(socket as AuthenticatedSocket);
    });
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    // Store connection
    this.connectedClients.set(socket.id, socket);

    // Handle disconnection
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });

    // Handle room joining
    socket.on(WebSocketEvents.JOIN_ROOM, (roomName: string) => {
      this.joinRoom(socket, roomName);
    });

    // Handle room leaving
    socket.on(WebSocketEvents.LEAVE_ROOM, (roomName: string) => {
      this.leaveRoom(socket, roomName);
    });

    // Handle authentication (for late authentication)
    socket.on(WebSocketEvents.AUTHENTICATE, (data: { token: string }) => {
      this.authenticateSocket(socket, data.token);
    });
  }

  private handleDisconnection(socket: AuthenticatedSocket): void {
    this.logger.log(`Client disconnected: ${socket.id}`);

    // Remove from connected clients
    this.connectedClients.delete(socket.id);

    // Remove from user sockets mapping
    if (socket.userId) {
      const userSocketSet = this.userSockets.get(socket.userId);
      if (userSocketSet) {
        userSocketSet.delete(socket.id);
        if (userSocketSet.size === 0) {
          this.userSockets.delete(socket.userId);
        }
      }
    }

    // Remove from all rooms
    for (const [roomName, participants] of this.roomParticipants.entries()) {
      if (participants.has(socket.id)) {
        participants.delete(socket.id);
        if (participants.size === 0) {
          this.roomParticipants.delete(roomName);
        }
      }
    }
  }

  private authenticateSocket(socket: AuthenticatedSocket, _token: string): void {
    // This would typically verify the JWT token
    // For now, we'll assume the guard has already done this
    if (socket.isAuthenticated && socket.userId) {
      // Add to user sockets mapping
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.id);

      // Join default rooms
      this.joinRoom(socket, WEBSOCKET_ROOMS['GLOBAL']!.name);
      this.joinRoom(socket, `user-${socket.userId}`);

      // Role-based room joining
      if (socket.role === UserRole.MERCHANT) {
        this.joinRoom(socket, WEBSOCKET_ROOMS['MERCHANT_DASHBOARD']!.name);
      } else if (socket.role === UserRole.ADMIN) {
        this.joinRoom(socket, WEBSOCKET_ROOMS['ADMIN_ALERTS']!.name);
      }

      socket.emit('authenticated', {
        success: true,
        userId: socket.userId,
        role: socket.role,
      });
    }
  }

  /**
   * Register an already-authenticated socket in the userSockets map so that
   * sendToUser() can reach it. Safe to call multiple times (idempotent).
   * Call this from handleJoinRoom (post-guard) to avoid the race condition
   * where the separate 'authenticate' event fires before the guard resolves.
   */
  registerUserSocket(socket: AuthenticatedSocket): void {
    this.logger.log(
      `[registerUserSocket] called — socketId=${socket.id} ` +
        `isAuthenticated=${socket.isAuthenticated} userId=${socket.userId} role=${socket.role}`,
    );

    if (!socket.isAuthenticated || !socket.userId) {
      this.logger.warn(
        `[registerUserSocket] SKIPPED — socket ${socket.id} is not authenticated yet. ` +
          `isAuthenticated=${socket.isAuthenticated} userId=${socket.userId}`,
      );
      return;
    }

    if (!this.userSockets.has(socket.userId)) {
      this.userSockets.set(socket.userId, new Set());
    }
    this.userSockets.get(socket.userId)!.add(socket.id);

    // Join user-specific room for direct targeting
    void socket.join(`user-${socket.userId}`);

    this.logger.log(
      `[registerUserSocket] SUCCESS — userId=${socket.userId} socketId=${socket.id} role=${socket.role} ` +
        `totalRegisteredUsers=${this.userSockets.size}`,
    );
  }

  joinRoom(socket: AuthenticatedSocket, roomName: string): void {
    const room = Object.values(WEBSOCKET_ROOMS).find((r) => r.name === roomName);

    if (!room) {
      socket.emit(WebSocketEvents.ERROR, {
        message: 'Invalid room name',
        room: roomName,
      });
      return;
    }

    // Check authentication requirement
    if (room.requiresAuth && !socket.isAuthenticated) {
      socket.emit(WebSocketEvents.UNAUTHORIZED, {
        message: 'Authentication required to join this room',
        room: roomName,
      });
      return;
    }

    // Check role permissions
    if (room.allowedRoles && !room.allowedRoles.includes(socket.role)) {
      socket.emit(WebSocketEvents.ERROR, {
        message: 'Insufficient permissions for this room',
        room: roomName,
      });
      return;
    }

    // Join the room
    void socket.join(roomName);

    // Track room participants
    if (!this.roomParticipants.has(roomName)) {
      this.roomParticipants.set(roomName, new Set());
    }
    this.roomParticipants.get(roomName)!.add(socket.id);

    this.logger.debug(`Socket ${socket.id} joined room: ${roomName}`);
  }

  leaveRoom(socket: AuthenticatedSocket, roomName: string): void {
    void socket.leave(roomName);

    // Remove from room participants tracking
    const participants = this.roomParticipants.get(roomName);
    if (participants) {
      participants.delete(socket.id);
      if (participants.size === 0) {
        this.roomParticipants.delete(roomName);
      }
    }

    this.logger.debug(`Socket ${socket.id} left room: ${roomName}`);
  }

  // Utility methods for sending events

  /**
   * Send event to a specific user (all their connected sockets)
   */
  sendToUser(userId: string, event: string, data: unknown): void {
    const userSocketIds = this.userSockets.get(userId);

    // ── diagnostic snapshot ───────────────────────────────────────────────────
    this.logger.log(
      `[sendToUser] event="${event}" targetUserId="${userId}" ` +
        `totalConnected=${this.connectedClients.size} ` +
        `registeredUsers=${this.userSockets.size} ` +
        `userFound=${!!userSocketIds} ` +
        `userSockets=[${[...this.userSockets.keys()].join(', ')}]`,
    );
    // ─────────────────────────────────────────────────────────────────────────

    if (!userSocketIds || userSocketIds.size === 0) {
      this.logger.warn(
        `[sendToUser] MISS — user "${userId}" is not in userSockets. ` +
          `Event "${event}" was NOT delivered. ` +
          `Is the merchant dashboard open and connected?`,
      );
      return;
    }

    let delivered = 0;
    for (const socketId of userSocketIds) {
      const socket = this.connectedClients.get(socketId);
      if (socket) {
        socket.emit(event, this.wrapEventPayload(event, data, userId));
        delivered++;
        this.logger.log(`[sendToUser] Emitted "${event}" to socketId=${socketId}`);
      } else {
        this.logger.warn(
          `[sendToUser] socketId=${socketId} in userSockets but NOT in connectedClients — stale entry`,
        );
      }
    }

    this.logger.log(
      `[sendToUser] "${event}" delivered to ${delivered}/${userSocketIds.size} sockets of user "${userId}"`,
    );
  }

  /**
   * Send event to a specific room
   */
  sendToRoom(roomName: string, event: string, data: unknown): void {
    if (this.server) {
      this.server.to(roomName).emit(event, this.wrapEventPayload(event, data));
      this.logger.debug(`Sent ${event} to room ${roomName}`);
    }
  }

  /**
   * Send event to all connected clients
   */
  broadcast(event: string, data: unknown): void {
    if (this.server) {
      this.server.emit(event, this.wrapEventPayload(event, data));
      this.logger.debug(`Broadcasted ${event} to all clients`);
    }
  }

  /**
   * Send event to users with specific role
   */
  sendToRole(role: UserRole, event: string, data: unknown): void {
    for (const [_socketId, socket] of this.connectedClients.entries()) {
      if (socket.role === role) {
        socket.emit(event, this.wrapEventPayload(event, data, socket.userId));
      }
    }
    this.logger.debug(`Sent ${event} to all users with role ${role}`);
  }

  /**
   * Send order status update to relevant parties
   */
  sendOrderStatusUpdate(update: OrderStatusUpdate): void {
    // Send to customer
    this.sendToUser(update.customerId, WebSocketEvents.ORDER_STATUS_UPDATED, update);

    // Send to merchant
    this.sendToUser(update.merchantId, WebSocketEvents.ORDER_STATUS_UPDATED, update);

    // Send to admin room for monitoring
    this.sendToRoom(
      WEBSOCKET_ROOMS['ADMIN_ALERTS']!.name,
      WebSocketEvents.ORDER_STATUS_UPDATED,
      update,
    );
  }

  /**
   * Send new nearby offer to consumers in the area
   */
  sendNearbyOfferUpdate(offer: OfferUpdate, userIds: string[]): void {
    for (const userId of userIds) {
      this.sendToUser(userId, WebSocketEvents.OFFER_NEW_NEARBY, offer);
    }
  }

  /**
   * Send notification to specific user
   */
  sendNotification(notification: NotificationEvent): void {
    this.sendToUser(notification.userId, WebSocketEvents.NOTIFICATION_NEW, notification);
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    totalConnections: number;
    authenticatedConnections: number;
    roomCounts: Record<string, number>;
    userCounts: number;
  } {
    const authenticatedConnections = Array.from(this.connectedClients.values()).filter(
      (socket) => socket.isAuthenticated,
    ).length;

    const roomCounts: Record<string, number> = {};
    for (const [roomName, participants] of this.roomParticipants.entries()) {
      roomCounts[roomName] = participants.size;
    }

    return {
      totalConnections: this.connectedClients.size,
      authenticatedConnections,
      roomCounts,
      userCounts: this.userSockets.size,
    };
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  /**
   * Get online users in a specific room
   */
  getRoomParticipants(roomName: string): string[] {
    const participants = this.roomParticipants.get(roomName);
    if (!participants) {
      return [];
    }

    return Array.from(participants)
      .map((socketId) => this.connectedClients.get(socketId))
      .filter((socket) => socket?.userId)
      .map((socket) => socket!.userId);
  }

  private wrapEventPayload(event: string, data: unknown, userId?: string): WebSocketEventPayload {
    return {
      event,
      data,
      timestamp: new Date(),
      ...(userId !== undefined && { userId }),
      metadata: {
        server: 'food-waste-api',
        version: '1.0.0',
      },
    };
  }
}
