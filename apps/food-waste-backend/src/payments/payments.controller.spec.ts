import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AppVersionGuard } from 'src/common/guards/app-version.guard';

import { PaymentService } from './payments.service';
import { KonnectOrderService } from './services/konnect-order.service';
import { MerchantCommissionService } from './services/merchant-commission.service';
import { PaymentController } from './payments.controller';

import type { TestingModule } from '@nestjs/testing';

const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('PaymentController — Konnect webhooks', () => {
  let controller: PaymentController;
  let konnectOrderService: { handleOrderWebhook: jest.Mock };

  beforeEach(async () => {
    konnectOrderService = {
      handleOrderWebhook: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: {
            findAllCursor: jest.fn(),
            findById: jest.fn(),
            getPaymentStats: jest.fn(),
          },
        },
        { provide: KonnectOrderService, useValue: konnectOrderService },
        // Required by the controller's constructor since the commission
        // statement endpoint was added. Unused by these webhook tests.
        { provide: MerchantCommissionService, useValue: { getStatement: jest.fn() } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: Reflector, useValue: new Reflector() },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(RolesGuard)
      .useValue(mockGuard)
      .overrideGuard(AppVersionGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get(PaymentController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /payments/webhook/konnect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleKonnectOrderWebhookGet', () => {
    it('should call handleOrderWebhook with valid payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookGet('konnect-ref-123');

      expect(result).toEqual({ received: true });
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('konnect-ref-123');
    });

    it('should return received:false for empty payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookGet('');

      expect(result).toEqual({ received: false });
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should return received:false for undefined payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookGet(undefined as any);

      expect(result).toEqual({ received: false });
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should return received:false for payment_ref longer than 100 chars', async () => {
      const longRef = 'a'.repeat(101);

      const result = await controller.handleKonnectOrderWebhookGet(longRef);

      expect(result).toEqual({ received: false });
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should still return received:true even if handleOrderWebhook throws', async () => {
      konnectOrderService.handleOrderWebhook.mockRejectedValue(new Error('DB crash'));

      const result = await controller.handleKonnectOrderWebhookGet('valid-ref');

      expect(result).toEqual({ received: true });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // POST /payments/webhook/konnect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleKonnectOrderWebhookPost', () => {
    it('should call handleOrderWebhook with valid payment_ref in body', async () => {
      const result = await controller.handleKonnectOrderWebhookPost({
        payment_ref: 'konnect-ref-456',
      });

      expect(result).toEqual({ received: true });
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith('konnect-ref-456');
    });

    it('should return received:false for missing payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookPost({});

      expect(result).toEqual({ received: false });
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should return received:false for non-string payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookPost({ payment_ref: 12345 as any });

      expect(result).toEqual({ received: false });
      expect(konnectOrderService.handleOrderWebhook).not.toHaveBeenCalled();
    });

    it('should return received:false for overly long payment_ref', async () => {
      const result = await controller.handleKonnectOrderWebhookPost({
        payment_ref: 'x'.repeat(101),
      });

      expect(result).toEqual({ received: false });
    });

    it('should still return received:true even if service throws', async () => {
      konnectOrderService.handleOrderWebhook.mockRejectedValue(new Error('Transaction failed'));

      const result = await controller.handleKonnectOrderWebhookPost({ payment_ref: 'ref-ok' });

      expect(result).toEqual({ received: true });
    });

    it('should accept payment_ref at exactly 100 chars', async () => {
      const exactRef = 'b'.repeat(100);

      const result = await controller.handleKonnectOrderWebhookPost({ payment_ref: exactRef });

      expect(result).toEqual({ received: true });
      expect(konnectOrderService.handleOrderWebhook).toHaveBeenCalledWith(exactRef);
    });
  });
});
