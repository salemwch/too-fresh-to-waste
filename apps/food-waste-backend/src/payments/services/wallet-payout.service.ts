import { Injectable, Logger } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Types, Connection } from 'mongoose';

import { MerchantWallet } from '../schemas/merchant-wallet.schema';
import { WalletTransaction, WalletTransactionDocument } from '../schemas/wallet-transaction.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';

interface WalletPayoutResult {
  establishmentId: string;
  merchantId: string;
  amount: number;
  transactionCount: number;
  success: boolean;
  batchId: string;
  error?: string;
}

@Injectable()
export class WalletPayoutService {
  private readonly logger = new Logger(WalletPayoutService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(MerchantWallet.name)
    private readonly walletModel: Model<MerchantWallet>,
    @InjectModel(WalletTransaction.name)
    private readonly walletTxModel: Model<WalletTransactionDocument>,
    @InjectModel(PlatformTransaction.name)
    private readonly platformTxModel: Model<PlatformTransaction>,
  ) {}

  async processWeeklyWalletPayouts(): Promise<WalletPayoutResult[]> {
    const walletsWithBalance = await this.walletModel.find({ availableBalance: { $gt: 0 } }).lean();

    if (walletsWithBalance.length === 0) {
      this.logger.log('No wallet balances to pay out');
      return [];
    }

    const batchId = `WPAYOUT-${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
    this.logger.log(
      `Processing wallet payouts for ${walletsWithBalance.length} establishments, batch ${batchId}`,
    );

    const results: WalletPayoutResult[] = [];

    for (const wallet of walletsWithBalance) {
      try {
        const result = await this.processEstablishmentPayout(wallet, batchId);
        results.push(result);
      } catch (error) {
        this.logger.error(
          `Wallet payout failed for establishment ${wallet.establishmentId}: ${(error as Error).message}`,
        );
        results.push({
          establishmentId: wallet.establishmentId.toString(),
          merchantId: wallet.merchantId.toString(),
          amount: wallet.availableBalance,
          transactionCount: 0,
          success: false,
          batchId,
          error: (error as Error).message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    this.logger.log(`Wallet payout batch ${batchId}: ${successCount}/${results.length} successful`);

    return results;
  }

  private async processEstablishmentPayout(
    wallet: MerchantWallet & { _id: Types.ObjectId },
    batchId: string,
  ): Promise<WalletPayoutResult> {
    const session = await this.connection.startSession();
    try {
      let result: WalletPayoutResult | null = null;

      await session.withTransaction(async () => {
        const lockedWallet = await this.walletModel.findOneAndUpdate(
          {
            _id: wallet._id,
            availableBalance: { $gt: 0 },
          },
          { $set: { availableBalance: 0 } },
          { session, new: false },
        );

        if (!lockedWallet || lockedWallet.availableBalance <= 0) {
          result = {
            establishmentId: wallet.establishmentId.toString(),
            merchantId: wallet.merchantId.toString(),
            amount: 0,
            transactionCount: 0,
            success: true,
            batchId,
          };
          return;
        }

        const payoutAmount = lockedWallet.availableBalance;

        await this.walletTxModel.create(
          [
            {
              establishmentId: wallet.establishmentId,
              merchantId: wallet.merchantId,
              payoutBatchId: batchId,
              type: 'PAYOUT',
              status: 'CREATED',
              amount: -payoutAmount,
              currency: 'TND',
              reference: `PAYOUT-${batchId}-${wallet.establishmentId}`,
              notes: `Weekly payout batch ${batchId}`,
            },
          ],
          { session },
        );

        await this.platformTxModel.create(
          [
            {
              payoutBatchId: batchId,
              type: 'PAYOUT_FEE',
              amount: 0,
              currency: 'TND',
              reference: `PAYOUT-FEE-${batchId}-${wallet.establishmentId}`,
              notes: `Payout fee for establishment ${wallet.establishmentId}`,
            },
          ],
          { session },
        );

        result = {
          establishmentId: wallet.establishmentId.toString(),
          merchantId: wallet.merchantId.toString(),
          amount: payoutAmount,
          transactionCount: 1,
          success: true,
          batchId,
        };
      });

      return result!;
    } finally {
      await session.endSession();
    }
  }
}
