/* eslint-disable require-await */
import { Test } from '@nestjs/testing';

import { CronLockService } from '../../common/services/cron-lock.service';
import { PayoutService } from '../services/payout.service';
import { WalletPayoutService } from '../services/wallet-payout.service';

import { PayoutTask } from './payout.task';

import type { PayoutBatchSummary } from '../dto/create-ledger.dto';
import type { TestingModule } from '@nestjs/testing';

describe('PayoutTask', () => {
  let task: PayoutTask;
  let payoutService: {
    aggregatePendingByMerchant: jest.Mock;
    processMerchantPayout: jest.Mock;
    retryFailedPayouts: jest.Mock;
  };
  let walletPayoutService: { processWeeklyWalletPayouts: jest.Mock };
  let cronLock: { runExclusive: jest.Mock };

  /**
   * Runs the payout batch and asserts the lock was acquired.
   *
   * `processWeeklyPayouts` now resolves to `undefined` when another replica
   * owns the tick. These tests configure the lock to always be won, so an
   * `undefined` here means the harness is wrong, not the batch.
   */
  const runPayouts = async (): Promise<PayoutBatchSummary> => {
    const summary = await task.processWeeklyPayouts();
    if (summary === undefined) {
      throw new Error('Expected the payout lock to be acquired in tests');
    }
    return summary;
  };

  beforeEach(async () => {
    payoutService = {
      aggregatePendingByMerchant: jest.fn(),
      processMerchantPayout: jest.fn(),
      retryFailedPayouts: jest.fn(),
    };
    walletPayoutService = {
      processWeeklyWalletPayouts: jest.fn(),
    };
    // Default: this replica wins the lock, so the batch actually runs and the
    // existing behavioural assertions below still exercise real code.
    cronLock = {
      runExclusive: jest.fn(async (_name: string, _ttl: number, fn: () => Promise<unknown>) => {
        const result = await fn();
        return result;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutTask,
        { provide: PayoutService, useValue: payoutService },
        { provide: WalletPayoutService, useValue: walletPayoutService },
        { provide: CronLockService, useValue: cronLock },
      ],
    }).compile();

    task = module.get(PayoutTask);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // processWeeklyPayouts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processWeeklyPayouts', () => {
    it('should return summary with zeros when no pending settlements', async () => {
      payoutService.aggregatePendingByMerchant.mockResolvedValue([]);
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([]);

      const summary = await runPayouts();

      expect(summary.totalMerchants).toBe(0);
      expect(summary.successfulPayouts).toBe(0);
      expect(summary.totalAmountPaid).toBe(0);
    });

    it('should process each merchant group sequentially', async () => {
      const groups = [
        {
          _id: 'merchant-1',
          merchantName: 'Shop A',
          totalAmount: 100,
          totalPlatformFee: 19,
          entryCount: 5,
        },
        {
          _id: 'merchant-2',
          merchantName: 'Shop B',
          totalAmount: 200,
          totalPlatformFee: 38,
          entryCount: 3,
        },
      ];
      payoutService.aggregatePendingByMerchant.mockResolvedValue(groups);
      payoutService.processMerchantPayout
        .mockResolvedValueOnce({ success: true, totalAmount: 100, entryCount: 5 })
        .mockResolvedValueOnce({ success: true, totalAmount: 200, entryCount: 3 });
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([]);

      const summary = await runPayouts();

      expect(summary.totalMerchants).toBe(2);
      expect(summary.successfulPayouts).toBe(2);
      expect(summary.failedPayouts).toBe(0);
      expect(summary.totalAmountPaid).toBe(300);
      expect(summary.totalPlatformFee).toBe(57);
    });

    it('should handle partial failures in merchant payouts', async () => {
      const groups = [
        {
          _id: 'm1',
          merchantName: 'Shop A',
          totalAmount: 100,
          totalPlatformFee: 19,
          entryCount: 5,
        },
        {
          _id: 'm2',
          merchantName: 'Shop B',
          totalAmount: 200,
          totalPlatformFee: 38,
          entryCount: 3,
        },
      ];
      payoutService.aggregatePendingByMerchant.mockResolvedValue(groups);
      payoutService.processMerchantPayout
        .mockResolvedValueOnce({ success: true, totalAmount: 100, entryCount: 5 })
        .mockResolvedValueOnce({
          success: false,
          error: 'Bank rejected',
          totalAmount: 0,
          entryCount: 0,
        });
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([]);

      const summary = await runPayouts();

      expect(summary.successfulPayouts).toBe(1);
      expect(summary.failedPayouts).toBe(1);
      expect(summary.totalAmountPaid).toBe(100);
    });

    it('should catch thrown exceptions from processMerchantPayout', async () => {
      const groups = [
        {
          _id: 'm1',
          merchantName: 'Shop A',
          totalAmount: 50,
          totalPlatformFee: 9.5,
          entryCount: 2,
        },
      ];
      payoutService.aggregatePendingByMerchant.mockResolvedValue(groups);
      payoutService.processMerchantPayout.mockRejectedValue(new Error('Connection refused'));
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([]);

      const summary = await runPayouts();

      expect(summary.failedPayouts).toBe(1);
      expect(summary.successfulPayouts).toBe(0);
    });

    it('should also run wallet-based payouts for online orders', async () => {
      const groups = [
        {
          _id: 'm1',
          merchantName: 'Shop A',
          totalAmount: 50,
          totalPlatformFee: 9.5,
          entryCount: 2,
        },
      ];
      payoutService.aggregatePendingByMerchant.mockResolvedValue(groups);
      payoutService.processMerchantPayout.mockResolvedValue({
        success: true,
        totalAmount: 50,
        entryCount: 2,
      });
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([
        {
          success: true,
          amount: 50,
          establishmentId: 'e1',
          merchantId: 'm1',
          transactionCount: 1,
          batchId: 'b1',
        },
      ]);

      await task.processWeeklyPayouts();

      expect(walletPayoutService.processWeeklyWalletPayouts).toHaveBeenCalled();
    });

    it('should not fail the batch if wallet payouts throw', async () => {
      const groups = [
        {
          _id: 'm1',
          merchantName: 'Shop A',
          totalAmount: 50,
          totalPlatformFee: 9.5,
          entryCount: 2,
        },
      ];
      payoutService.aggregatePendingByMerchant.mockResolvedValue(groups);
      payoutService.processMerchantPayout.mockResolvedValue({
        success: true,
        totalAmount: 50,
        entryCount: 2,
      });
      walletPayoutService.processWeeklyWalletPayouts.mockRejectedValue(new Error('Wallet DB down'));

      const summary = await runPayouts();

      expect(summary).toBeDefined();
      expect(summary.successfulPayouts).toBe(1);
    });

    it('should generate batch ID with correct prefix', async () => {
      payoutService.aggregatePendingByMerchant.mockResolvedValue([]);

      const summary = await runPayouts();

      expect(summary.batchId).toMatch(/^BATCH-\d{4}-\d{2}/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // retryFailedPayouts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('retryFailedPayouts', () => {
    it('should call payoutService.retryFailedPayouts with batch ID', async () => {
      payoutService.retryFailedPayouts.mockResolvedValue([]);

      await task.retryFailedPayouts();

      expect(payoutService.retryFailedPayouts).toHaveBeenCalledWith(
        expect.stringMatching(/^RETRY-/),
      );
    });

    it('should not throw if retry itself fails', async () => {
      payoutService.retryFailedPayouts.mockRejectedValue(new Error('timeout'));

      await expect(task.retryFailedPayouts()).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // triggerManualPayout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('triggerManualPayout', () => {
    it('should delegate to processWeeklyPayouts and return its result', async () => {
      payoutService.aggregatePendingByMerchant.mockResolvedValue([]);
      walletPayoutService.processWeeklyWalletPayouts.mockResolvedValue([]);

      const result = await task.triggerManualPayout();

      expect(result).toBeDefined();
      expect(result.batchId).toBeDefined();
    });
  });
});
