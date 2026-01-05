import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    ParseIntPipe,
    DefaultValuePipe,
    ValidationPipe,
    BadRequestException,
    Logger,
    UseInterceptors,
    UploadedFiles,
    UploadedFile,
} from '@nestjs/common';
import { FilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { EstablishmentsService } from './establishments.service';
import { CreateEstablishmentDto } from './DTO/create-establishment.dto';
import { UpdateEstablishmentDto } from './DTO/update-establishment.dto';
import { SearchEstablishmentsDto } from './DTO/search-establishments.dto';
import { EstablishmentStatus } from './schemas/establishment.schema';
import { ParseFloatPipe } from './float/parse-float.pipe';
import { FirebaseStorageService } from '../common/services/firebase-storage.service';
import { DocumentType, UploadDocumentsDto, VerifyDocumentDto } from './DTO/upload-documents.dto';

@ApiTags('🏪 Establishments Management')
@Controller('establishments')
@UseGuards(JwtAuthGuard)
export class EstablishmentsController {
    constructor(
        private readonly establishmentsService: EstablishmentsService,
        private readonly firebaseStorageService: FirebaseStorageService,
    ) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT)
    @UseInterceptors(FilesInterceptor('images', 8))
    @ApiOperation({
        summary: '🏪 Create New Establishment',
        description: 'Register a new food establishment with images. Merchants can upload up to 8 images (storefront, interior, menu, etc.)'
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({
        status: 201,
        description: '✅ Establishment created successfully',
        schema: {
            example: {
                message: 'Establishment created successfully. Pending admin approval.',
                data: {
                    id: '507f1f77bcf86cd799439011',
                    name: 'Fresh Corner Bakery',
                    description: 'Artisanal bakery serving fresh bread and pastries daily',
                    type: 'bakery',
                    status: 'pending',
                    images: [
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/storefront_1625097600000_abc123.jpg',
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/interior_1625097600000_def456.jpg'
                    ],
                    address: {
                        street: '123 Main Street',
                        city: 'Paris',
                        postalCode: '75001',
                        country: 'France'
                    }
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ Invalid establishment data or image upload failed' })
    @ApiResponse({ status: 401, description: '❌ Unauthorized' })
    @ApiResponse({ status: 403, description: '❌ Forbidden - Only merchants can create establishments' })
    @HttpCode(HttpStatus.CREATED)
    async create(
        @Body() createEstablishmentDto: CreateEstablishmentDto,
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
    ) {
        const logger = new Logger('EstablishmentsController');

        try {
            logger.debug('Received createEstablishmentDto:');
            logger.debug(JSON.stringify(createEstablishmentDto, null, 2));

            let imageUrls: string[] = [];

            // Upload images to Firebase Storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.firebaseStorageService.uploadFiles(files, {
                    folder: 'establishments',
                    makePublic: true,
                    imageProcessing: {
                        maxWidth: 1000,
                        maxHeight: 750,
                        quality: 85,
                        format: 'jpeg',
                    },
                    metadata: {
                        uploadedBy: req.user.userId,
                        category: 'establishment-image',
                        establishmentName: createEstablishmentDto.name,
                        establishmentType: createEstablishmentDto.type,
                    },
                });

                imageUrls = uploadResults.map(result => result.downloadURL);
                logger.debug(`Uploaded ${imageUrls.length} images for establishment`);
            }

            // Create establishment with uploaded image URLs
            const establishmentData = {
                ...createEstablishmentDto,
                images: imageUrls,
            };

            const establishment = await this.establishmentsService.create(
                establishmentData,
                req.user.userId,
            );

            logger.debug('Establishment created successfully:', JSON.stringify(establishment, null, 2));

            return {
                message: 'Establishment created successfully. Pending admin approval.',
                data: establishment,
            };
        } catch (error) {
            logger.error('Failed to create establishment', (error as Error).stack || error);
            throw new BadRequestException((error as Error).message || 'Failed to create establishment');
        }
    }

    @Get()
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query(new ValidationPipe({ transform: true })) filters: SearchEstablishmentsDto,
    ) {
        const result = await this.establishmentsService.findAll(page, limit, filters);

        return {
            message: 'Establishments retrieved successfully',
            data: result.establishments,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get('my-establishment')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT)
    async getMyEstablishment(@Request() req) {
        const establishments = await this.establishmentsService.findByOwnerId(
            req.user.userId,
        );

        return {
            message: 'Your establishments retrieved successfully',
            data: establishments,
        };
    }

    @Get('nearby')
    async findNearby(
        @Query('longitude', ParseFloatPipe) longitude: number,
        @Query('latitude', ParseFloatPipe) latitude: number,
        @Query('maxDistance', new DefaultValuePipe(5000), ParseIntPipe) maxDistance: number,
    ) {
        const establishments = await this.establishmentsService.getNearby(
            longitude,
            latitude,
            maxDistance,
        );

        return {
            message: 'Nearby establishments retrieved successfully',
            data: establishments,
        };
    }

    @Get('pending')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async getPendingEstablishments(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        const result = await this.establishmentsService.findAll(
            page,
            limit,
            { status: EstablishmentStatus.PENDING },
        );

        return {
            message: 'Pending establishments retrieved successfully',
            data: result.establishments,
            meta: {
                page,
                limit,
                total: result.total,
                totalPages: Math.ceil(result.total / limit),
            },
        };
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const establishment = await this.establishmentsService.findById(id);

        return {
            message: 'Establishment retrieved successfully',
            data: establishment,
        };
    }

    @Get(':id/stats')
    async getStats(@Param('id') id: string, @Request() req) {
        const establishment = await this.establishmentsService.findById(id);

        // Check if user can access stats (owner or admin)
        if (
            req.user.role !== UserRole.ADMIN &&
            establishment.ownerId.toString() !== req.user.userId
        ) {
            return {
                message: 'Access denied',
                data: null,
            };
        }

        const stats = await this.establishmentsService.getStats(id);

        return {
            message: 'Establishment stats retrieved successfully',
            data: stats,
        };
    }

    @Patch(':id')
    @UseInterceptors(FilesInterceptor('images', 8))
    @ApiOperation({
        summary: '✏️ Update Establishment',
        description: 'Update an existing establishment with optional new images. New images will be added to existing ones.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({
        status: 200,
        description: '✅ Establishment updated successfully',
        schema: {
            example: {
                message: 'Establishment updated successfully',
                data: {
                    id: '507f1f77bcf86cd799439011',
                    name: 'Updated Bakery Name',
                    images: [
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/storefront_1625097600000_abc123.jpg',
                        'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/new_interior_1625097700000_def456.jpg'
                    ]
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ Invalid update data' })
    @ApiResponse({ status: 403, description: '❌ Not authorized to update this establishment' })
    @ApiResponse({ status: 404, description: '❌ Establishment not found' })
    async update(
        @Param('id') id: string,
        @Body() updateEstablishmentDto: UpdateEstablishmentDto,
        @UploadedFiles() files: Express.Multer.File[],
        @Request() req,
    ) {
        try {
            let newImageUrls: string[] = [];

            // Upload new images to Firebase Storage if provided
            if (files && files.length > 0) {
                const uploadResults = await this.firebaseStorageService.uploadFiles(files, {
                    folder: 'establishments',
                    makePublic: true,
                    imageProcessing: {
                        maxWidth: 1000,
                        maxHeight: 750,
                        quality: 85,
                        format: 'jpeg',
                    },
                    metadata: {
                        uploadedBy: req.user.userId,
                        category: 'establishment-image-update',
                        establishmentId: id,
                    },
                });

                newImageUrls = uploadResults.map(result => result.downloadURL);
            }

            // Combine existing and new images
            const updateData = {
                ...updateEstablishmentDto,
                ...(newImageUrls.length > 0 && {
                    images: [...(updateEstablishmentDto.images || []), ...newImageUrls],
                }),
            };

            const updatedEstablishment = await this.establishmentsService.update(
                id,
                updateData,
                req.user.userId,
                req.user.role,
            );

            return {
                message: 'Establishment updated successfully',
                data: updatedEstablishment,
            };
        } catch (error) {
            throw error;
        }
    }

    @Patch(':id/status')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async updateStatus(
        @Param('id') id: string,
        @Body('status') status: EstablishmentStatus,
        @Body('rejectionReason') rejectionReason?: string,
    ) {
        const updatedEstablishment = await this.establishmentsService.updateStatus(
            id,
            status,
            rejectionReason,
        );

        return {
            message: 'Establishment status updated successfully',
            data: updatedEstablishment,
        };
    }

    @Patch(':id/verify')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async verifyEstablishment(@Param('id') id: string) {
        const updatedEstablishment = await this.establishmentsService.updateStatus(
            id,
            EstablishmentStatus.ACTIVE,
        );

        return {
            message: 'Establishment verified successfully',
            data: updatedEstablishment,
        };
    }

    @Patch(':id/reject')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    async rejectEstablishment(
        @Param('id') id: string,
        @Body('reason') reason: string,
    ) {
        const updatedEstablishment = await this.establishmentsService.updateStatus(
            id,
            EstablishmentStatus.REJECTED,
            reason,
        );

        return {
            message: 'Establishment rejected successfully',
            data: updatedEstablishment,
        };
    }

    @Post(':id/documents')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT, UserRole.ADMIN)
    @UseInterceptors(FileInterceptor('document'))
    @ApiOperation({
        summary: '📄 Upload Legal Document',
        description: 'Upload a legal document (business license, food safety certificate, etc.) for an establishment. Merchants can only upload to their own establishments.'
    })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({
        status: 201,
        description: '✅ Document uploaded successfully',
        schema: {
            example: {
                success: true,
                message: 'Business license uploaded successfully',
                document: {
                    type: 'business_license',
                    url: 'https://storage.googleapis.com/.../business_license_123.pdf',
                    fileName: 'business_license.pdf',
                    fileSize: 245760,
                    mimeType: 'application/pdf',
                    uploadedAt: '2025-10-26T10:30:00.000Z',
                    verified: false
                }
            }
        }
    })
    @ApiResponse({ status: 400, description: '❌ Invalid document or file type' })
    @ApiResponse({ status: 403, description: '❌ Forbidden - Can only upload to own establishment' })
    @ApiResponse({ status: 404, description: '❌ Establishment not found' })
    @HttpCode(HttpStatus.CREATED)
    async uploadDocument(
        @Param('id') id: string,
        @Body('documentType') documentType: DocumentType,
        @Body('expiryDate') expiryDate: string,
        @Body('notes') notes: string,
        @UploadedFile() file: Express.Multer.File,
        @Request() req,
    ) {
        const logger = new Logger('EstablishmentsController');

        try {
            // Validate file exists
            if (!file) {
                throw new BadRequestException('No document file provided');
            }

            // Validate document type
            if (!Object.values(DocumentType).includes(documentType)) {
                throw new BadRequestException('Invalid document type');
            }

            // Validate file type (only PDFs for legal documents)
            if (file.mimetype !== 'application/pdf') {
                throw new BadRequestException('Only PDF documents are allowed for legal documents');
            }

            logger.debug(`Uploading ${documentType} for establishment ${id}`);

            // Upload to Firebase Storage
            const uploadResult = await this.firebaseStorageService.uploadFile(file, {
                folder: `establishments/${id}/documents`,
                makePublic: false, // Keep documents private
                metadata: {
                    uploadedBy: req.user.userId,
                    category: 'legal-document',
                    documentType,
                    establishmentId: id,
                },
            });

            logger.debug(`Document uploaded: ${uploadResult.downloadURL}`);

            // Save document reference in database
            const updatedEstablishment = await this.establishmentsService.uploadDocument(
                id,
                documentType,
                uploadResult.downloadURL,
                {
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.size,
                    mimeType: uploadResult.mimeType,
                    uploadedBy: req.user.userId,
                    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                    notes,
                },
                req.user.userId,
                req.user.role,
            );

            return {
                success: true,
                message: `${documentType.replace(/_/g, ' ')} uploaded successfully`,
                document: {
                    type: documentType,
                    url: uploadResult.downloadURL,
                    fileName: uploadResult.fileName,
                    fileSize: uploadResult.size,
                    mimeType: uploadResult.mimeType,
                    uploadedAt: new Date(),
                    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
                    notes,
                    verified: false,
                },
                establishment: {
                    id: updatedEstablishment._id,
                    name: updatedEstablishment.name,
                    status: updatedEstablishment.status,
                },
            };
        } catch (error) {
            logger.error('Failed to upload document', (error as Error).stack || error);
            throw error;
        }
    }

    @Patch(':id/documents/:documentType/verify')
    @UseGuards(RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: '✅ Verify Document (Admin Only)',
        description: 'Mark a legal document as verified after review. Only admins can verify documents.'
    })
    @ApiResponse({
        status: 200,
        description: '✅ Document verified successfully',
    })
    @ApiResponse({ status: 400, description: '❌ Document not found or invalid type' })
    @ApiResponse({ status: 403, description: '❌ Forbidden - Admin only' })
    async verifyDocument(
        @Param('id') id: string,
        @Param('documentType') documentType: DocumentType,
        @Body() verifyDto: VerifyDocumentDto,
        @Request() req,
    ) {
        const updatedEstablishment = await this.establishmentsService.verifyDocument(
            id,
            documentType,
            req.user.userId,
            verifyDto.notes,
        );

        return {
            success: true,
            message: `${documentType.replace(/_/g, ' ')} verified successfully`,
            establishment: {
                id: updatedEstablishment._id,
                name: updatedEstablishment.name,
                status: updatedEstablishment.status,
            },
        };
    }

    @Delete(':id/documents/:documentType')
    @UseGuards(RolesGuard)
    @Roles(UserRole.MERCHANT, UserRole.ADMIN)
    @ApiOperation({
        summary: '🗑️ Delete Document',
        description: 'Delete a legal document from an establishment. Merchants can only delete from their own establishments.'
    })
    @ApiResponse({
        status: 200,
        description: '✅ Document deleted successfully',
    })
    @ApiResponse({ status: 403, description: '❌ Forbidden - Can only delete from own establishment' })
    @ApiResponse({ status: 404, description: '❌ Establishment or document not found' })
    async deleteDocument(
        @Param('id') id: string,
        @Param('documentType') documentType: DocumentType,
        @Request() req,
    ) {
        await this.establishmentsService.deleteDocument(
            id,
            documentType,
            req.user.userId,
            req.user.role,
        );

        return {
            success: true,
            message: `${documentType.replace(/_/g, ' ')} deleted successfully`,
        };
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@Param('id') id: string, @Request() req) {
        await this.establishmentsService.remove(id, req.user.userId, req.user.role);

        return {
            message: 'Establishment deleted successfully',
        };
    }
}