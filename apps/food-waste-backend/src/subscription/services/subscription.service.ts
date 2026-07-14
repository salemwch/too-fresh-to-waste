import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { InitiatePaymentResponseDto, SubscriptionStatusResponseDto } from '../dto/subscription.dto';
import { KonnectService } from './konnect.service';

const MONTHLY_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const YEARLY_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly konnectService: KonnectService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
  ) {}

  async getStatus(
    merchantId: string,
    establishmentId?: string,
  ): Promise<SubscriptionStatusResponseDto> {
    const establishment = await this.findMerchantEstablishment(merchantId, establishmentId);

    return {
      subscriptionStatus: establishment.subscriptionStatus,
      ...(establishment.subscriptionPlan
        ? { subscriptionPlan: establishment.subscriptionPlan }
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
    plan: 'monthly' | 'yearly',
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

    const amount = this.getPriceMillimes(plan);
    const token = `sub_${establishment._id.toString()}_${plan}_${Date.now()}`;

    const result = await this.konnectService.initPayment({
      amount,
      firstName: merchant.firstName ?? '',
      lastName: merchant.lastName ?? '',
      email: merchant.email,
      orderId: token,
      description: `Too Fresh To Waste — Abonnement ${plan === 'monthly' ? 'mensuel' : 'annuel'}`,
    });

    await this.establishmentModel
      .findByIdAndUpdate(establishment._id, {
        $set: { lastPaymentRef: result.paymentRef },
      })
      .exec();

    this.logger.log(
      `Payment initiated for establishment ${establishment._id.toString()}: plan=${plan}, ref=${result.paymentRef}`,
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

    const token = (payload['token'] as string) ?? '';
    const plan = token.includes('_yearly_') ? 'yearly' : 'monthly';
    const duration = plan === 'yearly' ? YEARLY_DURATION_MS : MONTHLY_DURATION_MS;

    const baseDate =
      establishment.subscriptionStatus === 'paid' && establishment.subscriptionExpiresAt
        ? new Date(Math.max(establishment.subscriptionExpiresAt.getTime(), Date.now()))
        : new Date();

    const subscriptionExpiresAt = new Date(baseDate.getTime() + duration);

    await this.establishmentModel
      .findByIdAndUpdate(establishment._id, {
        $set: {
          subscriptionStatus: 'paid',
          subscriptionPlan: plan,
          subscriptionExpiresAt,
          isActive: true,
        },
      })
      .exec();

    await this.eventBus.emit('establishment.subscription.activated', {
      establishmentId: establishment._id.toString(),
      establishmentName: establishment.name,
      ownerId: establishment.ownerId.toString(),
      plan,
      subscriptionExpiresAt,
      paymentRef,
    });

    this.logger.log(
      `Subscription activated for establishment ${establishment._id.toString()}: plan=${plan}, expires=${subscriptionExpiresAt.toISOString()}`,
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

  private getPriceMillimes(plan: 'monthly' | 'yearly'): number {
    const envKey =
      plan === 'monthly'
        ? 'SUBSCRIPTION_MONTHLY_PRICE_MILLIMES'
        : 'SUBSCRIPTION_YEARLY_PRICE_MILLIMES';

    const price = Number.parseInt(this.configService.get<string>(envKey, '0'), 10);

    if (!price || price <= 0) {
      throw new BadRequestException(
        'Subscription pricing is not configured. Please contact support.',
      );
    }

    return price;
  }

  private async findMerchantEstablishment(
    merchantId: string,
    establishmentId?: string,
  ): Promise<EstablishmentDocument> {
    const query: Record<string, unknown> = { ownerId: merchantId };
    if (establishmentId) {
      query['_id'] = establishmentId;
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
