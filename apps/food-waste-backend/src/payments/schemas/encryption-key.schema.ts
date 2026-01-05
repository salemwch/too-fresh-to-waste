import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EncryptionKeyDocument = EncryptionKey & Document & {
    createdAt: Date;
    updatedAt: Date;
};

export enum KeyStatus {
    ACTIVE = 'active',
    EXPIRED = 'expired',
    REVOKED = 'revoked',
    ROTATED = 'rotated'
}

export enum KeyType {
    PAYMENT_ENCRYPTION = 'payment_encryption',
    HSM_REFERENCE = 'hsm_reference',
    DERIVED_KEY = 'derived_key'
}

@Schema({
    timestamps: true,
    collection: 'encryption_keys',
    // Ensure sensitive data is not accidentally exposed
    toJSON: {
        transform: function(doc: any, ret: any) {
            delete ret.encryptedKey;
            delete ret.salt;
            delete ret.__v;
            return ret;
        }
    },
    toObject: {
        transform: function(doc: any, ret: any) {
            delete ret.encryptedKey;
            delete ret.salt;
            delete ret.__v;
            return ret;
        }
    }
})
export class EncryptionKey {
    @Prop({
        required: true,
        unique: true,
        index: true,
        maxlength: 128
    })
    keyId: string;

    @Prop({
        required: true,
        enum: Object.values(KeyStatus),
        default: KeyStatus.ACTIVE,
        index: true
    })
    status: KeyStatus;

    @Prop({
        required: true,
        enum: Object.values(KeyType),
        default: KeyType.PAYMENT_ENCRYPTION
    })
    keyType: KeyType;

    @Prop({
        required: true,
        maxlength: 64
    })
    merchantId: string;

    @Prop({
        required: true,
        maxlength: 32
    })
    environment: string;

    // Encrypted key material (never stored in plain text)
    @Prop({
        required: function(this: EncryptionKey) {
            return this.keyType !== KeyType.HSM_REFERENCE;
        },
        select: false // Never include in queries by default
    })
    encryptedKey: string;

    // Additional salt for key derivation
    @Prop({
        required: function(this: EncryptionKey) {
            return this.keyType === KeyType.DERIVED_KEY;
        },
        select: false
    })
    salt: string;

    // HSM key reference (when using HSM)
    @Prop({
        required: function(this: EncryptionKey) {
            return this.keyType === KeyType.HSM_REFERENCE;
        },
        maxlength: 256
    })
    hsmKeyId: string;

    @Prop({
        maxlength: 64
    })
    hsmProvider: string;

    @Prop({
        required: true
    })
    expiresAt: Date;

    @Prop()
    rotatedAt: Date;

    @Prop({
        maxlength: 128
    })
    rotatedToKeyId: string;

    @Prop({
        maxlength: 128
    })
    previousKeyId: string;

    @Prop({
        required: true,
        min: 1,
        max: 10
    })
    version: number;

    // Audit fields
    @Prop({
        maxlength: 128
    })
    createdBy: string;

    @Prop()
    lastAccessedAt: Date;

    @Prop({
        default: 0,
        min: 0
    })
    accessCount: number;

    @Prop()
    revokedAt: Date;

    @Prop({
        maxlength: 256
    })
    revokeReason: string;

    @Prop({
        maxlength: 128
    })
    revokedBy: string;

    // Security metadata
    @Prop({
        required: true,
        maxlength: 32
    })
    algorithm: string;

    @Prop({
        required: true,
        min: 16,
        max: 64
    })
    keySize: number;

    @Prop({
        required: true,
        maxlength: 64
    })
    derivationMethod: string;

    @Prop({
        default: {},
        type: Object
    })
    metadata: Record<string, any>;
}

export const EncryptionKeySchema = SchemaFactory.createForClass(EncryptionKey);

// Create indexes for performance and security
EncryptionKeySchema.index({ keyId: 1, merchantId: 1 }, { unique: true });
EncryptionKeySchema.index({ status: 1, expiresAt: 1 });
EncryptionKeySchema.index({ merchantId: 1, status: 1, expiresAt: 1 });
EncryptionKeySchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 1 year TTL

// Add security middleware
EncryptionKeySchema.pre('save', function(next) {
    // Update access tracking
    if (this.isModified('lastAccessedAt')) {
        this.accessCount = (this.accessCount || 0) + 1;
    }

    // Auto-expire old keys
    if (this.status === KeyStatus.ACTIVE && this.expiresAt < new Date()) {
        this.status = KeyStatus.EXPIRED;
    }

    next();
});

// Prevent accidental deletion
EncryptionKeySchema.pre('deleteOne', function(next) {
    const error = new Error('Direct deletion of encryption keys is not allowed. Use revocation instead.');
    next(error);
});

EncryptionKeySchema.pre('deleteMany', function(next) {
    const error = new Error('Bulk deletion of encryption keys is not allowed. Use revocation instead.');
    next(error);
});