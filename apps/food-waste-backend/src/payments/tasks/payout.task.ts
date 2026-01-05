import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayoutService } from '../services/payout.service';
import { PayoutBatchSummary, PayoutResult } from '../dto/create-ledger.dto';

/**
 * PayoutTask
 *
 * Monthly payout cron job that processes all pending merchant settlements.
 * Runs on the first Monday of each month at 8:00 AM Tunisia time (UTC+1).
 *
 * Cron expression breakdown:
 * - '0 7 1-7 * 1' = At 07:00 UTC (08:00 Tunisia) on day 1-7 of month, only if Monday
 * - This ensures it runs on the FIRST Monday of each month
 */
@Injectable()
export class PayoutTask {
    private readonly logger = new Logger(PayoutTask.name);

    constructor(private readonly payoutService: PayoutService) {}

    /**
     * Monthly payout processing
     * Runs on first Monday of each month at 8:00 AM Tunisia time
     *
     * Process:
     * 1. Aggregate all PENDING_SETTLEMENT entries by merchant
     * 2. For each merchant, execute bank transfer (stubbed)
     * 3. Update ledger entries to PAID_OUT
     * 4. Log summary for auditing
     */
    @Cron('0 7 1-7 * 1') // First Monday of month at 7:00 UTC = 8:00 Tunisia
    async processMonthlyPayouts(): Promise<PayoutBatchSummary> {
        const batchId = `BATCH-${new Date().toISOString().slice(0, 7)}-${Date.now()}`;
        this.logger.log(`Starting monthly payout batch: ${batchId}`);

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
                        this.logger.error(
                            `Payout failed: ${group.merchantName} - ${result.error}`,
                        );
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
            this.logger.error(`Monthly payout batch ${batchId} failed: ${(error as Error).message}`);
            throw error;
        }
    }

    /**
     * Retry failed payouts
     * Runs daily at 2:00 AM to retry any failed payouts from previous batches
     */
    @Cron('0 1 * * *') // Daily at 1:00 UTC = 2:00 Tunisia
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

    /**
     * Manual trigger for payout processing
     * Can be called from admin endpoints for testing or emergency processing
     *
     * @returns Batch summary
     */
    async triggerManualPayout(): Promise<PayoutBatchSummary> {
        this.logger.log('Manual payout trigger initiated');
        return this.processMonthlyPayouts();
    }
}
