import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

/**
 * RefreshToken Schema for Token Family Tracking
 *
 * This schema implements enterprise-grade token management with:
 * - JWT ID (jti) for unique token identification
 * - Token family tracking for rotation detection
 * - Issued-at timestamp for token fixation attack prevention
 * - Device and session metadata for security auditing
 *
 * Security Features:
 * 1. Token Family: Groups related tokens to detect token theft
 * 2. JTI Claim: Unique identifier prevents token replay attacks
 * 3. IssuedAt Check: Prevents token fixation by validating creation time
 * 4. Device Tracking: Links tokens to specific devices for anomaly detection
 */
@Schema({ timestamps: true })
export class RefreshToken {
  /**
   * JWT ID (jti) - Unique identifier for this token
   * RFC 7519: Used to prevent replay attacks and enable revocation
   */
  @Prop({ required: true, unique: true })
  jti!: string;

  /**
   * Hashed refresh token value
   * Stored hashed for security (defense in depth)
   */
  @Prop({ required: true })
  tokenHash!: string;

  /**
   * User ID this token belongs to
   */
  @Prop({ required: true })
  userId!: string;

  /**
   * Token Family ID - Groups related tokens for rotation tracking
   * When a token is refreshed, new token inherits the family ID
   * Enables detection of token theft (reuse of old token in family)
   */
  @Prop({ required: true })
  familyId!: string;

  /**
   * Issued-at timestamp (iat) - When this token was created
   * Critical for token fixation attack prevention
   * Reject tokens if iat < user's last security event timestamp
   */
  @Prop({ required: true })
  issuedAt!: Date;

  /**
   * Expiration timestamp
   */
  @Prop({ required: true })
  expiresAt!: Date;

  /**
   * Device information for security auditing
   */
  @Prop({
    type: {
      deviceId: String,
      deviceName: String,
      platform: String,
      browser: String,
      ipAddress: String,
      userAgent: String,
    },
  })
  deviceInfo?: {
    deviceId?: string;
    deviceName?: string;
    platform?: string;
    browser?: string;
    ipAddress?: string;
    userAgent?: string;
  };

  /**
   * Parent token JTI - References the token that was rotated to create this one
   * Enables token lineage tracking
   */
  @Prop()
  parentJti?: string;

  /**
   * Revoked status - Mark token as invalid without deletion
   */
  @Prop({ default: false })
  isRevoked!: boolean;

  /**
   * Revocation timestamp and reason
   */
  @Prop()
  revokedAt?: Date;

  @Prop()
  revokedReason?: string;

  /**
   * Last used timestamp - Track when token was last validated
   */
  @Prop()
  lastUsedAt?: Date;

  /**
   * Whether this token was issued with "remember me" enabled.
   * Persisted so that token rotation preserves the session duration.
   */
  @Prop({ default: false })
  rememberMe!: boolean;

  /**
   * Security metadata
   */
  @Prop({
    type: {
      rotationCount: { type: Number, default: 0 },
      isCompromised: { type: Boolean, default: false },
      compromisedAt: Date,
      compromisedReason: String,
    },
    default: () => ({
      rotationCount: 0,
      isCompromised: false,
    }),
  })
  securityMetadata!: {
    rotationCount: number;
    isCompromised: boolean;
    compromisedAt?: Date;
    compromisedReason?: string;
  };

  // Timestamps added by @Schema({ timestamps: true })
  createdAt?: Date;
  updatedAt?: Date;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

/**
 * Database Indexes for Performance
 */

// Composite index for token lookup and validation
RefreshTokenSchema.index({ userId: 1, jti: 1 });
RefreshTokenSchema.index({ userId: 1, familyId: 1 });
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });

// TTL index to automatically remove expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// TTL index to auto-purge revoked tokens 2 days after revocation
// Safety net independent of the cron job — only affects documents where revokedAt is set
RefreshTokenSchema.index({ revokedAt: 1 }, { expireAfterSeconds: 172800 });

// Rotation-recovery: look up child token by parentJti within a family
RefreshTokenSchema.index({ parentJti: 1, familyId: 1 }, { sparse: true });

// Family compromise queries are served by {userId:1, familyId:1} — userId is always known
