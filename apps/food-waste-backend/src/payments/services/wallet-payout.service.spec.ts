/* eslint-disable require-await */
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { MerchantWallet } from '../schemas/merchant-wallet.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';

import { WalletPayoutService } from './wallet-payout.service';

import type { TestingModule } from '@nestjs/testing';

// ─── Test constants ──────────────────────────────────────────────────────────

const ESTAB_A = new Types.ObjectId();
const ESTAB_B = new Types.ObjectId();
const MERCHANT_A = new Types.ObjectId();
const MERCHANT_B = new Types.ObjectId();
const WALLET_ID_A = new Types.ObjectId();
const WALLET_ID_B = new Types.ObjectId();

const makeWallet = (overrides: Record<string, unknown> = {}) => ({
  _id: WALLET_ID_A,
  establishmentId: ESTAB_A,
  merchantId: MERCHANT_A,
  availableBalance: 50.0,
  pendingBalance: 0,
  currency: 'TND',
  ...overrides,
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createMockModel = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn().mockResolvedValue({}),
});

describe('WalletPayoutService', () => {
  let service: WalletPayoutService;
  let walletModel: ReturnType<typeof createMockModel>;
  let walletTxModel: ReturnType<typeof createMockModel>;
  let platformTxModel: ReturnType<typeof createMockModel>;
  let mockSession: {
    withTransaction: jest.Mock;
    endSession: jest.Mock;
  };
  let mockConnection: { startSession: jest.Mock };

  beforeEach(async () => {
    walletModel = createMockModel();
    walletTxModel = createMockModel();
    platformTxModel = createMockModel();

    mockSession = {
      withTransaction: jest.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      startSession: jest.fn().mockResolvedValue(mockSession),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletPayoutService,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: getModelToken(MerchantWallet.name), useValue: walletModel },
        { provide: getModelToken(WalletTransaction.name), useValue: walletTxModel },
        { provide: getModelToken(PlatformTransaction.name), useValue: platformTxModel },
      ],
    }).compile();

    service = module.get(WalletPayoutService);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // processWeeklyWalletPayouts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('processWeeklyWalletPayouts', () => {
    describe('No wallets with balance', () => {
      it('should return empty array when no wallets have balance', async () => {
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

        const results = await service.processWeeklyWalletPayouts();

        expect(results).toEqual([]);
        expect(mockConnection.startSession).not.toHaveBeenCalled();
      });
    });

    describe('Single wallet payout', () => {
      it('should process a single wallet and return success', async () => {
        const wallet = makeWallet({ availableBalance: 100 });
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue({ ...wallet, availableBalance: 100 });

        const results = await service.processWeeklyWalletPayouts();

        expect(results).toHaveLength(1);
        expect(results[0]!.success).toBe(true);
        expect(results[0]!.amount).toBe(100);
        expect(results[0]!.establishmentId).toBe(ESTAB_A.toString());
      });

      it('should atomically zero the wallet balance', async () => {
        const wallet = makeWallet({ availableBalance: 50 });
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue({ ...wallet, availableBalance: 50 });

        await service.processWeeklyWalletPayouts();

        expect(walletModel.findOneAndUpdate).toHaveBeenCalledWith(
          { _id: wallet._id, availableBalance: { $gt: 0 } },
          { $set: { availableBalance: 0 } },
          expect.objectContaining({ new: false }),
        );
      });

      it('should create PAYOUT wallet transaction with negative amount', async () => {
        const wallet = makeWallet({ availableBalance: 75 });
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue({ ...wallet, availableBalance: 75 });

        await service.processWeeklyWalletPayouts();

        expect(walletTxModel.create).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              type: 'PAYOUT',
              status: 'CREATED',
              amount: -75,
              currency: 'TND',
            }),
          ],
          expect.objectContaining({ session: mockSession }),
        );
      });

      it('should create PAYOUT_FEE platform transaction with zero amount', async () => {
        const wallet = makeWallet();
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue(wallet);

        await service.processWeeklyWalletPayouts();

        expect(platformTxModel.create).toHaveBeenCalledWith(
          [
            expect.objectContaining({
              type: 'PAYOUT_FEE',
              amount: 0,
            }),
          ],
          expect.objectContaining({ session: mockSession }),
        );
      });
    });

    describe('Multiple wallets', () => {
      it('should process each wallet independently', async () => {
        const walletA = makeWallet({ _id: WALLET_ID_A, availableBalance: 30 });
        const walletB = makeWallet({
          _id: WALLET_ID_B,
          establishmentId: ESTAB_B,
          merchantId: MERCHANT_B,
          availableBalance: 70,
        });

        walletModel.find.mockReturnValue({
          lean: jest.fn().mockResolvedValue([walletA, walletB]),
        });
        walletModel.findOneAndUpdate
          .mockResolvedValueOnce({ ...walletA, availableBalance: 30 })
          .mockResolvedValueOnce({ ...walletB, availableBalance: 70 });

        const results = await service.processWeeklyWalletPayouts();

        expect(results).toHaveLength(2);
        expect(results[0]!.amount).toBe(30);
        expect(results[1]!.amount).toBe(70);
        expect(results.every(r => r.success)).toBe(true);
      });
    });

    describe('Race condition — balance zeroed between find and lock', () => {
      it('should return success with 0 amount if lock finds no balance', async () => {
        const wallet = makeWallet({ availableBalance: 50 });
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue(null);

        const results = await service.processWeeklyWalletPayouts();

        expect(results).toHaveLength(1);
        expect(results[0]!.success).toBe(true);
        expect(results[0]!.amount).toBe(0);
      });

      it('should not create wallet/platform transactions when lock returns null', async () => {
        const wallet = makeWallet();
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue(null);

        await service.processWeeklyWalletPayouts();

        expect(walletTxModel.create).not.toHaveBeenCalled();
        expect(platformTxModel.create).not.toHaveBeenCalled();
      });
    });

    describe('Partial failure — one wallet fails, others succeed', () => {
      it('should continue processing remaining wallets after one fails', async () => {
        const walletA = makeWallet({ _id: WALLET_ID_A, availableBalance: 30 });
        const walletB = makeWallet({
          _id: WALLET_ID_B,
          establishmentId: ESTAB_B,
          merchantId: MERCHANT_B,
          availableBalance: 70,
        });

        walletModel.find.mockReturnValue({
          lean: jest.fn().mockResolvedValue([walletA, walletB]),
        });

        // First wallet: transaction fails
        mockConnection.startSession
          .mockResolvedValueOnce({
            withTransaction: jest.fn().mockRejectedValue(new Error('DB error')),
            endSession: jest.fn().mockResolvedValue(undefined),
          })
          // Second wallet: success
          .mockResolvedValueOnce(mockSession);

        walletModel.findOneAndUpdate.mockResolvedValue({ ...walletB, availableBalance: 70 });

        const results = await service.processWeeklyWalletPayouts();

        expect(results).toHaveLength(2);
        expect(results[0]!.success).toBe(false);
        expect(results[0]!.error).toBe('DB error');
        expect(results[1]!.success).toBe(true);
        expect(results[1]!.amount).toBe(70);
      });
    });

    describe('Session cleanup', () => {
      it('should always end the session even on error', async () => {
        const wallet = makeWallet();
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });

        const failSession = {
          withTransaction: jest.fn().mockRejectedValue(new Error('fail')),
          endSession: jest.fn().mockResolvedValue(undefined),
        };
        mockConnection.startSession.mockResolvedValue(failSession);

        await service.processWeeklyWalletPayouts();

        expect(failSession.endSession).toHaveBeenCalled();
      });
    });

    describe('Batch ID format', () => {
      it('should generate batch ID with WPAYOUT prefix and date', async () => {
        const wallet = makeWallet();
        walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([wallet]) });
        walletModel.findOneAndUpdate.mockResolvedValue(wallet);

        const results = await service.processWeeklyWalletPayouts();

        expect(results[0]!.batchId).toMatch(/^WPAYOUT-\d{4}-\d{2}-\d{2}-\d+$/);
      });
    });
  });
});
