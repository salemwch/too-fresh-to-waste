import * as crypto from 'crypto';

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as geoip from 'geoip-lite';
import { Model } from 'mongoose';

import {
  USER_AUDIT_LOG_MAX,
  USER_LOGIN_HISTORY_MAX,
} from '../../common/constants/document-limits.constant';
import { User, UserDocument } from '../schemas/user.schema';

export interface DeviceInfo {
  deviceId: string;
  deviceFingerprint: string;
  deviceName: string;
  platform: string;
  browser: string;
  userAgent: string;
  ipAddress: string;
  location?: string | undefined;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  deviceInfo: DeviceInfo;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
}

@Injectable()
export class SessionManagementService {
  private readonly logger = new Logger(SessionManagementService.name);
  private readonly DEFAULT_TRUST_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly MAX_TRUSTED_DEVICES = 10;

  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {
    void this.DEFAULT_TRUST_PERIOD;
  }

  async createSession(userId: string, deviceInfo: DeviceInfo): Promise<SessionInfo> {
    // Only the existence check and the log line below need this document; the
    // history arrays are appended server-side further down. Selecting `email`
    // alone avoids pulling loginHistory, auditLog, mfaSettings and the rest of a
    // large user document on every single login.
    const user = await this.userModel.findById(userId).select('email').lean();
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Generate location from IP
    const location = this.getLocationFromIP(deviceInfo.ipAddress);

    // Create session info
    const sessionInfo: SessionInfo = {
      sessionId: crypto.randomUUID(),
      userId,
      deviceInfo: {
        ...deviceInfo,
        location,
      },
      createdAt: new Date(),
      lastActivity: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      isActive: true,
    };

    const now = new Date();

    /**
     * Both arrays are capped by the server in a single atomic update.
     *
     * The previous form read the document, `unshift`ed, sliced in JS and saved.
     * Two concurrent logins — the same person on phone and laptop, or a retried
     * request — each read the same array and each wrote their own version back,
     * so one login silently vanished from the history. That matters for arrays
     * whose whole purpose is a security audit trail.
     *
     * `$position: 0` prepends, so a positive `$slice` keeps the newest N and
     * discards the oldest. This matches `auth/services/session-management.service.ts`,
     * which drives the same two fields; they must not diverge.
     */
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: { lastLoginAt: now },
        $push: {
          loginHistory: {
            $each: [
              {
                ipAddress: deviceInfo.ipAddress,
                userAgent: deviceInfo.userAgent,
                timestamp: now,
                location,
              },
            ],
            $position: 0,
            $slice: USER_LOGIN_HISTORY_MAX,
          },
          auditLog: {
            $each: [
              {
                action: 'LOGIN',
                timestamp: now,
                ipAddress: deviceInfo.ipAddress,
                userAgent: deviceInfo.userAgent,
                details: {
                  sessionId: sessionInfo.sessionId,
                  deviceId: deviceInfo.deviceId,
                  location,
                },
              },
            ],
            $position: 0,
            $slice: USER_AUDIT_LOG_MAX,
          },
        },
      },
    );

    this.logger.log(`Session created for user: ${user.email}, Device: ${deviceInfo.deviceName}`);

    return sessionInfo;
  }

  async validateSession(_sessionId: string, userId: string): Promise<boolean> {
    // In a real implementation, this would check Redis or a session store
    // For now, we'll implement basic session validation
    const user = await this.userModel.findById(userId);
    if (!user) {
      return false;
    }

    // Check if user account is active
    if (user.status !== 'active') {
      return false;
    }

    // Check account lockout
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      return false;
    }

    return true;
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Add audit log entry
    user.auditLog ??= [];

    user.auditLog.unshift({
      action: 'LOGOUT',
      timestamp: new Date(),
      ipAddress: '', // Would come from request context
      userAgent: '', // Would come from request context
      details: { sessionId },
    });

    if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
      user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
    }

    await user.save();

    this.logger.log(`Session revoked: ${sessionId} for user: ${user.email}`);
  }

  async revokeAllSessions(userId: string, currentSessionId?: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Clear all refresh tokens except current session
    if (currentSessionId) {
      // In a real implementation, you'd preserve the current session's refresh token
      user.refreshTokens = [];
    } else {
      user.refreshTokens = [];
    }

    // Add audit log entry
    user.auditLog ??= [];

    user.auditLog.unshift({
      action: 'LOGOUT_ALL_SESSIONS',
      timestamp: new Date(),
      ipAddress: '', // Would come from request context
      userAgent: '', // Would come from request context
      details: {
        excludedSession: currentSessionId,
        reason: 'user_requested',
      },
    });

    if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
      user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
    }

    await user.save();

    this.logger.log(`All sessions revoked for user: ${user.email}`);
  }

  async trustDevice(
    userId: string,
    deviceInfo: DeviceInfo,
    trustDurationDays?: number,
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    user.trustedDevices ??= [];

    // Check if device is already trusted
    const existingDevice = user.trustedDevices.find(
      device => device.deviceId === deviceInfo.deviceId && !device.revokedAt,
    );

    if (existingDevice) {
      // Update existing trusted device
      existingDevice.lastUsedAt = new Date();
      existingDevice.expiresAt = new Date(
        Date.now() + (trustDurationDays ?? 30) * 24 * 60 * 60 * 1000,
      );
    } else {
      // Remove oldest trusted devices if we've hit the limit
      const activeTrustedDevices = user.trustedDevices.filter(
        device =>
          !device.revokedAt && device.expiresAt !== undefined && device.expiresAt > new Date(),
      );

      if (activeTrustedDevices.length >= this.MAX_TRUSTED_DEVICES) {
        const oldestDevice = activeTrustedDevices.sort(
          (a, b) => a.lastUsedAt.getTime() - b.lastUsedAt.getTime(),
        )[0];

        if (oldestDevice) {
          oldestDevice.revokedAt = new Date();
          oldestDevice.revokedReason = 'Exceeded maximum trusted devices limit';
        }
      }

      // Add new trusted device
      const location = this.getLocationFromIP(deviceInfo.ipAddress);
      const trustPeriod = (trustDurationDays ?? 30) * 24 * 60 * 60 * 1000;

      user.trustedDevices.push({
        deviceId: deviceInfo.deviceId,
        deviceFingerprint: deviceInfo.deviceFingerprint,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        browser: deviceInfo.browser,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        isTrusted: true,
        trustedAt: new Date(),
        lastUsedAt: new Date(),
        expiresAt: new Date(Date.now() + trustPeriod),
        location,
      });
    }

    // Add audit log entry
    user.auditLog ??= [];

    user.auditLog.unshift({
      action: 'DEVICE_TRUSTED',
      timestamp: new Date(),
      ipAddress: deviceInfo.ipAddress,
      userAgent: deviceInfo.userAgent,
      details: {
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        trustDurationDays: trustDurationDays ?? 30,
      },
    });

    if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
      user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
    }

    await user.save();

    this.logger.log(`Device trusted for user: ${user.email}, Device: ${deviceInfo.deviceName}`);
  }

  async revokeDeviceTrust(userId: string, deviceId: string, reason?: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.trustedDevices === null || user.trustedDevices === undefined) {
      return;
    }

    const device = user.trustedDevices.find(
      device => device.deviceId === deviceId && !device.revokedAt,
    );

    if (device) {
      device.revokedAt = new Date();
      device.revokedReason = reason ?? 'User requested revocation';

      // Add audit log entry
      user.auditLog ??= [];

      user.auditLog.unshift({
        action: 'DEVICE_TRUST_REVOKED',
        timestamp: new Date(),
        ipAddress: '', // Would come from request context
        userAgent: '', // Would come from request context
        details: {
          deviceId,
          deviceName: device.deviceName,
          reason: reason ?? 'User requested revocation',
        },
      });

      if (user.auditLog.length > USER_AUDIT_LOG_MAX) {
        user.auditLog = user.auditLog.slice(0, USER_AUDIT_LOG_MAX);
      }

      await user.save();

      this.logger.log(`Device trust revoked for user: ${user.email}, Device: ${device.deviceName}`);
    }
  }

  async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId);
    if (!user?.trustedDevices) {
      return false;
    }

    const device = user.trustedDevices.find(
      device =>
        device.deviceId === deviceId &&
        device.isTrusted === true &&
        !device.revokedAt &&
        device.expiresAt !== undefined &&
        device.expiresAt > new Date(),
    );

    if (device) {
      // Update last used timestamp
      device.lastUsedAt = new Date();
      await user.save();
      return true;
    }

    return false;
  }

  async getTrustedDevices(userId: string): Promise<
    Array<{
      deviceId: string;
      deviceName: string;
      platform: string;
      browser: string;
      lastUsedAt: Date;
      trustedAt: Date;
      expiresAt: Date;
      location?: string;
      isCurrent?: boolean;
    }>
  > {
    const user = await this.userModel.findById(userId);
    if (!user?.trustedDevices) {
      return [];
    }

    return user.trustedDevices.flatMap(device => {
      if (
        device.revokedAt ||
        !device.trustedAt ||
        !device.expiresAt ||
        device.expiresAt <= new Date()
      ) {
        return [];
      }

      return [
        {
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          platform: device.platform,
          browser: device.browser,
          lastUsedAt: device.lastUsedAt,
          trustedAt: device.trustedAt,
          expiresAt: device.expiresAt,
          ...(device.location !== undefined ? { location: device.location } : {}),
        },
      ];
    });
  }

  async detectSuspiciousActivity(
    userId: string,
    deviceInfo: DeviceInfo,
  ): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return { isSuspicious: false, reasons: [], riskScore: 0 };
    }

    const reasons: string[] = [];
    let riskScore = 0;

    // Check for new device
    const isKnownDevice = user.trustedDevices?.some(
      device => device.deviceFingerprint === deviceInfo.deviceFingerprint,
    );

    if (!isKnownDevice) {
      reasons.push('Login from unknown device');
      riskScore += 3;
    }

    // Check for unusual location
    const recentLogins = user.loginHistory?.slice(0, 10) ?? [];
    const currentLocation = this.getLocationFromIP(deviceInfo.ipAddress);

    if (currentLocation && recentLogins.length > 0) {
      const hasLocationHistory = recentLogins.some(login => login.location === currentLocation);

      if (!hasLocationHistory) {
        reasons.push('Login from unusual location');
        riskScore += 2;
      }
    }

    // Check for rapid location changes (impossible travel)
    if (recentLogins.length > 0) {
      const lastLogin = recentLogins[0];
      if (lastLogin) {
        const timeDiff = new Date().getTime() - lastLogin.timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);

        if (
          hoursDiff < 2 &&
          lastLogin.location &&
          currentLocation &&
          lastLogin.location !== currentLocation
        ) {
          reasons.push('Impossible travel detected');
          riskScore += 5;
        }
      }
    }

    // Check for multiple failed attempts recently
    if (user.failedLoginAttempts >= 3) {
      reasons.push('Multiple recent failed login attempts');
      riskScore += 4;
    }

    // Check for unusual time (outside normal hours)
    const currentHour = new Date().getHours();
    if (currentHour < 6 || currentHour > 23) {
      reasons.push('Login at unusual time');
      riskScore += 1;
    }

    const isSuspicious = riskScore >= 5;

    if (isSuspicious) {
      this.logger.warn(
        `Suspicious activity detected for user: ${user.email}, Risk Score: ${riskScore}`,
      );
    }

    return { isSuspicious, reasons, riskScore };
  }

  private getLocationFromIP(ipAddress: string): string | undefined {
    try {
      // Skip private/local IPs
      if (
        ipAddress === '127.0.0.1' ||
        ipAddress.startsWith('192.168.') ||
        ipAddress.startsWith('10.') ||
        ipAddress.startsWith('172.')
      ) {
        return 'Local Network';
      }

      const geo = geoip.lookup(ipAddress);
      if (geo) {
        return `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'}`;
      }
    } catch (error) {
      this.logger.error(`Error getting location for IP ${ipAddress}:`, error);
    }
    return undefined;
  }

  async cleanupExpiredSessions(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      return;
    }

    // Clean up expired trusted devices
    const now = new Date();
    for (const device of user.trustedDevices ?? []) {
      if (device.expiresAt && device.expiresAt < now && !device.revokedAt) {
        device.revokedAt = now;
        device.revokedReason = 'Expired';
      }
    }

    await user.save();
  }
}
