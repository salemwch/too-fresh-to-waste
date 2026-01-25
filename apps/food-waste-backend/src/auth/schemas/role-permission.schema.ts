import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UserRole } from 'src/common/enums/user.enum';

/**
 * Role-Permission Mapping Schema
 * Maps roles to their allowed permissions with optional constraints
 *
 * Supports:
 * - Permission assignment to roles
 * - Time-based permission validity
 * - Conditional permissions (e.g., only during business hours)
 * - Permission delegation
 */

export type RolePermissionDocument = RolePermission & Document;

@Schema({ timestamps: true })
export class RolePermission {
    @Prop({ type: String, enum: UserRole, required: true, index: true })
    role: UserRole;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }], required: true })
    permissions: Types.ObjectId[];

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    validFrom?: Date;

    @Prop()
    validUntil?: Date;

    @Prop({ type: Object })
    constraints?: {
        // IP restrictions
        allowedIPs?: string[];
        blockedIPs?: string[];

        // Time restrictions
        allowedHours?: {
            start: string; // "09:00"
            end: string;   // "18:00"
        };
        allowedDays?: string[]; // ["monday", "tuesday", ...]

        // Resource limits
        maxResourcesPerDay?: number;
        maxActionsPerHour?: number;

        // Approval requirements
        requiresApproval?: boolean;
        approverRole?: UserRole;
    };

    @Prop()
    grantedBy?: Types.ObjectId; // User who granted these permissions

    @Prop()
    grantedAt?: Date;

    @Prop({ type: Object })
    metadata?: Record<string, any>;

    createdAt?: Date;
    updatedAt?: Date;
}

export const RolePermissionSchema = SchemaFactory.createForClass(RolePermission);

// Indexes for efficient lookups
RolePermissionSchema.index({ role: 1, isActive: 1 });
RolePermissionSchema.index({ role: 1, permissions: 1 });
