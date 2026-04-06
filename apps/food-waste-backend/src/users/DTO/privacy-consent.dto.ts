// Tunisia + International Privacy Consent DTOs
// Compliant with Tunisian Law No. 2004-63 and GDPR/CCPA

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsString,
  IsOptional,
  IsIP,
  ValidateNested,
  Length,
} from 'class-validator';

import { ConsentType, LegalBasis } from '@foodwaste/shared';
import type {
  TunisianPrivacyConsentInput,
  InternationalPrivacyConsentInput,
  UpdatePrivacySettingsInput,
  DataExportRequestInput,
  DataDeletionRequestInput,
  ConsentWithdrawalInput,
} from '@foodwaste/shared';

// Tunisia Base Compliance DTO
export class TunisianPrivacyConsentDto implements TunisianPrivacyConsentInput {
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

// International Extended Compliance DTO
export class InternationalPrivacyConsentDto
  extends TunisianPrivacyConsentDto
  implements InternationalPrivacyConsentInput
{
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

export class UpdatePrivacySettingsDto implements UpdatePrivacySettingsInput {
  @ApiPropertyOptional({ type: TunisianPrivacyConsentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TunisianPrivacyConsentDto)
  tunisianCompliance?: TunisianPrivacyConsentDto | undefined;

  @ApiPropertyOptional({ type: InternationalPrivacyConsentDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => InternationalPrivacyConsentDto)
  internationalCompliance?: InternationalPrivacyConsentDto | undefined;
}

export class DataExportRequestDto implements DataExportRequestInput {
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
  includeActivityData?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Include application data (orders, favorites, reviews)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  includeApplicationData?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Legal basis for export request',
    enum: ['data_portability', 'access_request', 'legal_obligation'],
  })
  @IsOptional()
  @IsEnum(['data_portability', 'access_request', 'legal_obligation'])
  legalBasis?: 'data_portability' | 'access_request' | 'legal_obligation' | undefined;
}

export class DataDeletionRequestDto implements DataDeletionRequestInput {
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
    description: 'Keep minimal data for legal obligations (Tunisia Law)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  retainLegalData?: boolean | undefined;

  @ApiPropertyOptional({
    description: 'Immediate processing (affects retention periods)',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  immediateProcessing?: boolean | undefined;
}

export class ConsentWithdrawalDto implements ConsentWithdrawalInput {
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
  stopProcessingImmediately?: boolean | undefined;
}
