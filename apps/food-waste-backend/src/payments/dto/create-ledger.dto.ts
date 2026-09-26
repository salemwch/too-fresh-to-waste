import type { Types } from 'mongoose';

/**
 * DTO for creating a MerchantPayoutLedger entry
 * Used when pickup is confirmed to record merchant earnings
 */
export interface CreateLedgerDto {
  merchantId: Types.ObjectId;
  orderId: Types.ObjectId;
  paymentId: Types.ObjectId;
  establishmentId: Types.ObjectId;
  /** Gross amount the customer paid — kept for the ledger's audit record only. */
  orderTotal: number;
  /** Food line only (excludes delivery fee) — this is what the 81/19 split is computed on. */
  subtotal: number;
  /**
   * The order's commission decision (CommissionService / `order.commission`).
   *
   * REQUIRED. The merchant is credited the full subtotal on a NORMAL sale and
   * `subtotal - settled` on a SETTLEMENT; the 19% accrues to
   * `Establishment.commissionDue` instead of being deducted here. There used
   * to be a fallback to a flat 81 / 19 split when this was absent - which the
   * commission-settlement model forbids - so it is no longer optional and the
   * compiler holds every caller to it.
   */
  commissionSettlement: {
    /** `subtotal - settled`. What this order pays the merchant. */
    merchantAmount: number;
    /** Balance collected from this order. `0` on most orders. */
    settled: number;
  };
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
  transferRef?: string | undefined;
  error?: string | undefined;
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
