/**
 * Enterprise-Grade Session Management Interfaces
 * Unified session types for consistent authentication across the application
 *
 * @module common/security/interfaces
 * @version 2.0.0
 * @since 2025-11-21
 */

/**
 * Device information for session tracking and security auditing
 */
export interface DeviceInfo {
  /** Unique device identifier (UUID) */
  readonly deviceId: string;

  /** Device fingerprint for enhanced security */
  readonly deviceFingerprint: string;

  /** Human-readable device name */
  readonly deviceName: string;

  /** Platform (iOS, Android, Web, Desktop) */
  readonly platform: string;

  /** Browser name and version */
  readonly browser: string;

  /** Client IP address */
  readonly ipAddress: string;

  /** Full user agent string */
  readonly userAgent: string;

  /** Geographic location (city, country) derived from IP */
  readonly location?: string;

  /** Whether this device is marked as trusted */
  isTrusted: boolean;

  /** Last activity timestamp for this device */
  lastActiveAt: Date;

  /** Device creation timestamp */
  readonly createdAt: Date;
}

/**
 * Active session information
 * Combines in-memory (Redis) and persistent (MongoDB) session data
 */
export interface SessionInfo {
  /** Unique session identifier (UUID) */
  readonly sessionId: string;

  /** User ID associated with this session */
  readonly userId: string;

  /** Device information for this session */
  readonly deviceInfo: DeviceInfo;

  /** Current access token (JWT) */
  accessToken: string;

  /** Current refresh token */
  refreshToken: string;

  /** Session expiration timestamp */
  expiresAt: Date;

  /** Whether session is currently active */
  isActive: boolean;

  /** Session creation timestamp */
  readonly createdAt: Date;

  /** Last activity timestamp */
  lastActivityAt: Date;
}

/**
 * Request parameters for creating a new session
 */
export interface CreateSessionRequest {
  /** User ID for the session */
  readonly userId: string;

  /** User agent string from request headers */
  readonly userAgent: string;

  /** Client IP address */
  readonly ipAddress: string;

  /** Optional device fingerprint for enhanced security */
  readonly deviceFingerprint?: string;

  /** Whether to extend session duration (Remember Me) */
  readonly rememberMe?: boolean;
}

/**
 * Session service configuration
 * All values are configurable via environment variables
 */
export interface SessionConfiguration {
  /** Maximum number of concurrent sessions per user */
  readonly maxConcurrentSessions: number;

  /** Session timeout in milliseconds (default: 15 minutes) */
  readonly sessionTimeout: number;

  /** Remember Me session duration in milliseconds (default: 30 days) */
  readonly rememberMeDuration: number;

  /** Cleanup interval for expired sessions in milliseconds (default: 5 minutes) */
  readonly cleanupInterval: number;

  /** Threshold for suspicious activity detection */
  readonly suspiciousActivityThreshold: number;
}

/**
 * Login history entry for audit trail
 * Stored persistently in MongoDB
 */
export interface LoginHistoryEntry {
  /** IP address of the login */
  readonly ipAddress: string;

  /** User agent string */
  readonly userAgent: string;

  /** Login timestamp */
  readonly timestamp: Date;

  /** Geographic location (if available) */
  readonly location?: string;

  /** Login success status */
  readonly success: boolean;

  /** Failure reason (if login failed) */
  readonly failureReason?: string;
}

/**
 * Session validation result
 */
export interface SessionValidationResult {
  /** Whether session is valid */
  isValid: boolean;

  /** Session information (if valid) */
  session?: SessionInfo;

  /** Validation error message (if invalid) */
  error?: string;

  /** Whether session was expired */
  wasExpired?: boolean;
}

/**
 * Session activity log entry
 */
export interface SessionActivity {
  /** Session ID */
  readonly sessionId: string;

  /** Activity type (login, logout, refresh, access) */
  readonly activityType: 'login' | 'logout' | 'refresh' | 'access' | 'suspicious';

  /** Activity timestamp */
  readonly timestamp: Date;

  /** Additional metadata */
  readonly metadata?: Record<string, any>;
}
