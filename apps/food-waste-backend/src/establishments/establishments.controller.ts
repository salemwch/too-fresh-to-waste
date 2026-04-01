import { UserRole } from '@foodwaste/shared';
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
import { AuthenticatedRequest } from '../common/decorators/get-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseStorageService } from '../common/services/supabase-storage.service';
import { QueryOptimizer } from '../common/utils/query-optimization.util';

import { CreateEstablishmentDto } from './DTO/create-establishment.dto';
import { mapToSafeEstablishmentResponse } from './DTO/safe-establishment-response.dto';
import { SearchEstablishmentsDto } from './DTO/search-establishments.dto';
import { UpdateEstablishmentDto } from './DTO/update-establishment.dto';
import { DocumentType, VerifyDocumentDto } from './DTO/upload-documents.dto';
import { EstablishmentsService } from './establishments.service';
import { ParseFloatPipe } from './float/parse-float.pipe';
import { EstablishmentStatus } from './schemas/establishment.schema';

@ApiTags('🏪 Establishments Management')
@Controller('establishments')
@UseGuards(JwtAuthGuard)
export class EstablishmentsController {
  constructor(
    private readonly establishmentsService: EstablishmentsService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  /**
   * Public endpoint — no JWT required.
   * Called during merchant signup to verify a Google Place ID is not already
   * claimed by an active, admin-approved establishment.
   */
  @Get('check-place/:placeId')
  @Public()
  @ApiOperation({
    summary: '🔍 Check if a Google Place is already registered',
    description:
      'Returns { available: true } when the place can be registered. Returns { available: false } when an active, verified establishment already owns it.',
  })
  @ApiResponse({ status: 200, description: 'Availability result' })
  async checkPlaceAvailability(
    @Param('placeId') placeId: string,
  ): Promise<{ data: { available: boolean; message?: string } }> {
    if (!placeId?.trim()) {
      return { data: { available: false, message: 'Invalid place ID' } };
    }
    const taken = await this.establishmentsService.isGooglePlaceRegistered(placeId.trim());
    if (taken) {
      return {
        data: {
          available: false,
          message:
            'This business location is already registered on our platform. If you own this business, please contact support.',
        },
      };
    }
    return { data: { available: true } };
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  @UseInterceptors(FilesInterceptor('images', 8))
  @ApiOperation({
    summary: '🏪 Create New Establishment',
    description:
      'Register a new food establishment with images. Merchants can upload up to 8 images (storefront, interior, menu, etc.)',
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
            'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/interior_1625097600000_def456.jpg',
          ],
          address: {
            street: '123 Main Street',
            city: 'Paris',
            postalCode: '75001',
            country: 'France',
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '❌ Invalid establishment data or image upload failed' })
  @ApiResponse({ status: 401, description: '❌ Unauthorized' })
  @ApiResponse({
    status: 403,
    description: '❌ Forbidden - Only merchants can create establishments',
  })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createEstablishmentDto: CreateEstablishmentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: AuthenticatedRequest,
  ) {
    const logger = new Logger('EstablishmentsController');

    try {
      logger.debug('Received createEstablishmentDto:');
      logger.debug(JSON.stringify(createEstablishmentDto, null, 2));
      logger.debug(`Received files: ${files ? files.length : 0}`);
      if (files && files.length > 0) {
        logger.debug(
          `File details: ${JSON.stringify(files.map((f) => ({ originalname: f.originalname, mimetype: f.mimetype, size: f.size })))}`,
        );
      }

      let imageUrls: string[] = [];

      // Upload images to Firebase Cloud Storage if provided
      if (files && files.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(files, {
          folder: 'establishments',
          makePublic: true,
          metadata: { uploadedBy: req.user.userId, category: 'establishment-image' },
          imageProcessing: {
            maxWidth: 1000,
            maxHeight: 750,
            quality: 85,
            format: 'jpeg',
          },
        });

        imageUrls = uploadResults.map((result) => result.downloadURL);
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

      // SECURITY: Use safe mapper to exclude sensitive fields (metadata, internal _id fields, etc.)
      const safeEstablishment = mapToSafeEstablishmentResponse(establishment.toObject());

      return {
        message: 'Establishment created successfully. Pending admin approval.',
        data: safeEstablishment,
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
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get('my-establishment')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MERCHANT)
  async getMyEstablishment(@Request() req: AuthenticatedRequest) {
    const result = await this.establishmentsService.findByOwnerId(req.user.userId);

    return {
      message: 'Your establishments retrieved successfully',
      data: result.establishments,
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
    const result = await this.establishmentsService.findAll(page, limit, {
      status: EstablishmentStatus.PENDING,
    });

    return {
      message: 'Pending establishments retrieved successfully',
      data: result.establishments,
      meta: QueryOptimizer.getPaginationMeta(result.total, page, limit),
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const establishment = await this.establishmentsService.findByIdWithOwner(id);

    return {
      message: 'Establishment retrieved successfully',
      data: establishment,
    };
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    const establishment = await this.establishmentsService.findById(id);

    // Check if user can access stats (owner or admin)
    if (req.user.role !== UserRole.ADMIN && establishment.ownerId.toString() !== req.user.userId) {
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
    description:
      'Update an existing establishment with optional new images. New images will be added to existing ones.',
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
            'https://storage.googleapis.com/waste-food-d479c.appspot.com/establishments/new_interior_1625097700000_def456.jpg',
          ],
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: '❌ Invalid update data' })
  @ApiResponse({ status: 403, description: '❌ Not authorized to update this establishment' })
  @ApiResponse({ status: 404, description: '❌ Establishment not found' })
  async update(
    @Param('id') id: string,
    @Body() updateEstablishmentDto: UpdateEstablishmentDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: AuthenticatedRequest,
  ) {
    try {
      let newImageUrls: string[] = [];

      // Upload new images to Firebase Cloud Storage if provided
      if (files && files.length > 0) {
        const uploadResults = await this.supabaseStorageService.uploadFiles(files, {
          folder: 'establishments',
          makePublic: true,
          metadata: { uploadedBy: req.user.userId, category: 'establishment-image-update' },
          imageProcessing: {
            maxWidth: 1000,
            maxHeight: 750,
            quality: 85,
            format: 'jpeg',
          },
        });

        newImageUrls = uploadResults.map((result) => result.downloadURL);
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
  async rejectEstablishment(@Param('id') id: string, @Body('reason') reason: string) {
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
    description:
      'Upload a legal document (business license, food safety certificate, etc.) for an establishment. Merchants can only upload to their own establishments.',
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
          verified: false,
        },
      },
    },
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
    @Request() req: AuthenticatedRequest,
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

      // Upload to Firebase Cloud Storage (private — documents use signed URLs)
      const uploadResult = await this.supabaseStorageService.uploadFile(file, {
        folder: `establishments/${id}/documents`,
        makePublic: false,
        metadata: {
          uploadedBy: req.user.userId,
          category: 'establishment-document',
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
    description:
      'Mark a legal document as verified after review. Only admins can verify documents.',
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
    @Request() req: AuthenticatedRequest,
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
    description:
      'Delete a legal document from an establishment. Merchants can only delete from their own establishments.',
  })
  @ApiResponse({
    status: 200,
    description: '✅ Document deleted successfully',
  })
  @ApiResponse({
    status: 403,
    description: '❌ Forbidden - Can only delete from own establishment',
  })
  @ApiResponse({ status: 404, description: '❌ Establishment or document not found' })
  async deleteDocument(
    @Param('id') id: string,
    @Param('documentType') documentType: DocumentType,
    @Request() req: AuthenticatedRequest,
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
  async remove(@Param('id') id: string, @Request() req: AuthenticatedRequest) {
    await this.establishmentsService.remove(id, req.user.userId, req.user.role);

    return {
      message: 'Establishment deleted successfully',
    };
  }
}
