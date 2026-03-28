import { UseGuards, Logger, UseFilters } from '@nestjs/common';
import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { WebSocketExceptionFilter } from './filters/websocket-exception.filter';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { AuthenticatedSocket, WebSocketEvents } from './interfaces/websocket.interface';
import { WebSocketService } from './websocket.service';

@WSGateway({
  cors: {
    origin: [
      // Backend self (health checks / same-origin WS)
      'http://localhost:3000',
      // Web merchant dashboard (Next.js dev server)
      'http://localhost:3001',
      // Mobile app (React Native / Expo)
      'http://localhost:8081',
      'http://10.0.2.2:8081',
      'capacitor://localhost',
      'ionic://localhost',
    ],
    credentials: true,
  },
  namespace: '/',
})
@UseFilters(WebSocketExceptionFilter)
export class WebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(WebSocketGateway.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  afterInit(server: Server): void {
    this.webSocketService.setServer(server);
    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client attempting connection: ${client.id}`);

    // Set connection timeout
    const timeout = setTimeout(() => {
      if (!(client as AuthenticatedSocket).isAuthenticated) {
        this.logger.warn(`Connection timeout for unauthenticated client: ${client.id}`);
        client.emit(WebSocketEvents.ERROR, {
          message: 'Authentication timeout',
          code: 'AUTH_TIMEOUT',
        });
        client.disconnect();
      }
    }, 30000); // 30 seconds timeout

    // Clear timeout if client authenticates
    client.on('authenticated', () => {
      clearTimeout(timeout);
    });

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to Food Waste WebSocket Server',
      timestamp: new Date(),
      clientId: client.id,
    });
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage(WebSocketEvents.JOIN_ROOM)
  @UseGuards(WebSocketAuthGuard)
  handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ): void {
    // Guard has already verified the JWT and set client.isAuthenticated / userId / role.
    // Register in userSockets NOW so sendToUser() can reach this socket immediately.
    // This avoids the race condition where the separate 'authenticate' event fires
    // before verifyAsync() resolves and isAuthenticated is still false.
    this.webSocketService.registerUserSocket(client);
    this.webSocketService.joinRoom(client, data.room);
    client.emit('room_joined', {
      room: data.room,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage(WebSocketEvents.LEAVE_ROOM)
  @UseGuards(WebSocketAuthGuard)
  handleLeaveRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ): void {
    this.webSocketService.leaveRoom(client, data.room);
    client.emit('room_left', {
      room: data.room,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: Socket): void {
    client.emit('pong', {
      timestamp: new Date(),
      clientId: client.id,
    });
  }

  @SubscribeMessage('get_stats')
  @UseGuards(WebSocketAuthGuard)
  handleGetStats(@ConnectedSocket() client: AuthenticatedSocket): void {
    // Only admins can get connection stats
    if (client.role !== 'admin') {
      client.emit(WebSocketEvents.UNAUTHORIZED, {
        message: 'Admin role required',
      });
      return;
    }

    const stats = this.webSocketService.getConnectionStats();
    client.emit('stats', {
      ...stats,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('subscribe_location_updates')
  @UseGuards(WebSocketAuthGuard)
  handleSubscribeLocationUpdates(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { latitude: number; longitude: number; radius: number },
  ): void {
    // Create a location-based room for this user
    const locationRoom = `location_${data.latitude}_${data.longitude}_${data.radius}`;
    this.webSocketService.joinRoom(client, locationRoom);

    client.emit('location_subscription_confirmed', {
      room: locationRoom,
      coordinates: [data.longitude, data.latitude],
      radius: data.radius,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('unsubscribe_location_updates')
  @UseGuards(WebSocketAuthGuard)
  handleUnsubscribeLocationUpdates(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { latitude: number; longitude: number; radius: number },
  ): void {
    const locationRoom = `location_${data.latitude}_${data.longitude}_${data.radius}`;
    this.webSocketService.leaveRoom(client, locationRoom);

    client.emit('location_unsubscription_confirmed', {
      room: locationRoom,
      timestamp: new Date(),
    });
  }
}
