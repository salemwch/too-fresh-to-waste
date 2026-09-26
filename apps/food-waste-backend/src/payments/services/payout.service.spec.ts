/* eslint-disable require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from 'src/common/services/logger.service';
import { User } from 'src/users/schemas/user.schema';

import { MerchantPayoutLedger } from '../schemas/merchant-payout-ledger.schema';
import { PayoutService } from './payout.service';

/**
 * 20 TND food + 4 TND delivery = 24 TND charged. Under the commission-settlement
 * model the ledger records the order's commission decision exactly: the full 20
 * on a NORMAL sale, 20 - settled on a SETTLEMENT. Never 81%, never the 24.
 */
const FOOD = 20;
const DELIVERY_FEE = 4;
const TOTAL = FOOD + DELIVERY_FEE;
const NORMAL = { merchantAmount: FOOD, settled: 0 };
const SETTLEMENT = { merchantAmount: 15, settled: 5 };

describe('PayoutService.createLedgerEntry — splits subtotal, not total', () => {
  let service: PayoutService;
  let ledgerModel: { save: jest.Mock };
  let userModel: { findById: jest.Mock };

  beforeEach(async () => {
    ledgerModel = { save: jest.fn() };
    userModel = {
      findById: jest.fn().mockResolvedValue({
        firstName: 'Test',
        lastName: 'Merchant',
        email: 'merchant@example.com',
      }),
    };

    const LedgerModelCtor = jest.fn().mockImplementation((doc: Record<string, unknown>) => ({
      ...doc,
      save: async () => Promise.resolve({ ...doc, _id: new Types.ObjectId() }),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PayoutService,
        { provide: getModelToken(MerchantPayoutLedger.name), useValue: LedgerModelCtor },
        { provide: getModelToken(User.name), useValue: userModel },
        { provide: AppLoggerService, useValue: { log: jest.fn(), error: jest.fn() } },
      ],
    }).compile();

    service = module.get(PayoutService);
    void ledgerModel;
  });

  it('records a NORMAL sale at the full food price - 100%, not 81%', async () => {
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
      commissionSettlement: NORMAL,
    });

    expect(entry.merchantAmount).toBe(FOOD);
    expect(entry.platformFee).toBe(0);
  });

  it('records a SETTLEMENT as subtotal - settled, with the settled part as the platform fee', async () => {
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
      commissionSettlement: SETTLEMENT,
    });

    expect(entry.merchantAmount).toBe(15);
    expect(entry.platformFee).toBe(5);
  });

  it('does not hand the merchant any share of the delivery fee', async () => {
    // Neither the 24 nor 81% of it (19.44) may ever reach the merchant.
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
      commissionSettlement: NORMAL,
    });

    expect(entry.merchantAmount).toBeLessThanOrEqual(FOOD);
    expect(entry.merchantAmount).not.toBeCloseTo(TOTAL * 0.81, 2);
  });

  it('still records the audit-facing orderTotal as the gross total', async () => {
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
      commissionSettlement: NORMAL,
    });

    expect(entry.orderTotal).toBe(TOTAL);
  });
});
