import { IsEnum, IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../../common/enums/establishment.enum';

// Re-export DocumentType for backward compatibility
export { DocumentType };

/**
 * DTO for uploading legal documents to an establishment
 * Supports multiple document types with metadata
 */
export class UploadDocumentsDto {
    @ApiProperty({
        enum: DocumentType,
        description: 'Type of document being uploaded',
        example: DocumentType.BUSINESS_LICENSE,
        required: true,
    })
    @IsEnum(DocumentType, { message: 'Invalid document type' })
    documentType: DocumentType;

    @ApiProperty({
        description: 'Document expiry date (if applicable)',
        example: '2025-12-31',
        required: false,
    })
    @IsOptional()
    @IsDateString({}, { message: 'Expiry date must be a valid date string (YYYY-MM-DD)' })
    expiryDate?: string;

    @ApiProperty({
        description: 'Additional notes about the document',
        example: 'Valid for food handling and preparation',
        maxLength: 500,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(500, { message: 'Notes cannot exceed 500 characters' })
    notes?: string;

    @ApiProperty({
        description: 'Additional document type label (only for ADDITIONAL type)',
        example: 'Health inspection certificate',
        maxLength: 100,
        required: false,
    })
    @IsOptional()
    @IsString()
    @MaxLength(100, { message: 'Additional type cannot exceed 100 characters' })
    additionalType?: string;

    @ApiProperty({
        type: 'string',
        format: 'binary',
        description: 'Document file (PDF, max 5MB)',
        required: true,
    })
    document: Express.Multer.File; // Multer will handle this
}

/**
 * Response DTO for successful document upload
 */
export interface UploadDocumentResponse {
    success: boolean;
    message: string;
    document: {
        type: DocumentType;
        url: string;
        fileName: string;
        fileSize: number;
        mimeType: string;
        uploadedAt: Date;
        expiryDate?: Date;
        notes?: string;
    };
}

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
    documentType: DocumentType;

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
