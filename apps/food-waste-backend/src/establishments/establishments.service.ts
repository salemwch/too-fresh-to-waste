import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, FlattenMaps, PipelineStage, FilterQuery, UpdateQuery } from 'mongoose';

import {
  EstablishmentCreatedEvent,
  EstablishmentUpdatedEvent,
  EstablishmentDeletedEvent,
  EstablishmentDocumentUploadedEvent,
  EstablishmentDocumentVerifiedEvent,
  EstablishmentDocumentDeletedEvent,
  EstablishmentStatsUpdatedEvent,
} from '../common/events';
import { CacheService } from '../common/services/cache.service';

import { CreateEstablishmentDto } from './DTO/create-establishment.dto';
import { SearchEstablishmentsDto } from './DTO/search-establishments.dto';
import { UpdateEstablishmentDto } from './DTO/update-establishment.dto';
import { DocumentType } from './DTO/upload-documents.dto';
import {
  Establishment,
  EstablishmentDocument,
  EstablishmentStatus,
  EstablishmentType,
  DocumentMetadata,
} from './schemas/establishment.schema';

import type { BusinessInfo } from '@foodwaste/shared';

// ESTABLISHMENT_LIST_FIELDS import removed - not currently used

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

interface AggregateCountResult {
  total: number;
}

@Injectable()
export class EstablishmentsService {
  private readonly logger = new Logger(EstablishmentsService.name);

  // Cache TTL constants (seconds)
  private static readonly TTL_ESTABLISHMENT = 1800; // 30 min — establishments rarely change
  private static readonly TTL_PLACE_CHECK = 3600; // 1 h — Google Place availability is stable

  constructor(
    @InjectModel(Establishment.name)
    readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly eventEmitter: EventEmitter2,
    private readonly cacheService: CacheService,
  ) {}

  async create(
    createEstablishmentDto: CreateEstablishmentDto,
    ownerId: string,
  ): Promise<EstablishmentDocument> {
    // Solo merchants (no org) still limited to 1 establishment.
    // Org owners can create multiple — the org service manages the list.
    const org = await this.establishmentModel.db
      .collection('organizations')
      .findOne({ ownerId: new Types.ObjectId(ownerId), isDeleted: { $ne: true } });

    if (!org) {
      const existingEstablishment = await this.establishmentModel.findOne({ ownerId });
      if (existingEstablishment) {
        throw new ConflictException(
          'User already has an establishment. Create an organization to add more locations.',
        );
      }
    }

    const establishment = new this.establishmentModel({
      ...createEstablishmentDto,
      ownerId: new Types.ObjectId(ownerId),
      ...(org ? { organizationId: org._id } : {}),
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
          coordinates: savedEstablishment.address.coordinates.coordinates,
        },
        {
          hasImages: (savedEstablishment.images?.length ?? 0) > 0,
          imageCount: savedEstablishment.images?.length || 0,
          hasLegalDocuments: !!savedEstablishment.legalDocuments,
        },
      );
      this.eventEmitter.emit('establishment.created', event);
      this.logger.log(`Event emitted: establishment.created for ${savedEstablishment._id}`);
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.created event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return savedEstablishment;
  }

  /**
   * Create an establishment from merchant signup data.
   * Bypasses full CreateEstablishmentDto validation (minimal data from Google Places).
   * Idempotent: skips creation if owner already has an establishment.
   *
   * @param businessInfo - Business data from Google Places
   * @param ownerId - The newly created user's ID
   * @param userEmail - User's registration email (used as establishment contact)
   * @param userPhone - User's phone number (optional)
   */
  /**
   * Returns true when an active, admin-approved establishment already claims
   * this Google Place ID.  Only ACTIVE + isVerified=true establishments block
   * registration — pending/rejected ones do not.
   */
  async isGooglePlaceRegistered(googlePlaceId: string): Promise<boolean> {
    const cacheKey = `estab:place:${googlePlaceId}`;
    const result = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const count = await this.establishmentModel.countDocuments({
          googlePlaceId,
          status: EstablishmentStatus.ACTIVE,
          isVerified: true,
          isDeleted: { $ne: true },
        });
        return count > 0;
      },
      EstablishmentsService.TTL_PLACE_CHECK,
    );
    return result;
  }

  async createFromSignup(
    businessInfo: BusinessInfo,
    ownerId: string,
    userEmail: string,
    userPhone?: string,
  ): Promise<EstablishmentDocument | null> {
    // Idempotent: skip if owner already has an establishment
    const existing = await this.establishmentModel.findOne({
      ownerId: new Types.ObjectId(ownerId),
    });
    if (existing) {
      this.logger.warn(
        `Establishment already exists for owner ${ownerId}, skipping signup creation`,
      );
      return existing;
    }

    // Block registration if an active, verified establishment already owns this place
    if (businessInfo.googlePlaceId) {
      const taken = await this.isGooglePlaceRegistered(businessInfo.googlePlaceId);
      if (taken) {
        throw new ConflictException(
          'This business location is already registered on our platform. If you own this business, please contact support.',
        );
      }
    }

    const street = businessInfo.addressComponents?.street ?? businessInfo.formattedAddress;
    const city = businessInfo.addressComponents?.city ?? 'Unknown';
    const postalCode = businessInfo.addressComponents?.postalCode ?? '0000';
    const country = businessInfo.addressComponents?.country ?? 'Tunisia';

    const establishmentType =
      businessInfo.establishmentType ?? this.mapGoogleTypesToEstablishmentType(businessInfo.types);

    const establishment = new this.establishmentModel({
      name: businessInfo.name,
      description: 'Establishment pending profile completion',
      ownerId: new Types.ObjectId(ownerId),
      type: establishmentType,
      status: EstablishmentStatus.PENDING,
      googlePlaceId: businessInfo.googlePlaceId,
      address: {
        street,
        city,
        postalCode,
        country,
        coordinates: {
          type: 'Point',
          coordinates: [businessInfo.longitude, businessInfo.latitude],
        },
      },
      phoneNumber: userPhone ?? '+21600000000',
      email: userEmail,
    });

    const saved = await establishment.save();

    try {
      const event = new EstablishmentCreatedEvent(
        saved._id.toString(),
        ownerId,
        saved.name,
        saved.type,
        saved.status,
        saved.email,
        {
          street,
          city,
          postalCode,
          country,
          coordinates: [businessInfo.longitude, businessInfo.latitude],
        },
        {
          hasImages: false,
          imageCount: 0,
          hasLegalDocuments: false,
        },
      );
      this.eventEmitter.emit('establishment.created', event);
      this.logger.log(`Establishment created from signup for owner ${ownerId}: ${saved._id}`);
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.created event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return saved;
  }

  /**
   * Map Google Place types to EstablishmentType enum.
   * Falls back to OTHER if no match is found.
   */
  private mapGoogleTypesToEstablishmentType(googleTypes?: string[]): EstablishmentType {
    if (!googleTypes || googleTypes.length === 0) {
      return EstablishmentType.OTHER;
    }

    const typeMap: Record<string, EstablishmentType> = {
      restaurant: EstablishmentType.RESTAURANT,
      bakery: EstablishmentType.BAKERY,
      pastry_shop: EstablishmentType.PASTRY_SHOP,
      cafe: EstablishmentType.CAFE,
      coffee_shop: EstablishmentType.CAFE,
      meal_takeaway: EstablishmentType.TAKEAWAY,
      takeout_restaurant: EstablishmentType.TAKEAWAY,
      meal_delivery: EstablishmentType.FAST_FOOD,
      fast_food_restaurant: EstablishmentType.FAST_FOOD,
      sushi_restaurant: EstablishmentType.SUSHI_RESTAURANT,
      grocery_or_supermarket: EstablishmentType.GROCERY_STORE,
      grocery_store: EstablishmentType.GROCERY_STORE,
      supermarket: EstablishmentType.SUPERMARKET,
      butcher_shop: EstablishmentType.BUTCHER_SHOP,
      liquor_store: EstablishmentType.BEVERAGE_SHOP,
      pet_store: EstablishmentType.PET_STORE,
      florist: EstablishmentType.FLOWER_PLANT,
      flower_shop: EstablishmentType.FLOWER_PLANT,
      lodging: EstablishmentType.HOTEL,
      hotel: EstablishmentType.HOTEL,
    };

    for (const gType of googleTypes) {
      const mapped = typeMap[gType];
      if (mapped !== null && mapped !== undefined) {
        return mapped;
      }
    }

    return EstablishmentType.OTHER;
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    filters: SearchEstablishmentsDto = {},
  ): Promise<FindAllResult> {
    // ✅ OPTIMIZATION: Limit max page size to prevent DOS
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    // Build non-geo filter
    const filter: FilterQuery<EstablishmentDocument> = {};

    if (filters.search) {
      filter['$text'] = { $search: filters.search };
    }
    if (filters.type !== null && filters.type !== undefined) {
      filter['type'] = filters.type;
    }
    if (filters.status !== null && filters.status !== undefined) {
      filter['status'] = filters.status;
    }
    if (filters.isVerified !== undefined) {
      filter['isVerified'] = filters.isVerified;
    }
    if (filters.acceptsReservations !== undefined) {
      filter['acceptsReservations'] = filters.acceptsReservations;
    }
    if (filters.minRating) {
      filter['averageRating'] = { $gte: filters.minRating };
    }

    const longitude = filters.longitude;
    const latitude = filters.latitude;
    const hasGeoFilter = longitude !== undefined && latitude !== undefined;
    const ownerFields = ['firstName', 'lastName', 'email', 'phoneNumber'];

    // Build aggregate pipeline
    const pipeline: PipelineStage[] = [];

    if (hasGeoFilter) {
      // $geoNear must be the first stage — replaces both $match and $near
      // $text is not supported with $geoNear; exclude it from the geo query
      const geoFilter = { ...filter };
      delete geoFilter['$text'];

      pipeline.push({
        $geoNear: {
          near: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
          distanceField: 'distance',
          maxDistance: filters.maxDistance ?? 5000,
          query: geoFilter,
          spherical: true,
        },
      });
      // $geoNear already sorts by distance — no explicit $sort needed
    } else {
      pipeline.push({ $match: filter });
      pipeline.push({ $sort: { createdAt: -1 as const } });
    }

    pipeline.push(
      { $skip: skip },
      { $limit: safeLimit },
      ...this.getOwnerLookupStages(ownerFields),
    );

    // Execute aggregate + count in parallel
    const [establishments, total] = await Promise.all([
      this.establishmentModel.aggregate<EstablishmentLean>(pipeline),
      hasGeoFilter
        ? this.establishmentModel
            .aggregate<AggregateCountResult>([
              {
                $geoNear: {
                  near: {
                    type: 'Point',
                    coordinates: [longitude, latitude],
                  },
                  distanceField: 'distance',
                  maxDistance: filters.maxDistance ?? 5000,
                  query: (() => {
                    const f = { ...filter };
                    delete f['$text'];
                    return f;
                  })(),
                  spherical: true,
                },
              },
              { $count: 'total' },
            ])
            .then(r => r[0]?.total ?? 0)
        : this.establishmentModel.countDocuments(filter),
    ]);

    return { establishments, total };
  }

  async findById(id: string): Promise<EstablishmentDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid establishment ID');
    }

    // No populate — internal callers use .save() and only need ownerId as ObjectId.
    // For API responses with populated owner, use findByIdWithOwner() instead.
    const establishment = await this.establishmentModel.findById(id).exec();

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
    limit: number = 20,
  ): Promise<FindAllResult> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query = { ownerId: new Types.ObjectId(ownerId) };

    // Aggregate + count in parallel (single DB round-trip per query)
    const [establishments, total] = await Promise.all([
      this.establishmentModel.aggregate<EstablishmentLean>([
        { $match: query },
        { $sort: { createdAt: -1 as const } },
        { $skip: skip },
        { $limit: safeLimit },
        ...this.getOwnerLookupStages(['firstName', 'lastName', 'email', 'phoneNumber']),
      ]),
      this.establishmentModel.countDocuments(query),
    ]);

    return { establishments, total };
  }

  async update(
    id: string,
    updateEstablishmentDto: UpdateEstablishmentDto,
    userId: string,
    userRole: string,
  ): Promise<EstablishmentLean> {
    const establishment = await this.findById(id);

    if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
      throw new ForbiddenException('You can only update your own establishment');
    }

    if (
      userRole !== 'admin' &&
      updateEstablishmentDto.status !== null &&
      updateEstablishmentDto.status !== undefined
    ) {
      delete updateEstablishmentDto.status;
    }

    // Track significant changes for event emission
    const updatedFields: string[] = [];
    const changedData: Record<string, unknown> = {};

    if (updateEstablishmentDto.address) {
      updatedFields.push('address');
      changedData['addressChanged'] = true;
      changedData['previousAddress'] = establishment.address;
      changedData['newAddress'] = updateEstablishmentDto.address;
    }

    if (updateEstablishmentDto.phoneNumber || updateEstablishmentDto.email) {
      updatedFields.push('contact');
      changedData['contactChanged'] = true;
    }

    if (updateEstablishmentDto.businessHours) {
      updatedFields.push('businessHours');
      changedData['businessHoursChanged'] = true;
    }

    if (updateEstablishmentDto.type !== null && updateEstablishmentDto.type !== undefined) {
      updatedFields.push('type');
      changedData['typeChanged'] = true;
    }

    // Step 1: Perform mutation
    await this.establishmentModel
      .findByIdAndUpdate(id, updateEstablishmentDto, { new: true })
      .exec();

    // Invalidate stale cache so next read fetches fresh data
    await this.cacheService.del(`estab:owner:${id}`);

    // Step 2: Fetch updated document with owner via $lookup (single round-trip)
    const updatedEstablishment = await this.findByIdWithOwner(id);

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
        this.logger.log(
          `Event emitted: establishment.updated for ${id} (fields: ${updatedFields.join(', ')})`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to emit establishment.updated event: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return updatedEstablishment;
  }

  async updateStatus(
    id: string,
    status: EstablishmentStatus,
    rejectionReason?: string,
  ): Promise<EstablishmentLean> {
    const updateData: UpdateQuery<EstablishmentDocument> = { status };

    if (status === EstablishmentStatus.ACTIVE) {
      updateData['isVerified'] = true;
      updateData['verifiedAt'] = new Date();
    } else if (status === EstablishmentStatus.REJECTED && rejectionReason) {
      updateData['rejectionReason'] = rejectionReason;
    }

    // Step 1: Perform mutation
    const updateResult = await this.establishmentModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .exec();

    if (!updateResult) {
      throw new NotFoundException('Establishment not found');
    }

    // Invalidate stale cache entries
    await Promise.all([
      this.cacheService.del(`estab:owner:${id}`),
      // When status becomes ACTIVE+verified, the place check result changes
      ...(status === EstablishmentStatus.ACTIVE && updateResult.googlePlaceId
        ? [this.cacheService.del(`estab:place:${updateResult.googlePlaceId}`)]
        : []),
    ]);

    // Step 2: Fetch updated document with owner via $lookup (single round-trip)
    const establishment = await this.findByIdWithOwner(id);

    return establishment;
  }

  async updateStats(
    id: string,
    stats: Partial<{
      averageRating: number;
      totalReviews: number;
      totalOffers: number;
      completedOrders: number;
    }>,
  ): Promise<void> {
    const establishment = await this.establishmentModel
      .findByIdAndUpdate(id, stats, { new: true })
      .exec();

    if (!establishment) {
      this.logger.warn(`Attempted to update stats for non-existent establishment: ${id}`);
      return;
    }

    // ✅ EVENT: Emit stats updated event
    try {
      const event = new EstablishmentStatsUpdatedEvent(id, establishment.ownerId.toString(), stats);
      this.eventEmitter.emit('establishment.stats.updated', event);
      this.logger.log(`Event emitted: establishment.stats.updated for ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.stats.updated event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Soft delete an establishment (admin or owner only)
   * Prevents referential integrity issues with related orders, offers, reviews
   */
  async remove(
    id: string,
    userId: string,
    userRole: string,
    deletionReason?: string,
  ): Promise<void> {
    const establishment = await this.findById(id);

    if (userRole !== 'admin' && establishment.ownerId.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own establishment');
    }

    const isAdminDeletion = userRole === 'admin';
    const finalDeletionReason =
      deletionReason ?? (isAdminDeletion ? 'Admin deletion' : 'Owner deletion');

    // Soft delete: mark as deleted instead of removing from database
    const deleted = await this.establishmentModel
      .findByIdAndUpdate(
        id,
        {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          deletionReason: finalDeletionReason,
          isActive: false, // Also mark as inactive
          status: EstablishmentStatus.INACTIVE,
        },
        { new: true },
      )
      .exec();

    // Invalidate all cached data for this establishment
    void Promise.all([
      this.cacheService.del(`estab:owner:${id}`),
      ...(deleted?.googlePlaceId
        ? [this.cacheService.del(`estab:place:${deleted.googlePlaceId}`)]
        : []),
    ]);

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
      this.logger.log(
        `Event emitted: establishment.deleted for ${id} by ${isAdminDeletion ? 'admin' : 'owner'}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.deleted event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

    const geoFilter = {
      status: EstablishmentStatus.ACTIVE,
      isActive: true,
    };

    const geoNearStage: PipelineStage.GeoNear = {
      $geoNear: {
        near: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        distanceField: 'distance',
        maxDistance,
        query: geoFilter,
        spherical: true,
      },
    };

    // Aggregate + count in parallel
    const [establishments, total] = await Promise.all([
      this.establishmentModel.aggregate<EstablishmentLean>([
        geoNearStage,
        { $skip: skip },
        { $limit: safeLimit },
        ...this.getOwnerLookupStages(['firstName', 'lastName']),
      ]),
      this.establishmentModel
        .aggregate<AggregateCountResult>([geoNearStage, { $count: 'total' }])
        .then(r => r[0]?.total ?? 0),
    ]);

    return { establishments, total };
  }

  async getStats(id: string): Promise<{
    totalOffers: number;
    completedOrders: number;
    averageRating: number;
    totalReviews: number;
  }> {
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
      expiryDate?: Date | undefined;
      notes?: string | undefined;
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
    establishment.legalDocuments ??= {};

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
        establishment.legalDocuments.additionalDocuments ??= [];
        establishment.legalDocuments.additionalDocuments.push({
          type: metadata.notes ?? 'Additional Document',
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
      this.logger.log(
        `Event emitted: establishment.document.uploaded (${documentType}) for ${establishmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.document.uploaded event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

      case DocumentType.ADDITIONAL:
        throw new BadRequestException(
          'Additional documents require a dedicated identifier for verification',
        );

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
      this.logger.log(
        `Event emitted: establishment.document.verified (${documentType}) for ${establishmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.document.verified event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
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

      case DocumentType.ADDITIONAL:
        throw new BadRequestException(
          'Additional documents require a dedicated identifier for deletion',
        );

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
      this.logger.log(
        `Event emitted: establishment.document.deleted (${documentType}) for ${establishmentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to emit establishment.document.deleted event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    return establishment;
  }

  /**
   * Builds $lookup + $unwind stages to join owner (user) data.
   * Uses the pipeline form of $lookup for field-level projection,
   * reducing network I/O compared to populate().
   * @param fields - Owner fields to project (default: firstName, lastName, email)
   * @see https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/#join-conditions-and-subqueries-on-a-joined-collection
   */
  private getOwnerLookupStages(
    fields: string[] = ['firstName', 'lastName', 'email'],
  ): PipelineStage[] {
    const projection: Record<string, 1> = { _id: 1 };
    for (const field of fields) {
      projection[field] = 1;
    }

    return [
      {
        $lookup: {
          from: 'users',
          let: { ownerObjId: '$ownerId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$ownerObjId'] } } },
            { $project: projection },
          ],
          as: 'ownerId',
        },
      },
      {
        $unwind: {
          path: '$ownerId',
          preserveNullAndEmptyArrays: true,
        },
      },
    ];
  }

  /**
   * Read-only findById with $lookup for API responses.
   * Returns a lean object with populated owner — used by controllers.
   * Mutation callers should use findById() which returns a Mongoose document.
   */
  async findByIdWithOwner(id: string): Promise<EstablishmentLean> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid establishment ID');
    }

    const cacheKey = `estab:owner:${id}`;
    const result = await this.cacheService.getOrSet(
      cacheKey,
      async () => {
        const [establishment] = await this.establishmentModel.aggregate<EstablishmentLean>([
          { $match: { _id: new Types.ObjectId(id) } },
          { $limit: 1 },
          ...this.getOwnerLookupStages(['firstName', 'lastName', 'email', 'phoneNumber']),
        ]);

        if (!establishment) {
          throw new NotFoundException('Establishment not found');
        }

        return establishment;
      },
      EstablishmentsService.TTL_ESTABLISHMENT,
    );
    return result;
  }

  /**
   * Retrieve all establishments belonging to a given organization.
   * Used by the Organizations controller to list locations under one org.
   */
  async findByOrganizationId(
    organizationId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<FindAllResult> {
    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;

    const query = { organizationId: new Types.ObjectId(organizationId) };

    const [establishments, total] = await Promise.all([
      this.establishmentModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      this.establishmentModel.countDocuments(query),
    ]);

    return { establishments, total };
  }
}
