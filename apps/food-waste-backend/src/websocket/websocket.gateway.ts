import { UseGuards, Logger, UseFilters } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
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
import { parse as parseCookies } from 'cookie';
import { UserRole } from '@foodwaste/shared';

import { WebSocketExceptionFilter } from './filters/websocket-exception.filter';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { AuthenticatedSocket, WebSocketEvents } from './interfaces/websocket.interface';
import { WebSocketService } from './websocket.service';

@WSGateway({
  cors: {
    origin:
      (process.env['CORS_ORIGINS'] ?? '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean).length > 0
        ? (process.env['CORS_ORIGINS'] ?? '').split(',').map(o => {
            const trimmed = o.trim();
            return trimmed.startsWith('regex:')
              ? new RegExp(trimmed.slice('regex:'.length))
              : trimmed;
          })
        : [
            'http://localhost:3000',
            'http://localhost:3001',
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

  constructor(
    private readonly webSocketService: WebSocketService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server): void {
    this.webSocketService.setServer(server);

    // Authenticate every socket at connect-time using the handshake credentials.
    // This registers the socket in userSockets immediately so sendToUser() works
    // even before the client emits join_room (or if join_room never fires).
    server.use(async (socket: Socket, next) => {
      const client = socket as AuthenticatedSocket;
      const token = this.extractTokenFromHandshake(client);
      if (token) {
        try {
          const secret = this.configService.get<string>('JWT_SECRET');
          if (secret) {
            const payload = await this.jwtService.verifyAsync<{
              sub?: string;
              userId?: string;
              email?: string;
              role?: string;
            }>(token, { secret });
            const userId = payload.sub ?? payload.userId;
            if (userId && payload.email && payload.role) {
              client.userId = userId;
              client.email = payload.email;
              client.role = payload.role as UserRole;
              client.isAuthenticated = true;
              await this.webSocketService.registerUserSocket(client);
              this.logger.log(
                `[WS middleware] auto-registered userId=${userId} role=${payload.role}`,
              );
            }
          }
        } catch {
          // Expired or invalid token — socket proceeds as unauthenticated.
          // The join_room guard will reject it if auth is required.
        }
      }
      next();
    });

    this.logger.log('🚀 WebSocket Gateway initialized');
  }

  private extractTokenFromHandshake(client: AuthenticatedSocket): string | null {
    const queryToken = client.handshake?.query?.['token'];
    const cookieHeader = client.handshake?.headers?.cookie;
    const IS_PROD = process.env['NODE_ENV'] === 'production';

    let cookieToken: string | null = null;
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      const cookieName = IS_PROD ? '__Host-access_token' : 'access_token';
      cookieToken = cookies[cookieName] ?? null;
    }

    return (
      (client.handshake?.auth?.['token'] as string | undefined) ??
      (Array.isArray(queryToken) ? queryToken[0] : queryToken) ??
      client.handshake?.headers?.authorization?.replace('Bearer ', '') ??
      cookieToken ??
      null
    );
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
  async handleJoinRoom(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { room: string },
  ): Promise<void> {
    // Guard has already verified the JWT and set client.isAuthenticated / userId / role.
    // Await registerUserSocket so the user-{id} room join completes before we
    // process any events — eliminates the race condition with Redis adapter.
    await this.webSocketService.registerUserSocket(client);
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
