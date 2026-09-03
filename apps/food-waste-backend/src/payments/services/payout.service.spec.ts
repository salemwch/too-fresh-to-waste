/* eslint-disable require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { AppLoggerService } from 'src/common/services/logger.service';
import { User } from 'src/users/schemas/user.schema';

import { MerchantPayoutLedger } from '../schemas/merchant-payout-ledger.schema';
import { PayoutService } from './payout.service';

/** 20 TND food + 4 TND delivery = 24 TND charged. Merchant earns 81% of the 20, not the 24. */
const FOOD = 20;
const DELIVERY_FEE = 4;
const TOTAL = FOOD + DELIVERY_FEE;
const EXPECTED_MERCHANT_AMOUNT = 16.2;
const EXPECTED_PLATFORM_FEE = 3.8;

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

  it('splits 81% of the FOOD subtotal, not the order total', async () => {
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
    });

    expect(entry.merchantAmount).toBe(EXPECTED_MERCHANT_AMOUNT);
    expect(entry.platformFee).toBe(EXPECTED_PLATFORM_FEE);
  });

  it('does not hand the merchant any share of the delivery fee', async () => {
    // 81% of 24 = 19.44. If this ever appears again, the split reverted to using `orderTotal`.
    const entry = await service.createLedgerEntry({
      merchantId: new Types.ObjectId(),
      orderId: new Types.ObjectId(),
      paymentId: new Types.ObjectId(),
      establishmentId: new Types.ObjectId(),
      orderTotal: TOTAL,
      subtotal: FOOD,
    });

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
    });

    expect(entry.orderTotal).toBe(TOTAL);
  });
});
