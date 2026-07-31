import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { InitiatePaymentResponseDto, SubscriptionStatusResponseDto } from '../dto/subscription.dto';
import { nextSubscriptionExpiry, toSubscriptionCycle } from '../subscription-period';
import { KonnectService } from './konnect.service';

const PRICES_MILLIMES: Record<'standard' | 'pro', Record<'monthly' | 'yearly', number>> = {
  standard: {
    monthly: 15_500,
    yearly: 15_500 * 12,
  },
  pro: {
    monthly: 30_500,
    yearly: 30_500 * 12,
  },
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly konnectService: KonnectService,
    private readonly eventBus: EventBusService,
  ) {}

  async getStatus(
    merchantId: string,
    establishmentId?: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const establishment = await this.findMerchantEstablishment(merchantId, establishmentId);

    return {
      subscriptionStatus: establishment.subscriptionStatus,
      ...(establishment.subscriptionTier
        ? { subscriptionTier: establishment.subscriptionTier }
        : {}),
      ...(establishment.subscriptionCycle
        ? { subscriptionCycle: establishment.subscriptionCycle }
        : {}),
      ...(establishment.trialEndsAt ? { trialEndsAt: establishment.trialEndsAt } : {}),
      ...(establishment.subscriptionExpiresAt
        ? { subscriptionExpiresAt: establishment.subscriptionExpiresAt }
        : {}),
      canPublishOffers: establishment.subscriptionStatus !== 'suspended',
    };
  }

  async initiatePayment(
    merchantId: string,
    tier: 'standard' | 'pro',
    cycle: 'monthly' | 'yearly',
    establishmentId?: string,
  ): Promise<InitiatePaymentResponseDto> {
    const establishment = await this.findMerchantEstablishment(merchantId, establishmentId);

    if (establishment.subscriptionStatus === 'paid' && establishment.subscriptionExpiresAt) {
      const daysRemaining = Math.ceil(
        (establishment.subscriptionExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      if (daysRemaining > 7) {
        throw new BadRequestException(
          `Your subscription is still active for ${daysRemaining} more days. You can renew when fewer than 7 days remain.`,
        );
      }
    }

    const merchant = await this.userModel
      .findById(merchantId)
      .select('firstName lastName email')
      .lean()
      .exec();

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    const amount = PRICES_MILLIMES[tier][cycle];
    const token = `SUB${Date.now().toString(36)}`;

    const tierLabel = tier === 'standard' ? 'Standard' : 'Pro';
    const cycleLabel = cycle === 'monthly' ? 'mensuel' : 'annuel';

    await this.establishmentModel
      .findByIdAndUpdate(establishment._id, {
        $set: { pendingTier: tier, pendingCycle: cycle },
      })
      .exec();

    const result = await this.konnectService.initPayment({
      amount,
      firstName: merchant.firstName ?? '',
      lastName: merchant.lastName ?? '',
      email: merchant.email,
      orderId: token,
      description: `Too Fresh To Waste — Abonnement ${tierLabel} (${cycleLabel})`,
    });

    await this.establishmentModel
      .findByIdAndUpdate(establishment._id, {
        $set: { lastPaymentRef: result.paymentRef },
      })
      .exec();

    this.logger.log(
      `Payment initiated for establishment ${establishment._id.toString()}: tier=${tier}, cycle=${cycle}, ref=${result.paymentRef}`,
    );

    return {
      payUrl: result.payUrl,
      paymentRef: result.paymentRef,
    };
  }

  async handleWebhook(payload: Record<string, unknown>): Promise<void> {
    const paymentRef = payload['payment_ref'] as string | undefined;
    if (!paymentRef) {
      this.logger.warn('Konnect webhook received without payment_ref');
      return;
    }

    const details = await this.konnectService.getPaymentDetails(paymentRef);
    const status = details.payment?.status;

    if (status !== 'completed') {
      this.logger.log(`Konnect webhook: payment ${paymentRef} status=${status} — ignoring`);
      return;
    }

    const establishment = await this.establishmentModel
      .findOne({ lastPaymentRef: paymentRef })
      .exec();

    if (!establishment) {
      this.logger.warn(`Konnect webhook: no establishment found for paymentRef=${paymentRef}`);
      return;
    }

    if (establishment.subscriptionStatus === 'paid' && establishment.subscriptionExpiresAt) {
      const daysRemaining = Math.ceil(
        (establishment.subscriptionExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
      );
      if (daysRemaining > 7) {
        this.logger.log(
          `Konnect webhook: establishment ${establishment._id.toString()} already has active subscription — skipping duplicate`,
        );
        return;
      }
    }

    const tier = (establishment.get('pendingTier') === 'pro' ? 'pro' : 'standard') as
      | 'standard'
      | 'pro';
    const cycle = toSubscriptionCycle(establishment.get('pendingCycle'));

    // Only a still-running paid subscription carries days worth keeping; a
    // lapsed or trial one restarts from now.
    const currentExpiry =
      establishment.subscriptionStatus === 'paid' ? establishment.subscriptionExpiresAt : undefined;

    const subscriptionExpiresAt = nextSubscriptionExpiry(cycle, currentExpiry);

    await this.establishmentModel
      .findByIdAndUpdate(establishment._id, {
        $set: {
          subscriptionStatus: 'paid',
          subscriptionTier: tier,
          subscriptionCycle: cycle,
          subscriptionExpiresAt,
          isActive: true,
        },
        $unset: { pendingTier: 1, pendingCycle: 1 },
      })
      .exec();

    await this.eventBus.emit('establishment.subscription.activated', {
      establishmentId: establishment._id.toString(),
      establishmentName: establishment.name,
      ownerId: establishment.ownerId.toString(),
      tier,
      cycle,
      subscriptionExpiresAt,
      paymentRef,
    });

    this.logger.log(
      `Subscription activated for establishment ${establishment._id.toString()}: tier=${tier}, cycle=${cycle}, expires=${subscriptionExpiresAt.toISOString()}`,
    );
  }

  async handlePaymentCallback(
    paymentRef: string,
  ): Promise<{ success: boolean; establishmentId?: string }> {
    const details = await this.konnectService.getPaymentDetails(paymentRef);

    if (details.payment?.status !== 'completed') {
      return { success: false };
    }

    const establishment = await this.establishmentModel
      .findOne({ lastPaymentRef: paymentRef })
      .select('_id subscriptionStatus')
      .exec();

    return {
      success: true,
      ...(establishment ? { establishmentId: establishment._id.toString() } : {}),
    };
  }

  private async findMerchantEstablishment(
    merchantId: string,
    establishmentId?: string,
  ): Promise<EstablishmentDocument> {
    const query: Record<string, unknown> = { ownerId: new Types.ObjectId(merchantId) };
    if (establishmentId) {
      query['_id'] = new Types.ObjectId(establishmentId);
    }

    const establishment = await this.establishmentModel.findOne(query).exec();

    if (!establishment) {
      throw new NotFoundException('Establishment not found');
    }

    if (establishment.ownerId.toString() !== merchantId) {
      throw new ForbiddenException('You can only manage subscriptions for your own establishment');
    }

    return establishment;
  }
}
