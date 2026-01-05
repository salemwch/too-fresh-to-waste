import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum, IsArray, ValidateNested, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetupTotpDto {
    @ApiProperty({ description: 'User ID to setup TOTP for' })
    @IsString()
    @IsNotEmpty()
    userId: string;
}

export class VerifyTotpSetupDto {
    @ApiProperty({ description: 'TOTP token from authenticator app' })
    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    @MaxLength(6)
    token: string;
}

export class VerifyTotpDto {
    @ApiProperty({ description: 'TOTP token or backup code' })
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class DisableMfaDto {
    @ApiProperty({ description: 'Current password to confirm MFA disable' })
    @IsString()
    @IsNotEmpty()
    currentPassword: string;

    @ApiPropertyOptional({ description: 'Reason for disabling MFA' })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class TrustDeviceDto {
    @ApiProperty({ description: 'Device ID to trust' })
    @IsString()
    @IsNotEmpty()
    deviceId: string;

    @ApiProperty({ description: 'Device fingerprint for verification' })
    @IsString()
    @IsNotEmpty()
    deviceFingerprint: string;

    @ApiProperty({ description: 'Human-readable device name' })
    @IsString()
    @IsNotEmpty()
    deviceName: string;

    @ApiProperty({ description: 'Device platform (iOS, Android, Web, etc.)' })
    @IsString()
    @IsNotEmpty()
    platform: string;

    @ApiProperty({ description: 'Browser information' })
    @IsString()
    @IsNotEmpty()
    browser: string;

    @ApiPropertyOptional({
        description: 'Trust duration in days',
        default: 30
    })
    @IsOptional()
    @Type(() => Number)
    trustDurationDays?: number;
}

export class RevokeTrustedDeviceDto {
    @ApiProperty({ description: 'Device ID to revoke trust for' })
    @IsString()
    @IsNotEmpty()
    deviceId: string;

    @ApiPropertyOptional({ description: 'Reason for revoking trust' })
    @IsOptional()
    @IsString()
    reason?: string;
}

export class MfaMethodDto {
    @ApiProperty({
        enum: ['totp', 'sms', 'email', 'backup_codes'],
        description: 'MFA method type'
    })
    @IsEnum(['totp', 'sms', 'email', 'backup_codes'])
    type: 'totp' | 'sms' | 'email' | 'backup_codes';

    @ApiProperty({ description: 'Whether this method is active' })
    @IsBoolean()
    isActive: boolean;

    @ApiProperty({ description: 'Whether this method is verified' })
    @IsBoolean()
    verified: boolean;

    @ApiProperty({ description: 'When this method was created' })
    createdAt: Date;

    @ApiPropertyOptional({ description: 'When this method was last used' })
    @IsOptional()
    lastUsedAt?: Date;
}

export class MfaStatusResponseDto {
    @ApiProperty({ description: 'Whether MFA is enabled for the user' })
    @IsBoolean()
    isEnabled: boolean;

    @ApiProperty({
        type: [MfaMethodDto],
        description: 'List of configured MFA methods'
    })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MfaMethodDto)
    methods: MfaMethodDto[];

    @ApiPropertyOptional({ description: 'Number of remaining backup codes' })
    @IsOptional()
    @Type(() => Number)
    backupCodesCount?: number;
}

export class MfaSetupResponseDto {
    @ApiProperty({ description: 'TOTP secret key' })
    @IsString()
    secret: string;

    @ApiProperty({ description: 'QR code URL for easy setup' })
    @IsString()
    qrCodeUrl: string;

    @ApiProperty({
        type: [String],
        description: 'Backup codes for account recovery'
    })
    @IsArray()
    @IsString({ each: true })
    backupCodes: string[];

    @ApiProperty({ description: 'Manual entry key for authenticator apps' })
    @IsString()
    manualEntryKey: string;
}

export class MfaVerificationResponseDto {
    @ApiProperty({ description: 'Whether verification was successful' })
    @IsBoolean()
    success: boolean;

    @ApiPropertyOptional({ description: 'Whether a backup code was used' })
    @IsOptional()
    @IsBoolean()
    backupCodeUsed?: boolean;

    @ApiPropertyOptional({ description: 'Number of remaining backup codes' })
    @IsOptional()
    @Type(() => Number)
    remainingBackupCodes?: number;
}

export class GenerateBackupCodesResponseDto {
    @ApiProperty({
        type: [String],
        description: 'New backup codes'
    })
    @IsArray()
    @IsString({ each: true })
    backupCodes: string[];

    @ApiProperty({ description: 'Number of codes generated' })
    @Type(() => Number)
    count: number;

    @ApiProperty({ description: 'When the codes were generated' })
    generatedAt: Date;
}