import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MerchantPayoutLedgerDocument = MerchantPayoutLedger & Document;

/**
 * Ledger status tracking for merchant payouts
 * - PENDING_SETTLEMENT: Pickup confirmed, awaiting monthly payout
 * - PAID_OUT: Bank transfer completed
 * - FAILED: Bank transfer failed (will retry)
 */
export enum LedgerStatus {
    PENDING_SETTLEMENT = 'pending_settlement',
    PAID_OUT = 'paid_out',
    FAILED = 'failed',
}

/**
 * MerchantPayoutLedger Schema
 *
 * Tracks individual order earnings for merchants using the TGTG payment model.
 * Created when pickup is confirmed, aggregated for monthly payouts.
 *
 * Revenue Split: 75% Merchant / 25% Platform
 */
@Schema({ timestamps: true })
export class MerchantPayoutLedger {
    // =============================================================================
    // REFERENCES
    // =============================================================================

    @Prop({ required: true, type: Types.ObjectId, ref: 'User', index: true })
    merchantId: Types.ObjectId;

    @Prop({ required: true })
    merchantName: string;

    @Prop({ required: true })
    merchantEmail: string;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Order' })  // ✅ Removed unique: true (schema-level at line 136)
    orderId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Payment' })
    paymentId: Types.ObjectId;

    @Prop({ required: true, type: Types.ObjectId, ref: 'Establishment' })
    establishmentId: Types.ObjectId;

    // =============================================================================
    // FINANCIAL AMOUNTS
    // =============================================================================

    @Prop({ required: true, min: 0 })
    orderTotal: number;

    @Prop({ required: true, min: 0 })
    merchantAmount: number;

    @Prop({ required: true, min: 0 })
    platformFee: number;

    @Prop({ type: String, default: 'TND' })
    currency: string;

    // =============================================================================
    // STATUS TRACKING
    // =============================================================================

    @Prop({
        type: String,
        enum: LedgerStatus,
        default: LedgerStatus.PENDING_SETTLEMENT,
        index: true
    })
    status: LedgerStatus;

    @Prop({ required: true })
    earnedAt: Date;

    @Prop()
    paidOutAt?: Date;

    @Prop()
    transferRef?: string;

    @Prop()
    batchId?: string;

    // =============================================================================
    // ERROR HANDLING & RETRY
    // =============================================================================

    @Prop({ default: 0 })
    retryCount: number;

    @Prop()
    lastError?: string;

    @Prop()
    nextRetryAt?: Date;
}

export const MerchantPayoutLedgerSchema = SchemaFactory.createForClass(MerchantPayoutLedger);

// =============================================================================
// INDEXES
// =============================================================================

/**
 * Merchant Payout Query Index
 * - Optimizes monthly payout aggregation by merchant
 * - Query pattern: find({ merchantId, status: 'pending_settlement' })
 */
MerchantPayoutLedgerSchema.index({ merchantId: 1, status: 1 });

/**
 * Monthly Cron Index
 * - Optimizes finding all pending payouts for monthly processing
 * - Query pattern: find({ status: 'pending_settlement' }).sort({ earnedAt: 1 })
 */
MerchantPayoutLedgerSchema.index({ status: 1, earnedAt: 1 });

/**
 * Batch Reconciliation Index
 * - Groups ledger entries by payout batch for auditing
 * - Query pattern: find({ batchId: 'BATCH-xxx' })
 */
MerchantPayoutLedgerSchema.index({ batchId: 1 }, { sparse: true });

/**
 * Order Idempotency Index (Unique)
 * - Prevents duplicate ledger entries for the same order
 * - Critical for data integrity
 */
MerchantPayoutLedgerSchema.index({ orderId: 1 }, { unique: true });

/**
 * Establishment Analytics Index
 * - Enables per-establishment payout reporting
 * - Query pattern: find({ establishmentId, createdAt: { $gte: startDate } })
 */
MerchantPayoutLedgerSchema.index({ establishmentId: 1, earnedAt: -1 });

/**
 * Failed Payout Retry Index
 * - Optimizes retry cron job queries
 * - Query pattern: find({ status: 'failed', nextRetryAt: { $lte: now } })
 */
MerchantPayoutLedgerSchema.index({ status: 1, nextRetryAt: 1 }, { sparse: true });
