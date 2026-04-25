import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage } from 'mongoose';

import {
  Establishment,
  EstablishmentDocument,
} from '../../establishments/schemas/establishment.schema';
import { Offer, OfferDocument } from '../../offers/schemas/offer.schema';

import { SearchCacheService } from './search-cache.service';

/** Shape of an offer after the $lookup aggregation replaces establishmentId with the full doc. */
interface PopulatedOfferResult {
  _id: Types.ObjectId;
  title: string;
  description: string;
  categories?: string[];
  establishmentId?: {
    name?: string;
    address?: {
      coordinates?: unknown;
      city?: string;
      street?: string;
    };
  };
  pricing?: {
    originalPrice?: number;
    discountedPrice?: number;
    discountPercentage?: number;
  };
  availableQuantity?: number;
  availableFrom?: Date;
  availableUntil?: Date;
  status?: string;
  isFeaturedManual?: boolean;
  isFeaturedAuto?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(
    @InjectModel(Offer.name) private readonly offerModel: Model<OfferDocument>,
    @InjectModel(Establishment.name)
    private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly searchCacheService: SearchCacheService,
  ) {}

  // =========================================================================
  // REUSABLE $lookup PIPELINE BUILDER (replaces .populate() — 1 round-trip)
  // =========================================================================

  /**
   * Build $lookup stages for establishment population on offers.
   * Overwrites `establishmentId` ObjectId with the full establishment doc
   * (identical shape to Mongoose `.populate('establishmentId')`).
   */
  private buildEstablishmentLookupForSearch(): PipelineStage[] {
    return [
      {
        $lookup: {
          from: 'establishments',
          let: { refId: '$establishmentId' },
          pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$refId'] } } }],
          as: '_establishmentDoc',
        },
      },
      { $unwind: { path: '$_establishmentDoc', preserveNullAndEmptyArrays: true } },
      { $addFields: { establishmentId: '$_establishmentDoc' } },
      { $project: { _establishmentDoc: 0 } },
    ];
  }

  async indexOffer(offerId: string): Promise<void> {
    try {
      // ✅ PERFORMANCE: Single aggregation replaces findById + populate (2 → 1 round-trip)
      const pipeline: PipelineStage[] = [
        { $match: { _id: new Types.ObjectId(offerId) } },
        ...this.buildEstablishmentLookupForSearch(),
      ];

      const results = await this.offerModel.aggregate<PopulatedOfferResult>(pipeline).exec();
      const offer = results[0];

      if (offer === null || offer === undefined) {
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
      const establishment = await this.establishmentModel.findById(establishmentId).exec();

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

      // ✅ PERFORMANCE: Single aggregation replaces find + populate (2 → 1 round-trip per offer batch)
      const offerPipeline: PipelineStage[] = [
        { $match: { status: 'active' } },
        ...this.buildEstablishmentLookupForSearch(),
      ];
      const offers = await this.offerModel.aggregate<PopulatedOfferResult>(offerPipeline).exec();

      for (const offer of offers) {
        const searchDocument = this.createOfferSearchDocument(offer);
        await this.updateSearchIndex('offers', offer._id.toString(), searchDocument);
      }

      // Index all active establishments
      const establishments = await this.establishmentModel
        .find({ isActive: true })
        .limit(5000)
        .exec();

      for (const establishment of establishments) {
        const searchDocument = this.createEstablishmentSearchDocument(establishment);
        await this.updateSearchIndex(
          'establishments',
          establishment._id.toString(),
          searchDocument,
        );
      }

      this.logger.log(
        `Search index rebuilt successfully. Indexed ${offers.length} offers and ${establishments.length} establishments`,
      );
    } catch (error) {
      this.logger.error('Error rebuilding search index:', error);
      throw error;
    }
  }

  async getIndexStats(): Promise<{
    totalOffers: number;
    totalEstablishments: number;
    lastUpdated: Date;
  }> {
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

  private createOfferSearchDocument(offer: PopulatedOfferResult): Record<string, unknown> {
    return {
      id: offer._id.toString(),
      type: 'offer',
      title: offer.title,
      description: offer.description,
      categories: offer.categories ?? [],
      establishmentName: offer.establishmentId?.name ?? '',
      establishmentAddress: offer.establishmentId?.address ?? {},
      location: offer.establishmentId?.address?.coordinates ?? null,
      price: {
        original: offer.pricing?.originalPrice ?? 0,
        discounted: offer.pricing?.discountedPrice ?? 0,
        discount: offer.pricing?.discountPercentage ?? 0,
      },
      availability: {
        quantity: offer.availableQuantity ?? 0,
        from: offer.availableFrom,
        until: offer.availableUntil,
      },
      searchText:
        `${offer.title} ${offer.description} ${offer.categories?.join(' ') ?? ''} ${offer.establishmentId?.name ?? ''}`.toLowerCase(),
      status: offer.status,
      isFeatured: offer.isFeaturedManual === true || offer.isFeaturedAuto === true,
      createdAt: offer.createdAt,
      updatedAt: offer.updatedAt,
    };
  }

  private createEstablishmentSearchDocument(
    establishment: EstablishmentDocument,
  ): Record<string, unknown> {
    const withTimestamps = establishment as unknown as { createdAt?: Date; updatedAt?: Date };
    return {
      id: establishment._id.toString(),
      type: 'establishment',
      name: establishment.name,
      description: establishment.description,
      categories: establishment.cuisineTypes ?? [],
      address: establishment.address ?? {},
      location: establishment.address?.coordinates ?? null,
      rating: {
        average: establishment.averageRating || 0,
        count: establishment.totalReviews || 0,
      },
      searchText:
        `${establishment.name} ${establishment.description || ''} ${establishment.cuisineTypes?.join(' ') || ''} ${establishment.address?.city || ''} ${establishment.address?.street || ''}`.toLowerCase(),
      isActive: establishment.isActive,
      createdAt: withTimestamps.createdAt,
      updatedAt: withTimestamps.updatedAt,
    };
  }

  private async updateSearchIndex(
    type: string,
    id: string,
    document: Record<string, unknown>,
  ): Promise<void> {
    const key = `search:${type}:${id}`;
    await this.searchCacheService.setCache(key, document, 3600); // 1 hour TTL
  }
}
