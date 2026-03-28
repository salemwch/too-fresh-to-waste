/**
 * Device information for token binding
 */
export interface DeviceInfo {
  deviceId: string;
  deviceFingerprint: string;
  ipAddress: string;
  userAgent: string;
  platform?: string;
  browser?: string;
}

/**
 * Token metadata
 */
export interface TokenMetadata {
  jti: string; // JWT ID (unique token identifier)
  family: string; // Token family for rotation detection
  issuedAt: Date;
  expiresAt: Date;
  deviceFingerprint?: string;
}

/**
 * Interface for Token Service
 *
 * Abstraction layer for JWT token management and rotation.
 * Enables dependency inversion and facilitates testing with mocks.
 *
 * @enterprise-pattern Dependency Inversion Principle (SOLID)
 * @testing Easy to mock for unit tests without JWT complexity
 */
export interface ITokenService {
  /**
   * Generate access and refresh tokens with rotation support
   * @param userId User ID
   * @param email User email
   * @param role User role
   * @param deviceInfo Device information for token binding
   * @returns Access and refresh tokens with metadata
   */
  generateTokens(
    userId: string,
    email: string,
    role: string,
    deviceInfo?: DeviceInfo,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    metadata: TokenMetadata;
  }>;

  /**
   * Validate access token
   * @param token Access token
   * @returns Decoded payload if valid, null otherwise
   */
  validateAccessToken(token: string): Promise<Record<string, unknown> | null>;

  /**
   * Validate refresh token
   * @param token Refresh token
   * @param userId User ID to validate against
   * @returns Decoded payload if valid, null otherwise
   */
  validateRefreshToken(token: string, userId: string): Promise<Record<string, unknown> | null>;

  /**
   * Rotate refresh token (generate new token family)
   * @param oldRefreshToken Old refresh token
   * @param userId User ID
   * @param deviceInfo Device information
   * @returns New access and refresh tokens
   */
  rotateRefreshToken(
    oldRefreshToken: string,
    userId: string,
    deviceInfo?: DeviceInfo,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    metadata: TokenMetadata;
  }>;

  /**
   * Revoke token family (invalidate all tokens in rotation chain)
   * @param tokenFamily Token family ID
   */
  revokeTokenFamily(tokenFamily: string): Promise<void>;

  /**
   * Check if token is revoked
   * @param jti JWT ID
   * @returns True if revoked
   */
  isTokenRevoked(jti: string): Promise<boolean>;
}

/**
 * Injection token for ITokenService
 * Use this token in constructor injection instead of the concrete class
 *
 * @example
 * constructor(@Inject(TOKEN_SERVICE_TOKEN) private readonly tokenService: ITokenService) {}
 */
export const TOKEN_SERVICE_TOKEN = Symbol('ITokenService');
