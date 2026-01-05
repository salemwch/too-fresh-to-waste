import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RedisService } from '../../redis/redis.service';
import { RedisClientType } from 'redis';
import {
  SecurityEvent,
  SecurityEventType,
  SecuritySeverity,
} from '../events/security-events';

type RedisClient = RedisClientType;

interface AttemptData {
  count: number;
  lastAttempt: string; // ISO string in Redis
  blockedUntil?: string; // ISO string in Redis
}

interface RequestData {
  count: number;
  resetTime: string; // ISO string in Redis
}

interface AttemptResult {
  count: number;
  blocked: boolean;
  blockedUntil?: Date;
}

// Type guards for runtime type safety
function isAttemptData(obj: unknown): obj is AttemptData {
  return typeof obj === 'object' &&
         obj !== null &&
         typeof (obj as AttemptData).count === 'number' &&
         typeof (obj as AttemptData).lastAttempt === 'string' &&
         ((obj as AttemptData).blockedUntil === undefined || typeof (obj as AttemptData).blockedUntil === 'string');
}

function isRequestData(obj: unknown): obj is RequestData {
  return typeof obj === 'object' &&
         obj !== null &&
         typeof (obj as RequestData).count === 'number' &&
         typeof (obj as RequestData).resetTime === 'string';
}

@Injectable()
export class AuthSecurityService {
  private readonly logger = new Logger(AuthSecurityService.name);

  // Account lockout configuration
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private readonly SUSPICIOUS_ACTIVITY_THRESHOLD = 10;

  // CAPTCHA requirement thresholds (PRODUCTION-READY IMPROVEMENT)
  private readonly CAPTCHA_REQUIRED_AFTER_ATTEMPTS = 3; // Require CAPTCHA after 3 failed attempts

  // Rate limiting configuration (PRODUCTION-READY IMPROVEMENT: Reduced from 50 to 25)
  private readonly RATE_LIMIT_THRESHOLD = 25; // requests per minute (down from 50)
  private readonly RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

  // Fallback in-memory storage for development/offline mode
  private readonly fallbackAttempts = new Map<string, { count: number; lastAttempt: Date; blockedUntil?: Date }>();
  private readonly fallbackRequests = new Map<string, { count: number; resetTime: Date }>();
  private readonly fallbackBlockedIps = new Map<string, Date>();

  // Redis key prefixes for namespacing
  private readonly REDIS_KEYS = {
    ATTEMPTS: 'auth:attempts:',
    REQUESTS: 'auth:requests:',
    BLOCKED_IPS: 'auth:blocked-ips:',
  } as const;

  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.logger.log('✅ AuthSecurityService initialized with shared RedisService and EventEmitter');
  }

  /**
   * Get Redis client from shared service
   */
  private async getRedisClient(): Promise<RedisClient | null> {
    try {
      if (!this.redisService.isConnected()) {
        return null;
      }
      return await this.redisService.getClient();
    } catch (error) {
      this.logger.warn('Failed to get Redis client, using in-memory fallback', error);
      return null;
    }
  }

  async checkLoginAttempts(
    ip: string,
    email: string,
  ): Promise<{
    allowed: boolean;
    remainingAttempts?: number;
    blockedUntil?: Date;
    captchaRequired?: boolean;
  }> {
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${email}`;

    try {
      // Check IP-based attempts
      const ipAttempts = await this.getAttempts(ipKey);
      if (ipAttempts.blocked) {
        this.logger.warn(`Login blocked for IP ${ip} until ${ipAttempts.blockedUntil}`);

        // Emit security event for account lockout (PRODUCTION-READY IMPROVEMENT)
        this.emitSecurityEvent(
          SecurityEventType.ACCOUNT_LOCKED,
          SecuritySeverity.HIGH,
          ip,
          { reason: 'IP-based lockout', attempts: ipAttempts.count },
          email,
        );

        return { allowed: false, blockedUntil: ipAttempts.blockedUntil };
      }

      // Check email-based attempts
      const emailAttempts = await this.getAttempts(emailKey);
      if (emailAttempts.blocked) {
        this.logger.warn(`Login blocked for email ${email} until ${emailAttempts.blockedUntil}`);

        // Emit security event for account lockout (PRODUCTION-READY IMPROVEMENT)
        this.emitSecurityEvent(
          SecurityEventType.ACCOUNT_LOCKED,
          SecuritySeverity.HIGH,
          ip,
          { reason: 'Email-based lockout', attempts: emailAttempts.count },
          email,
        );

        return { allowed: false, blockedUntil: emailAttempts.blockedUntil };
      }

      const remainingAttempts = Math.min(
        this.MAX_LOGIN_ATTEMPTS - ipAttempts.count,
        this.MAX_LOGIN_ATTEMPTS - emailAttempts.count
      );

      // Check if CAPTCHA is required (PRODUCTION-READY IMPROVEMENT)
      const maxAttempts = Math.max(ipAttempts.count, emailAttempts.count);
      const captchaRequired = maxAttempts >= this.CAPTCHA_REQUIRED_AFTER_ATTEMPTS;

      if (captchaRequired && maxAttempts < this.MAX_LOGIN_ATTEMPTS) {
        this.logger.warn(
          `CAPTCHA required for ${email} from IP ${ip} after ${maxAttempts} failed attempts`
        );

        // Emit security event for CAPTCHA requirement (PRODUCTION-READY IMPROVEMENT)
        this.emitSecurityEvent(
          SecurityEventType.CAPTCHA_REQUIRED,
          SecuritySeverity.MEDIUM,
          ip,
          { attempts: maxAttempts, threshold: this.CAPTCHA_REQUIRED_AFTER_ATTEMPTS },
          email,
        );
      }

      return { allowed: true, remainingAttempts, captchaRequired };
    } catch (error) {
      this.logger.error('Error checking login attempts:', error);
      return { allowed: true }; // Fail open for availability
    }
  }

  async recordFailedLoginAttempt(ip: string, email: string): Promise<void> {
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${email}`;

    try {
      await this.incrementAttempts(ipKey);
      await this.incrementAttempts(emailKey);

      // Check for suspicious activity and emit events (PRODUCTION-READY IMPROVEMENT)
      const ipAttempts = await this.getAttempts(ipKey);

      if (ipAttempts && ipAttempts.count >= this.SUSPICIOUS_ACTIVITY_THRESHOLD) {
        this.logger.warn(`Suspicious activity detected from IP ${ip}: ${ipAttempts.count} failed attempts`);

        // Emit brute force detection event (PRODUCTION-READY IMPROVEMENT)
        this.emitSecurityEvent(
          SecurityEventType.BRUTE_FORCE_DETECTED,
          SecuritySeverity.CRITICAL,
          ip,
          {
            attemptCount: ipAttempts.count,
            threshold: this.SUSPICIOUS_ACTIVITY_THRESHOLD,
            target: 'login',
          },
          email,
        );
      } else if (ipAttempts && ipAttempts.count >= this.CAPTCHA_REQUIRED_AFTER_ATTEMPTS) {
        // Emit multiple failed logins event (PRODUCTION-READY IMPROVEMENT)
        this.emitSecurityEvent(
          SecurityEventType.MULTIPLE_FAILED_LOGINS,
          SecuritySeverity.MEDIUM,
          ip,
          {
            attemptCount: ipAttempts.count,
            captchaThreshold: this.CAPTCHA_REQUIRED_AFTER_ATTEMPTS,
          },
          email,
        );
      }
    } catch (error) {
      this.logger.error('Error recording failed login attempt:', error);
    }
  }

  async clearLoginAttempts(ip: string, email: string): Promise<void> {
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${email}`;

    try {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        await Promise.all([
          redisClient.del(this.REDIS_KEYS.ATTEMPTS + ipKey),
          redisClient.del(this.REDIS_KEYS.ATTEMPTS + emailKey)
        ]);
      } else {
        this.fallbackAttempts.delete(ipKey);
        this.fallbackAttempts.delete(emailKey);
      }
    } catch (error) {
      this.logger.error('Error clearing login attempts:', error);
    }
  }

  async isIpBlocked(ip: string): Promise<boolean> {
    try {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        const blockedUntilStr = await redisClient.get(this.REDIS_KEYS.BLOCKED_IPS + ip);
        if (blockedUntilStr && typeof blockedUntilStr === 'string') {
          const blockedUntil = new Date(blockedUntilStr);
          if (!isNaN(blockedUntil.getTime()) && new Date() < blockedUntil) {
            return true;
          }
          // Clean up expired blocks
          await redisClient.del(this.REDIS_KEYS.BLOCKED_IPS + ip);
        }
        return false;
      } else {
        const blockedUntil = this.fallbackBlockedIps.get(ip);
        if (blockedUntil && new Date() < blockedUntil) {
          return true;
        }
        // Clean up expired blocks
        if (blockedUntil && new Date() >= blockedUntil) {
          this.fallbackBlockedIps.delete(ip);
        }
        return false;
      }
    } catch (error) {
      this.logger.error('Error checking IP block status:', error);
      return false;
    }
  }

  async blockIp(ip: string, duration: number = this.LOCKOUT_DURATION, reason?: string): Promise<void> {
    try {
      const blockedUntil = new Date(Date.now() + duration);
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        const ttlSeconds = Math.ceil(duration / 1000);
        await redisClient.setEx(this.REDIS_KEYS.BLOCKED_IPS + ip, ttlSeconds, blockedUntil.toISOString());
      } else {
        this.fallbackBlockedIps.set(ip, blockedUntil);
      }

      this.logger.warn(`IP ${ip} blocked until ${blockedUntil}. Reason: ${reason || 'security violation'}`);

      // Emit security event for IP blocking (PRODUCTION-READY IMPROVEMENT)
      this.emitSecurityEvent(
        SecurityEventType.IP_BLOCKED,
        SecuritySeverity.HIGH,
        ip,
        {
          reason: reason || 'security violation',
          duration,
          blockedUntil: blockedUntil.toISOString(),
        },
      );
    } catch (error) {
      this.logger.error('Error blocking IP:', error);
    }
  }

  async detectSuspiciousActivity(ip: string, userAgent: string): Promise<boolean> {
    try {
      const isRateLimitExceeded = await this.checkRateLimit(ip);
      if (isRateLimitExceeded) {
        return true;
      }

      const isSuspiciousUserAgent = this.checkSuspiciousUserAgent(ip, userAgent);
      if (isSuspiciousUserAgent) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error('Error detecting suspicious activity:', error);
      return false;
    }
  }

  private async getAttempts(key: string): Promise<AttemptResult> {
    try {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        return await this.getRedisAttempts(key);
      } else {
        return this.getInMemoryAttempts(key);
      }
    } catch (error) {
      this.logger.error(`Error getting attempts for key ${key}:`, error);
      return this.createDefaultAttemptResult();
    }
  }

  private async getRedisAttempts(key: string): Promise<AttemptResult> {
    const attemptData = await this.retrieveRedisAttemptData(key);

    if (!attemptData) {
      return this.createDefaultAttemptResult();
    }

    const isExpired = await this.handleExpiredRedisAttempt(key, attemptData);
    if (isExpired) {
      return this.createDefaultAttemptResult();
    }

    return this.buildAttemptResult(attemptData.count, attemptData.blockedUntil);
  }

  private getInMemoryAttempts(key: string): AttemptResult {
    const attemptData = this.fallbackAttempts.get(key);

    if (!attemptData) {
      return this.createDefaultAttemptResult();
    }

    const isExpired = this.handleExpiredInMemoryAttempt(key, attemptData);
    if (isExpired) {
      return this.createDefaultAttemptResult();
    }

    return this.buildAttemptResult(attemptData.count, attemptData.blockedUntil);
  }

  private async retrieveRedisAttemptData(key: string): Promise<AttemptData | null> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {return null;}

    const attemptDataStr = await redisClient.get(this.REDIS_KEYS.ATTEMPTS + key);

    if (!attemptDataStr || typeof attemptDataStr !== 'string') {
      return null;
    }

    return this.parseRedisAttemptData(attemptDataStr, key);
  }

  private parseRedisAttemptData(attemptDataStr: string, key: string): AttemptData | null {
    try {
      const parsed: unknown = JSON.parse(attemptDataStr);
      if (!isAttemptData(parsed)) {
        this.logger.warn(`Invalid attempt data format for key ${key}`);
        return null;
      }
      return parsed;
    } catch (error) {
      this.logger.warn(`Failed to parse attempt data for key ${key}:`, error);
      return null;
    }
  }

  private async handleExpiredRedisAttempt(key: string, attemptData: AttemptData): Promise<boolean> {
    if (!attemptData.blockedUntil) {
      return false;
    }

    const blockedUntil = new Date(attemptData.blockedUntil);
    const isExpired = new Date() >= blockedUntil;

    if (isExpired) {
      const redisClient = await this.getRedisClient();
      if (redisClient) {
        await redisClient.del(this.REDIS_KEYS.ATTEMPTS + key);
      }
    }

    return isExpired;
  }

  private handleExpiredInMemoryAttempt(
    key: string,
    attemptData: { count: number; lastAttempt: Date; blockedUntil?: Date }
  ): boolean {
    if (!attemptData.blockedUntil) {
      return false;
    }

    const isExpired = new Date() >= attemptData.blockedUntil;

    if (isExpired) {
      this.fallbackAttempts.delete(key);
    }

    return isExpired;
  }

  private buildAttemptResult(count: number, blockedUntil?: Date | string): AttemptResult {
    const isBlocked = count >= this.MAX_LOGIN_ATTEMPTS;

    if (isBlocked) {
      const blockedUntilDate = typeof blockedUntil === 'string' ? new Date(blockedUntil) : blockedUntil;
      return {
        count,
        blocked: true,
        blockedUntil: blockedUntilDate
      };
    }

    return { count, blocked: false };
  }

  private createDefaultAttemptResult(): AttemptResult {
    return { count: 0, blocked: false };
  }

  private async checkRateLimit(ip: string): Promise<boolean> {
    const now = new Date();
    const requestKey = this.REDIS_KEYS.REQUESTS + ip;
    const redisClient = await this.getRedisClient();

    if (redisClient) {
      return this.checkRateLimitWithRedis(
        requestKey,
        now,
        this.RATE_LIMIT_THRESHOLD,
        this.RATE_LIMIT_WINDOW_MS,
        ip
      );
    } else {
      return this.checkRateLimitInMemory(
        ip,
        now,
        this.RATE_LIMIT_THRESHOLD,
        this.RATE_LIMIT_WINDOW_MS
      );
    }
  }

  private async checkRateLimitWithRedis(
    requestKey: string,
    now: Date,
    threshold: number,
    windowSizeMs: number,
    ip: string
  ): Promise<boolean> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {return false;}

    const requestDataStr = await redisClient.get(requestKey);
    let requestData: RequestData | null = null;

    if (requestDataStr && typeof requestDataStr === 'string') {
      requestData = this.parseRequestData(requestDataStr, ip);
    }

    const shouldResetWindow = !requestData ||
      now.getTime() - new Date(requestData.resetTime).getTime() > windowSizeMs;

    if (shouldResetWindow) {
      requestData = { count: 1, resetTime: now.toISOString() };
    } else {
      requestData.count++;
    }

    await redisClient.setEx(requestKey, 60, JSON.stringify(requestData));

    if (requestData.count > threshold) {
      this.logger.warn(
        `Rate limit exceeded: ${requestData.count} requests from IP ${ip} in 1 minute (threshold: ${threshold})`
      );

      // Emit security event for rate limit exceeded (PRODUCTION-READY IMPROVEMENT)
      this.emitSecurityEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecuritySeverity.HIGH,
        ip,
        {
          requestCount: requestData.count,
          threshold,
          windowSeconds: 60,
        },
      );

      return true;
    }

    return false;
  }

  private checkRateLimitInMemory(
    ip: string,
    now: Date,
    threshold: number,
    windowSizeMs: number
  ): boolean {
    const requestData = this.fallbackRequests.get(ip);
    const shouldResetWindow = !requestData ||
      now.getTime() - requestData.resetTime.getTime() > windowSizeMs;

    if (shouldResetWindow) {
      this.fallbackRequests.set(ip, { count: 1, resetTime: now });
    } else {
      requestData.count++;
      this.fallbackRequests.set(ip, requestData);
    }

    const currentCount = this.fallbackRequests.get(ip)?.count || 0;
    if (currentCount > threshold) {
      this.logger.warn(
        `Rate limit exceeded: ${currentCount} requests from IP ${ip} in 1 minute (threshold: ${threshold})`
      );

      // Emit security event for rate limit exceeded (PRODUCTION-READY IMPROVEMENT)
      this.emitSecurityEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecuritySeverity.HIGH,
        ip,
        {
          requestCount: currentCount,
          threshold,
          windowSeconds: 60,
        },
      );

      return true;
    }

    return false;
  }

  private parseRequestData(requestDataStr: string, ip: string): RequestData | null {
    try {
      const parsed: unknown = JSON.parse(requestDataStr);
      if (isRequestData(parsed)) {
        return parsed;
      }
    } catch (error) {
      this.logger.warn(`Failed to parse request data for IP ${ip}:`, error);
    }
    return null;
  }

  private checkSuspiciousUserAgent(ip: string, userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /python/i,
      /curl/i,
      /wget/i
    ];

    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    if (isSuspicious) {
      this.logger.warn(`Suspicious user agent from IP ${ip}: ${userAgent}`);
      return true;
    }

    return false;
  }

  private async incrementAttempts(key: string): Promise<void> {
    try {
      const now = new Date();
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        await this.incrementRedisAttempts(key, now);
      } else {
        this.incrementInMemoryAttempts(key, now);
      }
    } catch (error) {
      this.logger.error(`Error incrementing attempts for key ${key}:`, error);
    }
  }

  private async incrementRedisAttempts(key: string, now: Date): Promise<void> {
    const existingData = await this.getRedisAttemptData(key);
    const updatedData = this.calculateUpdatedAttemptData(existingData, now);
    const ttlSeconds = this.calculateTtlSeconds(updatedData);
    const redisClient = await this.getRedisClient();
    if (!redisClient) {return;}

    await redisClient.setEx(
      this.REDIS_KEYS.ATTEMPTS + key,
      ttlSeconds,
      JSON.stringify(updatedData)
    );
  }

  private incrementInMemoryAttempts(key: string, now: Date): void {
    const existingData = this.fallbackAttempts.get(key);
    const updatedData = this.calculateUpdatedInMemoryAttemptData(existingData, now);

    this.fallbackAttempts.set(key, updatedData);
  }

  private async getRedisAttemptData(key: string): Promise<AttemptData | null> {
    const redisClient = await this.getRedisClient();
    if (!redisClient) {return null;}

    const attemptDataStr = await redisClient.get(this.REDIS_KEYS.ATTEMPTS + key);

    if (!attemptDataStr || typeof attemptDataStr !== 'string') {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(attemptDataStr);
      return isAttemptData(parsed) ? parsed : null;
    } catch (error) {
      this.logger.warn(`Failed to parse attempt data for key ${key}:`, error);
      return null;
    }
  }

  private calculateUpdatedAttemptData(existingData: AttemptData | null, now: Date): AttemptData {
    if (!existingData) {
      return this.createFirstAttemptData(now);
    }

    return this.createIncrementedAttemptData(existingData, now);
  }

  private calculateUpdatedInMemoryAttemptData(
    existingData: { count: number; lastAttempt: Date; blockedUntil?: Date } | undefined,
    now: Date
  ): { count: number; lastAttempt: Date; blockedUntil?: Date } {
    if (!existingData) {
      return {
        count: 1,
        lastAttempt: now,
        blockedUntil: undefined
      };
    }

    const newCount = existingData.count + 1;
    const blockedUntil = this.shouldBlockAttempt(newCount)
      ? new Date(now.getTime() + this.LOCKOUT_DURATION)
      : existingData.blockedUntil;

    return {
      count: newCount,
      lastAttempt: now,
      blockedUntil
    };
  }

  private createFirstAttemptData(now: Date): AttemptData {
    return {
      count: 1,
      lastAttempt: now.toISOString(),
      blockedUntil: undefined
    };
  }

  private createIncrementedAttemptData(existingData: AttemptData, now: Date): AttemptData {
    const newCount = existingData.count + 1;
    const blockedUntil = this.shouldBlockAttempt(newCount)
      ? new Date(now.getTime() + this.LOCKOUT_DURATION).toISOString()
      : existingData.blockedUntil;

    return {
      count: newCount,
      lastAttempt: now.toISOString(),
      blockedUntil
    };
  }

  private shouldBlockAttempt(attemptCount: number): boolean {
    return attemptCount >= this.MAX_LOGIN_ATTEMPTS;
  }

  private calculateTtlSeconds(attemptData: AttemptData): number {
    return attemptData.blockedUntil
      ? Math.ceil(this.LOCKOUT_DURATION / 1000)
      : 3600; // 1 hour for non-blocked attempts
  }

  /**
   * Emit security event for admin notifications (PRODUCTION-READY IMPROVEMENT)
   * @param type - Event type
   * @param severity - Event severity level
   * @param ipAddress - Source IP address
   * @param details - Event details
   * @param email - User email (optional)
   * @param userAgent - User agent string (optional)
   */
  private emitSecurityEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    ipAddress: string,
    details: Record<string, any>,
    email?: string,
    userAgent?: string,
  ): void {
    try {
      const event = new SecurityEvent(
        type,
        severity,
        ipAddress,
        details,
        email,
        undefined, // userId not available in auth-security service
        userAgent,
        {
          attemptCount: details.attemptCount || details.attempts,
          threshold: details.threshold,
          blockedUntil: details.blockedUntil ? new Date(details.blockedUntil) : undefined,
        },
      );

      // Emit event asynchronously (non-blocking)
      this.eventEmitter.emit(type, event.toPayload());

      this.logger.debug(`Security event emitted: ${type}`, {
        severity,
        ipAddress,
        email,
      });
    } catch (error) {
      this.logger.error('Failed to emit security event:', error);
    }
  }

  /**
   * Check if CAPTCHA is required for the given IP/email combination
   * (PRODUCTION-READY IMPROVEMENT)
   */
  async isCaptchaRequired(ip: string, email: string): Promise<boolean> {
    const ipKey = `ip:${ip}`;
    const emailKey = `email:${email}`;

    try {
      const [ipAttempts, emailAttempts] = await Promise.all([
        this.getAttempts(ipKey),
        this.getAttempts(emailKey),
      ]);

      const maxAttempts = Math.max(ipAttempts.count, emailAttempts.count);
      return maxAttempts >= this.CAPTCHA_REQUIRED_AFTER_ATTEMPTS;
    } catch (error) {
      this.logger.error('Error checking CAPTCHA requirement:', error);
      return false; // Fail open
    }
  }

  async clearAllIpBlocks(): Promise<{ clearedCount: number }> {
    try {
      let clearedCount = 0;
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        const keys = await redisClient.keys(`${this.REDIS_KEYS.BLOCKED_IPS}*`);
        if (keys.length > 0) {
          clearedCount = await redisClient.del(keys);
        }
      } else {
        clearedCount = this.fallbackBlockedIps.size;
        this.fallbackBlockedIps.clear();
      }

      this.logger.log(`Cleared ${clearedCount} IP blocks`);
      return { clearedCount };
    } catch (error) {
      this.logger.error('Error clearing IP blocks:', error);
      return { clearedCount: 0 };
    }
  }

  async clearAllLoginAttempts(): Promise<{ clearedCount: number }> {
    try {
      let clearedCount = 0;
      const redisClient = await this.getRedisClient();

      if (redisClient) {
        const attemptKeys = await redisClient.keys(`${this.REDIS_KEYS.ATTEMPTS}*`);
        const requestKeys = await redisClient.keys(`${this.REDIS_KEYS.REQUESTS}*`);
        const allKeys = [...attemptKeys, ...requestKeys];

        if (allKeys.length > 0) {
          clearedCount = await redisClient.del(allKeys);
        }
      } else {
        clearedCount = this.fallbackAttempts.size + this.fallbackRequests.size;
        this.fallbackAttempts.clear();
        this.fallbackRequests.clear();
      }

      this.logger.log(`Cleared ${clearedCount} login attempt records`);
      return { clearedCount };
    } catch (error) {
      this.logger.error('Error clearing login attempts:', error);
      return { clearedCount: 0 };
    }
  }
}