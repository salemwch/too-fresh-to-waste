import { Injectable, Logger } from '@nestjs/common';
import { WebSocketService } from '../websocket.service';
import { OfferUpdate, WebSocketEvents } from '../interfaces/websocket.interface';

@Injectable()
export class OfferGateway {
  private readonly logger = new Logger(OfferGateway.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  /**
   * Notify users about new offers in their area
   */
  notifyNearbyOffers(offer: OfferUpdate, userIds: string[]): void {
    try {
      const notification = {
        ...offer,
        title: '🍽️ New Food Available Nearby!',
        message: `${offer.title} - ${offer.discountPercentage}% off! Only ${offer.availableQuantity} left.`,
        actionRequired: true,
        action: 'view_offer',
      };

      this.webSocketService.sendNearbyOfferUpdate(notification, userIds);
      this.logger.log(`Nearby offer notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send nearby offer notification:', error);
    }
  }

  /**
   * Notify about featured offers
   */
  notifyFeaturedOffer(offer: OfferUpdate, userIds: string[]): void {
    try {
      const notification = {
        ...offer,
        title: '⭐ Featured Offer Alert!',
        message: `Don't miss: ${offer.title} - ${offer.discountPercentage}% off!`,
        actionRequired: true,
        action: 'view_offer',
        priority: 'high' as const,
      };

      for (const userId of userIds) {
        this.webSocketService.sendToUser(userId, WebSocketEvents.OFFER_FEATURED, notification);
      }

      this.logger.log(`Featured offer notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send featured offer notification:', error);
    }
  }

  /**
   * Notify about offers expiring soon
   */
  notifyExpiringOffers(offers: OfferUpdate[], userIds: string[]): void {
    try {
      for (const offer of offers) {
        const timeUntilExpiry = Math.floor(
          (offer.expiresAt.getTime() - Date.now()) / (1000 * 60)
        );

        const notification = {
          ...offer,
          title: '⏰ Hurry! Offer Expiring Soon!',
          message: `${offer.title} expires in ${timeUntilExpiry} minutes - ${offer.discountPercentage}% off!`,
          actionRequired: true,
          action: 'view_offer',
          priority: 'urgent' as const,
          metadata: {
            timeUntilExpiry,
          },
        };

        for (const userId of userIds) {
          this.webSocketService.sendToUser(userId, WebSocketEvents.OFFER_EXPIRING_SOON, notification);
        }
      }

      this.logger.log(`Expiring offer notifications sent for ${offers.length} offers`);
    } catch (error) {
      this.logger.error('Failed to send expiring offer notifications:', error);
    }
  }

  /**
   * Notify when an offer is sold out
   */
  notifyOfferSoldOut(offer: OfferUpdate): void {
    try {
      // Notify the merchant
      const merchantNotification = {
        ...offer,
        title: '🎉 Offer Sold Out!',
        message: `Great news! Your "${offer.title}" offer is completely sold out.`,
        actionRequired: false,
      };

      this.webSocketService.sendToUser(
        offer.merchantId,
        WebSocketEvents.OFFER_SOLD_OUT,
        merchantNotification
      );

      this.logger.log(`Sold out notification sent for offer ${offer.offerId}`);
    } catch (error) {
      this.logger.error('Failed to send sold out notification:', error);
    }
  }

  /**
   * Notify followers when establishment posts new offer
   */
  notifyEstablishmentFollowers(offer: OfferUpdate, followerIds: string[]): void {
    try {
      const notification = {
        ...offer,
        title: '🔔 New Offer from Followed Store!',
        message: `Your favorite store just posted: ${offer.title} - ${offer.discountPercentage}% off!`,
        actionRequired: true,
        action: 'view_offer',
        priority: 'medium' as const,
      };

      for (const followerId of followerIds) {
        this.webSocketService.sendToUser(followerId, WebSocketEvents.ESTABLISHMENT_NEW_OFFER, notification);
      }

      this.logger.log(`New offer notification sent to ${followerIds.length} followers`);
    } catch (error) {
      this.logger.error('Failed to send follower notification:', error);
    }
  }

  /**
   * Notify about flash sales or limited-time offers
   */
  notifyFlashSale(offers: OfferUpdate[], userIds: string[]): void {
    try {
      const notification = {
        title: '⚡ Flash Sale Alert!',
        message: `Limited time offers available with up to ${Math.max(...offers.map(o => o.discountPercentage))}% off!`,
        actionRequired: true,
        action: 'browse_flash_sales',
        priority: 'high' as const,
        data: {
          offerCount: offers.length,
          maxDiscount: Math.max(...offers.map(o => o.discountPercentage)),
          offers: offers.map(o => ({
            id: o.offerId,
            title: o.title,
            discount: o.discountPercentage,
            quantity: o.availableQuantity,
          })),
        },
      };

      for (const userId of userIds) {
        this.webSocketService.sendToUser(userId, 'flash_sale:alert', notification);
      }

      this.logger.log(`Flash sale notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send flash sale notification:', error);
    }
  }

  /**
   * Notify about price drops on wishlisted items
   */
  notifyPriceDrop(offer: OfferUpdate, userIds: string[], oldPrice: number): void {
    try {
      const priceDrop = oldPrice - offer.discountPercentage;

      const notification = {
        ...offer,
        title: '💰 Price Drop Alert!',
        message: `Price dropped on "${offer.title}"! Now ${offer.discountPercentage}% off (was ${oldPrice}% off)`,
        actionRequired: true,
        action: 'view_offer',
        priority: 'medium' as const,
        metadata: {
          oldDiscount: oldPrice,
          newDiscount: offer.discountPercentage,
          savings: priceDrop,
        },
      };

      for (const userId of userIds) {
        this.webSocketService.sendToUser(userId, 'offer:price_drop', notification);
      }

      this.logger.log(`Price drop notification sent to ${userIds.length} users`);
    } catch (error) {
      this.logger.error('Failed to send price drop notification:', error);
    }
  }

  /**
   * Notify merchants about offer performance
   */
  notifyOfferPerformance(
    merchantId: string,
    offerId: string,
    stats: {
      views: number;
      favorites: number;
      orders: number;
      revenue: number;
    }
  ): void {
    try {
      const notification = {
        offerId,
        title: '📊 Offer Performance Update',
        message: `Your offer has ${stats.views} views, ${stats.favorites} favorites, and generated $${stats.revenue.toFixed(2)} in revenue.`,
        actionRequired: true,
        action: 'view_analytics',
        data: stats,
      };

      this.webSocketService.sendToUser(merchantId, 'offer:performance', notification);
      this.logger.log(`Performance notification sent for offer ${offerId}`);
    } catch (error) {
      this.logger.error('Failed to send performance notification:', error);
    }
  }

  /**
   * Batch process multiple offer updates
   */
  batchNotifyOfferUpdates(updates: OfferUpdate[], userMappings: Map<string, string[]>): void {
    try {
      for (const update of updates) {
        const relevantUsers = userMappings.get(update.offerId) || [];

        switch (update.type) {
          case 'new':
            this.notifyNearbyOffers(update, relevantUsers);
            break;
          case 'featured':
            this.notifyFeaturedOffer(update, relevantUsers);
            break;
          case 'expired':
            // Handle expired offers if needed
            break;
          case 'sold_out':
            this.notifyOfferSoldOut(update);
            break;
        }
      }

      this.logger.log(`Batch offer updates processed: ${updates.length} offers`);
    } catch (error) {
      this.logger.error('Failed to process batch offer updates:', error);
    }
  }
}