import { Type } from 'class-transformer';
import { IsString, IsOptional, ValidateNested } from 'class-validator';

/**
 * CSP Violation Report DTO
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#violation_report_syntax
 */
class CspReportBodyDto {
  @IsString()
  @IsOptional()
  'document-uri'?: string;

  @IsString()
  @IsOptional()
  referrer?: string;

  @IsString()
  @IsOptional()
  'violated-directive'?: string;

  @IsString()
  @IsOptional()
  'effective-directive'?: string;

  @IsString()
  @IsOptional()
  'original-policy'?: string;

  @IsString()
  @IsOptional()
  disposition?: string;

  @IsString()
  @IsOptional()
  'blocked-uri'?: string;

  @IsString()
  @IsOptional()
  'line-number'?: string;

  @IsString()
  @IsOptional()
  'column-number'?: string;

  @IsString()
  @IsOptional()
  'source-file'?: string;

  @IsString()
  @IsOptional()
  'status-code'?: string;

  @IsString()
  @IsOptional()
  'script-sample'?: string;
}

export class CspReportDto {
  @ValidateNested()
  @Type(() => CspReportBodyDto)
  'csp-report': CspReportBodyDto;
}
