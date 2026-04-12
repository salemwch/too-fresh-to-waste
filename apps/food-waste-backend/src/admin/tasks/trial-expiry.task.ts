import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron } from '@nestjs/schedule';
import { Model } from 'mongoose';

import {
  EstablishmentTrialExpiringSoonEvent,
  EstablishmentTrialExpiredEvent,
} from '../../common/events/admin-establishment.events';
import { EventBusService } from '../../common/services/event-bus/event-bus.service';
import {
  Establishment,
  EstablishmentDocument,
  EstablishmentStatus,
} from '../../establishments/schemas/establishment.schema';

const EXPIRING_SOON_WINDOW_DAYS = 2;
const EXPIRING_SOON_WINDOW_MS = EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000;

/**
 * Daily scanner that enforces the 2-month merchant free trial.
 *
 * Runs once a day at 00:10 (10 minutes past midnight to avoid contention with
 * the existing midnight cluster: inventory expiry, gamification, moderation).
 *
 * Responsibilities:
 *  1. Warn merchants whose trial ends within 2 days (fires once per establishment,
 *     gated by `trialExpiringNotifiedAt`).
 *  2. Suspend merchants whose trial has expired (sets `subscriptionStatus='suspended'`)
 *     and emit a domain event so notifications, analytics, and any downstream
 *     reactions fire via the existing RabbitMQ transport.
 *
 * Mongo is the source of truth for *when* the trial ends; RabbitMQ is the
 * transport for *what happens next*. This keeps 60-day schedules out of the
 * broker (the delayed-messages plugin caps at ~49 days anyway) and keeps the
 * reaction pipeline consistent with every other domain event in the codebase.
 */
@Injectable()
export class TrialExpiryTask {
  private readonly logger = new Logger(TrialExpiryTask.name);

  constructor(
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly eventBus: EventBusService,
  ) {}

  @Cron('10 0 * * *', { name: 'trial-expiry-scan', timeZone: 'UTC' })
  async handleTrialExpiryScan(): Promise<void> {
    this.logger.log('Starting daily trial-expiry scan…');

    try {
      await this.notifyExpiringSoon();
      await this.suspendExpiredTrials();
    } catch (error) {
      this.logger.error(
        `Trial-expiry scan failed: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Fires `establishment.trial.expiring_soon` events for merchants whose trial
   * ends in the next 2 days and who have not yet been notified.
   * Sets `trialExpiringNotifiedAt` atomically to prevent duplicate warnings.
   */
  private async notifyExpiringSoon(): Promise<void> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + EXPIRING_SOON_WINDOW_MS);

    const candidates = await this.establishmentModel
      .find({
        subscriptionStatus: 'trial',
        status: EstablishmentStatus.ACTIVE,
        trialEndsAt: { $gte: now, $lte: windowEnd },
        trialExpiringNotifiedAt: { $exists: false },
      })
      .populate('ownerId', '_id email firstName lastName')
      .select('name ownerId trialEndsAt')
      .exec();

    if (candidates.length === 0) {
      this.logger.log('No merchants to warn about upcoming trial expiry');
      return;
    }

    this.logger.log(`Found ${candidates.length} merchants with trial expiring within 2 days`);

    for (const establishment of candidates) {
      const trialEndsAt = establishment.trialEndsAt;
      if (!trialEndsAt) {
        continue;
      }

      const daysRemaining = Math.max(
        0,
        Math.ceil((trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );

      // Atomically mark as notified *before* emitting so a crash mid-batch
      // cannot cause duplicate warnings on the next run.
      const marked = await this.establishmentModel
        .findOneAndUpdate(
          {
            _id: establishment._id,
            trialExpiringNotifiedAt: { $exists: false },
          },
          { $set: { trialExpiringNotifiedAt: now } },
          { new: true },
        )
        .exec();

      if (!marked) {
        continue;
      }

      const ownerId = this.extractOwnerId(establishment.ownerId);

      await this.eventBus.emit(
        'establishment.trial.expiring_soon',
        new EstablishmentTrialExpiringSoonEvent(
          establishment._id.toString(),
          establishment.name,
          ownerId,
          trialEndsAt,
          daysRemaining,
        ),
      );

      this.logger.log(
        `Emitted expiring_soon event for establishment ${establishment._id.toString()} (${daysRemaining}d remaining)`,
      );
    }
  }

  /**
   * Suspends all merchants whose trial has expired and emits a domain event.
   * Uses a single atomic updateMany for the state flip, then individual events
   * so downstream listeners (notification, audit, analytics) can react per merchant.
   */
  private async suspendExpiredTrials(): Promise<void> {
    const now = new Date();

    const expired = await this.establishmentModel
      .find({
        subscriptionStatus: 'trial',
        trialEndsAt: { $lt: now },
      })
      .populate('ownerId', '_id email firstName lastName')
      .select('name ownerId trialEndsAt')
      .exec();

    if (expired.length === 0) {
      this.logger.log('No expired trials to suspend');
      return;
    }

    this.logger.log(`Found ${expired.length} expired trials — suspending`);

    const ids = expired.map(e => e._id);
    await this.establishmentModel
      .updateMany(
        { _id: { $in: ids }, subscriptionStatus: 'trial' },
        { $set: { subscriptionStatus: 'suspended', isActive: false } },
      )
      .exec();

    for (const establishment of expired) {
      const trialEndedAt = establishment.trialEndsAt ?? now;
      const ownerId = this.extractOwnerId(establishment.ownerId);

      await this.eventBus.emit(
        'establishment.trial.expired',
        new EstablishmentTrialExpiredEvent(
          establishment._id.toString(),
          establishment.name,
          ownerId,
          trialEndedAt,
        ),
      );

      this.logger.log(`Emitted expired event for establishment ${establishment._id.toString()}`);
    }
  }

  private extractOwnerId(owner: unknown): string {
    if (owner && typeof owner === 'object') {
      const o = owner as { _id?: { toString(): string }; toString?: () => string };
      if (o._id && typeof o._id.toString === 'function') {
        return o._id.toString();
      }
      if (typeof o.toString === 'function') {
        return o.toString();
      }
    }
    return '';
  }
}
