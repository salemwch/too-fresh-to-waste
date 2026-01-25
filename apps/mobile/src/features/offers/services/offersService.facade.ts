/**
 * Offers Service Facade
 *
 * Best Practice: Use facade pattern for safe migration with feature flags
 *
 * This allows instant rollback and A/B testing without code changes
 *
 * @version 2.0.0
 * @migration-strategy Gradual rollout with feature flag
 */

import { isFeatureEnabled } from '@/config/featureFlags';
import { offersService as offersServiceV1 } from './offersService';
import { offersServiceV2 } from './offersService.v2';
import { Logger } from '@/utils/logger';
import { store } from '@/store';

import type {
  Offer,
  OfferListItem,
  OfferSearchParams,
  OffersResponse,
} from '../types/offer.types';
import type { NearbyOffersParams } from './offersService.v2';

/**
 * Unified Offers Service Interface
 *
 * Automatically switches between V1 (manual tokens) and V2 (auto tokens)
 * based on feature flag: useApiClientV2
 */
class OffersServiceFacade {
  private get useV2(): boolean {
    return isFeatureEnabled('useApiClientV2');
  }

  private getAccessToken(): string {
    const state = store.getState();
    return state.auth.tokens?.accessToken || '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public Methods (No Token Required)
  // ─────────────────────────────────────────────────────────────────────────

  async getOfferById(offerId: string): Promise<Offer> {
    if (this.useV2) {
      Logger.debug('Using OffersService V2 (auto token refresh)');
      return offersServiceV2.getOfferById(offerId);
    } else {
      Logger.debug('Using OffersService V1 (manual tokens)');
      return offersServiceV1.getOfferById(offerId);
    }
  }

  async getAllOffers(params?: OfferSearchParams): Promise<OffersResponse> {
    return this.useV2
      ? offersServiceV2.getAllOffers(params)
      : offersServiceV1.getAllOffers(params);
  }

  async getFeaturedOffers(limit: number = 10): Promise<OfferListItem[]> {
    return this.useV2
      ? offersServiceV2.getFeaturedOffers(limit)
      : offersServiceV1.getFeaturedOffers(limit);
  }

  async getNearbyOffers(params: NearbyOffersParams): Promise<OfferListItem[]> {
    return this.useV2
      ? offersServiceV2.getNearbyOffers(params)
      : offersServiceV1.getNearbyOffers(params);
  }

  async getOffersByEstablishment(
    establishmentId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<OffersResponse> {
    return this.useV2
      ? offersServiceV2.getOffersByEstablishment(establishmentId, page, limit)
      : offersServiceV1.getOffersByEstablishment(establishmentId, page, limit);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Authenticated Methods (Consumer-only)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Reserve quantity
   */
  async reserveQuantity(
    offerId: string,
    quantity: number,
    accessToken?: string
  ): Promise<Offer> {
    if (this.useV2) {
      return offersServiceV2.reserveQuantity(offerId, quantity);
    } else {
      const token = accessToken || this.getAccessToken();
      return offersServiceV1.reserveQuantity(offerId, quantity, token);
    }
  }

}

/**
 * Export singleton facade
 *
 * Usage in components/hooks:
 * ```typescript
 * import { offersServiceFacade } from '@/features/offers/services/offersService.facade';
 *
 * // Automatically uses V1 or V2 based on feature flag
 * const offer = await offersServiceFacade.createOffer(payload);
 * ```
 */
export const offersServiceFacade = new OffersServiceFacade();
