/**
 * Favorite Events Listener for Offers Module
 * Handles favorite-related events to update offer favorite counts
 *
 * Dual-mode listener:
 * - @OnEvent: Legacy EventEmitter2 (fallback)
 * - @RabbitSubscribe: RabbitMQ message broker (production)
 *
 * @module offers/listeners
 */

import { RabbitSubscribe, Nack } from '@golevelup/nestjs-rabbitmq';
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { plainToClass } from 'class-transformer';
import { Model } from 'mongoose';

import { FavoriteAddedEvent, FavoriteRemovedEvent } from '../../common/events';
import { Offer, OfferDocument } from '../schemas/offer.schema';

@Injectable()
export class FavoriteEventsListener {
  private readonly logger = new Logger(FavoriteEventsListener.name);

  constructor(
    @InjectModel(Offer.name)
    private readonly offerModel: Model<OfferDocument>,
  ) {}

  // ============================================
  // FAVORITE ADDED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for favorite added
   */
  @OnEvent('favorite.added')
  async handleFavoriteAddedLegacy(event: FavoriteAddedEvent): Promise<void> {
    await this.incrementFavoriteCount(event);
  }

  /**
   * RABBITMQ: Message broker handler for favorite added
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'favorite.added',
    queue: 'foodwaste.offers.favorite-added',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000, // 24 hours
      },
    },
  })
  async handleFavoriteAddedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(FavoriteAddedEvent, msg);
      await this.incrementFavoriteCount(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process favorite.added event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Increment favorite count for offer
   */
  private async incrementFavoriteCount(event: FavoriteAddedEvent): Promise<void> {
    try {
      await this.offerModel.findByIdAndUpdate(
        event.offerId,
        { $inc: { favoriteCount: 1 } },
        { new: true },
      );

      this.logger.log(
        `Incremented favorite count for offer ${event.offerId} (user: ${event.userId})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to increment favorite count for offer ${event.offerId}: ${message}`,
        stack,
      );
      // Don't throw - event listeners should not break the flow
    }
  }

  // ============================================
  // FAVORITE REMOVED HANDLERS
  // ============================================

  /**
   * LEGACY: EventEmitter2 handler for favorite removed
   */
  @OnEvent('favorite.removed')
  async handleFavoriteRemovedLegacy(event: FavoriteRemovedEvent): Promise<void> {
    await this.decrementFavoriteCount(event);
  }

  /**
   * RABBITMQ: Message broker handler for favorite removed
   */
  @RabbitSubscribe({
    exchange: 'foodwaste.events',
    routingKey: 'favorite.removed',
    queue: 'foodwaste.offers.favorite-removed',
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'foodwaste.dlx',
        'x-message-ttl': 86400000,
      },
    },
  })
  async handleFavoriteRemovedRabbitMQ(msg: object): Promise<void | Nack> {
    try {
      const event = plainToClass(FavoriteRemovedEvent, msg);
      await this.decrementFavoriteCount(event);
      // Auto-ACK on success
    } catch (error) {
      this.logger.error(`RabbitMQ: Failed to process favorite.removed event`, error);
      return new Nack(true); // Requeue for retry
    }
  }

  /**
   * Shared logic: Decrement favorite count for offer
   */
  private async decrementFavoriteCount(event: FavoriteRemovedEvent): Promise<void> {
    try {
      await this.offerModel.findByIdAndUpdate(
        event.offerId,
        { $inc: { favoriteCount: -1 } },
        { new: true },
      );

      this.logger.log(
        `Decremented favorite count for offer ${event.offerId} (user: ${event.userId})`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to decrement favorite count for offer ${event.offerId}: ${message}`,
        stack,
      );
      // Don't throw - event listeners should not break the flow
    }
  }
}
