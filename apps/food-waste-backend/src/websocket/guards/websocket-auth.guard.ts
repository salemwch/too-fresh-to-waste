import { UserRole } from '@foodwaste/shared';
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { parse as parseCookies } from 'cookie';

import { AuthenticatedSocket } from '../interfaces/websocket.interface';

interface WebSocketJwtPayload {
  sub?: string;
  userId?: string;
  email?: string;
  role?: string;
}

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
      // JWT uses `sub` (standard claim) for userId — fall back to `userId` for compat
      const resolvedUserId = payload.sub ?? payload.userId;
      if (!resolvedUserId) {
        this.logger.warn(`WebSocket token missing userId for client: ${client.id}`);
        return false;
      }
      client.userId = resolvedUserId;
      client.email = payload.email;
      client.role = payload.role as UserRole;
      client.isAuthenticated = true;

      this.logger.log(`WebSocket authenticated: ${payload.email} (${client.id})`);
      return true;
    } catch (error) {
      this.logger.error('WebSocket authentication failed:', error);
      return false;
    }
  }

  private extractTokenFromHandshake(client: AuthenticatedSocket): string | null {
    try {
      // Priority order:
      // 1. Handshake auth object (mobile apps)
      // 2. Query parameter (legacy fallback)
      // 3. Authorization header (Bearer token)
      // 4. HttpOnly cookie (web app — browser sends it with withCredentials: true)
      const queryToken = client.handshake?.query?.['token'];
      const token =
        (client.handshake?.auth?.['token'] as string | undefined) ??
        (Array.isArray(queryToken) ? queryToken[0] : queryToken) ??
        client.handshake?.headers?.authorization?.replace('Bearer ', '') ??
        this.extractTokenFromCookieHeader(client.handshake?.headers?.cookie);

      return token ?? null;
    } catch (error) {
      this.logger.error('Failed to extract token from handshake:', error);
      return null;
    }
  }

  /** Parse the raw Cookie header to extract the access_token value. */
  private extractTokenFromCookieHeader(cookieHeader?: string): string | null {
    if (!cookieHeader) {
      return null;
    }
    // Use the `cookie` package for spec-compliant parsing — handles edge cases
    // (values with `=`, whitespace, URL-encoded chars) that a simple regex misses.
    const cookies = parseCookies(cookieHeader);
    return cookies['access_token'] ?? null;
  }

  private async verifyToken(
    token: string,
  ): Promise<{ sub?: string; userId: string; email: string; role: string } | null> {
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      if (!secret) {
        throw new Error('JWT_SECRET is not configured');
      }
      const payload = await this.jwtService.verifyAsync<WebSocketJwtPayload>(token, { secret });

      // Verify token structure — JWT standard uses `sub` for userId
      const userId = payload.sub ?? payload.userId;
      if (
        userId === null ||
        userId === undefined ||
        payload.email === null ||
        payload.email === undefined ||
        payload.role === null ||
        payload.role === undefined
      ) {
        throw new Error('Invalid token payload structure');
      }

      return {
        ...payload,
        userId,
        email: payload.email,
        role: payload.role,
      };
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }
}
