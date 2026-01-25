import {
    Injectable,
    NotFoundException,
    ConflictException,
    BadRequestException,
    ForbiddenException,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Model, Types, FlattenMaps } from 'mongoose';
import { Establishment, EstablishmentDocument, EstablishmentStatus, DocumentMetadata } from './schemas/establishment.schema';
import { CreateEstablishmentDto } from './DTO/create-establishment.dto';
import { UpdateEstablishmentDto } from './DTO/update-establishment.dto';
import { SearchEstablishmentsDto } from './DTO/search-establishments.dto';
import { DocumentType } from './DTO/upload-documents.dto';
import { ESTABLISHMENT_LIST_FIELDS } from '../common/utils/query-optimization.util';
import {
    EstablishmentCreatedEvent,
    EstablishmentUpdatedEvent,
    EstablishmentDeletedEvent,
    EstablishmentDocumentUploadedEvent,
    EstablishmentDocumentVerifiedEvent,
    EstablishmentDocumentDeletedEvent,
    EstablishmentStatsUpdatedEvent,
} from '../common/events';

/**
 * Lean result type for Establishment documents
 * Use this for results from .lean() queries to maintain type safety
 *
 * Note: When using .lean(), Mongoose returns POJO with FlattenMaps type.
 * We use 'unknown' for _id to accept both ObjectId and FlattenMaps variants.
 */
export type EstablishmentLean = FlattenMaps<Establishment> & { _id: unknown };

export interface FindAllResult {
    establishments: EstablishmentLean[];
    total: number;
}

@Injectable()
export class EstablishmentsService {
    private readonly logger = new Logger(EstablishmentsService.name);

    constructor(
        @InjectModel(Establishment.name)
        readonly establishmentModel: Model<EstablishmentDocument>,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async create(
        createEstablishmentDto: CreateEstablishmentDto,
        ownerId: string
    ): Promise<EstablishmentDocument> {
        const existingEstablishment = await this.establishmentModel.findOne({ ownerId });
        if (existingEstablishment) {
            throw new ConflictException('User already has an establishment');
        }

        const establishment = new this.establishmentModel({
            ...createEstablishmentDto,
            ownerId: new Types.ObjectId(ownerId),
        });

        const savedEstablishment = await establishment.save();

        // ✅ EVENT: Emit establishment created event
        try {
            const event = new EstablishmentCreatedEvent(
                savedEstablishment._id.toString(),
                ownerId,
                savedEstablishment.name,
                savedEstablishment.type,
                savedEstablishment.status,
                savedEstablishment.email,
                {
                    street: savedEstablishment.address.street,
                    city: savedEstablishment.address.city,
                    postalCode: savedEstablishment.address.postalCode,
                    country: savedEstablishment.address.country,
                    coordinates: savedEstablishment.address.coordinates.coordinates as [number, number],
                },
                {
                    hasImages: savedEstablishment.images && savedEstablishment.images.length > 0,
                    imageCount: savedEstablishment.images?.length || 0,
                    hasLegalDocuments: !!savedEstablishment.legalDocuments,
                },
            );
            this.eventEmitter.emit('establishment.created', event);
            this.logger.log(`Event emitted: establishment.created for ${savedEstablishment._id}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.created event: ${error.message}`);
        }

        return savedEstablishment;
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        filters: SearchEstablishmentsDto = {},
    ): Promise<FindAllResult> {
        // ✅ OPTIMIZATION: Limit max page size to prevent DOS
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;
        const query: Record<string, any> = {};

        if (filters.search) {
            query.$text = { $search: filters.search };
        }
        if (filters.type) {query.type = filters.type;}
        if (filters.status) {query.status = filters.status;}
        if (filters.isVerified !== undefined) {query.isVerified = filters.isVerified;}
        if (filters.acceptsReservations !== undefined) {query.acceptsReservations = filters.acceptsReservations;}
        if (filters.minRating) {query.averageRating = { $gte: filters.minRating };}
        if (filters.longitude && filters.latitude) {
            const maxDistance = filters.maxDistance || 5000;
            query['address.coordinates'] = {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [filters.longitude, filters.latitude],
                    },
                    $maxDistance: maxDistance,
                },
            };
        }

        const [establishments, total] = await Promise.all([
            this.establishmentModel
                .find(query)
                .select(ESTABLISHMENT_LIST_FIELDS) // ✅ OPTIMIZATION: Only fetch required fields
                .populate('ownerId', 'firstName lastName email phoneNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ OPTIMIZATION: 50% memory reduction
                .exec(),
            this.establishmentModel.countDocuments(query),
        ]);

        return { establishments, total };
    }

    async findById(id: string): Promise<EstablishmentDocument> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid establishment ID');
        }

        const establishment = await this.establishmentModel
            .findById(id)
            .populate('ownerId', 'firstName lastName email phoneNumber')
            .exec();

        if (!establishment) {
            throw new NotFoundException('Establishment not found');
        }

        return establishment;
    }

    /**
     * Find establishments by owner ID
     * ⚠️ ENTERPRISE FIX: Added pagination to prevent loading 1000s of establishments
     */
    async findByOwnerId(
        ownerId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<FindAllResult> {
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        const query = { ownerId: new Types.ObjectId(ownerId) };

        const [establishments, total] = await Promise.all([
            this.establishmentModel
                .find(query)
                .select(ESTABLISHMENT_LIST_FIELDS) // ✅ Only fetch required fields
                .populate('ownerId', 'firstName lastName email phoneNumber')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ 50% memory reduction
                .exec(),
            this.establishmentModel.countDocuments(query),
        ]);

        return { establishments, total };
    }

    async update(
        id: string,
        updateEstablishmentDto: UpdateEstablishmentDto,
        userId: string,
        userRole: string,
    ): Promise<EstablishmentDocument> {
        const establishment = await this.findById(id);

        if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
            throw new ForbiddenException('You can only update your own establishment');
        }

        if (userRole !== 'admin' && updateEstablishmentDto.status) {
            delete updateEstablishmentDto.status;
        }

        // Track significant changes for event emission
        const updatedFields: string[] = [];
        const changedData: Record<string, any> = {};

        if (updateEstablishmentDto.address) {
            updatedFields.push('address');
            changedData.addressChanged = true;
            changedData.previousAddress = establishment.address;
            changedData.newAddress = updateEstablishmentDto.address;
        }

        if (updateEstablishmentDto.phoneNumber || updateEstablishmentDto.email) {
            updatedFields.push('contact');
            changedData.contactChanged = true;
        }

        if (updateEstablishmentDto.businessHours) {
            updatedFields.push('businessHours');
            changedData.businessHoursChanged = true;
        }

        if (updateEstablishmentDto.type) {
            updatedFields.push('type');
            changedData.typeChanged = true;
        }

        const updatedEstablishment = await this.establishmentModel
            .findByIdAndUpdate(id, updateEstablishmentDto, { new: true })
            .populate('ownerId', 'firstName lastName email phoneNumber')
            .exec();

        // ✅ EVENT: Emit establishment updated event (only for significant changes)
        if (updatedFields.length > 0) {
            try {
                const event = new EstablishmentUpdatedEvent(
                    id,
                    establishment.ownerId.toString(),
                    updatedEstablishment.name,
                    updatedFields,
                    changedData,
                );
                this.eventEmitter.emit('establishment.updated', event);
                this.logger.log(`Event emitted: establishment.updated for ${id} (fields: ${updatedFields.join(', ')})`);
            } catch (error) {
                this.logger.error(`Failed to emit establishment.updated event: ${error.message}`);
            }
        }

        return updatedEstablishment;
    }

    async updateStatus(
        id: string,
        status: EstablishmentStatus,
        rejectionReason?: string,
    ): Promise<EstablishmentDocument> {
        const updateData: Record<string, any> = { status };

        if (status === EstablishmentStatus.ACTIVE) {
            updateData.isVerified = true;
            updateData.verifiedAt = new Date();
        } else if (status === EstablishmentStatus.REJECTED && rejectionReason) {
            updateData.rejectionReason = rejectionReason;
        }

        const establishment = await this.establishmentModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('ownerId', 'firstName lastName email phoneNumber')
            .exec();

        if (!establishment) {
            throw new NotFoundException('Establishment not found');
        }

        return establishment;
    }

    async updateStats(id: string, stats: Partial<{ averageRating: number; totalReviews: number; totalOffers: number; completedOrders: number }>): Promise<void> {
        const establishment = await this.establishmentModel.findByIdAndUpdate(id, stats, { new: true }).exec();

        if (!establishment) {
            this.logger.warn(`Attempted to update stats for non-existent establishment: ${id}`);
            return;
        }

        // ✅ EVENT: Emit stats updated event
        try {
            const event = new EstablishmentStatsUpdatedEvent(
                id,
                establishment.ownerId.toString(),
                stats,
            );
            this.eventEmitter.emit('establishment.stats.updated', event);
            this.logger.log(`Event emitted: establishment.stats.updated for ${id}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.stats.updated event: ${error.message}`);
        }
    }

    /**
     * Soft delete an establishment (admin or owner only)
     * Prevents referential integrity issues with related orders, offers, reviews
     */
    async remove(id: string, userId: string, userRole: string, deletionReason?: string): Promise<void> {
        const establishment = await this.findById(id);

        if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
            throw new ForbiddenException('You can only delete your own establishment');
        }

        const isAdminDeletion = userRole === 'admin';
        const finalDeletionReason = deletionReason || (isAdminDeletion ? 'Admin deletion' : 'Owner deletion');

        // Soft delete: mark as deleted instead of removing from database
        await this.establishmentModel.findByIdAndUpdate(
            id,
            {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId,
                deletionReason: finalDeletionReason,
                isActive: false, // Also mark as inactive
                status: EstablishmentStatus.INACTIVE
            },
            { new: true }
        ).exec();

        // ✅ EVENT: Emit establishment deleted event
        try {
            const event = new EstablishmentDeletedEvent(
                id,
                establishment.ownerId.toString(),
                establishment.name,
                userId,
                finalDeletionReason,
                isAdminDeletion,
                {
                    totalOffers: establishment.totalOffers,
                    totalReviews: establishment.totalReviews,
                    pendingOrders: 0, // Could be fetched from orders service if needed
                },
            );
            this.eventEmitter.emit('establishment.deleted', event);
            this.logger.log(`Event emitted: establishment.deleted for ${id} by ${isAdminDeletion ? 'admin' : 'owner'}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.deleted event: ${error.message}`);
        }
    }

    /**
     * Get nearby establishments with pagination
     * ⚠️ ENTERPRISE FIX: Added pagination params to replace hardcoded limit=20
     */
    async getNearby(
        longitude: number,
        latitude: number,
        maxDistance: number = 5000,
        page: number = 1,
        limit: number = 20,
    ): Promise<FindAllResult> {
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        const query = {
            status: EstablishmentStatus.ACTIVE,
            isActive: true,
            'address.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: [longitude, latitude],
                    },
                    $maxDistance: maxDistance,
                },
            },
        };

        const [establishments, total] = await Promise.all([
            this.establishmentModel
                .find(query)
                .select(ESTABLISHMENT_LIST_FIELDS) // ✅ Only fetch required fields
                .populate('ownerId', 'firstName lastName')
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ 50% memory reduction
                .exec(),
            this.establishmentModel.countDocuments(query),
        ]);

        return { establishments, total };
    }

    async getStats(id: string): Promise<any> {
        const establishment = await this.findById(id);

        return {
            totalOffers: establishment.totalOffers,
            completedOrders: establishment.completedOrders,
            averageRating: establishment.averageRating,
            totalReviews: establishment.totalReviews,
        };
    }

    /**
     * Upload a legal document to an establishment
     * Enterprise-grade document management with full metadata tracking
     */
    async uploadDocument(
        establishmentId: string,
        documentType: DocumentType,
        documentUrl: string,
        metadata: {
            fileName: string;
            fileSize: number;
            mimeType: string;
            uploadedBy: string;
            expiryDate?: Date;
            notes?: string;
        },
        userId: string,
        userRole: string,
    ): Promise<EstablishmentDocument> {
        // Validate establishment exists and user has permission
        const establishment = await this.findById(establishmentId);

        if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
            throw new ForbiddenException('You can only upload documents to your own establishment');
        }

        // Create document metadata
        const documentMetadata: DocumentMetadata = {
            fileName: metadata.fileName,
            fileSize: metadata.fileSize,
            mimeType: metadata.mimeType,
            uploadedAt: new Date(),
            uploadedBy: userId,
            verified: false,
            expiryDate: metadata.expiryDate,
            notes: metadata.notes,
        };

        // Initialize legalDocuments if it doesn't exist
        if (!establishment.legalDocuments) {
            establishment.legalDocuments = {};
        }

        // Update the appropriate document field based on type
        switch (documentType) {
            case DocumentType.BUSINESS_LICENSE:
                establishment.legalDocuments.businessLicenseUrl = documentUrl;
                establishment.legalDocuments.businessLicenseMetadata = documentMetadata;
                break;

            case DocumentType.FOOD_SAFETY_LICENSE:
                establishment.legalDocuments.foodSafetyLicenseUrl = documentUrl;
                establishment.legalDocuments.foodSafetyLicenseMetadata = documentMetadata;
                break;

            case DocumentType.INSURANCE_DOCUMENT:
                establishment.legalDocuments.insuranceDocumentUrl = documentUrl;
                establishment.legalDocuments.insuranceDocumentMetadata = documentMetadata;
                break;

            case DocumentType.TAX_CERTIFICATE:
                establishment.legalDocuments.taxCertificateUrl = documentUrl;
                establishment.legalDocuments.taxCertificateMetadata = documentMetadata;
                break;

            case DocumentType.OWNER_ID_DOCUMENT:
                establishment.legalDocuments.ownerIdDocumentUrl = documentUrl;
                establishment.legalDocuments.ownerIdDocumentMetadata = documentMetadata;
                break;

            case DocumentType.ADDITIONAL:
                // Add to additional documents array
                if (!establishment.legalDocuments.additionalDocuments) {
                    establishment.legalDocuments.additionalDocuments = [];
                }
                establishment.legalDocuments.additionalDocuments.push({
                    type: metadata.notes || 'Additional Document',
                    url: documentUrl,
                    metadata: documentMetadata,
                });
                break;

            default:
                throw new BadRequestException('Invalid document type');
        }

        // Save and return updated establishment
        await establishment.save();

        // ✅ EVENT: Emit document uploaded event
        try {
            const event = new EstablishmentDocumentUploadedEvent(
                establishmentId,
                establishment.ownerId.toString(),
                establishment.name,
                documentType,
                documentUrl,
                userId,
                {
                    fileName: metadata.fileName,
                    fileSize: metadata.fileSize,
                    mimeType: metadata.mimeType,
                    expiryDate: metadata.expiryDate,
                },
            );
            this.eventEmitter.emit('establishment.document.uploaded', event);
            this.logger.log(`Event emitted: establishment.document.uploaded (${documentType}) for ${establishmentId}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.document.uploaded event: ${error.message}`);
        }

        return establishment;
    }

    /**
     * Verify a document (admin only)
     */
    async verifyDocument(
        establishmentId: string,
        documentType: DocumentType,
        verifiedBy: string,
        notes?: string,
    ): Promise<EstablishmentDocument> {
        const establishment = await this.findById(establishmentId);

        if (!establishment.legalDocuments) {
            throw new BadRequestException('No documents uploaded for this establishment');
        }

        const verificationData = {
            verified: true,
            verifiedAt: new Date(),
            verifiedBy,
            notes,
        };

        // Update verification status based on document type
        switch (documentType) {
            case DocumentType.BUSINESS_LICENSE:
                if (establishment.legalDocuments.businessLicenseMetadata) {
                    establishment.legalDocuments.businessLicenseMetadata = {
                        ...establishment.legalDocuments.businessLicenseMetadata,
                        ...verificationData,
                    };
                }
                break;

            case DocumentType.FOOD_SAFETY_LICENSE:
                if (establishment.legalDocuments.foodSafetyLicenseMetadata) {
                    establishment.legalDocuments.foodSafetyLicenseMetadata = {
                        ...establishment.legalDocuments.foodSafetyLicenseMetadata,
                        ...verificationData,
                    };
                }
                break;

            case DocumentType.INSURANCE_DOCUMENT:
                if (establishment.legalDocuments.insuranceDocumentMetadata) {
                    establishment.legalDocuments.insuranceDocumentMetadata = {
                        ...establishment.legalDocuments.insuranceDocumentMetadata,
                        ...verificationData,
                    };
                }
                break;

            case DocumentType.TAX_CERTIFICATE:
                if (establishment.legalDocuments.taxCertificateMetadata) {
                    establishment.legalDocuments.taxCertificateMetadata = {
                        ...establishment.legalDocuments.taxCertificateMetadata,
                        ...verificationData,
                    };
                }
                break;

            case DocumentType.OWNER_ID_DOCUMENT:
                if (establishment.legalDocuments.ownerIdDocumentMetadata) {
                    establishment.legalDocuments.ownerIdDocumentMetadata = {
                        ...establishment.legalDocuments.ownerIdDocumentMetadata,
                        ...verificationData,
                    };
                }
                break;

            default:
                throw new BadRequestException('Invalid document type for verification');
        }

        await establishment.save();

        // Check if all required documents are verified
        const allDocumentsVerified =
            establishment.legalDocuments.businessLicenseMetadata?.verified === true &&
            establishment.legalDocuments.foodSafetyLicenseMetadata?.verified === true;

        // ✅ EVENT: Emit document verified event
        try {
            // Get verifier email (would need to fetch from users service in real implementation)
            const verifiedByEmail = 'admin@example.com'; // Placeholder

            const event = new EstablishmentDocumentVerifiedEvent(
                establishmentId,
                establishment.ownerId.toString(),
                establishment.name,
                documentType,
                verifiedBy,
                verifiedByEmail,
                allDocumentsVerified,
                notes,
            );
            this.eventEmitter.emit('establishment.document.verified', event);
            this.logger.log(`Event emitted: establishment.document.verified (${documentType}) for ${establishmentId}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.document.verified event: ${error.message}`);
        }

        return establishment;
    }

    /**
     * Delete a document from an establishment
     */
    async deleteDocument(
        establishmentId: string,
        documentType: DocumentType,
        userId: string,
        userRole: string,
    ): Promise<EstablishmentDocument> {
        const establishment = await this.findById(establishmentId);

        if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
            throw new ForbiddenException('You can only delete documents from your own establishment');
        }

        if (!establishment.legalDocuments) {
            throw new BadRequestException('No documents found for this establishment');
        }

        const isAdminDeletion = userRole === 'admin';

        // Remove the document based on type
        switch (documentType) {
            case DocumentType.BUSINESS_LICENSE:
                establishment.legalDocuments.businessLicenseUrl = undefined;
                establishment.legalDocuments.businessLicenseMetadata = undefined;
                break;

            case DocumentType.FOOD_SAFETY_LICENSE:
                establishment.legalDocuments.foodSafetyLicenseUrl = undefined;
                establishment.legalDocuments.foodSafetyLicenseMetadata = undefined;
                break;

            case DocumentType.INSURANCE_DOCUMENT:
                establishment.legalDocuments.insuranceDocumentUrl = undefined;
                establishment.legalDocuments.insuranceDocumentMetadata = undefined;
                break;

            case DocumentType.TAX_CERTIFICATE:
                establishment.legalDocuments.taxCertificateUrl = undefined;
                establishment.legalDocuments.taxCertificateMetadata = undefined;
                break;

            case DocumentType.OWNER_ID_DOCUMENT:
                establishment.legalDocuments.ownerIdDocumentUrl = undefined;
                establishment.legalDocuments.ownerIdDocumentMetadata = undefined;
                break;

            default:
                throw new BadRequestException('Invalid document type');
        }

        await establishment.save();

        // ✅ EVENT: Emit document deleted event
        try {
            const event = new EstablishmentDocumentDeletedEvent(
                establishmentId,
                establishment.ownerId.toString(),
                establishment.name,
                documentType,
                userId,
                isAdminDeletion,
                isAdminDeletion ? 'Admin deleted document' : 'Owner deleted document',
            );
            this.eventEmitter.emit('establishment.document.deleted', event);
            this.logger.log(`Event emitted: establishment.document.deleted (${documentType}) for ${establishmentId}`);
        } catch (error) {
            this.logger.error(`Failed to emit establishment.document.deleted event: ${error.message}`);
        }

        return establishment;
    }
}