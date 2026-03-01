import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ArchiveDataDocument = ArchiveData & Document;

/**
 * Valid source collection names for archived records.
 * Maps 1:1 with the main Mongoose model collection names.
 */
export const ARCHIVABLE_COLLECTIONS = [
    'orders',
    'reviews',
    'offers',
    'establishments',
    'userdonations',
    'users',
] as const;

export type ArchivableCollection = (typeof ARCHIVABLE_COLLECTIONS)[number];

/**
 * ArchiveData schema — single collection storing soft-deleted records
 * from all archivable entities after a 30-day retention window.
 *
 * Collection: `Archive_data` (already provisioned in Atlas)
 */
@Schema({ collection: 'Archive_data', timestamps: false })
export class ArchiveData {
    /**
     * Source collection name — discriminator for multi-entity archive.
     */
    @Prop({
        required: true,
        type: String,
        enum: ARCHIVABLE_COLLECTIONS,
        index: true,
    })
    sourceCollection: ArchivableCollection;

    /**
     * Original `_id` from the source document.
     */
    @Prop({ required: true, type: Types.ObjectId })
    originalId: Types.ObjectId;

    /**
     * Timestamp when the record was archived (moved to this collection).
     */
    @Prop({ required: true, type: Date, default: Date.now })
    archivedAt: Date;

    /**
     * Full snapshot of the original document at archive time.
     * Stored as a generic object to support any entity shape.
     */
    @Prop({ required: true, type: Object })
    document: Record<string, any>;
}

export const ArchiveDataSchema = SchemaFactory.createForClass(ArchiveData);

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

/**
 * Unique compound index — prevents duplicate archives of the same record.
 * Lookup pattern: findOne({ sourceCollection: 'orders', originalId })
 */
ArchiveDataSchema.index(
    { sourceCollection: 1, originalId: 1 },
    { unique: true },
);

/**
 * Admin browsing index — enables paginated listing per source collection,
 * sorted by archive date (newest first).
 */
ArchiveDataSchema.index({ sourceCollection: 1, archivedAt: -1 });

/**
 * Chronological purge index — supports future TTL or manual purge cron
 * that removes records older than N months.
 */
ArchiveDataSchema.index({ archivedAt: 1 });
