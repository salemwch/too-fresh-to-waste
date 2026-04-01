import { DocumentType } from '@foodwaste/shared';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

// Re-export DocumentType for backward compatibility
export { DocumentType };

/**
 * DTO for verifying a document (admin only)
 */
export class VerifyDocumentDto {
  @ApiProperty({
    enum: DocumentType,
    description: 'Type of document to verify',
    example: DocumentType.BUSINESS_LICENSE,
    required: true,
  })
  @IsEnum(DocumentType, { message: 'Invalid document type' })
  documentType!: DocumentType;

  @ApiProperty({
    description: 'Verification notes',
    example: 'Document verified - valid until 2025',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
