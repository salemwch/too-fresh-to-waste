/**
 * Favorite Domain Events
 * Events emitted by the favorites module for cross-module communication
 *
 * @module common/events
 */

/**
 * Emitted when a user adds an offer to favorites
 * Listeners: Offers (increment count), Analytics, Notifications (to merchant)
 */
export class FavoriteAddedEvent {
  constructor(
    public readonly favoriteId: string,
    public readonly userId: string,
    public readonly offerId: string,
    public readonly addedAt: Date,
  ) {}
}

/**
 * Emitted when a user removes an offer from favorites
 * Listeners: Offers (decrement count), Analytics
 */
export class FavoriteRemovedEvent {
  constructor(
    public readonly favoriteId: string,
    public readonly userId: string,
    public readonly offerId: string,
    public readonly removedAt: Date,
  ) {}
}
