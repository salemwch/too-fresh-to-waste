import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, Types } from 'mongoose';

import {
    ArchiveData,
    ArchiveDataDocument,
    ArchivableCollection,
} from './schemas/archive-data.schema';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { Review, ReviewDocument } from '../reviwes/schemas/reviwe.schema';
import { Offer, OfferDocument } from '../offers/schemas/offer.schema';
import {
    Establishment,
    EstablishmentDocument,
} from '../establishments/schemas/establishment.schema';
import {
    UserDonation,
    UserDonationDocument,
} from '../donations/schemas/user-donation.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { UserStatus } from '../common/enums/user.enum';

/**
 * Retention period: records soft-deleted more than 30 days ago are eligible
 * for archival. Expressed in milliseconds for Date arithmetic.
 */
const ARCHIVE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Batch size for archive + purge operations.
 * Keeps memory footprint low on Atlas M0 (512 MB).
 */
const BATCH_SIZE = 50;

/** Result of a single entity archival pass. */
export interface ArchiveResult {
    sourceCollection: ArchivableCollection;
    archivedCount: number;
}

@Injectable()
export class ArchiveService {
    private readonly logger = new Logger(ArchiveService.name);

    constructor(
        @InjectModel(ArchiveData.name)
        private readonly archiveModel: Model<ArchiveDataDocument>,
        @InjectModel(Order.name)
        private readonly orderModel: Model<OrderDocument>,
        @InjectModel(Review.name)
        private readonly reviewModel: Model<ReviewDocument>,
        @InjectModel(Offer.name)
        private readonly offerModel: Model<OfferDocument>,
        @InjectModel(Establishment.name)
        private readonly establishmentModel: Model<EstablishmentDocument>,
        @InjectModel(UserDonation.name)
        private readonly userDonationModel: Model<UserDonationDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
    ) {}

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Archive all soft-deleted records across the 6 entities
     * whose deletion date exceeds the retention window (30 days).
     *
     * @returns Array of per-entity archive results.
     */
    async archiveAllExpired(): Promise<ArchiveResult[]> {
        const cutoff = new Date(Date.now() - ARCHIVE_RETENTION_MS);
        const results: ArchiveResult[] = [];

        // Standard isDeleted + deletedAt pattern (5 entities)
        const standardQuery: FilterQuery<any> = {
            isDeleted: true,
            deletedAt: { $lte: cutoff },
        };

        results.push(
            await this.archiveAndPurge(
                this.orderModel,
                standardQuery,
                'orders',
            ),
        );
        results.push(
            await this.archiveAndPurge(
                this.reviewModel,
                standardQuery,
                'reviews',
            ),
        );
        results.push(
            await this.archiveAndPurge(
                this.offerModel,
                standardQuery,
                'offers',
            ),
        );
        results.push(
            await this.archiveAndPurge(
                this.establishmentModel,
                standardQuery,
                'establishments',
            ),
        );
        results.push(
            await this.archiveAndPurge(
                this.userDonationModel,
                standardQuery,
                'userdonations',
            ),
        );

        // User uses status: 'deleted' instead of isDeleted flag
        const userQuery: FilterQuery<any> = {
            status: UserStatus.DELETED,
            deletedAt: { $lte: cutoff },
        };

        results.push(
            await this.archiveAndPurge(
                this.userModel,
                userQuery,
                'users',
            ),
        );

        return results;
    }

    /**
     * Retrieve archived records for admin browsing / investigation.
     *
     * @param sourceCollection - Which entity's archives to query.
     * @param filter - Additional Mongo filter merged into the query.
     * @param page - 1-based page number.
     * @param limit - Documents per page.
     */
    async findArchived(
        sourceCollection: ArchivableCollection,
        filter: FilterQuery<ArchiveDataDocument> = {},
        page = 1,
        limit = 20,
    ): Promise<{ data: ArchiveData[]; total: number }> {
        const query: FilterQuery<ArchiveDataDocument> = {
            sourceCollection,
            ...filter,
        };

        const [data, total] = await Promise.all([
            this.archiveModel
                .find(query)
                .sort({ archivedAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean()
                .exec(),
            this.archiveModel.countDocuments(query).exec(),
        ]);

        return { data, total };
    }

    // =========================================================================
    // Internal
    // =========================================================================

    /**
     * Generic archive-and-purge pipeline for a single entity.
     *
     * 1. Find soft-deleted docs matching `query` (bypasses soft-delete middleware).
     * 2. For each batch of BATCH_SIZE:
     *    a. insertMany into Archive_data (ordered: false to skip duplicates).
     *    b. deleteMany from source by _id list.
     * 3. Return total archived count.
     */
    private async archiveAndPurge<T>(
        model: Model<T>,
        query: FilterQuery<T>,
        sourceCollection: ArchivableCollection,
    ): Promise<ArchiveResult> {
        let totalArchived = 0;

        try {
            // Bypass soft-delete middleware via includeDeleted option.
            // All 6 entity schemas now support this pattern.
            const docs = await (model as Model<any>)
                .find(query)
                .setOptions({ includeDeleted: true })
                .lean()
                .exec();

            if (!docs.length) {
                return { sourceCollection, archivedCount: 0 };
            }

            this.logger.log(
                `Found ${docs.length} expired soft-deleted records in ${sourceCollection}`,
            );

            // Process in batches to keep memory and write size bounded
            for (let i = 0; i < docs.length; i += BATCH_SIZE) {
                const batch = docs.slice(i, i + BATCH_SIZE);
                const archiveDocs = batch.map((doc) => ({
                    sourceCollection,
                    originalId: doc._id as Types.ObjectId,
                    archivedAt: new Date(),
                    document: doc,
                }));

                const ids = batch.map((doc) => doc._id);

                try {
                    // ordered: false — skip duplicates (e.g. if a previous run
                    // inserted some but crashed before deleting from source).
                    await this.archiveModel.insertMany(archiveDocs, {
                        ordered: false,
                    });
                } catch (err: any) {
                    // Code 11000 = duplicate key — expected for partial retries.
                    // Any other error should propagate.
                    if (err?.code !== 11000 && !err?.writeErrors?.every((e: any) => e.err?.code === 11000)) {
                        throw err;
                    }
                    this.logger.warn(
                        `Skipped ${err?.writeErrors?.length ?? 0} duplicate archive entries in ${sourceCollection}`,
                    );
                }

                // Hard-delete from source — deleteMany is NOT affected by
                // soft-delete /^find/ middleware.
                await (model as Model<any>).deleteMany({ _id: { $in: ids } });
                totalArchived += batch.length;
            }

            this.logger.log(
                `Archived and purged ${totalArchived} records from ${sourceCollection}`,
            );
        } catch (error) {
            this.logger.error(
                `Failed to archive ${sourceCollection}: ${(error as Error).message}`,
                (error as Error).stack,
            );
        }

        return { sourceCollection, archivedCount: totalArchived };
    }
}
