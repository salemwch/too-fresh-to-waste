/**
 * SubscriptionService.handleWebhook — the amount actually captured
 *
 * The Konnect silentWebhook carries no signature, so both payment flows treat
 * its payload as untrusted and re-fetch authoritative state from Konnect's API
 * before crediting anything. The order flow then also checks that the amount
 * Konnect captured equals what the order was priced at
 * (konnect-order.service.ts). The subscription flow did not.
 *
 * That asymmetry was the gap: `status === 'completed'` says a payment
 * succeeded, not that it succeeded for the right price. The webhook reads
 * `pendingTier` / `pendingCycle` off the establishment to decide what to grant,
 * so a completed payment for one month of Standard would activate whatever
 * those fields said at the time — up to a yearly Pro subscription, a 24x
 * difference in value.
 *
 * These tests drive the grant decision against the price table, which is the
 * seam that was missing. The mismatch case must leave the establishment
 * completely untouched — a partially applied grant is worse than none, because
 * the pending fields are what a human would reconcile from.
 */

import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';

import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import { Establishment } from '../../establishments/schemas/establishment.schema';
import { User } from '../../users/schemas/user.schema';
import { KonnectService } from '../services/konnect.service';
import { SubscriptionService } from '../services/subscription.service';

import type { TestingModule } from '@nestjs/testing';

const ESTABLISHMENT_ID = '507f1f77bcf86cd799439011';
const PAYMENT_REF = 'ref_abc123';

/** Mirrors PRICES_MILLIMES in subscription.service.ts. */
const PRICE = {
  standardMonthly: 15_500,
  standardYearly: 15_500 * 12,
  proMonthly: 30_500,
  proYearly: 30_500 * 12,
} as const;

describe('SubscriptionService.handleWebhook — amount verification', () => {
  let service: SubscriptionService;
  let findByIdAndUpdate: jest.Mock;
  let getPaymentDetails: jest.Mock;
  let emit: jest.Mock;

  /** Builds an establishment doc whose pending fields ask for `tier`/`cycle`. */
  const establishmentAsking = (tier: string, cycle: string) => ({
    _id: { toString: () => ESTABLISHMENT_ID },
    name: 'Test Bakery',
    ownerId: { toString: () => 'owner-1' },
    subscriptionStatus: 'unpaid',
    subscriptionExpiresAt: undefined,
    get: (field: string) =>
      field === 'pendingTier' ? tier : field === 'pendingCycle' ? cycle : undefined,
  });

  const arrange = (opts: { tier: string; cycle: string; paidMillimes: number }) => {
    getPaymentDetails.mockResolvedValue({
      payment: { status: 'completed', amount: opts.paidMillimes, id: 'konnect-1' },
    });

    const establishmentModel = {
      findOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(establishmentAsking(opts.tier, opts.cycle)),
      }),
      findByIdAndUpdate,
    };
    return establishmentModel;
  };

  const build = async (establishmentModel: unknown) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: getModelToken(Establishment.name), useValue: establishmentModel },
        { provide: getModelToken(User.name), useValue: {} },
        { provide: KonnectService, useValue: { getPaymentDetails } },
        { provide: EventBusService, useValue: { emit } },
      ],
    }).compile();

    return module.get<SubscriptionService>(SubscriptionService);
  };

  beforeEach(() => {
    findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    getPaymentDetails = jest.fn();
    emit = jest.fn().mockResolvedValue(undefined);
  });

  describe('the captured amount matches the requested plan', () => {
    it.each([
      ['standard', 'monthly', PRICE.standardMonthly],
      ['standard', 'yearly', PRICE.standardYearly],
      ['pro', 'monthly', PRICE.proMonthly],
      ['pro', 'yearly', PRICE.proYearly],
    ])('activates %s/%s when %d millimes were captured', async (tier, cycle, paid) => {
      const model = arrange({ tier, cycle, paidMillimes: paid });
      service = await build(model);

      await service.handleWebhook({ payment_ref: PAYMENT_REF });

      expect(findByIdAndUpdate).toHaveBeenCalledTimes(1);
      const update = findByIdAndUpdate.mock.calls[0]?.[1] as Record<
        string,
        Record<string, unknown>
      >;
      expect(update['$set']?.['subscriptionStatus']).toBe('paid');
      expect(update['$set']?.['subscriptionTier']).toBe(tier);
      expect(emit).toHaveBeenCalledWith('establishment.subscription.activated', expect.anything());
    });
  });

  describe('the captured amount does not match', () => {
    it.each([
      // The attack this guards: pay for the cheapest plan, claim the dearest.
      ['pro', 'yearly', PRICE.standardMonthly, 'a monthly Standard payment claiming yearly Pro'],
      ['pro', 'monthly', PRICE.standardMonthly, 'a Standard payment claiming Pro'],
      ['standard', 'yearly', PRICE.standardMonthly, 'a monthly payment claiming a year'],
      ['standard', 'monthly', 1, 'a one-millime payment'],
      ['standard', 'monthly', 0, 'a zero-amount payment'],
    ])('does not activate %s/%s from %d millimes — %s', async (tier, cycle, paid) => {
      const model = arrange({ tier, cycle, paidMillimes: paid });
      service = await build(model);

      await service.handleWebhook({ payment_ref: PAYMENT_REF });

      // Nothing written and nothing emitted: a failed check leaves state
      // exactly as it was, so the pending fields survive for reconciliation.
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });

    it('does not activate when Konnect reports no amount at all', async () => {
      getPaymentDetails.mockResolvedValue({ payment: { status: 'completed', id: 'konnect-1' } });
      const model = {
        findOne: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(establishmentAsking('standard', 'monthly')),
        }),
        findByIdAndUpdate,
      };
      service = await build(model);

      await service.handleWebhook({ payment_ref: PAYMENT_REF });

      // `undefined !== expected` must fail closed, not read as "no objection".
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
      expect(emit).not.toHaveBeenCalled();
    });
  });

  describe('checks that must still run before the amount is considered', () => {
    it('ignores a payment Konnect has not completed', async () => {
      getPaymentDetails.mockResolvedValue({
        payment: { status: 'pending', amount: PRICE.standardMonthly },
      });
      service = await build({ findOne: jest.fn(), findByIdAndUpdate });

      await service.handleWebhook({ payment_ref: PAYMENT_REF });

      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('ignores a webhook with no payment_ref, without calling Konnect', async () => {
      service = await build({ findOne: jest.fn(), findByIdAndUpdate });

      await service.handleWebhook({});

      expect(getPaymentDetails).not.toHaveBeenCalled();
      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('ignores a reference that matches no establishment', async () => {
      getPaymentDetails.mockResolvedValue({
        payment: { status: 'completed', amount: PRICE.standardMonthly },
      });
      const model = {
        findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
        findByIdAndUpdate,
      };
      service = await build(model);

      await service.handleWebhook({ payment_ref: PAYMENT_REF });

      expect(findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});
