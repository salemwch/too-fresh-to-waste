import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';

import { AppLoggerService } from 'src/common/services/logger.service';
import { User, UserDocument } from 'src/users/schemas/user.schema';

import {
  CreateLedgerDto,
  BankTransferParams,
  TransferResult,
  PayoutResult,
} from '../dto/create-ledger.dto';
import {
  MerchantPayoutLedger,
  MerchantPayoutLedgerDocument,
  LedgerStatus,
} from '../schemas/merchant-payout-ledger.schema';

interface MerchantPayoutStatusStat {
  _id: LedgerStatus;
  totalAmount: number;
  count: number;
  lastDate: Date | null;
}

/**
 * PayoutService
 *
 * Manages merchant payout ledger entries and processes monthly payouts.
 * Implements the TGTG-style payment model with:
 * - 81% merchant / 19% platform revenue split
 * - Monthly payout aggregation
 * - Stubbed bank transfer (ready for real integration)
 */
@Injectable()
export class PayoutService {
  private readonly logger = new Logger(PayoutService.name);

  constructor(
    @InjectModel(MerchantPayoutLedger.name)
    private readonly ledgerModel: Model<MerchantPayoutLedgerDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly appLogger: AppLoggerService,
  ) {}

  /**
   * TND is quoted to three decimals (millimes). Matches the rounding
   * convention in `order-pricing.util.ts`'s `round()` - summing many
   * already-rounded ledger entries can still drift in IEEE-754
   * (e.g. `129.60000000000002`), so the summed total is rounded again here.
   */
  private round(value: number): number {
    return parseFloat(value.toFixed(3));
  }

  /**
   * Creates a ledger entry when pickup is confirmed
   * Calculates 81/19 split and records for future payout
   *
   * @param data - Order and payment details
   * @param session - MongoDB session for transaction support
   * @returns Created ledger entry
   */
  async createLedgerEntry(
    data: CreateLedgerDto,
    session?: ClientSession,
  ): Promise<MerchantPayoutLedgerDocument> {
    // Fetch merchant details for denormalization
    const merchant = await this.userModel.findById(data.merchantId);

    if (!merchant) {
      throw new Error(`Merchant not found: ${data.merchantId}`);
    }

    /*
     * Revenue split — food subtotal only, never the gross total.
     *
     * Under the commission-wallet model the caller has already decided both
     * numbers: the merchant is credited the full subtotal on most orders, and
     * the platform's cut on *this* order is whatever was collected against the
     * outstanding balance (usually 0), not a flat 19%. Recomputing the flat
     * split here would double-count the commission — once in the balance and
     * again in the payout — so the caller's figures win when supplied.
     */
    const merchantAmount = data.commissionSettlement.merchantAmount;
    const platformFee = data.commissionSettlement.settled;

    const ledgerEntry = new this.ledgerModel({
      merchantId: data.merchantId,
      merchantName:
        `${merchant.firstName || ''} ${merchant.lastName || ''}`.trim() || 'Unknown Merchant',
      merchantEmail: merchant.email,
      orderId: data.orderId,
      paymentId: data.paymentId,
      establishmentId: data.establishmentId,
      orderTotal: data.orderTotal,
      merchantAmount,
      platformFee,
      currency: 'TND',
      status: LedgerStatus.PENDING_SETTLEMENT,
      earnedAt: new Date(),
    });

    const savedEntry = session ? await ledgerEntry.save({ session }) : await ledgerEntry.save();

    this.appLogger.log(
      `Created ledger entry for order ${data.orderId}: ` +
        `merchant ${merchantAmount} TND, platform ${platformFee} TND`,
      'PayoutService',
    );

    return savedEntry;
  }

  /**
   * Gets all pending settlement entries for a merchant
   *
   * @param merchantId - Merchant user ID
   * @returns Array of pending ledger entries
   */
  async getPendingSettlements(merchantId: string): Promise<MerchantPayoutLedgerDocument[]> {
    const settlements = await this.ledgerModel
      .find({
        merchantId: new Types.ObjectId(merchantId),
        status: LedgerStatus.PENDING_SETTLEMENT,
      })
      .sort({ earnedAt: 1 });
    return settlements;
  }

  /**
   * Aggregates pending settlements by merchant for payout processing
   *
   * @returns Array of merchant aggregations with totals
   */
  async aggregatePendingByMerchant(): Promise<
    Array<{
      _id: Types.ObjectId;
      merchantName: string;
      merchantEmail: string;
      totalAmount: number;
      totalPlatformFee: number;
      entryCount: number;
    }>
  > {
    const aggregation = await this.ledgerModel.aggregate<{
      _id: Types.ObjectId;
      merchantName: string;
      merchantEmail: string;
      totalAmount: number;
      totalPlatformFee: number;
      entryCount: number;
    }>([
      { $match: { status: LedgerStatus.PENDING_SETTLEMENT } },
      {
        $group: {
          _id: '$merchantId',
          merchantName: { $first: '$merchantName' },
          merchantEmail: { $first: '$merchantEmail' },
          totalAmount: { $sum: '$merchantAmount' },
          totalPlatformFee: { $sum: '$platformFee' },
          entryCount: { $sum: 1 },
        },
      },
      {
        // Ledger entries are already rounded to millimes, but summing many
        // of them can still drift in IEEE-754 - round the total too.
        $addFields: {
          totalAmount: { $round: ['$totalAmount', 3] },
          totalPlatformFee: { $round: ['$totalPlatformFee', 3] },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]);
    return aggregation;
  }

  /**
   * Processes payout for a single merchant
   * Updates all pending ledger entries to PAID_OUT
   *
   * @param merchantId - Merchant user ID
   * @param batchId - Payout batch identifier
   * @returns Payout result
   */
  async processMerchantPayout(merchantId: string, batchId: string): Promise<PayoutResult> {
    // Get all pending entries for this merchant
    const pendingEntries = await this.ledgerModel.find({
      merchantId: new Types.ObjectId(merchantId),
      status: LedgerStatus.PENDING_SETTLEMENT,
    });

    if (pendingEntries.length === 0) {
      return {
        merchantId,
        merchantName: 'Unknown',
        totalAmount: 0,
        entryCount: 0,
        success: true,
        error: 'No pending entries',
      };
    }

    const firstPendingEntry = pendingEntries[0];
    if (!firstPendingEntry) {
      return {
        merchantId,
        merchantName: 'Unknown',
        totalAmount: 0,
        entryCount: 0,
        success: true,
        error: 'No pending entries',
      };
    }

    const merchantName = firstPendingEntry.merchantName;
    const merchantEmail = firstPendingEntry.merchantEmail;
    const totalAmount = this.round(pendingEntries.reduce((sum, e) => sum + e.merchantAmount, 0));
    const entryIds = pendingEntries.map(e => e._id);

    // Execute bank transfer (stubbed)
    const transferResult = await this.executeBankTransfer({
      merchantId,
      merchantName,
      merchantEmail,
      amount: totalAmount,
      currency: 'TND',
      batchId,
    });

    if (transferResult.success) {
      // Update all entries to PAID_OUT
      await this.ledgerModel.updateMany(
        { _id: { $in: entryIds } },
        {
          status: LedgerStatus.PAID_OUT,
          paidOutAt: new Date(),
          transferRef: transferResult.transferRef,
          batchId,
        },
      );

      this.appLogger.log(
        `Payout successful for ${merchantName}: ${totalAmount} TND (${pendingEntries.length} orders)`,
        'PayoutService',
      );

      return {
        merchantId,
        merchantName,
        totalAmount,
        entryCount: pendingEntries.length,
        success: true,
        transferRef: transferResult.transferRef,
      };
    }
    // Mark as failed for retry
    await this.ledgerModel.updateMany(
      { _id: { $in: entryIds } },
      {
        status: LedgerStatus.FAILED,
        lastError: transferResult.error,
        $inc: { retryCount: 1 },
        nextRetryAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Retry next day
      },
    );

    this.appLogger.error(
      `Payout failed for ${merchantName}: ${transferResult.error}`,
      'PayoutService',
    );

    return {
      merchantId,
      merchantName,
      totalAmount,
      entryCount: pendingEntries.length,
      success: false,
      error: transferResult.error,
    };
  }

  /**
   * STUB: Bank transfer implementation
   *
   * In production, this would integrate with:
   * - Tunisian banking APIs (STB, BNA, BIAT)
   * - International wire transfer providers
   * - Mobile money providers (e.g., Ooredoo, Tunisie Telecom)
   *
   * @param params - Transfer parameters
   * @returns Transfer result with reference
   */
  private async executeBankTransfer(params: BankTransferParams): Promise<TransferResult> {
    this.logger.log(
      `[STUB] Bank transfer: ${params.amount} ${params.currency} to merchant ${params.merchantName} (${params.merchantId})`,
    );

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // In production: Call actual banking API
    // Example integration points:
    // - Bank transfer endpoint
    // - SWIFT/IBAN transfer for international
    // - Mobile money APIs

    // For now, always succeed with mock reference
    return {
      success: true,
      transferRef: `TXF-${params.batchId}-${Date.now()}-${params.merchantId.slice(-4)}`,
      timestamp: new Date(),
    };
  }

  /**
   * Retries failed payouts
   * Called by a separate retry cron job
   *
   * @param batchId - New batch ID for retry
   * @returns Array of retry results
   */
  async retryFailedPayouts(batchId: string): Promise<PayoutResult[]> {
    const failedEntries = await this.ledgerModel.aggregate<{
      _id: Types.ObjectId;
      count: number;
    }>([
      {
        $match: {
          status: LedgerStatus.FAILED,
          nextRetryAt: { $lte: new Date() },
          retryCount: { $lt: 3 }, // Max 3 retries
        },
      },
      {
        $group: {
          _id: '$merchantId',
          count: { $sum: 1 },
        },
      },
    ]);

    const results: PayoutResult[] = [];

    for (const entry of failedEntries) {
      const result = await this.processMerchantPayout(entry._id.toString(), batchId);
      results.push(result);
    }

    return results;
  }

  /**
   * Gets payout statistics for a merchant
   *
   * @param merchantId - Merchant user ID
   * @returns Payout statistics
   */
  async getMerchantPayoutStats(merchantId: string): Promise<{
    pendingAmount: number;
    pendingCount: number;
    paidOutAmount: number;
    paidOutCount: number;
    lastPayoutDate: Date | null;
  }> {
    const stats = await this.ledgerModel.aggregate<MerchantPayoutStatusStat>([
      { $match: { merchantId: new Types.ObjectId(merchantId) } },
      {
        $group: {
          _id: '$status',
          totalAmount: { $sum: '$merchantAmount' },
          count: { $sum: 1 },
          lastDate: { $max: '$paidOutAt' },
        },
      },
    ]);

    const pending = stats.find(s => s._id === LedgerStatus.PENDING_SETTLEMENT);
    const paidOut = stats.find(s => s._id === LedgerStatus.PAID_OUT);

    return {
      pendingAmount: pending?.totalAmount ?? 0,
      pendingCount: pending?.count ?? 0,
      paidOutAmount: paidOut?.totalAmount ?? 0,
      paidOutCount: paidOut?.count ?? 0,
      lastPayoutDate: paidOut?.lastDate ?? null,
    };
  }

  /**
   * Gets ledger entry by order ID
   * Used to check if ledger already exists (idempotency)
   *
   * @param orderId - Order ID
   * @returns Ledger entry or null
   */
  async findByOrderId(orderId: string): Promise<MerchantPayoutLedgerDocument | null> {
    const ledger = await this.ledgerModel.findOne({
      orderId: new Types.ObjectId(orderId),
    });
    return ledger;
  }
}
