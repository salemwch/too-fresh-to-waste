import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * User-Specific Permission Overrides
 * Allows granting additional permissions to individual users beyond their role
 *
 * Use Cases:
 * - Temporary elevated access
 * - Exception-based permissions
 * - Trial permissions for new features
 * - Custom merchant permissions
 */

export type UserPermissionDocument = UserPermission & Document;

@Schema({ timestamps: true })
export class UserPermission {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Permission', required: true })
    permissionId: Types.ObjectId;

    @Prop({ required: true, enum: ['grant', 'revoke'] })
    type: 'grant' | 'revoke'; // Grant additional or revoke existing

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    validFrom?: Date;

    @Prop()
    validUntil?: Date;

    @Prop()
    reason?: string; // Why was this permission granted/revoked?

    @Prop({ type: Types.ObjectId, ref: 'User' })
    grantedBy?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    revokedBy?: Types.ObjectId;

    @Prop()
    revokedAt?: Date;

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    createdAt?: Date;
    updatedAt?: Date;
}

export const UserPermissionSchema = SchemaFactory.createForClass(UserPermission);

// Indexes for efficient permission lookups
UserPermissionSchema.index({ userId: 1, isActive: 1 });
UserPermissionSchema.index({ userId: 1, permissionId: 1 });
UserPermissionSchema.index({ userId: 1, type: 1, isActive: 1 });
UserPermissionSchema.index({ validUntil: 1 }); // For cleanup jobs
