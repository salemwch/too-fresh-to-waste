import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RefreshToken, RefreshTokenDocument } from '../schemas/refresh-token.schema';
import { UserRole } from 'src/common/enums/user.enum';

/**
 * Token Payload Interface
 * Extends standard JWT claims with custom fields
 */
export interface TokenPayload {
    sub: string; // User ID
    email: string;
    role: UserRole;
    jti: string; // JWT ID
    iat: number; // Issued at (Unix timestamp)
    exp: number; // Expiration (Unix timestamp)
    familyId?: string; // Token family for rotation tracking
    ver?: number; // Token revocation version
}

/**
 * Token Generation Result
 */
export interface TokenPair {
    accessToken: string;
    refreshToken: string;
    jti: string;
    familyId: string;
}

/**
 * Device Information Interface
 */
export interface DeviceInfo {
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    browser?: string;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Token Validation Result
 */
export interface TokenValidationResult {
    isValid: boolean;
    userId?: string;
    jti?: string;
    familyId?: string;
    payload?: TokenPayload;
    error?: string;
    shouldRevokeFamily?: boolean; // True if token reuse detected
    rememberMe?: boolean; // Persisted flag — propagated to rotated tokens
}

/**
 * TokenService
 *
 * Enterprise-grade token management service with:
 * - JWT ID (jti) generation and tracking
 * - Token family management for rotation detection
 * - Token fixation attack prevention via issuedAt validation
 * - Automatic token cleanup and revocation
 * - Comprehensive security logging
 *
 * Security Principles:
 * 1. Every token has a unique JTI (prevents replay attacks)
 * 2. Tokens belong to families (detects token theft via rotation)
 * 3. IssuedAt timestamps prevent fixation attacks
 * 4. Hashed storage (defense in depth)
 * 5. Automatic cleanup of expired/revoked tokens
 */
@Injectable()
export class TokenService {
    private readonly logger = new Logger(TokenService.name);

    constructor(
        @InjectModel(RefreshToken.name)
        private readonly refreshTokenModel: Model<RefreshTokenDocument>,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) { }

    /**
     * Generate new token pair with JTI and family tracking
     *
     * @param userId - User ID
     * @param email - User email
     * @param role - User role
     * @param deviceInfo - Optional device metadata
     * @param parentJti - Optional parent token JTI for rotation
     * @param existingFamilyId - Optional existing family ID for rotation
     * @param tokenRevocationVersion - User's current token revocation version
     * @returns Token pair with metadata
     */
    async generateTokenPair(
        userId: string,
        email: string,
        role: UserRole,
        deviceInfo?: DeviceInfo,
        parentJti?: string,
        existingFamilyId?: string,
        tokenRevocationVersion: number = 0,
        rememberMe: boolean = false,
    ): Promise<TokenPair> {
        const now = Math.floor(Date.now() / 1000);

        // Generate unique JTI and family ID
        const jti = uuidv4();
        const familyId = existingFamilyId || uuidv4();

        // Calculate expiration times in seconds
        const accessExpiresInSec = this.parseExpiration(
            this.configService.get<string>('JWT_EXPIRES_IN') || '15m'
        );
        const refreshExpiresInSec = this.parseExpiration(
            this.configService.get<string>(
                rememberMe ? 'JWT_REFRESH_REMEMBER_ME_EXPIRES_IN' : 'JWT_REFRESH_EXPIRES_IN'
            ) || (rememberMe ? '30d' : '7d')
        );

        // Create token payloads WITHOUT exp/iat - let JWT library handle them
        // This avoids conflict with expiresIn option from global JwtModule config
        const accessPayload = {
            sub: userId,
            email,
            role,
            jti: uuidv4(), // Access token gets its own JTI
            ver: tokenRevocationVersion,
        };

        const refreshPayload = {
            sub: userId,
            email,
            role,
            jti,
            familyId,
            ver: tokenRevocationVersion,
        };

        // Sign tokens with expiresIn as number (seconds)
        // JWT library will automatically add iat and exp claims
        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(accessPayload, {
                secret: this.configService.get<string>('JWT_SECRET'),
                expiresIn: accessExpiresInSec, // seconds
            }),
            this.jwtService.signAsync(refreshPayload, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
                expiresIn: refreshExpiresInSec, // seconds
            }),
        ]);

        // Store refresh token metadata
        await this.storeRefreshToken({
            jti,
            tokenHash: this.hashToken(refreshToken),
            userId,
            familyId,
            issuedAt: new Date(now * 1000),
            expiresAt: new Date((now + refreshExpiresInSec) * 1000),
            deviceInfo,
            parentJti,
            rememberMe,
        });

        this.logger.log(`Generated token pair for user ${userId}`, {
            jti,
            familyId,
            isRotation: !!parentJti,
            devicePlatform: deviceInfo?.platform,
        });

        return {
            accessToken,
            refreshToken,
            jti,
            familyId,
        };
    }

    /**
     * Validate refresh token and check for security violations
     *
     * Performs:
     * 1. JWT signature validation
     * 2. Token existence check in database
     * 3. Revocation status check
     * 4. Token fixation attack prevention (issuedAt validation)
     * 5. Token family compromise detection
     *
     * @param token - Refresh token string
     * @param userLastTokenInvalidation - User's last token invalidation timestamp
     * @param userTokenRevocationVersion - User's current token revocation version
     * @returns Validation result with security indicators
     */
    async validateRefreshToken(
        token: string,
        userLastTokenInvalidation?: Date,
        userTokenRevocationVersion: number = 0,
    ): Promise<TokenValidationResult> {
        try {
            // 1. Verify JWT signature and decode
            const payload = await this.jwtService.verifyAsync<TokenPayload>(token, {
                secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
            });

            if (!payload.jti || !payload.sub) {
                return {
                    isValid: false,
                    error: 'Missing required claims (jti or sub)',
                };
            }

            // 2. Check token revocation version
            if (payload.ver !== undefined && payload.ver < userTokenRevocationVersion) {
                this.logger.warn(`Token revocation version mismatch for user ${payload.sub}`, {
                    tokenVersion: payload.ver,
                    currentVersion: userTokenRevocationVersion,
                });
                return {
                    isValid: false,
                    error: 'Token revocation version mismatch',
                };
            }

            // 3. Find token record in database
            const tokenRecord = await this.refreshTokenModel.findOne({
                jti: payload.jti,
                userId: payload.sub,
            });

            if (!tokenRecord) {
                this.logger.warn(`Token not found in database`, {
                    jti: payload.jti,
                    userId: payload.sub,
                });
                return {
                    isValid: false,
                    error: 'Token not found',
                };
            }

            // 4. Check if token is revoked
            if (tokenRecord.isRevoked) {
                this.logger.warn(`Revoked token used`, {
                    jti: payload.jti,
                    userId: payload.sub,
                    revokedAt: tokenRecord.revokedAt,
                    reason: tokenRecord.revokedReason,
                });
                return {
                    isValid: false,
                    error: 'Token has been revoked',
                };
            }

            // 5. Check if token is expired
            if (tokenRecord.expiresAt < new Date()) {
                this.logger.warn(`Expired token used`, {
                    jti: payload.jti,
                    userId: payload.sub,
                    expiresAt: tokenRecord.expiresAt,
                });
                return {
                    isValid: false,
                    error: 'Token has expired',
                };
            }

            // 6. Token Fixation Attack Prevention
            // Reject tokens issued before user's last security event
            if (userLastTokenInvalidation && tokenRecord.issuedAt < userLastTokenInvalidation) {
                this.logger.warn(`Token fixation attack detected`, {
                    jti: payload.jti,
                    userId: payload.sub,
                    tokenIssuedAt: tokenRecord.issuedAt,
                    lastInvalidation: userLastTokenInvalidation,
                });

                // Mark this token and its family as compromised
                await this.markFamilyAsCompromised(
                    tokenRecord.familyId,
                    'Token issued before security event (fixation attack prevention)'
                );

                return {
                    isValid: false,
                    error: 'Token issued before security event',
                    shouldRevokeFamily: true,
                };
            }

            // 7. Token Family Compromise Detection
            // Check if any token in this family has been reused (indicates theft)
            if (tokenRecord.securityMetadata.isCompromised) {
                this.logger.error(`Compromised token family used`, {
                    jti: payload.jti,
                    familyId: tokenRecord.familyId,
                    userId: payload.sub,
                    compromisedReason: tokenRecord.securityMetadata.compromisedReason,
                });

                return {
                    isValid: false,
                    error: 'Token family compromised',
                    shouldRevokeFamily: true,
                };
            }

            // 8. Update last used timestamp
            await this.refreshTokenModel.updateOne(
                { _id: tokenRecord._id },
                {
                    $set: { lastUsedAt: new Date() },
                }
            );

            this.logger.debug(`Token validated successfully`, {
                jti: payload.jti,
                userId: payload.sub,
                familyId: tokenRecord.familyId,
            });

            return {
                isValid: true,
                userId: payload.sub,
                jti: payload.jti,
                familyId: tokenRecord.familyId,
                payload,
                rememberMe: tokenRecord.rememberMe ?? false,
            };
        } catch (error) {
            this.logger.warn(`Token validation failed`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });

            return {
                isValid: false,
                error: error instanceof Error ? error.message : 'Token validation failed',
            };
        }
    }

    /**
     * Rotate refresh token (used during token refresh)
     *
     * Creates a new token in the same family and revokes the old one
     * This enables detection of token theft (reuse of old token)
     *
     * @param oldJti - JTI of token being rotated
     * @returns True if rotation successful
     */
    async rotateToken(oldJti: string): Promise<boolean> {
        try {
            const oldToken = await this.refreshTokenModel.findOne({ jti: oldJti });

            if (!oldToken) {
                this.logger.warn(`Cannot rotate - token not found`, { jti: oldJti });
                return false;
            }

            // Mark old token as revoked (soft delete)
            await this.refreshTokenModel.updateOne(
                { _id: oldToken._id },
                {
                    $set: {
                        isRevoked: true,
                        revokedAt: new Date(),
                        revokedReason: 'Token rotated during refresh',
                    },
                    $inc: {
                        'securityMetadata.rotationCount': 1,
                    },
                }
            );

            this.logger.debug(`Token rotated successfully`, {
                oldJti,
                familyId: oldToken.familyId,
                rotationCount: oldToken.securityMetadata.rotationCount + 1,
            });

            return true;
        } catch (error) {
            this.logger.error(`Error rotating token`, {
                jti: oldJti,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return false;
        }
    }

    /**
     * Revoke all tokens for a user
     *
     * @param userId - User ID
     * @param reason - Revocation reason
     */
    async revokeAllUserTokens(userId: string, reason: string): Promise<number> {
        try {
            const result = await this.refreshTokenModel.updateMany(
                { userId, isRevoked: false },
                {
                    $set: {
                        isRevoked: true,
                        revokedAt: new Date(),
                        revokedReason: reason,
                    },
                }
            );

            this.logger.log(`Revoked all tokens for user`, {
                userId,
                count: result.modifiedCount,
                reason,
            });

            return result.modifiedCount;
        } catch (error) {
            this.logger.error(`Error revoking user tokens`, {
                userId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }

    /**
     * Revoke all tokens in a token family
     *
     * Used when token theft is detected (reuse of rotated token)
     *
     * @param familyId - Token family ID
     * @param reason - Revocation reason
     */
    async revokeFamilyTokens(familyId: string, reason: string): Promise<number> {
        try {
            const result = await this.refreshTokenModel.updateMany(
                { familyId, isRevoked: false },
                {
                    $set: {
                        isRevoked: true,
                        revokedAt: new Date(),
                        revokedReason: reason,
                    },
                }
            );

            this.logger.warn(`Revoked token family`, {
                familyId,
                count: result.modifiedCount,
                reason,
            });

            return result.modifiedCount;
        } catch (error) {
            this.logger.error(`Error revoking family tokens`, {
                familyId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }

    /**
     * Mark entire token family as compromised
     *
     * @param familyId - Token family ID
     * @param reason - Compromise reason
     */
    async markFamilyAsCompromised(familyId: string, reason: string): Promise<void> {
        try {
            await this.refreshTokenModel.updateMany(
                { familyId },
                {
                    $set: {
                        'securityMetadata.isCompromised': true,
                        'securityMetadata.compromisedAt': new Date(),
                        'securityMetadata.compromisedReason': reason,
                        isRevoked: true,
                        revokedAt: new Date(),
                        revokedReason: `Family compromised: ${reason}`,
                    },
                }
            );

            this.logger.error(`Token family marked as compromised`, {
                familyId,
                reason,
            });
        } catch (error) {
            this.logger.error(`Error marking family as compromised`, {
                familyId,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * Cleanup expired and old revoked tokens
     *
     * Should be run periodically (e.g., daily cron job)
     *
     * @param olderThanDays - Remove revoked tokens older than N days
     */
    async cleanupTokens(olderThanDays: number = 30): Promise<number> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            const result = await this.refreshTokenModel.deleteMany({
                $or: [
                    { expiresAt: { $lt: new Date() } }, // Expired tokens
                    {
                        isRevoked: true,
                        revokedAt: { $lt: cutoffDate }, // Old revoked tokens
                    },
                ],
            });

            this.logger.log(`Cleaned up tokens`, {
                deletedCount: result.deletedCount,
                olderThanDays,
            });

            return result.deletedCount;
        } catch (error) {
            this.logger.error(`Error cleaning up tokens`, {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return 0;
        }
    }

    /**
     * Get user's active token count
     *
     * @param userId - User ID
     */
    async getUserActiveTokenCount(userId: string): Promise<number> {
        const count = await this.refreshTokenModel.countDocuments({
            userId,
            isRevoked: false,
            expiresAt: { $gt: new Date() },
        });

        return count;
    }

    /**
     * Store refresh token metadata
     *
     * @param tokenData - Token metadata
     */
    private async storeRefreshToken(tokenData: {
        jti: string;
        tokenHash: string;
        userId: string;
        familyId: string;
        issuedAt: Date;
        expiresAt: Date;
        deviceInfo?: DeviceInfo;
        parentJti?: string;
        rememberMe?: boolean;
    }): Promise<void> {
        try {
            await this.refreshTokenModel.create({
                ...tokenData,
                securityMetadata: {
                    rotationCount: 0,
                    isCompromised: false,
                },
            });
        } catch (error) {
            this.logger.error(`Error storing refresh token`, {
                jti: tokenData.jti,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Hash token for storage (defense in depth)
     *
     * @param token - Token string
     * @returns SHA-256 hash
     */
    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Parse expiration string to seconds
     *
     * @param expiration - Expiration string (e.g., "15m", "7d")
     * @returns Seconds
     */
    private parseExpiration(expiration: string): number {
        const match = expiration.match(/^(\d+)([smhd])$/);
        if (!match) {
            this.logger.warn(`Invalid expiration format: ${expiration}, defaulting to 15m`);
            return 900; // 15 minutes default
        }

        const [, value, unit] = match;
        const num = parseInt(value, 10);

        const multipliers: Record<string, number> = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
        };

        return num * multipliers[unit];
    }
}
