/**
 * The merchant wallet at pickup confirmation, under the commission-settlement
 * model (.claude/work/commission-settlement-model.md).
 *
 * - The payment put the SALE amount into `pendingBalance`. Confirmation moves
 *   exactly that amount out of pending - whatever it was (100% for sales made
 *   under the model, 81% for sales paid before it) - so pending can never be
 *   left short or overdrawn by a rule change between payment and pickup.
 * - It puts `merchantAmount` into `availableBalance`: the full subtotal on a
 *   NORMAL sale, `subtotal - settled` on a SETTLEMENT. Never 81%, and never
 *   any share of the delivery fee.
 * - A delivery was never credited to the wallet: the driver paid the merchant
 *   in cash at pickup. Confirming it moves nothing.
 *
 * Carried over from the 81% era because it is still the costliest mistake
 * available: splitting `total` instead of `subtotal` hands the merchant the
 * delivery fee.
 */

import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { Types } from 'mongoose';

import { Establishment } from '../../establishments/schemas/establishment.schema';
import { Order } from '../../orders/schemas/order.schema';
import { MerchantWallet } from '../schemas/merchant-wallet.schema';
import { PaymentAttempt } from '../schemas/payment-attempt.schema';
import { PlatformTransaction } from '../schemas/platform-transaction.schema';
import { RefundRequest } from '../schemas/refund-request.schema';
import { WalletTransaction } from '../schemas/wallet-transaction.schema';
import { KonnectOrderService } from '../services/konnect-order.service';
import { KonnectService } from '../../subscription/services/konnect.service';

import type { OrderDocument } from '../../orders/schemas/order.schema';
import type { TestingModule } from '@nestjs/testing';

const ESTABLISHMENT_ID = new Types.ObjectId();
const OWNER_ID = new Types.ObjectId();

/** 20 TND of food + 4 TND delivery = 24 TND charged. */
const FOOD = 20;
const DELIVERY_FEE = 4;
const TOTAL = FOOD + DELIVERY_FEE;

const deliveryOrder = () =>
  ({
    _id: new Types.ObjectId(),
    orderNumber: 'ORD-TEST-1',
    establishmentId: ESTABLISHMENT_ID,
    merchantId: OWNER_ID,
    deliveryMode: 'delivery',
    pricing: {
      subtotal: FOOD,
      discountAmount: 0,
      taxAmount: 0,
      deliveryFee: DELIVERY_FEE,
      total: TOTAL,
      currency: 'TND',
    },
  }) as unknown as OrderDocument;

describe('Settlement splits food, not total', () => {
  let service: KonnectOrderService;
  let walletModel: { findOneAndUpdate: jest.Mock };
  let walletTxModel: ReturnType<typeof createMockModel> & { findOne: jest.Mock };

  /** What the payment put into pending for this order - the SALE row. */
  const saleOf = (amount: number | null) => {
    walletTxModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        session: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue(amount === null ? null : { amount }),
        }),
      }),
    });
  };
  let establishmentModel: { findById: jest.Mock };

  const createMockModel = () => ({
    findOneAndUpdate: jest.fn().mockResolvedValue({}),
    create: jest.fn().mockResolvedValue([{}]),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({}),
  });

  beforeEach(async () => {
    walletModel = createMockModel();
    walletTxModel = { ...createMockModel(), findOne: jest.fn() };
    saleOf(FOOD);
    establishmentModel = createMockModel();
    establishmentModel.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: ESTABLISHMENT_ID, ownerId: OWNER_ID }),
      }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KonnectOrderService,
        { provide: KonnectService, useValue: {} },
        { provide: 'ConfigService', useValue: { get: jest.fn() } },
        {
          provide: (await import('@nestjs/config')).ConfigService,
          useValue: { get: jest.fn().mockReturnValue(15) },
        },
        { provide: getConnectionToken(), useValue: { startSession: jest.fn() } },
        { provide: getModelToken(Order.name), useValue: createMockModel() },
        { provide: getModelToken(PaymentAttempt.name), useValue: createMockModel() },
        { provide: getModelToken(MerchantWallet.name), useValue: walletModel },
        { provide: getModelToken(WalletTransaction.name), useValue: walletTxModel },
        { provide: getModelToken(PlatformTransaction.name), useValue: createMockModel() },
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(RefundRequest.name), useValue: createMockModel() },
      ],
    }).compile();

    service = module.get(KonnectOrderService);
  });

  const pickupOrder = () => {
    const order = deliveryOrder();
    (order as unknown as { deliveryMode: string }).deliveryMode = 'pickup';
    order.pricing.deliveryFee = 0;
    order.pricing.total = FOOD;
    return order;
  };

  const inc = () =>
    (
      walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
        $inc: { availableBalance: number; pendingBalance: number };
      }
    ).$inc;

  describe('processPickupConfirmation', () => {
    it('releases the full food price on a NORMAL sale - 100%, not 81%', async () => {
      await service.processPickupConfirmation(pickupOrder(), FOOD);

      expect(inc()).toEqual({ pendingBalance: -FOOD, availableBalance: FOOD });
    });

    it('releases subtotal - settled on a SETTLEMENT sale', async () => {
      // Due 5 settled from a 20 TND sale: the merchant is owed 15.
      await service.processPickupConfirmation(pickupOrder(), 15);

      expect(inc()).toEqual({ pendingBalance: -FOOD, availableBalance: 15 });
    });

    it('moves out of pending exactly what the payment put in, for a sale paid under the old rule', async () => {
      // Paid before the model: pending got 16.20 (81%). Taking 20 out would
      // overdraw pending by 3.80.
      saleOf(16.2);

      await service.processPickupConfirmation(pickupOrder(), FOOD);

      expect(inc()).toEqual({ pendingBalance: -16.2, availableBalance: FOOD });
    });

    it('never hands the merchant any share of the delivery fee', async () => {
      await service.processPickupConfirmation(pickupOrder(), FOOD);

      expect(inc().availableBalance).not.toBe(TOTAL);
      expect(inc().availableBalance).toBeLessThanOrEqual(FOOD);
    });

    it('moves nothing for a delivery - the driver already paid the merchant', async () => {
      saleOf(null);

      await service.processPickupConfirmation(deliveryOrder(), FOOD);

      expect(walletModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it.each([Number.NaN, -1])(
      'refuses a merchant amount of %p rather than corrupt the wallet',
      async bad => {
        await expect(service.processPickupConfirmation(pickupOrder(), bad)).rejects.toThrow();
        expect(walletModel.findOneAndUpdate).not.toHaveBeenCalled();
      },
    );
  });
});
