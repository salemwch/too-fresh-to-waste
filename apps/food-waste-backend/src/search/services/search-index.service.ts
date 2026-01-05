import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Offer, OfferDocument } from '../../offers/schemas/offer.schema';
import { Establishment, EstablishmentDocument } from '../../establishments/schemas/establishment.schema';
import { SearchCacheService } from './search-cache.service';

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(
    @InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
    @InjectModel(Establishment.name) private establishmentModel: Model<EstablishmentDocument>,
    private searchCacheService: SearchCacheService,
  ) {}

  async indexOffer(offerId: string): Promise<void> {
    try {
      const offer = await this.offerModel
        .findById(offerId)
        .populate('establishmentId')
        .exec();

      if (!offer) {
        this.logger.warn(`Offer ${offerId} not found for indexing`);
        return;
      }

      const searchDocument = this.createOfferSearchDocument(offer);
      await this.updateSearchIndex('offers', offerId, searchDocument);

      this.logger.log(`Indexed offer ${offerId}`);
    } catch (error) {
      this.logger.error(`Error indexing offer ${offerId}:`, error);
    }
  }

  async indexEstablishment(establishmentId: string): Promise<void> {
    try {
      const establishment = await this.establishmentModel
        .findById(establishmentId)
        .exec();

      if (!establishment) {
        this.logger.warn(`Establishment ${establishmentId} not found for indexing`);
        return;
      }

      const searchDocument = this.createEstablishmentSearchDocument(establishment);
      await this.updateSearchIndex('establishments', establishmentId, searchDocument);

      this.logger.log(`Indexed establishment ${establishmentId}`);
    } catch (error) {
      this.logger.error(`Error indexing establishment ${establishmentId}:`, error);
    }
  }

  async removeFromIndex(type: 'offers' | 'establishments', id: string): Promise<void> {
    try {
      await this.searchCacheService.deleteFromCache(`search:${type}:${id}`);
      this.logger.log(`Removed ${type} ${id} from search index`);
    } catch (error) {
      this.logger.error(`Error removing ${type} ${id} from search index:`, error);
    }
  }

  async rebuildIndex(): Promise<void> {
    try {
      this.logger.log('Starting search index rebuild...');

      // Clear existing index
      await this.searchCacheService.clearPattern('search:*');

      // Index all active offers
      const offers = await this.offerModel
        .find({ status: 'active' })
        .populate('establishmentId')
        .exec();

      for (const offer of offers) {
        const searchDocument = this.createOfferSearchDocument(offer);
        await this.updateSearchIndex('offers', offer._id.toString(), searchDocument);
      }

      // Index all active establishments
      const establishments = await this.establishmentModel
        .find({ isActive: true })
        .exec();

      for (const establishment of establishments) {
        const searchDocument = this.createEstablishmentSearchDocument(establishment);
        await this.updateSearchIndex('establishments', establishment._id.toString(), searchDocument);
      }

      this.logger.log(`Search index rebuilt successfully. Indexed ${offers.length} offers and ${establishments.length} establishments`);
    } catch (error) {
      this.logger.error('Error rebuilding search index:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const offerCount = await this.offerModel.countDocuments({ status: 'active' });
      const establishmentCount = await this.establishmentModel.countDocuments({ isActive: true });

      return {
        totalOffers: offerCount,
        totalEstablishments: establishmentCount,
        lastUpdated: new Date(),
      };
    } catch (error) {
      this.logger.error('Error getting index stats:', error);
      return {
        totalOffers: 0,
        totalEstablishments: 0,
        lastUpdated: new Date(),
      };
    }
  }

  private createOfferSearchDocument(offer: any): any {
    return {
      id: offer._id.toString(),
      type: 'offer',
      title: offer.title,
      description: offer.description,
      categories: offer.categories || [],
      establishmentName: offer.establishmentId?.name || '',
      establishmentAddress: offer.establishmentId?.address || {},
      location: offer.establishmentId?.address?.coordinates || null,
      price: {
        original: offer.pricing?.originalPrice || 0,
        discounted: offer.pricing?.discountedPrice || 0,
        discount: offer.pricing?.discountPercentage || 0,
      },
      availability: {
        quantity: offer.availableQuantity || 0,
        from: offer.availableFrom,
        until: offer.availableUntil,
      },
      searchText: `${offer.title} ${offer.description} ${offer.categories?.join(' ') || ''} ${offer.establishmentId?.name || ''}`.toLowerCase(),
      status: offer.status,
      isFeatured: offer.isFeatured || false,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private createEstablishmentSearchDocument(establishment: any): any {
    return {
      id: establishment._id.toString(),
      type: 'establishment',
      name: establishment.name,
      description: establishment.description,
      categories: establishment.cuisineTypes || [],
      address: establishment.address || {},
      location: establishment.address?.coordinates || null,
      rating: {
        average: establishment.rating?.average || 0,
        count: establishment.rating?.count || 0,
      },
      searchText: `${establishment.name} ${establishment.description || ''} ${establishment.cuisineTypes?.join(' ') || ''} ${establishment.address?.city || ''} ${establishment.address?.street || ''}`.toLowerCase(),
      isActive: establishment.isActive,
      createdAt: establishment.createdAt,
      updatedAt: establishment.updatedAt,
    };
  }

  private async updateSearchIndex(type: string, id: string, document: any): Promise<void> {
    const key = `search:${type}:${id}`;
    await this.searchCacheService.setCache(key, document, 3600); // 1 hour TTL
  }
}