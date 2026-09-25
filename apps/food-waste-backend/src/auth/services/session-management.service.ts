/**
 * Enterprise-Grade Unified Session Management Service
 * Consolidates auth/services/session-management.service.ts and users/services/session-management.service.ts
 *
 * Features:
 * - Redis for fast active session lookup
 * - MongoDB for persistent login history and audit trail
 * - Automatic session cleanup and expiration
 * - Suspicious activity detection
 * - Device trust management
 * - Concurrent session limiting
 *
 * @module common/security
 * @version 2.0.0
 * @since 2025-11-21
 */

import * as crypto from 'crypto';

import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as geoip from 'geoip-lite';
import { Model } from 'mongoose';

import { USER_LOGIN_HISTORY_MAX } from '../../common/constants/document-limits.constant';
import {
  SessionInfo,
  DeviceInfo,
  CreateSessionRequest,
  SessionConfiguration,
  LoginHistoryEntry,
  SessionValidationResult,
  SessionActivity,
} from '../../common/security/interfaces/session.interface';
import { scanBatches } from '../../common/utils/redis-scan.util';
import { RedisService } from '../../redis/redis.service';
import { User, UserDocument } from '../../users/schemas/user.schema';

import { appError } from '../../common/errors';
/**
 * Redis key prefixes. Centralised because the cleanup routine has to rebuild
 * a `session:` key from a member of a `user:sessions:` set — if the two ever
 * drift apart, cleanup silently treats every live session as an orphan and
 * empties the mapping sets.
 */
const SESSION_KEY_PREFIX = 'session:';
const USER_SESSIONS_KEY_PREFIX = 'user:sessions:';

interface SerializedDeviceInfo extends Omit<DeviceInfo, 'lastActiveAt' | 'createdAt'> {
  readonly lastActiveAt: string | Date;
  readonly createdAt: string | Date;
}

interface SerializedSessionInfo extends Omit<
  SessionInfo,
  'deviceInfo' | 'expiresAt' | 'createdAt' | 'lastActivityAt'
> {
  readonly deviceInfo: SerializedDeviceInfo;
  expiresAt: string | Date;
  readonly createdAt: string | Date;
  lastActivityAt: string | Date;
}

/**
 * Unified Session Management Service
 * Single source of truth for all session-related operations
 */
@Injectable()
export class SessionManagementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionManagementService.name);
  private readonly config: SessionConfiguration;

  // In-memory fallback (used when Redis is unavailable)
  private readonly fallbackSessions = new Map<string, SessionInfo>();
  private readonly fallbackUserSessions = new Map<string, Set<string>>();

  private cleanupTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    this.config = {
      maxConcurrentSessions: Number(this.configService.get('SESSION_MAX_CONCURRENT')) || 5,
      sessionTimeout: Number(this.configService.get('SESSION_TIMEOUT_MS')) || 15 * 60 * 1000, // 15 min
      rememberMeDuration:
        Number(this.configService.get('SESSION_REMEMBER_ME_MS')) || 30 * 24 * 60 * 60 * 1000, // 30 days
      cleanupInterval:
        Number(this.configService.get('SESSION_CLEANUP_INTERVAL_MS')) || 5 * 60 * 1000, // 5 min
      suspiciousActivityThreshold:
        Number(this.configService.get('SESSION_SUSPICIOUS_THRESHOLD')) || 3,
    };
  }

  onModuleInit(): void {
    this.logger.log('Initializing Unified Session Management Service...');
    this.startCleanupTimer();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Create a new session for a user.
   * Returns the session object immediately after generating it synchronously.
   * All Redis/MongoDB I/O (store, enforce limit, audit) runs fire-and-forget
   * so the login HTTP response is never blocked by remote Redis latency.
   */
  async createSession(request: CreateSessionRequest): Promise<SessionInfo> {
    const { userId, userAgent, ipAddress, deviceFingerprint, rememberMe } = request;

    // Parse device information (synchronous — offline geoip lookup only)
    const deviceInfo = this.parseDeviceInfo(userAgent, ipAddress, deviceFingerprint);

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Calculate expiration
    const expiresAt = new Date(
      Date.now() +
        (rememberMe === true ? this.config.rememberMeDuration : this.config.sessionTimeout),
    );

    // Create session object (fully synchronous — no I/O)
    const session: SessionInfo = {
      sessionId,
      userId,
      deviceInfo,
      accessToken: '', // Will be set by auth service
      refreshToken: '', // Will be set by auth service
      expiresAt,
      isActive: true,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };

    // ── Fire-and-forget: all Redis/MongoDB I/O ────────────────────────────
    // Session ID + device info are generated synchronously above, so we can
    // return immediately. The remote Redis writes (store, enforce limit,
    // audit trail) complete asynchronously — they are not required for the
    // JWT tokens that actually authenticate subsequent requests.
    this.persistSessionAsync(session, userId, ipAddress, userAgent, deviceInfo).catch(
      (error: unknown) =>
        this.logger.error(`Background session persistence failed: ${this.getErrorMessage(error)}`),
    );

    this.logger.log(`Session created for user ${userId}: \n${sessionId}`);

    const result = await Promise.resolve(session);
    return result;
  }

  /**
   * Persist session data to Redis + MongoDB asynchronously.
   * Called fire-and-forget from createSession so the login response is fast.
   */
  private async persistSessionAsync(
    session: SessionInfo,
    userId: string,
    ipAddress: string,
    userAgent: string,
    deviceInfo: DeviceInfo,
  ): Promise<void> {
    // Enforce limit + store session — can run in parallel since enforce
    // reads existing sessions while store writes the new one to a unique key.
    await Promise.all([
      this.enforceConcurrentSessionLimit(userId),
      this.storeSessionInRedis(session),
      this.addSessionToUser(userId, session.sessionId),
    ]);

    // Login history + activity logging are audit-only — fire-and-forget
    this.addLoginHistory(userId, {
      ipAddress,
      userAgent,
      timestamp: new Date(),
      location: deviceInfo.location,
      success: true,
    }).catch((error: unknown) =>
      this.logger.warn(`Failed to write login history: ${this.getErrorMessage(error)}`),
    );

    this.logSessionActivity({
      sessionId: session.sessionId,
      activityType: 'login',
      timestamp: new Date(),
      metadata: { userId, ipAddress },
    });
  }

  /**
   * Validate and retrieve a session by ID
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    try {
      // Try Redis first
      const session = await this.getSessionFromRedis(sessionId);

      if (!session) {
        return {
          isValid: false,
          error: 'Session not found',
        };
      }

      // Check if expired
      if (new Date() > session.expiresAt) {
        await this.destroySession(sessionId);
        return {
          isValid: false,
          error: 'Session expired',
          wasExpired: true,
        };
      }

      // Check if active
      if (!session.isActive) {
        return {
          isValid: false,
          error: 'Session inactive',
        };
      }

      // Update last activity
      session.lastActivityAt = new Date();
      await this.storeSessionInRedis(session);

      return {
        isValid: true,
        session,
      };
    } catch (error) {
      this.logger.error(
        `Session validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return {
        isValid: false,
        error: 'Validation error',
      };
    }
  }

  /**
   * Refresh a session (update expiration and activity)
   */
  async refreshSession(
    sessionId: string,
    newAccessToken?: string,
    newRefreshToken?: string,
  ): Promise<SessionInfo> {
    const validation = await this.validateSession(sessionId);

    if (!validation.isValid || !validation.session) {
      throw new UnauthorizedException(appError('SESSION_EXPIRED'));
    }

    const session = validation.session;

    // Update tokens if provided
    if (newAccessToken) {
      session.accessToken = newAccessToken;
    }
    if (newRefreshToken) {
      session.refreshToken = newRefreshToken;
    }

    // Extend expiration
    session.expiresAt = new Date(Date.now() + this.config.sessionTimeout);
    session.lastActivityAt = new Date();

    await this.storeSessionInRedis(session);

    // Log activity
    this.logSessionActivity({
      sessionId,
      activityType: 'refresh',
      timestamp: new Date(),
    });

    return session;
  }

  /**
   * Destroy a session (logout).
   * Parallelises Redis DELETE + SREM to cut round-trips in half.
   */
  async destroySession(sessionId: string): Promise<void> {
    const session = await this.getSessionFromRedis(sessionId);

    if (session) {
      // Remove from user set + delete session key in parallel
      await Promise.all([
        this.removeSessionFromUser(session.userId, sessionId),
        this.deleteSessionFromRedis(sessionId),
      ]);

      // Log activity (fire-and-forget — just a logger.debug call)
      this.logSessionActivity({
        sessionId,
        activityType: 'logout',
        timestamp: new Date(),
      });

      this.logger.log(`Session destroyed: ${sessionId}`);
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyAllUserSessions(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);

    for (const sessionId of sessionIds) {
      await this.destroySession(sessionId);
    }

    this.logger.log(`All sessions destroyed for user ${userId}`);
  }

  /**
   * Get all active sessions for a user.
   * Parallelises Redis GETs to avoid sequential round-trips to remote Redis.
   */
  async getUserSessions(userId: string): Promise<SessionInfo[]> {
    const sessionIds = await this.getUserSessionIds(userId);
    if (sessionIds.length === 0) {
      return [];
    }

    // Fetch all sessions in parallel — each is an independent Redis GET
    const results = await Promise.all(
      sessionIds.map(async id => {
        const session = await this.getSessionFromRedis(id);
        return session;
      }),
    );

    return results.filter((s): s is SessionInfo => s?.isActive === true);
  }

  /**
   * Mark a device as trusted
   */
  async trustDevice(userId: string, deviceId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException(appError('USER_NOT_FOUND'));
    }

    user.trustedDevices ??= [];

    // Check if device already trusted
    const existingDevice = user.trustedDevices.find(d => d.deviceId === deviceId);

    if (!existingDevice) {
      user.trustedDevices.push({
        deviceId,
        deviceFingerprint: '', // Will be updated from session
        deviceName: '',
        platform: '',
        browser: '',
        ipAddress: '',
        userAgent: '',
        isTrusted: true,
        trustedAt: new Date(),
        lastUsedAt: new Date(),
      });

      await user.save();
      this.logger.log(`Device ${deviceId} marked as trusted for user ${userId}`);
    }
  }

  /**
   * Detect suspicious activity (e.g., multiple IPs, locations)
   */
  async detectSuspiciousActivity(userId: string): Promise<boolean> {
    const sessions = await this.getUserSessions(userId);

    // Check for multiple unique IPs within short time window
    const uniqueIps = new Set(sessions.map(s => s.deviceInfo.ipAddress));

    if (uniqueIps.size >= this.config.suspiciousActivityThreshold) {
      this.logger.warn(`Suspicious activity detected for user ${userId}`);

      // Log suspicious activity
      for (const session of sessions) {
        this.logSessionActivity({
          sessionId: session.sessionId,
          activityType: 'suspicious',
          timestamp: new Date(),
          metadata: { reason: 'Multiple unique IPs', uniqueIpCount: uniqueIps.size },
        });
      }

      return true;
    }

    return false;
  }

  /**
   * Get login history for a user
   */
  async getLoginHistory(userId: string, limit = 50): Promise<LoginHistoryEntry[]> {
    const user = await this.userModel.findById(userId).select('loginHistory');

    if (user?.loginHistory === null || user?.loginHistory === undefined) {
      return [];
    }

    return user.loginHistory.slice(0, limit) as LoginHistoryEntry[];
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Parse device information from user agent and IP
   *
   * CRITICAL: This method MUST NOT make any blocking external API calls
   * - Uses offline geoip-lite for IP location (local database lookup)
   * - Never calls external geocoding APIs (Google Maps, etc.)
   * - Login flow depends on this being fast and non-blocking
   */
  private parseDeviceInfo(
    userAgent: string,
    ipAddress: string,
    deviceFingerprint?: string,
  ): DeviceInfo {
    // ✅ SECURITY FIX: Use offline geoip-lite ONLY (no external API calls)
    // This is a local database lookup that never blocks on network
    const location = this.getLocationFromIP(ipAddress);

    // Simple user agent parsing (can be enhanced with ua-parser-js)
    const platform = this.extractPlatform(userAgent);
    const browser = this.extractBrowser(userAgent);

    return {
      deviceId: deviceFingerprint ?? crypto.randomUUID(),
      deviceFingerprint: deviceFingerprint ?? this.generateDeviceFingerprint(userAgent, ipAddress),
      deviceName: `${platform} - ${browser}`,
      platform,
      browser,
      ipAddress,
      userAgent,
      location,
      isTrusted: false,
      lastActiveAt: new Date(),
      createdAt: new Date(),
    };
  }

  /**
   * Get geographic location from IP address
   *
   * CRITICAL: Uses OFFLINE geoip-lite library (local MaxMind database)
   * - NO external API calls
   * - NO network requests
   * - NO blocking on external geocoding APIs
   * - Safe for login critical path
   *
   * @param ipAddress - IPv4 or IPv6 address
   * @returns Location string like "Paris, FR" or undefined if lookup fails
   */
  private getLocationFromIP(ipAddress: string): string | undefined {
    try {
      // Skip invalid/local IPs that won't have geolocation
      if (
        !ipAddress ||
        ipAddress === 'unknown' ||
        ipAddress.startsWith('192.168.') ||
        ipAddress.startsWith('10.') ||
        ipAddress.startsWith('172.') ||
        ipAddress === '127.0.0.1' ||
        ipAddress === '::1'
      ) {
        this.logger.debug(`Skipping geolocation for local/invalid IP: ${ipAddress}`);
        return undefined;
      }

      // ✅ OFFLINE LOOKUP - No external API call, pure local database query
      const geo = geoip.lookup(ipAddress);
      if (geo) {
        // Return city and country code (e.g., "Paris, FR")
        return `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'}`;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to lookup IP location (non-blocking): ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
    return undefined;
  }

  /**
   * Extract platform from user agent
   */
  private extractPlatform(userAgent: string): string {
    if (/android/i.test(userAgent)) {
      return 'Android';
    }
    if (/iphone|ipad|ipod/i.test(userAgent)) {
      return 'iOS';
    }
    if (/windows/i.test(userAgent)) {
      return 'Windows';
    }
    if (/mac/i.test(userAgent)) {
      return 'macOS';
    }
    if (/linux/i.test(userAgent)) {
      return 'Linux';
    }
    return 'Unknown';
  }

  /**
   * Extract browser from user agent
   */
  private extractBrowser(userAgent: string): string {
    if (/chrome/i.test(userAgent)) {
      return 'Chrome';
    }
    if (/safari/i.test(userAgent)) {
      return 'Safari';
    }
    if (/firefox/i.test(userAgent)) {
      return 'Firefox';
    }
    if (/edge/i.test(userAgent)) {
      return 'Edge';
    }
    return 'Unknown';
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(userAgent: string, ipAddress: string): string {
    const data = `${userAgent}-${ipAddress}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  private isSerializedDeviceInfo(value: unknown): value is SerializedDeviceInfo {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false;
    }

    const deviceInfo = value as Record<string, unknown>;

    return (
      typeof deviceInfo['deviceId'] === 'string' &&
      typeof deviceInfo['deviceFingerprint'] === 'string' &&
      typeof deviceInfo['deviceName'] === 'string' &&
      typeof deviceInfo['platform'] === 'string' &&
      typeof deviceInfo['browser'] === 'string' &&
      typeof deviceInfo['ipAddress'] === 'string' &&
      typeof deviceInfo['userAgent'] === 'string' &&
      (deviceInfo['location'] === undefined || typeof deviceInfo['location'] === 'string') &&
      typeof deviceInfo['isTrusted'] === 'boolean' &&
      (typeof deviceInfo['lastActiveAt'] === 'string' ||
        deviceInfo['lastActiveAt'] instanceof Date) &&
      (typeof deviceInfo['createdAt'] === 'string' || deviceInfo['createdAt'] instanceof Date)
    );
  }

  private isSerializedSessionInfo(value: unknown): value is SerializedSessionInfo {
    if (value === null || value === undefined || typeof value !== 'object') {
      return false;
    }

    const session = value as Record<string, unknown>;

    return (
      typeof session['sessionId'] === 'string' &&
      typeof session['userId'] === 'string' &&
      this.isSerializedDeviceInfo(session['deviceInfo']) &&
      typeof session['accessToken'] === 'string' &&
      typeof session['refreshToken'] === 'string' &&
      (typeof session['expiresAt'] === 'string' || session['expiresAt'] instanceof Date) &&
      typeof session['isActive'] === 'boolean' &&
      (typeof session['createdAt'] === 'string' || session['createdAt'] instanceof Date) &&
      (typeof session['lastActivityAt'] === 'string' || session['lastActivityAt'] instanceof Date)
    );
  }

  private deserializeSession(sessionJson: string): SessionInfo {
    const parsed: unknown = JSON.parse(sessionJson);

    if (!this.isSerializedSessionInfo(parsed)) {
      throw new Error('Invalid session payload');
    }

    return {
      ...parsed,
      deviceInfo: {
        ...parsed.deviceInfo,
        lastActiveAt: new Date(parsed.deviceInfo.lastActiveAt),
        createdAt: new Date(parsed.deviceInfo.createdAt),
      },
      expiresAt: new Date(parsed.expiresAt),
      createdAt: new Date(parsed.createdAt),
      lastActivityAt: new Date(parsed.lastActivityAt),
    };
  }

  /**
   * Enforce concurrent session limit for a user
   */
  private async enforceConcurrentSessionLimit(userId: string): Promise<void> {
    const sessionIds = await this.getUserSessionIds(userId);

    if (sessionIds.length >= this.config.maxConcurrentSessions) {
      // Remove oldest session
      const sessions = await this.getUserSessions(userId);
      sessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      const oldestSession = sessions[0];
      if (oldestSession) {
        await this.destroySession(oldestSession.sessionId);
        this.logger.log(`Removed oldest session for user ${userId} due to limit`);
      }
    }
  }

  /**
   * Add login history entry to user document
   */
  private async addLoginHistory(userId: string, entry: LoginHistoryEntry): Promise<void> {
    // Atomic $push + $slice — no findById needed, single roundtrip
    await this.userModel.updateOne(
      { _id: userId },
      {
        $push: {
          loginHistory: {
            $each: [entry],
            $position: 0,
            $slice: USER_LOGIN_HISTORY_MAX,
          },
        },
      },
    );
  }

  /**
   * Log session activity
   */
  private logSessionActivity(activity: SessionActivity): void {
    // Could be expanded to store in dedicated activity log collection
    this.logger.debug(`Session activity: ${activity.activityType} for ${activity.sessionId}`);
  }

  /**
   * Start cleanup timer for expired sessions
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      void this.cleanupExpiredSessions().catch((error: unknown) => {
        this.logger.error(
          `Session cleanup error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      });
    }, this.config.cleanupInterval);

    this.logger.log('Session cleanup timer started');
  }

  /**
   * Prune session IDs that no longer resolve to a live session.
   *
   * Storage layout:
   *   session:{sessionId}      → session JSON, carries a TTL
   *   user:sessions:{userId}   → SET of sessionIds, carries NO TTL
   *
   * Redis expires the `session:*` keys on its own, but the member IDs left
   * behind in `user:sessions:*` are never removed — that set grows without
   * bound for the lifetime of the account, and it is what `getUserSessionIds`
   * reads to answer "where is this user signed in?".
   *
   * This previously scanned `session:*` with a KEYS command. That was doubly
   * wrong: KEYS blocks the single-threaded Redis that also backs the throttler,
   * Bull and the Socket.IO adapter, and — because TTL has already removed the
   * expired keys — a scan of `session:*` returns only *live* sessions and so
   * can never observe the orphans that actually leak. It was expensive work
   * that could not find the thing it was looking for.
   *
   * We now walk the sets themselves via SCAN (far fewer keys than sessions,
   * one per signed-in user) and resolve each set's members in a single MGET.
   */
  private async cleanupExpiredSessions(): Promise<void> {
    const redisClient = await this.redisService.getClient();

    let orphansRemoved = 0;
    let setsEmptied = 0;

    await scanBatches(redisClient, `${USER_SESSIONS_KEY_PREFIX}*`, async setKeys => {
      for (const setKey of setKeys) {
        const sessionIds = await redisClient.sMembers(setKey);
        if (sessionIds.length === 0) {
          // An empty set still occupies a key; reclaim it.
          await redisClient.del([setKey]);
          setsEmptied++;
          continue;
        }

        // One round-trip resolves every member. MGET returns null in the slot
        // of any key that no longer exists — those are exactly the orphans.
        const sessionKeys = sessionIds.map(id => `${SESSION_KEY_PREFIX}${id}`);
        const payloads = await redisClient.mGet(sessionKeys);

        const orphaned = sessionIds.filter((_id, i) => payloads[i] === null);

        if (orphaned.length > 0) {
          await redisClient.sRem(setKey, orphaned);
          orphansRemoved += orphaned.length;
        }

        if (orphaned.length === sessionIds.length) {
          // Every member was stale — the user has no live session left.
          await redisClient.del([setKey]);
          setsEmptied++;
        }
      }
    });

    if (orphansRemoved > 0 || setsEmptied > 0) {
      this.logger.log(
        `Session cleanup: removed ${orphansRemoved} orphaned session ` +
          `reference(s), reclaimed ${setsEmptied} empty set(s)`,
      );
    }
  }

  // ============================================================================
  // REDIS STORAGE METHODS
  // ============================================================================

  /**
   * Store session in Redis
   */
  private async storeSessionInRedis(session: SessionInfo): Promise<void> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${SESSION_KEY_PREFIX}${session.sessionId}`;
      const ttl = Math.ceil((session.expiresAt.getTime() - Date.now()) / 1000);

      if (ttl <= 0) {
        this.logger.warn(
          `Session ${session.sessionId} already expired (ttl=${ttl}s), skipping Redis store`,
        );
        return;
      }

      await redisClient.setEx(key, ttl, JSON.stringify(session));
    } catch (error: unknown) {
      this.logger.warn(
        `Redis storage failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.fallbackSessions.set(session.sessionId, session);
    }
  }

  /**
   * Get session from Redis
   */
  private async getSessionFromRedis(sessionId: string): Promise<SessionInfo | null> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${SESSION_KEY_PREFIX}${sessionId}`;
      const sessionJson = await redisClient.get(key);

      if (sessionJson) {
        return this.deserializeSession(sessionJson);
      }
    } catch (error: unknown) {
      this.logger.warn(`Redis retrieval failed, using fallback: ${this.getErrorMessage(error)}`);
      return this.fallbackSessions.get(sessionId) ?? null;
    }

    return null;
  }

  /**
   * Delete session from Redis
   */
  private async deleteSessionFromRedis(sessionId: string): Promise<void> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${SESSION_KEY_PREFIX}${sessionId}`;
      await redisClient.del(key);
    } catch (error) {
      this.logger.warn(
        `Redis deletion failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.fallbackSessions.delete(sessionId);
    }
  }

  /**
   * Add session ID to user's session list
   */
  private async addSessionToUser(userId: string, sessionId: string): Promise<void> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${USER_SESSIONS_KEY_PREFIX}${userId}`;
      await redisClient.sAdd(key, sessionId);
    } catch (error) {
      this.logger.warn(
        `Redis sAdd failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      if (!this.fallbackUserSessions.has(userId)) {
        this.fallbackUserSessions.set(userId, new Set());
      }
      const fallbackSessions = this.fallbackUserSessions.get(userId);
      if (!fallbackSessions) {
        this.logger.warn(`Failed to initialize fallback session set for user ${userId}`);
        return;
      }
      fallbackSessions.add(sessionId);
    }
  }

  /**
   * Remove session ID from user's session list
   */
  private async removeSessionFromUser(userId: string, sessionId: string): Promise<void> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${USER_SESSIONS_KEY_PREFIX}${userId}`;
      await redisClient.sRem(key, sessionId);
    } catch (error) {
      this.logger.warn(
        `Redis sRem failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      this.fallbackUserSessions.get(userId)?.delete(sessionId);
    }
  }

  /**
   * Get all session IDs for a user
   */
  private async getUserSessionIds(userId: string): Promise<string[]> {
    try {
      const redisClient = await this.redisService.getClient();
      const key = `${USER_SESSIONS_KEY_PREFIX}${userId}`;
      return await redisClient.sMembers(key);
    } catch (error) {
      this.logger.warn(
        `Redis sMembers failed, using fallback: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return Array.from(this.fallbackUserSessions.get(userId) ?? []);
    }
  }
}
