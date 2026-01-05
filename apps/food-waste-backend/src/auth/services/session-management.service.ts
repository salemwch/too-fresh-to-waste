import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/user.service';
import * as crypto from 'crypto';

export interface DeviceInfo {
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly deviceName: string;
  readonly platform: string;
  readonly browser: string;
  readonly ipAddress: string;
  readonly userAgent: string;
  isTrusted: boolean;
  lastActiveAt: Date;
  readonly createdAt: Date;
}

export interface SessionInfo {
  readonly sessionId: string;
  readonly userId: string;
  readonly deviceInfo: DeviceInfo;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  isActive: boolean;
  readonly createdAt: Date;
  lastActivityAt: Date;
}

export interface CreateSessionRequest {
  readonly userId: string;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly deviceFingerprint?: string;
  readonly rememberMe?: boolean;
}

export interface SessionConfiguration {
  readonly maxConcurrentSessions: number;
  readonly sessionTimeout: number;
  readonly rememberMeDuration: number;
  readonly cleanupInterval: number;
  readonly suspiciousActivityThreshold: number;
}

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name);
  private readonly config: SessionConfiguration;

  private readonly activeSessions = new Map<string, SessionInfo>();
  private readonly userSessions = new Map<string, Set<string>>();
  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    this.config = {
      maxConcurrentSessions: this.configService.get<number>('SESSION_MAX_CONCURRENT') || 5,
      sessionTimeout: this.configService.get<number>('SESSION_TIMEOUT_MS') || (15 * 60 * 1000), // 15 minutes
      rememberMeDuration: this.configService.get<number>('SESSION_REMEMBER_ME_MS') || (30 * 24 * 60 * 60 * 1000), // 30 days
      cleanupInterval: this.configService.get<number>('SESSION_CLEANUP_INTERVAL_MS') || (5 * 60 * 1000), // 5 minutes
      suspiciousActivityThreshold: this.configService.get<number>('SESSION_SUSPICIOUS_THRESHOLD') || 3,
    };

    // Start cleanup timer
    this.startCleanupTimer();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupExpiredSessions();
      } catch (error) {
        this.logger.error('Error during automated session cleanup:', error);
      }
    }, this.config.cleanupInterval);
  }

  async createSession(request: CreateSessionRequest, tokens: { accessToken: string; refreshToken: string }): Promise<SessionInfo> {
    const sessionId = this.generateSessionId();
    const deviceInfo = this.parseDeviceInfo(request);

    // Check concurrent session limits
    this.enforceSessionLimits(request.userId);

    const sessionInfo: SessionInfo = {
      sessionId,
      userId: request.userId,
      deviceInfo,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(Date.now() + (request.rememberMe ? this.config.rememberMeDuration : this.config.sessionTimeout)),
      isActive: true,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    // Store session
    this.activeSessions.set(sessionId, sessionInfo);

    // Track user sessions
    if (!this.userSessions.has(request.userId)) {
      this.userSessions.set(request.userId, new Set());
    }
    const userSessionSet = this.userSessions.get(request.userId);
    if (userSessionSet) {
      userSessionSet.add(sessionId);
    }

    // Update user device tracking
    await this.updateUserDeviceInfo(request.userId, deviceInfo);

    this.logger.log(`Session created for user ${request.userId}`, {
      sessionId,
      deviceInfo: {
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        ipAddress: deviceInfo.ipAddress,
      },
    });

    return sessionInfo;
  }

  validateSession(sessionId: string): SessionInfo | null {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.expiresAt < new Date()) {
      this.terminateSession(sessionId);
      return null;
    }

    // Check if session is active
    if (!session.isActive) {
      return null;
    }

    // Update last activity
    session.lastActivityAt = new Date();
    this.activeSessions.set(sessionId, session);

    return session;
  }

  terminateSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);

    if (session) {
      // Remove from user sessions tracking
      const userSessionSet = this.userSessions.get(session.userId);
      if (userSessionSet) {
        userSessionSet.delete(sessionId);
        if (userSessionSet.size === 0) {
          this.userSessions.delete(session.userId);
        }
      }

      // Remove the session
      this.activeSessions.delete(sessionId);

      this.logger.log(`Session terminated: ${sessionId} for user ${session.userId}`);
    }
  }

  terminateAllUserSessions(userId: string, excludeSessionId?: string): number {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet) {
      return 0;
    }

    let terminatedCount = 0;

    for (const sessionId of userSessionSet) {
      if (excludeSessionId && sessionId === excludeSessionId) {
        continue;
      }

      this.terminateSession(sessionId);
      terminatedCount++;
    }

    this.logger.log(`Terminated ${terminatedCount} sessions for user ${userId}`);
    return terminatedCount;
  }

  getUserActiveSessions(userId: string): SessionInfo[] {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet) {
      return [];
    }

    const sessions: SessionInfo[] = [];

    for (const sessionId of userSessionSet) {
      const session = this.activeSessions.get(sessionId);
      if (session?.isActive) {
        sessions.push(session);
      }
    }

    return sessions;
  }

  refreshSession(sessionId: string, newTokens: { accessToken: string; refreshToken: string }): SessionInfo | null {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return null;
    }

    session.accessToken = newTokens.accessToken;
    session.refreshToken = newTokens.refreshToken;
    session.lastActivityAt = new Date();

    // Extend expiration if it's a remember me session
    if (session.expiresAt.getTime() - session.createdAt.getTime() > this.config.sessionTimeout) {
      session.expiresAt = new Date(Date.now() + this.config.rememberMeDuration);
    } else {
      session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
    }

    this.activeSessions.set(sessionId, session);
    return session;
  }

  detectSuspiciousSession(sessionId: string, currentIp: string, currentUserAgent: string): boolean {
    const session = this.activeSessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Check for IP address changes
    if (session.deviceInfo.ipAddress !== currentIp) {
      this.logger.warn(`IP address change detected for session ${sessionId}`, {
        originalIp: session.deviceInfo.ipAddress,
        currentIp,
        userId: session.userId,
      });
      return true;
    }

    // Check for user agent changes (could indicate session hijacking)
    if (session.deviceInfo.userAgent !== currentUserAgent) {
      this.logger.warn(`User agent change detected for session ${sessionId}`, {
        originalUserAgent: session.deviceInfo.userAgent,
        currentUserAgent,
        userId: session.userId,
      });
      return true;
    }

    return false;
  }

  cleanupExpiredSessions(): number {
    let cleanedCount = 0;
    const now = new Date();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.terminateSession(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  private enforceSessionLimits(userId: string): void {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet || userSessionSet.size < this.config.maxConcurrentSessions) {
      return;
    }

    // Find oldest session and terminate it
    let oldestSession: SessionInfo | null = null;
    let oldestSessionId: string | null = null;

    for (const sessionId of userSessionSet) {
      const session = this.activeSessions.get(sessionId);
      if (session && (!oldestSession || session.createdAt < oldestSession.createdAt)) {
        oldestSession = session;
        oldestSessionId = sessionId;
      }
    }

    if (oldestSessionId) {
      this.terminateSession(oldestSessionId);
      this.logger.log(`Terminated oldest session for user ${userId} due to session limit`);
    }
  }

  private parseDeviceInfo(request: CreateSessionRequest): DeviceInfo {
    const deviceFingerprint = request.deviceFingerprint || this.generateDeviceFingerprint(request);

    return {
      deviceId: this.generateDeviceId(deviceFingerprint),
      deviceFingerprint,
      deviceName: this.extractDeviceName(request.userAgent),
      platform: this.extractPlatform(request.userAgent),
      browser: this.extractBrowser(request.userAgent),
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      isTrusted: false, // New devices are not trusted by default
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };
  }

  private generateSessionId(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private generateDeviceFingerprint(request: CreateSessionRequest): string {
    const data = `${request.userAgent}:${request.ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private generateDeviceId(fingerprint: string): string {
    return crypto.createHash('md5').update(fingerprint).digest('hex');
  }

  private extractDeviceName(userAgent: string): string {
    if (userAgent.includes('Mobile')) {return 'Mobile Device';}
    if (userAgent.includes('Tablet')) {return 'Tablet';}
    return 'Desktop';
  }

  private extractPlatform(userAgent: string): string {
    if (userAgent.includes('Windows')) {return 'Windows';}
    if (userAgent.includes('Mac')) {return 'macOS';}
    if (userAgent.includes('Linux')) {return 'Linux';}
    if (userAgent.includes('Android')) {return 'Android';}
    if (userAgent.includes('iOS')) {return 'iOS';}
    return 'Unknown';
  }

  private extractBrowser(userAgent: string): string {
    if (userAgent.includes('Chrome')) {return 'Chrome';}
    if (userAgent.includes('Firefox')) {return 'Firefox';}
    if (userAgent.includes('Safari')) {return 'Safari';}
    if (userAgent.includes('Edge')) {return 'Edge';}
    return 'Unknown';
  }

  private async updateUserDeviceInfo(userId: string, deviceInfo: DeviceInfo): Promise<void> {
    try {
      // This would update the user's device tracking in the database
      await this.usersService.updateDeviceInfo(userId, {
        deviceId: deviceInfo.deviceId,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        lastActiveAt: deviceInfo.lastActiveAt,
      });
    } catch (error) {
      this.logger.error(`Failed to update device info for user ${userId}:`, error);
    }
  }
}