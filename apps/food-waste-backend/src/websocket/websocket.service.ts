import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import {
  AuthenticatedSocket,
  WebSocketEventPayload,
  WebSocketEvents,
  WEBSOCKET_ROOMS,
  OrderStatusUpdate,
  OfferUpdate,
  NotificationEvent
} from './interfaces/websocket.interface';
import { UserRole } from '../users/schemas/user.schema';

@Injectable()
export class WebSocketService {
  private readonly logger = new Logger(WebSocketService.name);
  private server!: Server;
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds
  private roomParticipants = new Map<string, Set<string>>(); // room -> Set of socketIds

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
    socket.on(WebSocketEvents.AUTHENTICATE, async (data: { token: string }) => {
      await this.authenticateSocket(socket, data.token);
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

  private async authenticateSocket(socket: AuthenticatedSocket, token: string): Promise<void> {
    // This would typically verify the JWT token
    // For now, we'll assume the guard has already done this
    if (socket.isAuthenticated && socket.userId) {
      // Add to user sockets mapping
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId)!.add(socket.id);

      // Join default rooms
      this.joinRoom(socket, WEBSOCKET_ROOMS['GLOBAL'].name);
      this.joinRoom(socket, `user-${socket.userId}`);

      // Role-based room joining
      if (socket.role === UserRole.MERCHANT) {
        this.joinRoom(socket, WEBSOCKET_ROOMS['MERCHANT_DASHBOARD'].name);
      } else if (socket.role === UserRole.ADMIN) {
        this.joinRoom(socket, WEBSOCKET_ROOMS['ADMIN_ALERTS'].name);
      }

      socket.emit('authenticated', {
        success: true,
        userId: socket.userId,
        role: socket.role,
      });
    }
  }

  joinRoom(socket: AuthenticatedSocket, roomName: string): void {
    const room = Object.values(WEBSOCKET_ROOMS).find(r => r.name === roomName);

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
    socket.join(roomName);

    // Track room participants
    if (!this.roomParticipants.has(roomName)) {
      this.roomParticipants.set(roomName, new Set());
    }
    this.roomParticipants.get(roomName)!.add(socket.id);

    this.logger.debug(`Socket ${socket.id} joined room: ${roomName}`);
  }

  leaveRoom(socket: AuthenticatedSocket, roomName: string): void {
    socket.leave(roomName);

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
  sendToUser(userId: string, event: string, data: any): void {
    const userSocketIds = this.userSockets.get(userId);
    if (userSocketIds) {
      for (const socketId of userSocketIds) {
        const socket = this.connectedClients.get(socketId);
        if (socket) {
          socket.emit(event, this.wrapEventPayload(event, data, userId));
        }
      }
      this.logger.debug(`Sent ${event} to user ${userId} (${userSocketIds.size} connections)`);
    }
  }

  /**
   * Send event to a specific room
   */
  sendToRoom(roomName: string, event: string, data: any): void {
    if (this.server) {
      this.server.to(roomName).emit(event, this.wrapEventPayload(event, data));
      this.logger.debug(`Sent ${event} to room ${roomName}`);
    }
  }

  /**
   * Send event to all connected clients
   */
  broadcast(event: string, data: any): void {
    if (this.server) {
      this.server.emit(event, this.wrapEventPayload(event, data));
      this.logger.debug(`Broadcasted ${event} to all clients`);
    }
  }

  /**
   * Send event to users with specific role
   */
  sendToRole(role: UserRole, event: string, data: any): void {
    for (const [socketId, socket] of this.connectedClients.entries()) {
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
    this.sendToRoom(WEBSOCKET_ROOMS['ADMIN_ALERTS'].name, WebSocketEvents.ORDER_STATUS_UPDATED, update);
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
    const authenticatedConnections = Array.from(this.connectedClients.values())
      .filter(socket => socket.isAuthenticated).length;

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
    if (!participants) return [];

    return Array.from(participants)
      .map(socketId => this.connectedClients.get(socketId))
      .filter(socket => socket && socket.userId)
      .map(socket => socket!.userId);
  }

  private wrapEventPayload(event: string, data: any, userId?: string): WebSocketEventPayload {
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