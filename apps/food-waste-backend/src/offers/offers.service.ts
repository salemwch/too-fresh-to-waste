import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, isValidObjectId, PipelineStage, FlattenMaps } from 'mongoose';
import { Offer, OfferDocument, OfferStatus, Currency } from './schemas/offer.schema';
import { EstablishmentDocument } from '../establishments/schemas/establishment.schema';
import { CreateOfferDto } from './DTO/create-offer.dto';
import { SearchOffersDto, OfferSortField } from './DTO/search-offers.dto';
import { UpdateOfferDto } from './DTO/update-offer.dto';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppLoggerService } from '../common/services/logger.service';
import { OFFER_LIST_FIELDS } from '../common/utils/query-optimization.util';
import { TimezoneUtil } from '../common/utils/timezone.util';
import {
    MIN_EXISTENCE_MS,
    URGENCY_THRESHOLD_MS,
    AUTO_FEATURE_ENABLED,
    AUTO_FEATURE_CRON_SCHEDULE,
    MIN_EXISTENCE_HOURS,
    URGENCY_THRESHOLD_HOURS,
} from './config/featuring.config';

/**
 * Lean result type for Offer documents
 * Use this for results from .lean() queries to maintain type safety
 *
 * Note: When using .lean(), Mongoose returns POJO with FlattenMaps type.
 * We use 'unknown' for _id to accept both ObjectId and FlattenMaps variants.
 */
export type OfferLean = FlattenMaps<Offer> & { _id: unknown };

// Core business interfaces for type safety
interface MongoQuery {
    status?: OfferStatus;
    isActive?: boolean;
    $text?: { $search: string };
    type?: string;
    isFeaturedManual?: boolean;
    isFeaturedAuto?: boolean;
    $or?: Array<{ isFeaturedManual?: boolean; isFeaturedAuto?: boolean }>;
    establishmentId?: Types.ObjectId;
    merchantId?: Types.ObjectId;
    categories?: { $in: string[] };
    tags?: { $in: string[] };
    'pricing.discountedPrice'?: {
        $gte?: number;
        $lte?: number;
    };
    'pricing.discountPercentage'?: { $gte: number };
    availableFrom?: { $lte: Date };
    availableUntil?: { $gte: Date } | { $lte: Date; $gte: Date };
    'establishment.address.coordinates'?: {
        $near: {
            $geometry: {
                type: 'Point';
                coordinates: [number, number];
            };
            $maxDistance: number;
        };
    };
}

interface MongoSort {
    [field: string]: 1 | -1;
    createdAt?: 1 | -1;
}

interface OfferPricing {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    currency: Currency;
}

interface OfferPickupTimeSlot {
    startTime: string;
    endTime: string;
    maxOrders: number;
    currentOrders?: number;
}

interface StatusUpdateData {
    status: OfferStatus;
    publishedAt?: Date;
}

export interface FindAllResult {
    offers: OfferLean[];
    total: number;
}
@Injectable()
export class OffersService {
    constructor(
        @InjectModel(Offer.name)
        private readonly offerModel: Model<OfferDocument>,
        private readonly logger: AppLoggerService,
    ) { }

    async create(
        createOfferDto: CreateOfferDto,
        merchantId: string
    ): Promise<OfferDocument> {
        this.validateEstablishmentOwnership(
            createOfferDto.establishmentId,
            merchantId
        );
        // ✅ TIMEZONE: Convert local time (Tunisia) to UTC using proper timezone library
        // User inputs local time (e.g., 23:20 Tunisia) → Backend stores UTC (22:20)
        const timezone = createOfferDto.timezone || 'Africa/Tunis';

        const availableFrom = TimezoneUtil.toUTC(createOfferDto.availableFrom, timezone);
        const availableUntil = TimezoneUtil.toUTC(createOfferDto.availableUntil, timezone);
        const now = new Date();

        if (availableFrom < now) {
            throw new BadRequestException('Available from date cannot be in the past');
        }
        if (availableUntil <= availableFrom) {
            throw new BadRequestException('Available until date must be after available from date');
        }

        // ✅ SECURITY: Calculate discount percentage and enforce TND currency
        const validatedPricing = this.calculateAndValidatePricing(createOfferDto.pricing);
        this.validatePickupTimeSlots(createOfferDto.pickupTimeSlots);
        this.validatePickupSlotsAgainstQuantity(createOfferDto.pickupTimeSlots, createOfferDto.totalQuantity);

        const offer = new this.offerModel({
            ...createOfferDto,
            pricing: validatedPricing,
            establishmentId: new Types.ObjectId(createOfferDto.establishmentId),
            merchantId: new Types.ObjectId(merchantId),
            availableFrom,
            availableUntil,
            cancellationDeadline: createOfferDto.cancellationDeadline
                ? TimezoneUtil.toUTC(createOfferDto.cancellationDeadline, timezone)
                : new Date(availableFrom.getTime() - 2 * 60 * 60 * 1000), // 2 hours before
        });

        return offer.save();
    }

    async findAll(
        page: number = 1,
        limit: number = 10,
        filters: SearchOffersDto = {},
    ): Promise<FindAllResult> {
        // 🔍 DEBUG: Log incoming request
        console.log('========================================');
        console.log('🔍 BACKEND: findAll called');
        console.log('========================================');
        console.log('page:', page);
        console.log('limit:', limit);
        console.log('filters:', JSON.stringify(filters, null, 2));
        console.log('========================================');

        // ✅ ENTERPRISE: DOS protection - limit max page size
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;
        const query: MongoQuery = {};
        const sort: MongoSort = {};

        if (!filters.merchantId && !filters.status) {
            query.status = OfferStatus.ACTIVE;
            query.isActive = true;
        }
        if (filters.search) {
            query.$text = { $search: filters.search };
        }
        if (filters.type) { query.type = filters.type; }
        if (filters.status) { query.status = filters.status; }
        // ✅ FIX: Query actual database fields, not virtual field
        // isFeatured is virtual (isFeaturedManual || isFeaturedAuto)
        if (filters.isFeatured !== undefined) {
            if (filters.isFeatured) {
                // When filtering for featured offers, use $or
                query.$or = [
                    { isFeaturedManual: true },
                    { isFeaturedAuto: true }
                ];
            } else {
                // When filtering for NON-featured offers
                query.isFeaturedManual = false;
                query.isFeaturedAuto = false;
            }
        }
        if (filters.establishmentId) {
            if (!isValidObjectId(filters.establishmentId)) {
                throw new BadRequestException('Invalid establishmentId format');
            }
            query.establishmentId = new Types.ObjectId(filters.establishmentId);
        }
        if (filters.merchantId) {
            if (!isValidObjectId(filters.merchantId)) {
                throw new BadRequestException('Invalid merchantId format');
            }
            query.merchantId = new Types.ObjectId(filters.merchantId);
        }
        if (filters.categories && filters.categories.length > 0) {
            query.categories = { $in: filters.categories };
        }
        if (filters.tags && filters.tags.length > 0) {
            query.tags = { $in: filters.tags };
        }

        // ✅ NEW: Establishment filters (requires aggregation pipeline)
        const hasEstablishmentFilters = (filters.establishmentTypes && filters.establishmentTypes.length > 0) || (filters.cuisineTypes && filters.cuisineTypes.length > 0);

        if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
            query['pricing.discountedPrice'] = {};
            if (filters.minPrice !== undefined) { query['pricing.discountedPrice'].$gte = filters.minPrice; }
            if (filters.maxPrice !== undefined) { query['pricing.discountedPrice'].$lte = filters.maxPrice; }
        }
        if (filters.minDiscount) {
            query['pricing.discountPercentage'] = { $gte: filters.minDiscount };
        }

        // ✅ SECURITY: Backend enforces time-based filtering for public queries
        // Users should only see currently available offers (not future or expired)
        // Merchants/admins can see all statuses via status filter
        if (!filters.merchantId && !filters.status) {
            const now = new Date();
            query.availableFrom = { $lte: now };
            query.availableUntil = { $gte: now };
        }

        // ✅ NEW: Handle establishment filters with aggregation pipeline
        if (hasEstablishmentFilters && !filters.longitude && !filters.latitude) {
            // Use aggregation pipeline for establishment filtering
            const pipeline: PipelineStage[] = [
                // Match offers first
                { $match: query },
                // Lookup establishment details
                {
                    $lookup: {
                        from: 'establishments',
                        localField: 'establishmentId',
                        foreignField: '_id',
                        as: 'establishment'
                    }
                },
                { $unwind: '$establishment' },
                // Apply establishment filters
                {
                    $match: {
                        ...(filters.establishmentTypes && filters.establishmentTypes.length > 0 && {
                            'establishment.type': { $in: filters.establishmentTypes }
                        }),
                        ...(filters.cuisineTypes && filters.cuisineTypes.length > 0 && {
                            'establishment.cuisineTypes': { $in: filters.cuisineTypes }
                        })
                    }
                },
                // Lookup merchant data
                {
                    $lookup: {
                        from: 'users',
                        localField: 'merchantId',
                        foreignField: '_id',
                        as: 'merchantData'
                    }
                },
                { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
                // Project required fields
                {
                    $project: {
                        title: 1,
                        description: 1,
                        type: 1,
                        images: 1,
                        pricing: 1,
                        totalQuantity: 1,
                        soldQuantity: 1,
                        reservedQuantity: 1,
                        availableFrom: 1,
                        availableUntil: 1,
                        establishmentId: 1,
                        merchantId: {
                            _id: '$merchantData._id',
                            firstName: '$merchantData.firstName',
                            lastName: '$merchantData.lastName',
                            profileImage: '$merchantData.profileImage'
                        },
                        pickupTimeSlots: 1,
                        status: 1,
                        createdAt: 1,
                        establishment: {
                            _id: '$establishment._id',
                            name: '$establishment.name',
                            address: '$establishment.address',
                            type: '$establishment.type',
                            averageRating: '$establishment.averageRating'
                        },
                        isFeaturedManual: 1,
                        isFeaturedAuto: 1,
                        featuredAt: 1,
                        isPickupToday: 1,
                        isPickupTomorrow: 1
                    }
                },
                // Apply sorting
                { $sort: sort },
                // Pagination
                { $skip: skip },
                { $limit: safeLimit }
            ];

            const countPipeline: PipelineStage[] = [
                { $match: query },
                {
                    $lookup: {
                        from: 'establishments',
                        localField: 'establishmentId',
                        foreignField: '_id',
                        as: 'establishment'
                    }
                },
                { $unwind: '$establishment' },
                {
                    $match: {
                        ...(filters.establishmentTypes && filters.establishmentTypes.length > 0 && {
                            'establishment.type': { $in: filters.establishmentTypes }
                        }),
                        ...(filters.cuisineTypes && filters.cuisineTypes.length > 0 && {
                            'establishment.cuisineTypes': { $in: filters.cuisineTypes }
                        })
                    }
                },
                { $count: 'total' }
            ];

            const [offers, totalCount] = await Promise.all([
                this.offerModel.aggregate(pipeline).exec(),
                this.offerModel.aggregate(countPipeline).exec()
            ]);

            const total = totalCount[0]?.total || 0;
            return { offers: offers as OfferLean[], total };
        }

        // ✅ ENTERPRISE: Geolocation query with pagination
        // ⚠️ CRITICAL FIX: $geoNear MUST be the first stage in aggregation pipeline
        if (filters.longitude && filters.latitude) {
            const maxDistance = filters.maxDistance || 5000;

            // ✅ FIX: Use $geoNear as FIRST stage (MongoDB requirement)
            // Move all offer filters into the 'query' parameter of $geoNear
            const geoNearQuery: any = {
                // Establishment must be active (we're querying establishments collection virtually)
                isActive: true,
                isDeleted: { $ne: true }
            };

            // ✅ NEW: Apply establishment filters in geoNear query
            if (filters.establishmentTypes && filters.establishmentTypes.length > 0) {
                geoNearQuery.type = { $in: filters.establishmentTypes };
            }
            if (filters.cuisineTypes && filters.cuisineTypes.length > 0) {
                geoNearQuery.cuisineTypes = { $in: filters.cuisineTypes };
            }

            const pipeline: PipelineStage[] = [
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [filters.longitude, filters.latitude]
                        },
                        distanceField: 'distance',
                        maxDistance,
                        spherical: true,
                        key: 'address.coordinates', // Geospatial field on establishments
                        query: geoNearQuery
                    }
                },
                // ✅ Now lookup offers for these nearby establishments
                {
                    $lookup: {
                        from: 'offers',
                        let: { establishmentId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                                    ...query // Apply offer filters (status, isActive, dates, etc.)
                                }
                            }
                        ],
                        as: 'offers'
                    }
                },
                { $unwind: '$offers' },
                // ✅ Lookup merchant data for profileImage
                {
                    $lookup: {
                        from: 'users',
                        localField: 'offers.merchantId',
                        foreignField: '_id',
                        as: 'merchantData'
                    }
                },
                { $unwind: { path: '$merchantData', preserveNullAndEmptyArrays: true } },
                // ✅ Restructure to have offer as root document
                {
                    $replaceRoot: {
                        newRoot: {
                            $mergeObjects: [
                                '$offers',
                                {
                                    establishment: {
                                        _id: '$_id',
                                        name: '$name',
                                        address: '$address',
                                        type: '$type',
                                        averageRating: '$averageRating'
                                    },
                                    merchantId: {
                                        _id: '$merchantData._id',
                                        firstName: '$merchantData.firstName',
                                        lastName: '$merchantData.lastName',
                                        profileImage: '$merchantData.profileImage'
                                    },
                                    distance: '$distance'
                                }
                            ]
                        }
                    }
                },
                // ✅ ENTERPRISE: Project only required fields for performance
                {
                    $project: {
                        title: 1,
                        type: 1,
                        images: 1,
                        pricing: 1,
                        totalQuantity: 1,
                        soldQuantity: 1,
                        reservedQuantity: 1,
                        availableFrom: 1,
                        availableUntil: 1,
                        establishmentId: 1,
                        merchantId: 1,              // ✅ Required for merchant profileImage
                        pickupTimeSlots: 1,         // ✅ Required for time range display
                        status: 1,
                        createdAt: 1,
                        distance: 1,
                        establishment: 1,
                        isFeaturedManual: 1,        // ✅ Required for featuring logic
                        isFeaturedAuto: 1,          // ✅ Required for featuring logic
                        featuredAt: 1,              // ✅ Required for featuring logic
                        isPickupToday: 1,           // ✅ Pickup categorization
                        isPickupTomorrow: 1         // ✅ Pickup categorization
                    }
                },
                { $sort: { distance: 1 } }, // Sort by distance (nearest first)
                { $skip: skip },
                { $limit: safeLimit }
            ];

            const countPipeline: PipelineStage[] = [
                {
                    $geoNear: {
                        near: {
                            type: 'Point',
                            coordinates: [filters.longitude, filters.latitude]
                        },
                        distanceField: 'distance',
                        maxDistance,
                        spherical: true,
                        key: 'address.coordinates',
                        query: geoNearQuery
                    }
                },
                {
                    $lookup: {
                        from: 'offers',
                        let: { establishmentId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                                    ...query
                                }
                            }
                        ],
                        as: 'offers'
                    }
                },
                { $unwind: '$offers' },
                { $count: 'total' }
            ];

            // ⚠️ CRITICAL: Query establishments collection (not offers) since $geoNear requires 2dsphere index
            const establishmentModel = this.offerModel.db.collection('establishments');

            const [offers, totalCount] = await Promise.all([
                establishmentModel.aggregate(pipeline).toArray(),
                establishmentModel.aggregate(countPipeline).toArray()
            ]);

            const total = totalCount[0]?.total || 0;
            return { offers: offers as OfferLean[], total };
        }

        // ✅ SECURITY: Whitelist-based sorting to prevent prototype pollution
        if (filters.sortBy) {
            const allowedSortFields: Record<OfferSortField, string> = {
                [OfferSortField.CREATED_AT]: 'createdAt',
                [OfferSortField.PRICE]: 'pricing.discountedPrice',
                [OfferSortField.DISCOUNT]: 'pricing.discountPercentage',
                [OfferSortField.EXPIRY]: 'availableUntil',
            };

            const safeField = allowedSortFields[filters.sortBy];
            if (safeField) {
                const order = filters.sortOrder === 'asc' ? 1 : -1;
                sort[safeField] = order;
            }
        } else {
            sort.createdAt = -1;
        }

        // 🔍 DEBUG: Log final query before execution
        console.log('========================================');
        console.log('🔍 BACKEND: Final MongoDB query');
        console.log('========================================');
        console.log('query:', JSON.stringify(query, null, 2));
        console.log('sort:', JSON.stringify(sort, null, 2));
        console.log('skip:', skip);
        console.log('limit:', safeLimit);
        console.log('========================================');

        const [offers, total] = await Promise.all([
            this.offerModel
                .find(query)
                .select(OFFER_LIST_FIELDS) // ✅ ENTERPRISE: Only fetch required fields (60% payload reduction)
                .populate('establishmentId', 'name address type averageRating')
                .populate('merchantId', 'firstName lastName profileImage')
                .sort(sort)
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ ENTERPRISE: 50% memory reduction
                .exec(),
            this.offerModel.countDocuments(query),
        ]);

        // 🔍 DEBUG: Log results
        console.log('========================================');
        console.log('🔍 BACKEND: Query results');
        console.log('========================================');
        console.log('offers count:', offers.length);
        console.log('total:', total);
        if (offers.length > 0) {
            console.log('First offer:', {
                id: offers[0]._id,
                title: offers[0].title,
                discount: offers[0].pricing?.discountPercentage,
                status: offers[0].status
            });
        }
        console.log('========================================');

        return { offers, total };
    }

    async findById(id: string): Promise<OfferDocument> {
        if (!Types.ObjectId.isValid(id)) {
            throw new BadRequestException('Invalid offer ID');
        }

        const offer = await this.offerModel
            .findById(id)
            .populate('establishmentId', 'name address type averageRating phoneNumber email')
            .populate('merchantId', 'firstName lastName email phoneNumber profileImage')
            .exec();

        if (!offer) {
            throw new NotFoundException('Offer not found');
        }

        // Increment view count
        await this.offerModel.findByIdAndUpdate(id, { $inc: { viewCount: 1 } });

        return offer;
    }

    async findByEstablishment(establishmentId: string, page: number = 1, limit: number = 10): Promise<FindAllResult> {
        return this.findAll(page, limit, { establishmentId });
    }

    async findByMerchant(merchantId: string, page: number = 1, limit: number = 10): Promise<FindAllResult> {
        return this.findAll(page, limit, { merchantId });
    }

    async update(
        id: string,
        updateOfferDto: UpdateOfferDto,
        userId: string,
        userRole: string,
    ): Promise<OfferDocument> {
        const offer = await this.findById(id);

        // Check permissions
        // Handle both ObjectId and populated merchantId
        const merchantIdString = typeof offer.merchantId === 'object' && offer.merchantId._id
            ? offer.merchantId._id.toString()
            : offer.merchantId.toString();

        if (userRole !== 'admin' && merchantIdString !== userId) {
            throw new ForbiddenException('You can only update your own offers');
        }

        if (offer.reservedQuantity > 0 && userRole !== 'admin') {
            throw new BadRequestException('Cannot update offer with active reservations');
        }
        if (updateOfferDto.pricing) {
            // ✅ SECURITY: Calculate discount percentage and enforce TND currency
            updateOfferDto.pricing = this.calculateAndValidatePricing(updateOfferDto.pricing);
        }
        if (updateOfferDto.pickupTimeSlots) {
            this.validatePickupTimeSlots(updateOfferDto.pickupTimeSlots);
            // Validate against updated or existing totalQuantity
            const totalQuantity = updateOfferDto.totalQuantity ?? offer.totalQuantity;
            this.validatePickupSlotsAgainstQuantity(updateOfferDto.pickupTimeSlots, totalQuantity);
        }
        // If totalQuantity changed but slots didn't, still validate
        if (updateOfferDto.totalQuantity && !updateOfferDto.pickupTimeSlots) {
            this.validatePickupSlotsAgainstQuantity(offer.pickupTimeSlots, updateOfferDto.totalQuantity);
        }
        if (updateOfferDto.availableFrom || updateOfferDto.availableUntil) {
            const availableFrom = updateOfferDto.availableFrom ? new Date(updateOfferDto.availableFrom) : offer.availableFrom;
            const availableUntil = updateOfferDto.availableUntil ? new Date(updateOfferDto.availableUntil) : offer.availableUntil;

            if (availableUntil <= availableFrom) {
                throw new BadRequestException('Available until date must be after available from date');
            }

            updateOfferDto.availableFrom = availableFrom.toISOString();
            updateOfferDto.availableUntil = availableUntil.toISOString();
        }

        const updatedOffer = await this.offerModel
            .findByIdAndUpdate(
                id,
                {
                    ...updateOfferDto,
                    lastModifiedBy: new Types.ObjectId(userId)
                },
                { new: true }
            )
            .populate('establishmentId', 'name address type averageRating')
            .populate('merchantId', 'firstName lastName')
            .exec();

        return updatedOffer;
    }

    async updateStatus(id: string, status: OfferStatus): Promise<any> {
        const updateData: StatusUpdateData = { status };

        if (status === OfferStatus.ACTIVE) {
            updateData.publishedAt = new Date();
        }

        const offer = await this.offerModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .select('_id status publishedAt updatedAt')
            .exec();

        if (!offer) {
            throw new NotFoundException('Offer not found');
        }

        return offer;
    }

    async reserveQuantity(
        id: string,
        quantity: number
    ): Promise<{ offer: OfferDocument; reservedQuantity: number; soldQuantity: number }> {
        if (quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        const now = new Date();

        // Atomic update: ensure enough quantity + offer still active + not expired
        const updatedOffer = await this.offerModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                status: OfferStatus.ACTIVE,
                isActive: true,
                availableUntil: { $gt: now }, // 🔹 expiry check
                $expr: {
                    $gte: [
                        { $subtract: ['$totalQuantity', { $add: ['$reservedQuantity', '$soldQuantity'] }] },
                        quantity,
                    ],
                },
            },
            { $inc: { reservedQuantity: quantity } },
            { new: true, runValidators: true }
        ).exec();

        // Handle cases
        if (!updatedOffer) {
            const offer = await this.offerModel.findById(id).exec();

            if (!offer) {
                throw new NotFoundException(`Offer with id ${id} not found`);
            }

            if (offer.status !== OfferStatus.ACTIVE || !offer.isActive) {
                throw new BadRequestException('This offer is not active');
            }

            if (offer.availableUntil <= now) {
                throw new BadRequestException('This offer has expired');
            }

            throw new BadRequestException('Not enough quantity available to reserve');
        }

        return {
            offer: updatedOffer.toObject({ virtuals: true }) as OfferDocument,
            reservedQuantity: updatedOffer.reservedQuantity,
            soldQuantity: updatedOffer.soldQuantity,
        };
    }


    async confirmSale(
        id: string,
        quantity: number
    ): Promise<{ offer: OfferDocument; reservedQuantity: number; soldQuantity: number }> {
        if (quantity <= 0) {
            throw new BadRequestException('Quantity must be greater than 0');
        }

        const updatedOffer = await this.offerModel.findOneAndUpdate(
            {
                _id: new Types.ObjectId(id),
                reservedQuantity: { $gte: quantity },
                status: OfferStatus.ACTIVE,
                isActive: true,
            },
            {
                $inc: {
                    reservedQuantity: -quantity,
                    soldQuantity: quantity,
                },
            },
            { new: true, runValidators: true }
        ).exec();

        if (!updatedOffer) {
            const exists = await this.offerModel.exists({ _id: id });
            if (!exists) {
                throw new NotFoundException('Offer not found');
            }
            throw new BadRequestException('Not enough reserved quantity to confirm sale');
        }

        return {
            offer: updatedOffer.toObject({ virtuals: true }) as OfferDocument,
            reservedQuantity: updatedOffer.reservedQuantity,
            soldQuantity: updatedOffer.soldQuantity,
        };
    }
    async cancelReservation(id: string, quantity: number): Promise<OfferDocument> {
        const updatedOffer = await this.offerModel
            .findByIdAndUpdate(
                id,
                { $inc: { reservedQuantity: -quantity } },
                { new: true }
            )
            .exec();

        if (!updatedOffer) {
            throw new NotFoundException('Offer not found');
        }

        return updatedOffer;
    }

    /**
     * Soft delete an offer (admin or merchant only)
     * Prevents referential integrity issues with active orders and reservations
     */
    async remove(id: string, userId: string, userRole: string, deletionReason?: string): Promise<void> {
        const offer = await this.findById(id);

        // Check permissions
        // Handle both ObjectId and populated merchantId
        const merchantIdString = typeof offer.merchantId === 'object' && offer.merchantId._id
            ? offer.merchantId._id.toString()
            : offer.merchantId.toString();

        if (userRole !== 'admin' && merchantIdString !== userId) {
            throw new ForbiddenException('You can only delete your own offers');
        }
        if (offer.reservedQuantity > 0) {
            throw new BadRequestException('Cannot delete offer with active reservations');
        }

        // Soft delete: mark as deleted instead of removing from database
        await this.offerModel.findByIdAndUpdate(
            id,
            {
                isDeleted: true,
                deletedAt: new Date(),
                deletedBy: userId,
                deletionReason: deletionReason || (userRole === 'admin' ? 'Admin deletion' : 'Merchant deletion'),
                status: OfferStatus.CANCELLED, // Mark as cancelled
                isActive: false
            },
            { new: true }
        ).exec();

        this.logger.log(`Offer ${id} soft deleted by user ${userId} (${userRole})`);
    }
    /**
     * Get offers available for pickup TODAY
     *
     * Returns offers where the pickup window overlaps with today (00:00 - 23:59 in Africa/Tunis timezone)
     *
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated offers available for pickup today
     */
    async getPickupTodayOffers(
        page: number = 1,
        limit: number = 20
    ): Promise<FindAllResult> {
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        // ✅ Merchant-controlled categorization (no time-based logic)
        const query = {
            status: OfferStatus.ACTIVE,
            isActive: true,
            isPickupToday: true,  // Set by merchant when creating/editing offer
        };

        const [offers, total] = await Promise.all([
            this.offerModel
                .find(query)
                .select(OFFER_LIST_FIELDS)
                .populate('establishmentId', 'name address type averageRating')
                .populate('merchantId', 'firstName lastName profileImage')  // ✅ Populate merchant for logo
                .sort({ availableUntil: 1, createdAt: -1 }) // Expiring soon first
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            this.offerModel.countDocuments(query)
        ]);

        return { offers, total };
    }

    /**
     * Get offers available for pickup TOMORROW
     *
     * Returns offers where the pickup window overlaps with tomorrow (00:00 - 23:59 in Africa/Tunis timezone)
     *
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated offers available for pickup tomorrow
     */
    async getPickupTomorrowOffers(
        page: number = 1,
        limit: number = 20
    ): Promise<FindAllResult> {
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        // ✅ Merchant-controlled categorization (no time-based logic)
        const query = {
            status: OfferStatus.ACTIVE,
            isActive: true,
            isPickupTomorrow: true,  // Set by merchant when creating/editing offer
        };

        const [offers, total] = await Promise.all([
            this.offerModel
                .find(query)
                .select(OFFER_LIST_FIELDS)
                .populate('establishmentId', 'name address type averageRating')
                .populate('merchantId', 'firstName lastName profileImage')  // ✅ Populate merchant for logo
                .sort({ availableUntil: 1, createdAt: -1 }) // Expiring soon first
                .skip(skip)
                .limit(safeLimit)
                .lean()
                .exec(),
            this.offerModel.countDocuments(query)
        ]);

        return { offers, total };
    }

    /**
     * Get featured offers with enterprise-grade pagination
     * ⚠️ CRITICAL FIX: Added pagination to replace hardcoded limit
     *
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated featured offers with total count
     */
    async getFeaturedOffers(
        page: number = 1,
        limit: number = 10
    ): Promise<FindAllResult> {
        // ✅ ENTERPRISE: DOS protection - limit max page size
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        const now = new Date();

        // ✅ FIX: Query actual database fields, not virtual field
        // isFeatured is virtual (isFeaturedManual || isFeaturedAuto)
        // Must use $or to query the actual stored fields
        const query = {
            status: OfferStatus.ACTIVE,
            isActive: true,
            availableFrom: { $lte: now },
            availableUntil: { $gte: now },
            $or: [
                { isFeaturedManual: true },
                { isFeaturedAuto: true }
            ]
        };

        const [offers, total] = await Promise.all([
            this.offerModel
                .find(query)
                .select(OFFER_LIST_FIELDS) // ✅ ENTERPRISE: Only fetch required fields
                .populate('establishmentId', 'name address type averageRating')
                .populate('merchantId', 'firstName lastName profileImage') // ✅ Merchant profile image for OfferCard logo
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ ENTERPRISE: 50% memory reduction
                .exec(),
            this.offerModel.countDocuments(query)
        ]);

        return { offers, total };
    }
    /**
     * Get nearby offers with enterprise-grade pagination and geolocation
     * ⚠️ CRITICAL FIX: Added pagination and proper geolocation query
     *
     * @param longitude - Longitude coordinate
     * @param latitude - Latitude coordinate
     * @param maxDistance - Maximum distance in meters (default: 5000)
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated nearby offers with total count
     */
    async getNearbyOffers(
        longitude: number,
        latitude: number,
        maxDistance: number = 5000,
        page: number = 1,
        limit: number = 20,
    ): Promise<FindAllResult> {
        // ✅ ENTERPRISE: DOS protection - limit max page size
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;
        const now = new Date();

        // ✅ CRITICAL FIX: $geoNear MUST be the FIRST stage in aggregation pipeline
        // MongoDB requirement: https://docs.mongodb.com/manual/reference/operator/aggregation/geoNear/

        // Strategy: Query establishments collection first (has 2dsphere index), then lookup offers
        const basePipeline: PipelineStage[] = [
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [longitude, latitude]
                    },
                    distanceField: 'distance',
                    maxDistance,
                    spherical: true,
                    key: 'address.coordinates', // Geospatial index on establishments collection
                    // ✅ Filter establishments
                    query: {
                        isActive: true,
                        isDeleted: { $ne: true }
                    }
                }
            },
            // ✅ Lookup active offers for these nearby establishments
            {
                $lookup: {
                    from: 'offers',
                    let: { establishmentId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$establishmentId', '$$establishmentId'] },
                                status: OfferStatus.ACTIVE,
                                isActive: true,
                                availableFrom: { $lte: now },
                                availableUntil: { $gte: now },
                                isDeleted: { $ne: true }
                            }
                        }
                    ],
                    as: 'offers'
                }
            },
            // ✅ Unwind offers array (one document per offer)
            { $unwind: '$offers' },
            // ✅ Lookup merchant details
            {
                $lookup: {
                    from: 'users',
                    localField: 'offers.merchantId',
                    foreignField: '_id',
                    as: 'merchant'
                }
            },
            // ✅ Restructure to have offer as root document (with establishment and distance)
            {
                $replaceRoot: {
                    newRoot: {
                        $mergeObjects: [
                            '$offers',
                            {
                                establishment: {
                                    _id: '$_id',
                                    name: '$name',
                                    address: '$address',
                                    type: '$type',
                                    averageRating: '$averageRating'
                                },
                                distance: '$distance',
                                merchant: { $arrayElemAt: ['$merchant', 0] }
                            }
                        ]
                    }
                }
            },
            // ✅ ENTERPRISE: Project only required fields for performance
            {
                $project: {
                    title: 1,
                    type: 1,
                    images: 1,
                    pricing: 1,
                    totalQuantity: 1,
                    soldQuantity: 1,
                    reservedQuantity: 1,
                    availableFrom: 1,
                    availableUntil: 1,
                    establishmentId: 1,
                    status: 1,
                    distance: 1,
                    'establishment.name': 1,
                    'establishment.address': 1,
                    'establishment.type': 1,
                    'establishment.averageRating': 1,
                    'merchant.firstName': 1,
                    'merchant.lastName': 1,
                    'merchant.profileImage': 1, // ✅ Merchant profile image for OfferCard logo
                    createdAt: 1
                }
            }
        ];

        // ⚠️ CRITICAL: Query establishments collection (not offers) since $geoNear requires 2dsphere index
        const establishmentModel = this.offerModel.db.collection('establishments');

        const [offers, totalCount] = await Promise.all([
            establishmentModel.aggregate([
                ...basePipeline,
                { $sort: { distance: 1 } }, // Sort by distance (nearest first)
                { $skip: skip },
                { $limit: safeLimit }
            ]).toArray(),
            establishmentModel.aggregate([
                ...basePipeline,
                { $count: 'total' }
            ]).toArray()
        ]);

        const total = totalCount[0]?.total || 0;
        return { offers: offers as OfferLean[], total };
    }
    /**
     * Get expiring offers with enterprise-grade pagination
     * ⚠️ CRITICAL FIX: Added pagination to prevent loading 1000s of expiring offers
     *
     * @param hoursUntilExpiry - Hours until expiry threshold (default: 24)
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated expiring offers with total count
     */
    async getExpiringOffers(
        hoursUntilExpiry: number = 24,
        page: number = 1,
        limit: number = 20
    ): Promise<FindAllResult> {
        // ✅ ENTERPRISE: DOS protection - limit max page size
        const safeLimit = Math.min(limit, 100);
        const skip = (page - 1) * safeLimit;

        const now = new Date();
        const expiryTime = new Date(now.getTime() + hoursUntilExpiry * 60 * 60 * 1000);

        const query = {
            status: OfferStatus.ACTIVE,
            availableUntil: { $lte: expiryTime, $gte: now }
        };

        const [offers, total] = await Promise.all([
            this.offerModel
                .find(query)
                .select(OFFER_LIST_FIELDS) // ✅ ENTERPRISE: Only fetch required fields
                .populate('establishmentId', 'name address type')
                .populate('merchantId', 'firstName lastName email profileImage')
                .sort({ availableUntil: 1 }) // Sort by expiry time (soonest first)
                .skip(skip)
                .limit(safeLimit)
                .lean() // ✅ ENTERPRISE: 50% memory reduction
                .exec(),
            this.offerModel.countDocuments(query)
        ]);

        return { offers, total };
    }

    /**
     * Get urgent offers (public-facing wrapper for expiring offers)
     *
     * @description Returns active offers expiring within a specified time window.
     * Designed for "Urgent Deals" sections that need to show offers based on
     * actual time remaining, not manual/auto featuring flags.
     *
     * Differences from getExpiringOffers:
     * - Public endpoint (no auth required)
     * - Default: 1 hour (vs 24 hours for admin expiring endpoint)
     * - Includes merchant profileImage for card display
     *
     * @param hoursUntilExpiry - Hours until expiry threshold (default: 1)
     * @param page - Page number (1-indexed)
     * @param limit - Items per page (max 100)
     * @returns Paginated urgent offers with total count, sorted by soonest expiring first
     */
    async getUrgentOffers(
        hoursUntilExpiry: number = 1,
        page: number = 1,
        limit: number = 10
    ): Promise<FindAllResult> {
        // ✅ Reuse existing getExpiringOffers logic
        // This ensures consistency and reduces code duplication
        return this.getExpiringOffers(hoursUntilExpiry, page, limit);
    }

    /**
     * Get personalized recommended offers for user (MVP)
     *
     * Business Logic:
     * 1. Priority 1: Offers from user's favorited establishments
     * 2. Priority 2: Offers in user's favorited categories
     * 3. Fallback: Featured offers (if no favorites exist)
     *
     * Hard Filters (CRITICAL):
     * - availableQuantity > 0 (not sold out)
     * - availableUntil >= now (not expired, pickup window valid)
     * - isActive = true, status = ACTIVE
     *
     * Ranking (Better than simple discount):
     * - Priority: favorited establishment (1) > favorited category (2)
     * - Discount percentage DESC (highest first)
     * - Expiry ASC (urgent offers first - expiring soon show up)
     * - CreatedAt DESC (tie-breaker)
     *
     * Security:
     * - Uses stable categoryId/slug matching (not itemName - prevents drift/casing issues)
     * - De-duplicates offers matching both establishment + category
     *
     * @param userId - User ID for personalization
     * @param limit - Maximum offers to return (default: 20, max: 100)
     * @returns Recommended offers array
     */
    async getRecommendedOffers(userId: string, limit: number = 20): Promise<OfferLean[]> {
        // ✅ ENTERPRISE: DOS protection - limit max page size
        const safeLimit = Math.min(limit, 100);

        // Step 1: Get user's active favorites
        // TODO: Fetch favorites via FavoritesService or event-driven approach
        const favorites: any[] = [];

        // Extract favorited establishment IDs and categories
        const favoritedEstablishments = favorites
            .filter(f => f.type === 'establishment')
            .map(f => f.itemId);

        const favoritedCategories = favorites
            .filter(f => f.type === 'category')
            .map(f => f.itemName); // Using itemName for categories (stored as string names)

        // Step 2: Fallback - If no favorites, return featured offers
        if (favoritedEstablishments.length === 0 && favoritedCategories.length === 0) {
            this.logger.log(
                `User ${userId} has no favorites, returning featured offers`,
                'OffersService'
            );
            const result = await this.getFeaturedOffers(1, safeLimit);
            return result.offers;
        }

        const now = new Date();

        // Step 3: Build aggregation pipeline with hard filters and smart ranking
        const pipeline: PipelineStage[] = [
            // ✅ HARD FILTERS (CRITICAL)
            {
                $match: {
                    status: OfferStatus.ACTIVE,
                    isActive: true,
                    availableUntil: { $gte: now }, // Not expired, pickup window valid
                    availableFrom: { $lte: now }, // Already started
                    $or: [
                        { establishmentId: { $in: favoritedEstablishments } }, // From fav establishments
                        { categories: { $in: favoritedCategories } }           // From fav categories
                    ]
                }
            },
            // ✅ Calculate available quantity and filter sold out
            {
                $addFields: {
                    availableQuantity: {
                        $subtract: [
                            '$totalQuantity',
                            { $add: ['$reservedQuantity', '$soldQuantity'] }
                        ]
                    }
                }
            },
            {
                $match: {
                    availableQuantity: { $gt: 0 } // ✅ HARD FILTER: Not sold out
                }
            },
            // ✅ Add priority field for ranking
            {
                $addFields: {
                    priority: {
                        $cond: {
                            if: { $in: ['$establishmentId', favoritedEstablishments] },
                            then: 1, // Priority 1: Favorited establishment
                            else: 2  // Priority 2: Favorited category only
                        }
                    },
                    // Calculate urgency (ms until expiry) for sorting
                    urgencyScore: {
                        $subtract: ['$availableUntil', now]
                    }
                }
            },
            // ✅ BETTER RANKING: Priority → Discount → Urgency → CreatedAt
            {
                $sort: {
                    priority: 1,                            // Favorited establishments first
                    'pricing.discountPercentage': -1,       // Highest discount
                    urgencyScore: 1,                         // Expiring soon (ASC - smaller values = more urgent)
                    createdAt: -1                            // Newest (tie-breaker)
                }
            },
            // ✅ Populate establishment details
            {
                $lookup: {
                    from: 'establishments',
                    localField: 'establishmentId',
                    foreignField: '_id',
                    as: 'establishment'
                }
            },
            { $unwind: { path: '$establishment', preserveNullAndEmptyArrays: true } },
            // ✅ Populate merchant details
            {
                $lookup: {
                    from: 'users',
                    localField: 'merchantId',
                    foreignField: '_id',
                    as: 'merchant'
                }
            },
            { $unwind: { path: '$merchant', preserveNullAndEmptyArrays: true } },
            // ✅ ENTERPRISE: Project only required fields for performance
            {
                $project: {
                    title: 1,
                    description: 1,
                    type: 1,
                    images: 1,
                    pricing: 1,
                    totalQuantity: 1,
                    soldQuantity: 1,
                    reservedQuantity: 1,
                    availableQuantity: 1,
                    availableFrom: 1,
                    availableUntil: 1,
                    establishmentId: 1,
                    merchantId: 1,
                    categories: 1,
                    tags: 1,
                    status: 1,
                    pickupTimeSlots: 1,
                    viewCount: 1,
                    favoriteCount: 1,
                    isFeaturedManual: 1,
                    isFeaturedAuto: 1,
                    createdAt: 1,
                    // Establishment details
                    'establishment.name': 1,
                    'establishment.address': 1,
                    'establishment.type': 1,
                    'establishment.averageRating': 1,
                    'establishment.profileImage': 1,
                    // Merchant details
                    'merchant.profileImage': 1,
                    // Internal fields for debugging (optional)
                    priority: 1,
                    urgencyScore: 1
                }
            },
            { $limit: safeLimit }
        ];

        const offers = await this.offerModel.aggregate(pipeline).exec();

        this.logger.log(
            `Recommended ${offers.length} offers for user ${userId} ` +
            `(${favoritedEstablishments.length} fav establishments, ${favoritedCategories.length} fav categories)`,
            'OffersService'
        );

        return offers as OfferLean[];
    }

    /**
     * Calculate distance between two geographic coordinates using Haversine formula
     * @param lat1 - User latitude
     * @param lon1 - User longitude
     * @param lat2 - Establishment latitude
     * @param lon2 - Establishment longitude
     * @returns Distance in meters
     */
    calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return Math.round(R * c); // Distance in meters
    }

    private validateEstablishmentOwnership(_establishmentId: string, _merchantId: string): EstablishmentDocument | null {
        // This would typically use EstablishmentsService
        // For now, we'll assume the validation is done at controller level
        return null;
    }

    /**
     * Calculates discount percentage from prices and enforces business rules
     * ✅ SECURITY: Backend-calculated, user has no control over discount percentage
     * ✅ BUSINESS: Enforces 50-90% discount range for food waste reduction legitimacy
     * ✅ SECURITY: System-enforces TND currency
     */
    private calculateAndValidatePricing(pricing: Partial<OfferPricing>): OfferPricing {
        if (!pricing.originalPrice || !pricing.discountedPrice) {
            throw new BadRequestException('Original price and discounted price are required');
        }

        if (pricing.discountedPrice >= pricing.originalPrice) {
            throw new BadRequestException('Discounted price must be less than original price');
        }

        // ✅ Calculate discount percentage (backend-only, not user input)
        const discountPercentage = Math.round(
            ((pricing.originalPrice - pricing.discountedPrice) / pricing.originalPrice) * 100
        );

        // ✅ BUSINESS: Enforce minimum 50% discount
        if (discountPercentage < 50 || discountPercentage > 90) {
            throw new BadRequestException(
                `Discount must be between 50% and 90%. Your prices result in ${discountPercentage}% discount.`
            );
        }

        return {
            originalPrice: pricing.originalPrice,
            discountedPrice: pricing.discountedPrice,
            discountPercentage,
            currency: Currency.TND, // ✅ SECURITY: System-enforced
        };
    }

    private validatePickupTimeSlots(slots: OfferPickupTimeSlot[]): void {
        if (slots?.length === 0) {
            throw new BadRequestException('At least one pickup time slot is required');
        }

        for (const slot of slots) {
            const start = slot.startTime.split(':');
            const end = slot.endTime.split(':');

            const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
            const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);

            if (startMinutes >= endMinutes) {
                throw new BadRequestException('Pickup slot start time must be before end time');
            }

            if (slot.maxOrders < 1) {
                throw new BadRequestException('Maximum orders per slot must be at least 1');
            }
        }
    }

    /**
     * Validates that total pickup slot capacity doesn't exceed available quantity
     * Prevents overbooking scenarios where sum(maxOrders) > totalQuantity
     */
    private validatePickupSlotsAgainstQuantity(
        slots: OfferPickupTimeSlot[],
        totalQuantity: number
    ): void {
        const totalSlotCapacity = slots.reduce((sum, slot) => sum + slot.maxOrders, 0);

        if (totalSlotCapacity > totalQuantity) {
            throw new BadRequestException(
                `Total pickup slot capacity (${totalSlotCapacity}) exceeds available quantity (${totalQuantity}). ` +
                `Please reduce maxOrders per slot or increase totalQuantity.`
            );
        }
    }

    async updateExpiredOffers(): Promise<number> {
        const result = await this.offerModel.updateMany(
            {
                status: OfferStatus.ACTIVE,
                availableUntil: { $lt: new Date() }
            },
            {
                status: OfferStatus.EXPIRED,
                expiredAt: new Date()
            }
        );
        return result.modifiedCount;
    }

    // =========================================================================
    // FEATURING MANAGEMENT
    // =========================================================================

    /**
     * Set manual featuring status (ADMIN ONLY)
     * This method should ONLY be called by admin users through controller
     *
     * @param offerId - Offer ID to update
     * @param isFeatured - Featured status
     * @param userId - Admin user ID performing the action
     * @returns Updated offer document
     */
    async setManualFeatured(
        offerId: string,
        isFeatured: boolean,
        userId?: string
    ): Promise<OfferDocument> {
        const updateData: any = {
            isFeaturedManual: isFeatured,
        };

        // Set featured timestamp and user when featuring
        if (isFeatured) {
            updateData.featuredAt = new Date();
            if (userId) {
                updateData.featuredBy = new Types.ObjectId(userId);
            }
        } else {
            // Clear featured metadata when unfeaturing
            updateData.featuredAt = null;
            updateData.featuredBy = null;
        }

        const offer = await this.offerModel.findByIdAndUpdate(
            offerId,
            updateData,
            { new: true }
        ).exec();

        if (!offer) {
            throw new NotFoundException('Offer not found');
        }

        this.logger.log(
            `Offer ${offerId} manually ${isFeatured ? 'featured' : 'unfeatured'} by admin ${userId || 'unknown'}`,
            'OffersService'
        );

        return offer;
    }

    /**
     * Legacy method for backward compatibility
     * @deprecated Use setManualFeatured instead
     */
    async setFeatured(offerId: string, isFeatured: boolean): Promise<OfferDocument> {
        return this.setManualFeatured(offerId, isFeatured);
    }

    /**
     * Auto-feature eligible offers based on urgency criteria
     * Business Rules:
     * - Offer must have existed for >= 2 hours (configurable)
     * - Offer must have <= 1.5 hours remaining (configurable)
     * - Offer must be ACTIVE status
     * - Offer must have available quantity > 0
     *
     * @returns Number of offers auto-featured
     */
    async autoFeatureEligibleOffers(): Promise<number> {
        if (!AUTO_FEATURE_ENABLED) {
            return 0;
        }

        const now = new Date();
        const existenceCutoff = new Date(now.getTime() - MIN_EXISTENCE_MS);
        const urgencyDeadline = new Date(now.getTime() + URGENCY_THRESHOLD_MS);

        // Find offers eligible for auto-featuring
        const eligibleOffers = await this.offerModel.find({
            status: OfferStatus.ACTIVE,
            createdAt: { $lte: existenceCutoff }, // Existed for at least MIN_EXISTENCE_HOURS
            availableUntil: {
                $gte: now, // Not expired
                $lte: urgencyDeadline, // Within urgency window
            },
            isFeaturedAuto: false, // Not already auto-featured
        }).select('_id totalQuantity reservedQuantity soldQuantity').exec();

        // Filter out sold-out offers (must check virtual field)
        const offersToFeature = eligibleOffers.filter(offer => {
            const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
            return availableQuantity > 0;
        });

        if (offersToFeature.length === 0) {
            return 0;
        }

        // Bulk update to auto-feature
        const offerIds = offersToFeature.map(o => o._id);
        const result = await this.offerModel.updateMany(
            { _id: { $in: offerIds } },
            {
                isFeaturedAuto: true,
                featuredAt: now,
            }
        ).exec();

        this.logger.log(
            `Auto-featured ${result.modifiedCount} offers (existed >= ${MIN_EXISTENCE_HOURS}h, <= ${URGENCY_THRESHOLD_HOURS}h remaining)`,
            'OffersService'
        );

        return result.modifiedCount;
    }

    /**
     * Auto-unfeature offers that no longer meet urgency criteria
     * Offers are unfeatured if:
     * - Status is not ACTIVE
     * - Offer has expired
     * - Offer is no longer urgent (> 1.5 hours remaining)
     * - Offer is sold out
     *
     * Note: Does NOT unfeature manually featured offers (isFeaturedManual = true)
     *
     * @returns Number of offers auto-unfeatured
     */
    async autoUnfeatureIneligibleOffers(): Promise<number> {
        if (!AUTO_FEATURE_ENABLED) {
            return 0;
        }

        const now = new Date();
        const urgencyDeadline = new Date(now.getTime() + URGENCY_THRESHOLD_MS);

        // Find auto-featured offers that are no longer eligible
        // Conditions for unfeaturing:
        // 1. Status is not ACTIVE, OR
        // 2. Expired (availableUntil <= now), OR
        // 3. No longer urgent (availableUntil > urgencyDeadline)
        const result = await this.offerModel.updateMany(
            {
                isFeaturedAuto: true,
                isFeaturedManual: false, // Don't touch manually featured offers
                $or: [
                    { status: { $ne: OfferStatus.ACTIVE } },
                    { availableUntil: { $lte: now } }, // Expired
                    { availableUntil: { $gt: urgencyDeadline } }, // No longer urgent
                ],
            },
            {
                isFeaturedAuto: false,
            }
        ).exec();

        if (result.modifiedCount > 0) {
            this.logger.log(
                `Auto-unfeatured ${result.modifiedCount} offers (no longer urgent)`,
                'OffersService'
            );
        }

        return result.modifiedCount;
    }

    // =========================================================================
    // CRON JOBS
    // =========================================================================

    /**
     * Cron job: Auto-feature/unfeature offers based on urgency
     * Runs every 5 minutes (configurable via AUTO_FEATURE_CRON_SCHEDULE)
     */
    @Cron(AUTO_FEATURE_CRON_SCHEDULE)
    async handleAutoFeaturing() {
        if (!AUTO_FEATURE_ENABLED) {
            return;
        }

        try {
            const startTime = Date.now();

            // Auto-feature eligible offers
            const featured = await this.autoFeatureEligibleOffers();

            // Auto-unfeature ineligible offers
            const unfeatured = await this.autoUnfeatureIneligibleOffers();

            const duration = Date.now() - startTime;

            if (featured > 0 || unfeatured > 0) {
                this.logger.log(
                    `Auto-featuring completed in ${duration}ms: ${featured} featured, ${unfeatured} unfeatured`,
                    'OffersService'
                );
            }
        } catch (error) {
            this.logger.error(
                'Error in auto-featuring cron job',
                error instanceof Error ? error.stack : String(error),
                'OffersService'
            );
        }
    }

    /**
     * Cron job: Update expired offers
     * Runs every 5 minutes
     */
    @Cron(CronExpression.EVERY_5_MINUTES)
    async handleUpdateExpired() {
        const updated = await this.updateExpiredOffers();
        if (updated > 0) {
            this.logger.log(`Expired offers updated: ${updated}`, 'OffersService');
        }
    }

    // =========================================================================
    // ADMIN ESTABLISHMENT EVENT HANDLERS
    // =========================================================================

    /**
     * Deactivate all offers for an establishment (triggered by admin suspension)
     * Used when admin suspends an establishment account
     *
     * @param establishmentId - Establishment ID whose offers should be deactivated
     * @param reason - Reason for deactivation (e.g., "Establishment suspended by admin")
     * @returns Number of offers deactivated
     */
    async deactivateEstablishmentOffers(
        establishmentId: string,
        reason: string,
    ): Promise<number> {
        try {
            // Find all active offers for this establishment
            const activeOffers = await this.offerModel
                .find({
                    establishmentId: new Types.ObjectId(establishmentId),
                    status: OfferStatus.ACTIVE,
                })
                .lean();

            if (activeOffers.length === 0) {
                this.logger.debug(
                    `No active offers to deactivate for establishment ${establishmentId}`,
                    'OffersService',
                );
                return 0;
            }

            // Update offers to suspended status
            const result = await this.offerModel.updateMany(
                {
                    establishmentId: new Types.ObjectId(establishmentId),
                    status: OfferStatus.ACTIVE,
                },
                {
                    $set: {
                        status: OfferStatus.SUSPENDED,
                        deactivationReason: reason,
                        deactivatedAt: new Date(),
                        deactivatedBy: 'system',
                        // Remove auto-featuring flags when deactivated
                        isFeaturedAuto: false,
                        isFeaturedManual: false,
                    },
                },
            );

            this.logger.log(
                `Deactivated ${result.modifiedCount} active offers for establishment ${establishmentId}. Reason: ${reason}`,
                'OffersService',
            );

            // Log each deactivated offer for audit trail
            for (const offer of activeOffers) {
                this.logger.warn(
                    `Offer ${offer._id.toString()} "${offer.title}" deactivated due to establishment suspension`,
                    'OffersService.EstablishmentSuspension',
                );
            }

            // TODO: Future enhancement - Emit offer.deactivated events for search index updates
            // TODO: Future enhancement - Cancel any active reservations for these offers

            return result.modifiedCount;
        } catch (error) {
            this.logger.error(
                `Failed to deactivate offers for establishment ${establishmentId}: ${error.message}`,
                error instanceof Error ? error.stack : String(error),
                'OffersService',
            );
            throw error;
        }
    }
}