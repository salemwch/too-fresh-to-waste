import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';

import { PayoutBatchSummary, PayoutResult } from '../dto/create-ledger.dto';
import { PayoutService } from '../services/payout.service';
import { WalletPayoutService } from '../services/wallet-payout.service';

/**
 * PayoutTask
 *
 * Weekly payout cron job that processes all pending merchant settlements.
 * Runs every Monday at 8:00 AM Africa/Tunis.
 */
@Injectable()
export class PayoutTask {
  private readonly logger = new Logger(PayoutTask.name);

  constructor(
    private readonly payoutService: PayoutService,
    private readonly walletPayoutService: WalletPayoutService,
  ) {}

  @Cron('0 8 * * 1', { timeZone: 'Africa/Tunis' })
  async processWeeklyPayouts(): Promise<PayoutBatchSummary> {
    const batchId = `BATCH-${new Date().toISOString().slice(0, 7)}-${Date.now()}`;
    this.logger.log(`Starting weekly payout batch: ${batchId}`);

    const startTime = Date.now();

    try {
      // Get all merchants with pending settlements
      const merchantGroups = await this.payoutService.aggregatePendingByMerchant();

      if (merchantGroups.length === 0) {
        this.logger.log('No pending settlements to process');
        return {
          batchId,
          processedAt: new Date(),
          totalMerchants: 0,
          successfulPayouts: 0,
          failedPayouts: 0,
          totalAmountPaid: 0,
          totalPlatformFee: 0,
        };
      }

      this.logger.log(`Processing payouts for ${merchantGroups.length} merchants`);

      const results: PayoutResult[] = [];
      let successCount = 0;
      let failureCount = 0;
      let totalAmountPaid = 0;
      let totalPlatformFee = 0;

      // Process each merchant sequentially to avoid overwhelming the bank API
      for (const group of merchantGroups) {
        try {
          const result = await this.payoutService.processMerchantPayout(
            group._id.toString(),
            batchId,
          );

          results.push(result);

          if (result.success) {
            successCount++;
            totalAmountPaid += result.totalAmount;
            totalPlatformFee += group.totalPlatformFee;
            this.logger.log(
              `Payout successful: ${group.merchantName} - ${result.totalAmount} TND (${result.entryCount} orders)`,
            );
          } else {
            failureCount++;
            this.logger.error(`Payout failed: ${group.merchantName} - ${result.error}`);
          }
        } catch (error) {
          failureCount++;
          this.logger.error(
            `Payout exception for merchant ${group._id}: ${(error as Error).message}`,
          );
          results.push({
            merchantId: group._id.toString(),
            merchantName: group.merchantName,
            totalAmount: group.totalAmount,
            entryCount: group.entryCount,
            success: false,
            error: (error as Error).message,
          });
        }
      }

      // Wallet-based payouts for online-paid orders
      try {
        const walletResults = await this.walletPayoutService.processWeeklyWalletPayouts();
        const walletSuccess = walletResults.filter(r => r.success).length;
        const walletTotal = walletResults.reduce((s, r) => s + r.amount, 0);
        this.logger.log(
          `Wallet payouts: ${walletSuccess}/${walletResults.length} successful, ${walletTotal} TND`,
        );
      } catch (walletError) {
        this.logger.error(`Wallet payout batch failed: ${(walletError as Error).message}`);
      }

      const duration = Date.now() - startTime;
      const summary: PayoutBatchSummary = {
        batchId,
        processedAt: new Date(),
        totalMerchants: merchantGroups.length,
        successfulPayouts: successCount,
        failedPayouts: failureCount,
        totalAmountPaid,
        totalPlatformFee,
      };

      this.logger.log(
        `Batch ${batchId} complete in ${duration}ms: ` +
          `${successCount} successful, ${failureCount} failed, ` +
          `${totalAmountPaid} TND paid, ${totalPlatformFee} TND platform fee`,
      );

      return summary;
    } catch (error) {
      this.logger.error(`Weekly payout batch ${batchId} failed: ${(error as Error).message}`);
      throw error;
    }
  }

  @Cron('0 2 * * *', { timeZone: 'Africa/Tunis' })
  async retryFailedPayouts(): Promise<void> {
    const batchId = `RETRY-${Date.now()}`;
    this.logger.log(`Starting failed payout retry batch: ${batchId}`);

    try {
      const results = await this.payoutService.retryFailedPayouts(batchId);

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (results.length > 0) {
        this.logger.log(
          `Retry batch ${batchId} complete: ${successCount} successful, ${failureCount} still failed`,
        );
      }
    } catch (error) {
      this.logger.error(`Retry batch ${batchId} failed: ${(error as Error).message}`);
    }
  }

  async triggerManualPayout(): Promise<PayoutBatchSummary> {
    this.logger.log('Manual payout trigger initiated');
    const result = await this.processWeeklyPayouts();
    return result;
  }
}
