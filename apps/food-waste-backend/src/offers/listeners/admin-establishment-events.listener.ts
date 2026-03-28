import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { plainToClass } from 'class-transformer';

import {
  AdminEstablishmentSuspendedEvent,
  AdminEstablishmentReactivatedEvent,
  AdminEstablishmentApprovedEvent,
} from '../../common/events/admin-establishment.events';
import { OffersService } from '../offers.service';

/**
 * Listener for admin establishment events in the Offers module
 * Handles offer status changes when establishments are suspended/reactivated/approved
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 */
@Injectable()
export class AdminEstablishmentEventsListener {
  private readonly logger = new Logger(AdminEstablishmentEventsListener.name);

  constructor(private readonly offersService: OffersService) {}

  // ============================================
  // ESTABLISHMENT SUSPENDED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for establishment suspension
   */
  @OnEvent('admin.establishment.suspended')
  async handleEstablishmentSuspendedLegacy(event: AdminEstablishmentSuspendedEvent): Promise<void> {
    await this.deactivateEstablishmentOffers(event);
  }

  /**
   * RABBITMQ: Message broker handler for establishment suspension
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.establishment.suspended',
    queue: 'foodwaste.offers.establishment-suspended',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleEstablishmentSuspendedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(AdminEstablishmentSuspendedEvent, msg);
      await this.deactivateEstablishmentOffers(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(
        `CRITICAL: RabbitMQ failed to process admin.establishment.suspended event`,
        error,
      );
      return new Nack(true); // Requeue for retry - critical for preventing orders from suspended merchants
    }
  }

  /**
   * Shared logic: Deactivate all offers when establishment is suspended
   */
  private async deactivateEstablishmentOffers(
    event: AdminEstablishmentSuspendedEvent,
  ): Promise<void> {
    try {
      this.logger.log(
        `Establishment ${event.establishmentId} (${event.establishmentName}) suspended by admin ${event.adminEmail}. Deactivating all offers.`,
      );

      // Deactivate all active offers for this establishment
      const deactivatedCount = await this.offersService.deactivateEstablishmentOffers(
        event.establishmentId,
        `Establishment suspended by admin: ${event.suspensionReason}`,
      );

      if (deactivatedCount > 0) {
        this.logger.log(
          `Successfully deactivated ${deactivatedCount} offers for suspended establishment ${event.establishmentId}`,
        );
      } else {
        this.logger.debug(
          `No active offers to deactivate for suspended establishment ${event.establishmentId}`,
        );
      }

      // If reactivation date is set, log it
      if (event.reactivationDate) {
        this.logger.log(
          `Establishment ${event.establishmentId} scheduled for reactivation on ${event.reactivationDate.toISOString()}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to deactivate offers for suspended establishment ${event.establishmentId}:`,
        error,
      );
      // Don't throw - offer deactivation failure shouldn't block the suspension
    }
  }

  // ============================================
  // ESTABLISHMENT REACTIVATED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for establishment reactivation
   */
  @OnEvent('admin.establishment.reactivated')
  handleEstablishmentReactivatedLegacy(event: AdminEstablishmentReactivatedEvent): void {
    this.logEstablishmentReactivation(event);
  }

  /**
   * RABBITMQ: Message broker handler for establishment reactivation
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.establishment.reactivated',
    queue: 'foodwaste.offers.establishment-reactivated',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  handleEstablishmentReactivatedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(AdminEstablishmentReactivatedEvent, msg);
      this.logEstablishmentReactivation(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.establishment.reactivated event`, error);
      return new Nack(false); // Don't requeue - just log
    }
  }

  /**
   * Shared logic: Log establishment reactivation (offers remain deactivated until merchant reactivates)
   */
  private logEstablishmentReactivation(event: AdminEstablishmentReactivatedEvent): void {
    try {
      this.logger.log(
        `Establishment ${event.establishmentId} (${event.establishmentName}) reactivated by admin ${event.adminEmail}.`,
      );

      // Log notification - offers remain deactivated until merchant reactivates them
      this.logger.log(
        `Establishment ${event.establishmentId} reactivated. Offers remain deactivated until merchant reviews and reactivates them.`,
      );

      // Optional: Send notification to merchant about reactivation
      // The notification service will handle this via its own listener
    } catch (error) {
      this.logger.error(
        `Error handling reactivation for establishment ${event.establishmentId}:`,
        error,
      );
    }
  }

  // ============================================
  // ESTABLISHMENT APPROVED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for establishment approval
   */
  @OnEvent('admin.establishment.approved')
  handleEstablishmentApprovedLegacy(event: AdminEstablishmentApprovedEvent): void {
    this.logEstablishmentApproval(event);
  }

  /**
   * RABBITMQ: Message broker handler for establishment approval
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'admin.establishment.approved',
    queue: 'foodwaste.offers.establishment-approved',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  handleEstablishmentApprovedRabbitMQ(msg: object): void | Nack {
    try {
      const event = plainToClass(AdminEstablishmentApprovedEvent, msg);
      this.logEstablishmentApproval(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process admin.establishment.approved event`, error);
      return new Nack(false); // Don't requeue - just log
    }
  }

  /**
   * Shared logic: Log establishment approval (merchant can now create offers)
   */
  private logEstablishmentApproval(event: AdminEstablishmentApprovedEvent): void {
    try {
      this.logger.log(
        `Establishment ${event.establishmentId} (${event.establishmentName}) approved by admin ${event.adminEmail}. Merchant can now create offers.`,
      );

      // Log approval - merchant can now start creating offers
      this.logger.log(
        `Establishment ${event.establishmentId} approved. Owner ${event.ownerId} can now create and publish offers.`,
      );
    } catch (error) {
      this.logger.error(
        `Error logging establishment approval for ${event.establishmentId}:`,
        error,
      );
    }
  }
}
