import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

// Interface for audit log entry details
export interface IAuditLogDetails {
    registrationMethod?: string;
    location?: string;
    method?: string;
    reason?: string;
    unlockedBy?: string;
    attempt?: number;
    maxAttempts?: number;
    deviceInfo?: string;
    deviceId?: string;
    excludedSession?: string;
    sessionId?: string;
    previousValue?: string;
    newValue?: string;
    ipv6?: string;
    userAgent?: string;
    referrer?: string;
    feature?: string;
    module?: string;
    action?: string;
    result?: string;
    errorCode?: string;
    duration?: number;
    timestamp?: Date;
    updatedFields?: string[];
    changes?: Record<string, any>;
    resetTo?: string;
    source?: string;
    metadata?: Record<string, string | number | boolean>;
    // Allow additional dynamic fields for flexible audit logging
    [key: string]: string | number | boolean | Date | string[] | Record<string, any> | undefined;
}
import { Document } from 'mongoose';
import { ConsentType, ConsentStatus, LegalBasis } from '../interfaces/privacy-consent.interface';

export type UserDocument = User & Document;

export enum UserRole {
    CONSUMER = 'consumer',
    MERCHANT = 'merchant',
    ADMIN = 'admin',
    MODERATOR = 'moderator',
}

export enum UserStatus {
    PENDING = 'pending',
    ACTIVE = 'active',
    SUSPENDED = 'suspended',
    BLOCKED = 'blocked',
    DELETED = 'deleted',
    ANONYMIZED = 'anonymized',
}

@Schema({ timestamps: true })
export class User {
    @Prop({ required: true })
    email: string;

    @Prop({ required: true })
    password: string;

    @Prop({ required: true })
    firstName: string;

    @Prop({ required: true })
    lastName: string;

    @Prop({ sparse: true })
    phoneNumber?: string;

    @Prop({ type: String, enum: UserRole, default: UserRole.CONSUMER })
    role: UserRole;

    @Prop({ type: String, enum: UserStatus, default: UserStatus.PENDING })
    status: UserStatus;

    @Prop({ default: false })
    isEmailVerified: boolean;

    @Prop({ default: false })
    isPhoneVerified: boolean;

    @Prop()
    avatar?: string;

    @Prop({
        type: {
            street: String,
            city: String,
            postalCode: String,
            country: String,
            coordinates: {
                type: { type: String, enum: ['Point'], default: 'Point' },
                coordinates: { type: [Number], index: '2dsphere' }
            }
        }
    })
    address?: {
        street: string;
        city: string;
        postalCode: string;
        country: string;
        coordinates?: {
            type: string;
            coordinates: [number, number];
        };
    };

    @Prop({ type: [String], default: [] })
    refreshTokens: string[];

    /**
     * Token Security Tracking
     * Timestamp of last security event requiring token invalidation
     * Used to prevent token fixation attacks by rejecting tokens
     * issued before this timestamp
     */
    @Prop()
    lastTokenInvalidation?: Date;

    /**
     * Global token revocation - force logout from all devices
     * Incremented on password change, account compromise, etc.
     */
    @Prop({ default: 0 })
    tokenRevocationVersion: number;

    @Prop()
    emailVerificationToken?: string;

    @Prop()
    phoneVerificationCode?: string;

    @Prop()
    phoneVerificationExpires?: Date;

    @Prop({ default: 0 })
    phoneVerificationAttempts?: number;

    @Prop()
    passwordResetToken?: string;

    @Prop()
    passwordResetExpires?: Date;

    @Prop({ default: Date.now })
    lastLoginAt?: Date;
    @Prop({ type: String, default: null })
    profileImage: string;
    // Mongoose timestamps automatically adds these fields
    createdAt?: Date;
    updatedAt?: Date;

    @Prop({
        type: {
            defaultLocation: {
                latitude: Number,
                longitude: Number
            },
            searchRadius: { type: Number, default: 5000 },
            savedLocations: [{
                id: String,
                name: String,
                coordinates: {
                    latitude: Number,
                    longitude: Number
                },
                address: {
                    street: String,
                    city: String,
                    postalCode: String,
                    country: String,
                    formattedAddress: String
                },
                category: { type: String, enum: ['home', 'work', 'favorite', 'other'] },
                createdAt: { type: Date, default: Date.now }
            }],
            locationHistory: [{
                coordinates: {
                    latitude: Number,
                    longitude: Number
                },
                timestamp: { type: Date, default: Date.now },
                accuracy: Number,
                source: { type: String, enum: ['gps', 'network', 'passive', 'manual', 'ip'] }
            }],
            autoDetectLocation: { type: Boolean, default: true },
            shareLocation: { type: Boolean, default: true }
        }
    })
    locationPreferences?: {
        defaultLocation?: {
            latitude: number;
            longitude: number;
        };
        searchRadius: number;
        savedLocations: Array<{
            id: string;
            name: string;
            coordinates: {
                latitude: number;
                longitude: number;
            };
            address: {
                street?: string;
                city: string;
                postalCode: string;
                country: string;
                formattedAddress?: string;
            };
            category: 'home' | 'work' | 'favorite' | 'other';
            createdAt: Date;
        }>;
        locationHistory: Array<{
            coordinates: {
                latitude: number;
                longitude: number;
            };
            timestamp: Date;
            accuracy: number;
            source: 'gps' | 'network' | 'passive' | 'manual' | 'ip';
        }>;
        autoDetectLocation: boolean;
        shareLocation: boolean;
    };

    // 🇹🇳 Tunisia + 🌍 International Privacy Compliance Fields
    @Prop({
        type: {
            // 🇹🇳 Tunisia Base Compliance (Law No. 2004-63)
            tunisianCompliance: {
                dataProcessingConsent: { type: Boolean, default: false },
                locationTrackingConsent: { type: Boolean, default: false },
                communicationConsent: { type: Boolean, default: false },
                consentGivenAt: Date,
                consentVersion: String,
                legalBasisTunisia: { type: String, enum: Object.values(LegalBasis) }
            },

            // 🌍 International Extended Compliance (GDPR/CCPA)
            internationalCompliance: {
                marketingOptIn: { type: Boolean, default: false },
                analyticsOptIn: { type: Boolean, default: false },
                thirdPartySharing: { type: Boolean, default: false },
                profilingOptIn: { type: Boolean, default: false },
                cookiesConsent: { type: Boolean, default: false },
                gdprConsentGiven: { type: Boolean, default: false },
                ccpaOptOutRequested: { type: Boolean, default: false }
            },

            // Consent Records
            consentRecords: [{
                consentType: { type: String, enum: Object.values(ConsentType) },
                status: { type: String, enum: Object.values(ConsentStatus) },
                legalBasis: { type: String, enum: Object.values(LegalBasis) },
                givenAt: Date,
                withdrawnAt: Date,
                expiresAt: Date,
                ipAddress: String,
                userAgent: String,
                consentVersion: String,
                processingPurpose: String,
                dataCategories: [String],
                retentionPeriod: Number,
                thirdParties: [String]
            }],

            // Data Subject Rights
            dataSubjectRights: {
                dataPortabilityRequested: { type: Boolean, default: false },
                deletionRequested: { type: Boolean, default: false },
                restrictionRequested: { type: Boolean, default: false },
                objectionRequested: { type: Boolean, default: false },
                lastExportDate: Date,
                pendingRequests: [String]
            },

            // Compliance Metadata
            lastPrivacyPolicyUpdate: Date,
            lastConsentRefresh: Date,
            privacyOfficerNotified: { type: Boolean, default: false }
        },
        default: () => ({
            tunisianCompliance: {
                dataProcessingConsent: false,
                locationTrackingConsent: false,
                communicationConsent: false
            },
            internationalCompliance: {
                marketingOptIn: false,
                analyticsOptIn: false,
                thirdPartySharing: false,
                profilingOptIn: false,
                cookiesConsent: false,
                gdprConsentGiven: false,
                ccpaOptOutRequested: false
            },
            consentRecords: [],
            dataSubjectRights: {
                dataPortabilityRequested: false,
                deletionRequested: false,
                restrictionRequested: false,
                objectionRequested: false,
                pendingRequests: []
            }
        })
    })
    privacySettings?: {
        tunisianCompliance: {
            dataProcessingConsent: boolean;
            locationTrackingConsent: boolean;
            communicationConsent: boolean;
            consentGivenAt?: Date;
            consentVersion?: string;
            legalBasisTunisia?: LegalBasis;
        };
        internationalCompliance: {
            marketingOptIn: boolean;
            analyticsOptIn: boolean;
            thirdPartySharing: boolean;
            profilingOptIn: boolean;
            cookiesConsent: boolean;
            gdprConsentGiven: boolean;
            ccpaOptOutRequested: boolean;
        };
        consentRecords: Array<{
            consentType: ConsentType;
            status: ConsentStatus;
            legalBasis: LegalBasis;
            givenAt: Date;
            withdrawnAt?: Date;
            expiresAt?: Date;
            ipAddress: string;
            userAgent: string;
            consentVersion: string;
            processingPurpose: string;
            dataCategories: string[];
            retentionPeriod: number;
            thirdParties?: string[];
        }>;
        dataSubjectRights: {
            dataPortabilityRequested: boolean;
            deletionRequested: boolean;
            restrictionRequested: boolean;
            objectionRequested: boolean;
            lastExportDate?: Date;
            pendingRequests: string[];
        };
        lastPrivacyPolicyUpdate?: Date;
        lastConsentRefresh?: Date;
        privacyOfficerNotified: boolean;
    };

    // Soft Delete Fields
    @Prop({ default: null })
    deletedAt?: Date;

    @Prop()
    deletionReason?: string;

    @Prop({ default: false })
    isAnonymized: boolean;

    @Prop()
    anonymizedAt?: Date;

    // Security & Audit Fields
    @Prop({
        type: [{
            action: String,
            timestamp: { type: Date, default: Date.now },
            ipAddress: String,
            userAgent: String,
            details: Object
        }],
        default: []
    })
    auditLog: Array<{
        action: string;
        timestamp: Date;
        ipAddress: string;
        userAgent: string;
        details: IAuditLogDetails;
    }>;

    @Prop({ default: 0 })
    failedLoginAttempts: number;

    @Prop()
    accountLockedUntil?: Date;

    @Prop({
        type: [{
            ipAddress: String,
            userAgent: String,
            timestamp: { type: Date, default: Date.now },
            location: String
        }],
        default: []
    })
    loginHistory: Array<{
        ipAddress: string;
        userAgent: string;
        timestamp: Date;
        location?: string;
    }>;

    // Multi-Factor Authentication (MFA) Settings
    @Prop({
        type: {
            isEnabled: { type: Boolean, default: false },
            methods: [{
                type: { type: String, enum: ['totp', 'sms', 'email', 'backup_codes'] },
                isActive: { type: Boolean, default: false },
                secret: String, // For TOTP
                backupCodes: [String], // Encrypted backup codes
                phoneNumber: String, // For SMS
                email: String, // For email
                createdAt: { type: Date, default: Date.now },
                lastUsedAt: Date,
                verified: { type: Boolean, default: false }
            }],
            lastAuthAt: Date,
            requireForSensitiveActions: { type: Boolean, default: true },
            trustDeviceDays: { type: Number, default: 30 },
            // Additional fields for MFA service compatibility
            pendingTotpSecret: String,
            totpSecret: String,
            backupCodes: [String],
            emergencyTokens: [String]
        }
    })
    mfaSettings?: {
        isEnabled: boolean;
        methods: Array<{
            type: 'totp' | 'sms' | 'email' | 'backup_codes';
            isActive: boolean;
            secret?: string;
            backupCodes?: string[];
            phoneNumber?: string;
            email?: string;
            createdAt: Date;
            lastUsedAt?: Date;
            verified: boolean;
        }>;
        lastAuthAt?: Date;
        requireForSensitiveActions: boolean;
        trustDeviceDays: number;
        // Additional fields for MFA service compatibility
        pendingTotpSecret?: string;
        totpSecret?: string;
        backupCodes?: string[];
        emergencyTokens?: string[];
    };

    // Trusted Devices Management
    @Prop({
        type: [{
            deviceId: String,
            deviceFingerprint: String,
            deviceName: String,
            platform: String,
            browser: String,
            ipAddress: String,
            userAgent: String,
            isTrusted: { type: Boolean, default: false },
            trustedAt: Date,
            lastUsedAt: { type: Date, default: Date.now },
            expiresAt: Date,
            location: String,
            revokedAt: Date,
            revokedReason: String
        }],
        default: []
    })
    trustedDevices: Array<{
        deviceId: string;
        deviceFingerprint: string;
        deviceName: string;
        platform: string;
        browser: string;
        ipAddress: string;
        userAgent: string;
        isTrusted: boolean;
        trustedAt?: Date;
        lastUsedAt: Date;
        expiresAt?: Date;
        location?: string;
        revokedAt?: Date;
        revokedReason?: string;
    }>;

    // Enhanced Security Settings
    @Prop({
        type: {
            passwordStrength: {
                score: { type: Number, min: 0, max: 4 },
                feedback: [String],
                lastChecked: Date
            },
            securityQuestions: [{
                question: String,
                answerHash: String, // Hashed answer
                createdAt: { type: Date, default: Date.now }
            }],
            backupEmail: String,
            recoveryPhrase: String, // Encrypted
            lastPasswordChange: Date,
            passwordHistory: [String], // Hashed previous passwords
            requirePasswordChangeAt: Date,
            loginNotifications: { type: Boolean, default: true },
            suspiciousActivityNotifications: { type: Boolean, default: true }
        }
    })
    securitySettings?: {
        passwordStrength: {
            score: number;
            feedback: string[];
            lastChecked?: Date;
        };
        securityQuestions: Array<{
            question: string;
            answerHash: string;
            createdAt: Date;
        }>;
        backupEmail?: string;
        recoveryPhrase?: string;
        lastPasswordChange?: Date;
        passwordHistory: string[];
        requirePasswordChangeAt?: Date;
        loginNotifications: boolean;
        suspiciousActivityNotifications: boolean;
    };

    // User Preferences Management
    @Prop({
        type: {
            // App Preferences
            theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'auto' },
            language: { type: String, default: 'en' },
            timezone: { type: String, default: 'UTC' },
            currency: { type: String, default: 'USD' },

            // Notification Preferences
            notifications: {
                email: {
                    marketing: { type: Boolean, default: false },
                    orderUpdates: { type: Boolean, default: true },
                    newOffers: { type: Boolean, default: true },
                    weeklyDigest: { type: Boolean, default: false },
                    securityAlerts: { type: Boolean, default: true }
                },
                push: {
                    orderUpdates: { type: Boolean, default: true },
                    nearbyOffers: { type: Boolean, default: true },
                    favoriteStoreOffers: { type: Boolean, default: true },
                    newMessages: { type: Boolean, default: true }
                },
                sms: {
                    orderConfirmation: { type: Boolean, default: false },
                    securityAlerts: { type: Boolean, default: true }
                }
            },

            // Privacy Preferences
            privacy: {
                profileVisibility: { type: String, enum: ['public', 'friends', 'private'], default: 'private' },
                showOnlineStatus: { type: Boolean, default: false },
                allowDataAnalytics: { type: Boolean, default: false },
                allowPersonalization: { type: Boolean, default: true }
            },

            // Search & Discovery Preferences
            discovery: {
                maxDistance: { type: Number, default: 5000 }, // meters
                preferredCategories: [String],
                excludedCategories: [String],
                minDiscount: { type: Number, default: 0 },
                showExpiringSoon: { type: Boolean, default: true },
                autoSaveSearches: { type: Boolean, default: false }
            }
        }
    })
    preferences?: {
        theme: 'light' | 'dark' | 'auto';
        language: string;
        timezone: string;
        currency: string;
        notifications: {
            email: {
                marketing: boolean;
                orderUpdates: boolean;
                newOffers: boolean;
                weeklyDigest: boolean;
                securityAlerts: boolean;
            };
            push: {
                orderUpdates: boolean;
                nearbyOffers: boolean;
                favoriteStoreOffers: boolean;
                newMessages: boolean;
            };
            sms: {
                orderConfirmation: boolean;
                securityAlerts: boolean;
            };
        };
        privacy: {
            profileVisibility: 'public' | 'friends' | 'private';
            showOnlineStatus: boolean;
            allowDataAnalytics: boolean;
            allowPersonalization: boolean;
        };
        discovery: {
            maxDistance: number;
            preferredCategories: string[];
            excludedCategories: string[];
            minDiscount: number;
            showExpiringSoon: boolean;
            autoSaveSearches: boolean;
        };
    };
}

export const UserSchema = SchemaFactory.createForClass(User);

// ============================================
// 🔧 SCHEMA CONFIGURATION
// ============================================
// Enable virtuals (id getter) in toJSON and toObject output
// This ensures 'id' is available alongside '_id' when serializing
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// ============================================
// 📊 DATABASE INDEXES FOR PERFORMANCE
// ============================================

/**
 * Phone Number Index - Optimizes phone number lookups
 * - Single field index for fast phone number queries
 * - Sparse index (only indexes documents with phoneNumber field)
 * - Supports queries: findOne({ phoneNumber: '+21620123456' })
 */
UserSchema.index({ phoneNumber: 1 }, { sparse: true });

/**
 * Compound Index - Phone Verification Status
 * - Optimizes queries checking phone number AND verification status
 * - Critical for preventing duplicate verified phone numbers
 * - Supports queries: find({ phoneNumber: '...', isPhoneVerified: true })
 */
UserSchema.index({ phoneNumber: 1, isPhoneVerified: 1 }, { sparse: true });

/**
 * Phone Verification Expiration Index
 * - Optimizes cleanup jobs that expire old verification codes
 * - TTL-like behavior for manual cleanup operations
 * - Supports queries: find({ phoneVerificationExpires: { $lt: new Date() } })
 */
UserSchema.index({ phoneVerificationExpires: 1 }, { sparse: true });

/**
 * Email Index - Already has unique constraint, explicit index for queries
 * - Optimizes email lookups during login and registration
 * - Unique index prevents duplicate emails
 */
UserSchema.index({ email: 1 }, { unique: true });

/**
 * Compound Index - User Status and Role
 * - Optimizes admin queries filtering by status and role
 * - Supports queries: find({ status: 'active', role: 'merchant' })
 */
UserSchema.index({ status: 1, role: 1 });

/**
 * Audit Log Timestamp Index
 * - Optimizes rate limiting queries on audit logs
 * - Supports queries: find({ 'auditLog.timestamp': { $gte: oneHourAgo } })
 * - Critical for phone verification rate limiting
 */
UserSchema.index({ 'auditLog.timestamp': 1 });

/**
 * =============================================================================
 * ENTERPRISE-GRADE PERFORMANCE INDEXES
 * =============================================================================
 * Added per production readiness audit recommendations
 */

/**
 * Compound Index - Role + Status + Created
 * - Optimizes admin dashboard queries filtering by role and status
 * - Sorted by creation date for pagination
 * - Supports queries: find({ role: 'merchant', status: 'active' }).sort({ createdAt: -1 })
 * - Query pattern: User management, reporting, analytics
 */
UserSchema.index({ role: 1, status: 1, createdAt: -1 });

/**
 * Soft Delete Index
 * - Optimizes queries excluding soft-deleted users
 * - Sparse index (only documents with deletedAt field)
 * - Supports queries: find({ deletedAt: { $exists: true } })
 * - Query pattern: GDPR compliance, data retention policies
 */
UserSchema.index({ deletedAt: 1 }, { sparse: true });

/**
 * Anonymization Index
 * - Optimizes queries for anonymized users
 * - Supports compliance reporting and data audit trails
 * - Query pattern: find({ isAnonymized: true, anonymizedAt: { $gte: startDate } })
 */
UserSchema.index({ isAnonymized: 1, anonymizedAt: 1 }, { sparse: true });

/**
 * Last Login Activity Index
 * - Optimizes queries for user activity tracking and dormant account detection
 * - Supports queries: find({ lastLoginAt: { $lt: thirtyDaysAgo } })
 * - Query pattern: Re-engagement campaigns, security audits
 */
UserSchema.index({ lastLoginAt: 1 }, { sparse: true });

/**
 * Account Lock Security Index
 * - Optimizes queries checking for locked accounts
 * - Sparse index for active locks only
 * - Supports queries: find({ accountLockedUntil: { $gt: new Date() } })
 * - Query pattern: Security monitoring, automated unlock jobs
 */
UserSchema.index({ accountLockedUntil: 1 }, { sparse: true });

/**
 * Failed Login Attempts Index
 * - Optimizes security queries for accounts approaching lockout
 * - Compound with status for active monitoring
 * - Supports queries: find({ failedLoginAttempts: { $gte: 3 }, status: 'active' })
 * - Query pattern: Brute force detection, security dashboards
 */
UserSchema.index({ failedLoginAttempts: 1, status: 1 });

/**
 * Email Verification Pending Index
 * - Optimizes queries for unverified users
 * - Supports automated reminder emails and cleanup jobs
 * - Query pattern: find({ isEmailVerified: false, createdAt: { $lt: sevenDaysAgo } })
 */
UserSchema.index({ isEmailVerified: 1, createdAt: -1 });

/**
 * Geospatial 2dsphere Index - User Address Coordinates
 * - Enables geospatial queries for user location-based features
 * - Supports $near, $geoWithin, $geoIntersects operators
 * - Query pattern: find({ 'address.coordinates': { $near: { $geometry: point } } })
 * - Use case: User proximity searches, delivery radius calculation
 * - Strategy: Coordinate format [longitude, latitude] per GeoJSON standard
 */
UserSchema.index({ 'address.coordinates.coordinates': '2dsphere' });

/**
 * MFA Status Index
 * - Optimizes queries for MFA-enabled users
 * - Supports security compliance reporting
 * - Query pattern: find({ 'mfaSettings.isEnabled': true })
 */
UserSchema.index({ 'mfaSettings.isEnabled': 1 });

/**
 * Privacy Compliance Index
 * - Optimizes GDPR/CCPA compliance queries
 * - Tracks consent status and data subject rights
 * - Query pattern: find({ 'privacySettings.dataSubjectRights.deletionRequested': true })
 */
UserSchema.index({
    'privacySettings.dataSubjectRights.deletionRequested': 1,
    'privacySettings.dataSubjectRights.dataPortabilityRequested': 1
}, { sparse: true });