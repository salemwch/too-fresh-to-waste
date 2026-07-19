import { UserRole } from '@foodwaste/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsString,
  IsEmail,
  IsArray,
  MaxLength,
  ArrayMinSize,
} from 'class-validator';

export enum AdminPermission {
  // User management
  USERS_VIEW = 'users:view',
  USERS_EDIT = 'users:edit',
  USERS_SUSPEND = 'users:suspend',
  USERS_DELETE = 'users:delete',

  // Establishment management
  ESTABLISHMENTS_VIEW = 'establishments:view',
  ESTABLISHMENTS_APPROVE = 'establishments:approve',
  ESTABLISHMENTS_SUSPEND = 'establishments:suspend',

  // Order management
  ORDERS_VIEW = 'orders:view',
  ORDERS_CANCEL = 'orders:cancel',
  ORDERS_REFUND = 'orders:refund',

  // Offer management
  OFFERS_VIEW = 'offers:view',
  OFFERS_EDIT = 'offers:edit',
  OFFERS_FEATURE = 'offers:feature',
  OFFERS_DELETE = 'offers:delete',

  // Moderation
  MODERATION_VIEW = 'moderation:view',
  MODERATION_ACTION = 'moderation:action',

  // Analytics
  ANALYTICS_VIEW = 'analytics:view',
  ANALYTICS_EXPORT = 'analytics:export',

  // Notifications
  NOTIFICATIONS_VIEW = 'notifications:view',
  NOTIFICATIONS_BROADCAST = 'notifications:broadcast',

  // Payments
  PAYMENTS_VIEW = 'payments:view',
  PAYMENTS_REFUND = 'payments:refund',

  // Voting & Loyalty
  VOTING_VIEW = 'voting:view',
  VOTING_MANAGE = 'voting:manage',

  // System
  SYSTEM_CONFIG = 'system:config',
  TEAM_MANAGE = 'team:manage',
  AUDIT_VIEW = 'audit:view',
}

export const ADMIN_PERMISSIONS: AdminPermission[] = Object.values(AdminPermission);

export const MODERATOR_DEFAULT_PERMISSIONS: AdminPermission[] = [
  AdminPermission.USERS_VIEW,
  AdminPermission.ESTABLISHMENTS_VIEW,
  AdminPermission.ORDERS_VIEW,
  AdminPermission.OFFERS_VIEW,
  AdminPermission.MODERATION_VIEW,
  AdminPermission.MODERATION_ACTION,
  AdminPermission.NOTIFICATIONS_VIEW,
  AdminPermission.ANALYTICS_VIEW,
  AdminPermission.VOTING_VIEW,
  AdminPermission.AUDIT_VIEW,
];

export class InviteTeamMemberDto {
  @ApiProperty({ description: 'Email of the team member to invite', example: 'mod@example.com' })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'First name', example: 'Jane' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName!: string;

  @ApiProperty({ enum: [UserRole.ADMIN, UserRole.MODERATOR], description: 'Role to assign' })
  @IsNotEmpty()
  @IsEnum([UserRole.ADMIN, UserRole.MODERATOR], {
    message: 'Role must be admin or moderator',
  })
  role!: UserRole.ADMIN | UserRole.MODERATOR;

  @ApiPropertyOptional({
    description: 'Specific permissions to assign (defaults based on role if omitted)',
    enum: AdminPermission,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(AdminPermission, { each: true })
  permissions?: AdminPermission[];
}

export class UpdateTeamMemberRoleDto {
  @ApiProperty({ enum: [UserRole.ADMIN, UserRole.MODERATOR], description: 'New role' })
  @IsNotEmpty()
  @IsEnum([UserRole.ADMIN, UserRole.MODERATOR], {
    message: 'Role must be admin or moderator',
  })
  role!: UserRole.ADMIN | UserRole.MODERATOR;
}

export class UpdateTeamMemberPermissionsDto {
  @ApiProperty({
    description: 'Complete set of permissions to assign',
    enum: AdminPermission,
    isArray: true,
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AdminPermission, { each: true })
  permissions!: AdminPermission[];
}

export class TeamSearchDto {
  @ApiPropertyOptional({ description: 'Search by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: [UserRole.ADMIN, UserRole.MODERATOR] })
  @IsOptional()
  @IsEnum([UserRole.ADMIN, UserRole.MODERATOR])
  role?: UserRole.ADMIN | UserRole.MODERATOR;

  @ApiPropertyOptional({ description: 'Page number', example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20 })
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
