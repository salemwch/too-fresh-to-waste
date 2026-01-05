import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticatedSocket } from '../interfaces/websocket.interface';

@Injectable()
export class WebSocketAuthGuard implements CanActivate {
  private readonly logger = new Logger(WebSocketAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: AuthenticatedSocket = context.switchToWs().getClient();
      const token = this.extractTokenFromHandshake(client);

      if (!token) {
        this.logger.warn(`WebSocket connection attempted without token from ${client.id}`);
        return false;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        this.logger.warn(`WebSocket connection attempted with invalid token from ${client.id}`);
        return false;
      }

      // Attach user information to the socket
      client.userId = payload.userId;
      client.email = payload.email;
      client.role = payload.role;
      client.isAuthenticated = true;

      this.logger.log(`WebSocket authenticated: ${payload.email} (${client.id})`);
      return true;
    } catch (error) {
      this.logger.error('WebSocket authentication failed:', error);
      return false;
    }
  }

  private extractTokenFromHandshake(client: any): string | null {
    try {
      // Extract token from handshake auth or query
      const token = client.handshake?.auth?.token ||
                   client.handshake?.query?.token ||
                   client.handshake?.headers?.authorization?.replace('Bearer ', '');

      return token || null;
    } catch (error) {
      this.logger.error('Failed to extract token from handshake:', error);
      return null;
    }
  }

  private async verifyToken(token: string): Promise<any> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }
      const payload = await this.jwtService.verifyAsync(token, { secret });

      // Verify token structure
      if (!payload.userId || !payload.email || !payload.role) {
        throw new Error('Invalid token payload structure');
      }

      return payload;
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }
}