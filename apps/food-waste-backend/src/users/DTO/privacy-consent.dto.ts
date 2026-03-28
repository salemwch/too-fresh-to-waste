// 🇹🇳 Tunisia + 🌍 International Privacy Consent DTOs
// Compliant with Tunisian Law No. 2004-63 and GDPR/CCPA

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsString,
  IsArray,
  IsOptional,
  IsDateString,
  IsNumber,
  IsIP,
  ValidateNested,
  ArrayMinSize,
  Length,
  IsObject,
} from 'class-validator';

import { ConsentType, ConsentStatus, LegalBasis } from '../interfaces/privacy-consent.interface';

export class ConsentRecordDto {
  @ApiProperty({ enum: ConsentType, description: 'Type of consent' })
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @ApiProperty({ enum: ConsentStatus, description: 'Consent status' })
  @IsEnum(ConsentStatus)
  status!: ConsentStatus;

  @ApiProperty({ enum: LegalBasis, description: 'Legal basis for processing' })
  @IsEnum(LegalBasis)
  legalBasis!: LegalBasis;

  @ApiProperty({ description: 'When consent was given' })
  @IsDateString()
  givenAt!: string;

  @ApiPropertyOptional({ description: 'When consent was withdrawn' })
  @IsOptional()
  @IsDateString()
  withdrawnAt?: string;

  @ApiPropertyOptional({ description: 'When consent expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ description: 'IP address when consent was given' })
  @IsIP()
  ipAddress!: string;

  @ApiProperty({ description: 'User agent when consent was given' })
  @IsString()
  @Length(1, 500)
  userAgent!: string;

  @ApiProperty({ description: 'Consent version/policy version' })
  @IsString()
  @Length(1, 50)
  consentVersion!: string;

  @ApiProperty({ description: 'Purpose for data processing' })
  @IsString()
  @Length(1, 200)
  processingPurpose!: string;

  @ApiProperty({ description: 'Categories of data being processed' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  dataCategories!: string[];

  @ApiProperty({ description: 'Retention period in days' })
  @IsNumber()
  retentionPeriod!: number;

  @ApiPropertyOptional({ description: 'Third parties that will receive data' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  thirdParties?: string[];
}

// 🇹🇳 Tunisia Base Compliance DTO
export class TunisianPrivacyConsentDto {
  @ApiProperty({
    description: '🇹🇳 Consent for personal data processing (required by Tunisian Law)',
  })
  @IsBoolean()
  dataProcessingConsent!: boolean;

  @ApiProperty({ description: '🇹🇳 Consent for location tracking (GPS data)' })
  @IsBoolean()
  locationTrackingConsent!: boolean;

  @ApiProperty({ description: '🇹🇳 Consent for communications (email, SMS)' })
  @IsBoolean()
  communicationConsent!: boolean;

  @ApiProperty({ description: 'Legal basis for processing', enum: LegalBasis })
  @IsEnum(LegalBasis)
  legalBasis!: LegalBasis;

  @ApiProperty({ description: 'IP address for consent record' })
  @IsIP()
  ipAddress!: string;

  @ApiProperty({ description: 'User agent for consent record' })
  @IsString()
  userAgent!: string;

  @ApiProperty({ description: 'Consent version' })
  @IsString()
  consentVersion!: string;
}

// 🌍 International Extended Compliance DTO
export class InternationalPrivacyConsentDto extends TunisianPrivacyConsentDto {
  @ApiProperty({ description: '🌍 Marketing communications opt-in (GDPR/CCPA)' })
  @IsBoolean()
  marketingOptIn!: boolean;

  @ApiProperty({ description: '🌍 Analytics and tracking opt-in' })
  @IsBoolean()
  analyticsOptIn!: boolean;

  @ApiProperty({ description: '🌍 Third-party data sharing consent' })
  @IsBoolean()
  thirdPartySharing!: boolean;

  @ApiProperty({ description: '🌍 Profiling and automated decision-making consent' })
  @IsBoolean()
  profilingOptIn!: boolean;

  @ApiProperty({ description: '🌍 Cookies and similar technologies consent' })
  @IsBoolean()
  cookiesConsent!: boolean;
}

export class UpdatePrivacySettingsDto {
  @ApiPropertyOptional({ type: TunisianPrivacyConsentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TunisianPrivacyConsentDto)
  tunisianCompliance?: TunisianPrivacyConsentDto;

  @ApiPropertyOptional({ type: InternationalPrivacyConsentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InternationalPrivacyConsentDto)
  internationalCompliance?: InternationalPrivacyConsentDto;
}

export class DataExportRequestDto {
  @ApiProperty({
    description: 'Export format',
    enum: ['json', 'csv', 'xml'],
    default: 'json',
  })
  @IsEnum(['json', 'csv', 'xml'])
  format!: 'json' | 'csv' | 'xml';

  @ApiPropertyOptional({
    description: 'Include activity data (location history, login logs)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeActivityData?: boolean;

  @ApiPropertyOptional({
    description: 'Include application data (orders, favorites, reviews)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeApplicationData?: boolean;

  @ApiPropertyOptional({
    description: 'Legal basis for export request',
    enum: ['data_portability', 'access_request', 'legal_obligation'],
  })
  @IsOptional()
  @IsEnum(['data_portability', 'access_request', 'legal_obligation'])
  legalBasis?: string;
}

export class DataDeletionRequestDto {
  @ApiProperty({ description: 'Reason for deletion request' })
  @IsString()
  @Length(10, 500)
  reason!: string;

  @ApiProperty({
    description: 'Type of deletion',
    enum: ['soft_delete', 'anonymization', 'complete_deletion'],
  })
  @IsEnum(['soft_delete', 'anonymization', 'complete_deletion'])
  deletionType!: 'soft_delete' | 'anonymization' | 'complete_deletion';

  @ApiPropertyOptional({
    description: '🇹🇳 Keep minimal data for legal obligations (Tunisia Law)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  retainLegalData?: boolean;

  @ApiPropertyOptional({
    description: 'Immediate processing (affects retention periods)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  immediateProcessing?: boolean;
}

export class ConsentWithdrawalDto {
  @ApiProperty({ enum: ConsentType, description: 'Type of consent to withdraw' })
  @IsEnum(ConsentType)
  consentType!: ConsentType;

  @ApiProperty({ description: 'Reason for withdrawal' })
  @IsString()
  @Length(5, 200)
  reason!: string;

  @ApiProperty({ description: 'IP address for withdrawal record' })
  @IsIP()
  ipAddress!: string;

  @ApiProperty({ description: 'User agent for withdrawal record' })
  @IsString()
  userAgent!: string;

  @ApiPropertyOptional({
    description: 'Stop all related processing immediately',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  stopProcessingImmediately?: boolean;
}

export class PrivacySettingsResponseDto {
  @ApiProperty({ description: 'Current privacy settings' })
  @IsObject()
  privacySettings!: Record<string, unknown>;

  @ApiProperty({ description: 'Consent history' })
  @IsArray()
  consentHistory!: ConsentRecordDto[];

  @ApiProperty({ description: 'Data processing records' })
  @IsArray()
  dataProcessingRecords!: Record<string, unknown>[];

  @ApiProperty({ description: 'Available rights and actions' })
  @IsObject()
  availableRights!: {
    canExportData: boolean;
    canDeleteAccount: boolean;
    canWithdrawConsent: boolean;
    canRestrictProcessing: boolean;
    canPortData: boolean;
  };

  @ApiProperty({ description: 'Compliance status' })
  @IsObject()
  complianceStatus!: {
    tunisia: {
      compliant: boolean;
      missingConsents: string[];
    };
    international: {
      gdpr: { compliant: boolean; missingConsents: string[] };
      ccpa: { compliant: boolean; missingConsents: string[] };
    };
  };
}
