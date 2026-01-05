/**
 * Security Event Types
 * Enterprise-grade security event definitions for admin notifications
 */

export enum SecurityEventType {
  ACCOUNT_LOCKED = 'security.account.locked',
  RATE_LIMIT_EXCEEDED = 'security.rate_limit.exceeded',
  SUSPICIOUS_ACTIVITY = 'security.suspicious_activity',
  IP_BLOCKED = 'security.ip.blocked',
  CAPTCHA_REQUIRED = 'security.captcha.required',
  CAPTCHA_FAILED = 'security.captcha.failed',
  BRUTE_FORCE_DETECTED = 'security.brute_force.detected',
  TOKEN_THEFT_DETECTED = 'security.token.theft_detected',
  MULTIPLE_FAILED_LOGINS = 'security.login.multiple_failures',
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface SecurityEventPayload {
  type: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
  email?: string;
  userId?: string;
  details: Record<string, any>;
  metadata?: {
    location?: string;
    attemptCount?: number;
    threshold?: number;
    blockedUntil?: Date;
  };
}

export class SecurityEvent {
  constructor(
    public readonly type: SecurityEventType,
    public readonly severity: SecuritySeverity,
    public readonly ipAddress: string,
    public readonly details: Record<string, any>,
    public readonly email?: string,
    public readonly userId?: string,
    public readonly userAgent?: string,
    public readonly metadata?: SecurityEventPayload['metadata'],
  ) {}

  toPayload(): SecurityEventPayload {
    return {
      type: this.type,
      severity: this.severity,
      timestamp: new Date(),
      ipAddress: this.ipAddress,
      userAgent: this.userAgent,
      email: this.email,
      userId: this.userId,
      details: this.details,
      metadata: this.metadata,
    };
  }
}
