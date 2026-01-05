import { Types } from 'mongoose';

/**
 * DTO for creating a MerchantPayoutLedger entry
 * Used when pickup is confirmed to record merchant earnings
 */
export interface CreateLedgerDto {
    merchantId: Types.ObjectId;
    orderId: Types.ObjectId;
    paymentId: Types.ObjectId;
    establishmentId: Types.ObjectId;
    orderTotal: number;
}

/**
 * Bank transfer request parameters
 * Interface for the stubbed bank transfer implementation
 */
export interface BankTransferParams {
    merchantId: string;
    merchantName: string;
    merchantEmail: string;
    bankAccount?: string;
    amount: number;
    currency: string;
    batchId: string;
}

/**
 * Bank transfer result
 */
export interface TransferResult {
    success: boolean;
    transferRef?: string;
    timestamp: Date;
    error?: string;
}

/**
 * Payout result for a single merchant
 */
export interface PayoutResult {
    merchantId: string;
    merchantName: string;
    totalAmount: number;
    entryCount: number;
    success: boolean;
    transferRef?: string;
    error?: string;
}

/**
 * Monthly payout batch summary
 */
export interface PayoutBatchSummary {
    batchId: string;
    processedAt: Date;
    totalMerchants: number;
    successfulPayouts: number;
    failedPayouts: number;
    totalAmountPaid: number;
    totalPlatformFee: number;
}
