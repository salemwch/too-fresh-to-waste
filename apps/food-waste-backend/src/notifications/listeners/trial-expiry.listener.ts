import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import {
  EstablishmentTrialExpiringSoonEvent,
  EstablishmentTrialExpiredEvent,
} from '../../common/events/admin-establishment.events';
import { ISendNotificationRequest } from '../interfaces/notification.interfaces';
import { NotificationService } from '../services/notification.service';
import { NotificationPriority, NotificationTrigger } from '../types/notification.types';

/**
 * Listener for merchant trial lifecycle events emitted by the daily trial-expiry scanner.
 *
 * Dual-mode listener (same pattern as AdminEstablishmentEventsListener):
 * - @OnEvent: EventEmitter2 fallback (used when RABBITMQ_ENABLED=false)
 * - @RabbitSubscribe: RabbitMQ broker (production)
 *
 * Emits in-app + email notification to the merchant owner. The scanner itself
 * handles the state transition (setting subscriptionStatus='suspended') — this
 * listener is purely the reaction side.
 */
@Injectable()
export class TrialExpiryListener {
  private readonly logger = new Logger(TrialExpiryListener.name);

  constructor(private readonly notificationService: NotificationService) {}

  // ============================================
  // EXPIRING SOON (2 days warning)
  // ============================================

  @OnEvent('establishment.trial.expiring_soon')
  async handleTrialExpiringSoonLegacy(event: EstablishmentTrialExpiringSoonEvent): Promise<void> {
    await this.sendExpiringSoonNotification(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'establishment.trial.expiring_soon',
    queue: 'foodwaste.notifications.trial-expiring-soon',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24h — warning is time-sensitive, drop if not delivered in a day
      },
    },
  })
  async handleTrialExpiringSoonRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(EstablishmentTrialExpiringSoonEvent, msg);
      await this.sendExpiringSoonNotification(event);
    } catch (error) {
      this.logger.error('Failed to process establishment.trial.expiring_soon from RabbitMQ', error);
      return new Nack(true);
    }
  }

  private async sendExpiringSoonNotification(
    event: EstablishmentTrialExpiringSoonEvent,
  ): Promise<void> {
    if (!event.ownerId) {
      this.logger.warn(
        `Cannot send trial-expiring-soon notification — missing ownerId for establishment ${event.establishmentId}`,
      );
      return;
    }

    const trialEndsAtFormatted = new Date(event.trialEndsAt).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const notificationData: ISendNotificationRequest = {
      type: 'email',
      trigger: NotificationTrigger.ESTABLISHMENT_TRIAL_EXPIRING_SOON,
      target: {
        userId: event.ownerId,
        establishmentId: event.establishmentId,
      },
      payload: {
        title: `⏰ Your free trial ends in ${event.daysRemaining} day${event.daysRemaining === 1 ? '' : 's'}`,
        body: `Your free trial for "${event.establishmentName}" ends on ${trialEndsAtFormatted}. Contact the admin team to continue using the platform after that date.`,
        data: {
          establishmentId: event.establishmentId,
          establishmentName: event.establishmentName,
          trialEndsAt: event.trialEndsAt,
          daysRemaining: event.daysRemaining,
        },
      },
      priority: NotificationPriority.HIGH,
    };

    try {
      await this.notificationService.sendNotification(notificationData);
      this.logger.log(
        `Sent trial-expiring-soon notification for establishment ${event.establishmentId} (${event.daysRemaining}d remaining)`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send trial-expiring-soon notification for establishment ${event.establishmentId}`,
        error,
      );
    }
  }

  // ============================================
  // EXPIRED (trial ended, merchant auto-suspended)
  // ============================================

  @OnEvent('establishment.trial.expired')
  async handleTrialExpiredLegacy(event: EstablishmentTrialExpiredEvent): Promise<void> {
    await this.sendTrialExpiredNotification(event);
  }

  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'establishment.trial.expired',
    queue: 'foodwaste.notifications.trial-expired',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleTrialExpiredRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(EstablishmentTrialExpiredEvent, msg);
      await this.sendTrialExpiredNotification(event);
    } catch (error) {
      this.logger.error('Failed to process establishment.trial.expired from RabbitMQ', error);
      return new Nack(true);
    }
  }

  private async sendTrialExpiredNotification(event: EstablishmentTrialExpiredEvent): Promise<void> {
    if (!event.ownerId) {
      this.logger.warn(
        `Cannot send trial-expired notification — missing ownerId for establishment ${event.establishmentId}`,
      );
      return;
    }

    const notificationData: ISendNotificationRequest = {
      type: 'email',
      trigger: NotificationTrigger.ESTABLISHMENT_TRIAL_EXPIRED,
      target: {
        userId: event.ownerId,
        establishmentId: event.establishmentId,
      },
      payload: {
        title: `🛑 Your free trial for "${event.establishmentName}" has ended`,
        body: `Your 2-month free trial has ended. You can still log in and view your dashboard, but creating new offers is paused until an admin reactivates your account. Please contact the admin team to continue.`,
        data: {
          establishmentId: event.establishmentId,
          establishmentName: event.establishmentName,
          trialEndedAt: event.trialEndedAt,
        },
      },
      priority: NotificationPriority.HIGH,
    };

    try {
      await this.notificationService.sendNotification(notificationData);
      this.logger.log(`Sent trial-expired notification for establishment ${event.establishmentId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send trial-expired notification for establishment ${event.establishmentId}`,
        error,
      );
    }
  }
}
