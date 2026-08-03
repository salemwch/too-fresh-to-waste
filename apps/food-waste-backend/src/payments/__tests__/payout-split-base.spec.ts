/**
 * Settlement must split the FOOD line, never the order total.
 *
 * `total` now includes the delivery fee. The merchant sells food and has no
 * part in delivery, so splitting `total` would pay them 81% of the delivery fee
 * — leaving the platform to fund a 3.00 TND driver out of its 0.76 TND share
 * and turning every delivery into a loss.
 *
 * These tests exist because a mutation survived without them: changing
 * `calculateFoodRevenueSplit(order.pricing.subtotal)` to `…(order.pricing.total)`
 * broke nothing in the suite. `calculateFoodRevenueSplit` was well covered in
 * isolation, but nothing asserted what the call sites feed it — and that
 * argument is the whole difference between a profitable delivery and a
 * loss-making one.
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

/** 81% of food. Deliberately NOT 81% of total (which would be 19.44). */
const EXPECTED_MERCHANT_AMOUNT = 16.2;

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
        { provide: getModelToken(WalletTransaction.name), useValue: createMockModel() },
        { provide: getModelToken(PlatformTransaction.name), useValue: createMockModel() },
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(RefundRequest.name), useValue: createMockModel() },
      ],
    }).compile();

    service = module.get(KonnectOrderService);
  });

  describe('processPickupConfirmation', () => {
    it('releases 81% of FOOD to the merchant, not 81% of total', async () => {
      await service.processPickupConfirmation(deliveryOrder());

      const update = walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
        $inc: { availableBalance: number; pendingBalance: number };
      };

      expect(update.$inc.availableBalance).toBe(EXPECTED_MERCHANT_AMOUNT);
      expect(update.$inc.pendingBalance).toBe(-EXPECTED_MERCHANT_AMOUNT);
    });

    it('does not hand the merchant any share of the delivery fee', async () => {
      // 81% of 24 = 19.44. If this ever appears, the split is using `total`.
      await service.processPickupConfirmation(deliveryOrder());

      const update = walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
        $inc: { availableBalance: number };
      };

      expect(update.$inc.availableBalance).not.toBeCloseTo(TOTAL * 0.81, 2);
    });

    it('leaves the full delivery fee available to cover the driver', async () => {
      // Collected 24. Merchant takes 16.20, so 7.80 remains — comfortably more
      // than the 3.00 owed to the driver. Splitting `total` would leave 4.56,
      // still positive here but negative on small baskets.
      await service.processPickupConfirmation(deliveryOrder());

      const update = walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
        $inc: { availableBalance: number };
      };
      const remaining = TOTAL - update.$inc.availableBalance;

      expect(remaining).toBeGreaterThanOrEqual(DELIVERY_FEE);
    });

    it('pays the same food share whether the order was delivery or pickup', async () => {
      // The merchant's economics must not depend on how the food reached the
      // customer — only on what they sold.
      await service.processPickupConfirmation(deliveryOrder());
      const deliveryAmount = (
        walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
          $inc: { availableBalance: number };
        }
      ).$inc.availableBalance;

      walletModel.findOneAndUpdate.mockClear();

      const pickup = deliveryOrder();
      pickup.pricing.deliveryFee = 0;
      pickup.pricing.total = FOOD;
      await service.processPickupConfirmation(pickup);

      const pickupAmount = (
        walletModel.findOneAndUpdate.mock.calls[0]?.[1] as {
          $inc: { availableBalance: number };
        }
      ).$inc.availableBalance;

      expect(pickupAmount).toBe(deliveryAmount);
    });
  });
});
