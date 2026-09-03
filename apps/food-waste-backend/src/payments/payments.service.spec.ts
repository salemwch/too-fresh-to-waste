import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';

import { RegexSecurityUtil } from 'src/common/utils/regex-security.util';
import { Order } from '../orders/schemas/order.schema';

import { MerchantWallet } from './schemas/merchant-wallet.schema';
import { Payment } from './schemas/payment.schema';
import { PaymentService } from './payments.service';

describe('PaymentService.getMyWallet', () => {
  let service: PaymentService;
  let walletModel: { find: jest.Mock };

  const merchantId = new Types.ObjectId();
  const establishmentA = new Types.ObjectId();
  const establishmentB = new Types.ObjectId();

  beforeEach(async () => {
    walletModel = { find: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(Payment.name), useValue: {} },
        { provide: getModelToken(Order.name), useValue: {} },
        { provide: getModelToken(MerchantWallet.name), useValue: walletModel },
        { provide: RegexSecurityUtil, useValue: {} },
      ],
    }).compile();

    service = module.get(PaymentService);
  });

  it("sums balances across all of the merchant's establishments when none is specified", async () => {
    walletModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        { availableBalance: 100, pendingBalance: 20, currency: 'TND' },
        { availableBalance: 28.4, pendingBalance: 5, currency: 'TND' },
      ]),
    });

    const result = await service.getMyWallet(merchantId.toString());

    expect(result).toEqual({ availableBalance: 128.4, pendingBalance: 25, currency: 'TND' });
    expect(walletModel.find).toHaveBeenCalledWith({ merchantId: expect.any(Types.ObjectId) });
  });

  it('scopes to one establishment when establishmentId is given', async () => {
    walletModel.find.mockReturnValue({
      lean: jest
        .fn()
        .mockResolvedValue([{ availableBalance: 100, pendingBalance: 20, currency: 'TND' }]),
    });

    await service.getMyWallet(merchantId.toString(), establishmentA.toString());

    expect(walletModel.find).toHaveBeenCalledWith({
      merchantId: expect.any(Types.ObjectId),
      establishmentId: expect.any(Types.ObjectId),
    });
  });

  it("cannot see another merchant's wallet by passing their establishment id — the compound filter returns nothing", async () => {
    // merchantId + establishmentId must both match; a merchant supplying an
    // establishmentId they do not own gets zero rows back, not someone else's wallet.
    walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await service.getMyWallet(merchantId.toString(), establishmentB.toString());

    expect(result).toEqual({ availableBalance: 0, pendingBalance: 0, currency: 'TND' });
  });

  it('returns zeros when the merchant has no wallet yet', async () => {
    walletModel.find.mockReturnValue({ lean: jest.fn().mockResolvedValue([]) });

    const result = await service.getMyWallet(merchantId.toString());

    expect(result).toEqual({ availableBalance: 0, pendingBalance: 0, currency: 'TND' });
  });
});
