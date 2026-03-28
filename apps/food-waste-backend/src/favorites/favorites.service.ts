import { Injectable, NotFoundException, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, PipelineStage, FlattenMaps } from 'mongoose';

import { FavoriteAddedEvent, FavoriteRemovedEvent } from '../common/events';
import { EventBusService } from '../common/services/event-bus/event-bus.service';
import { QueryOptimizer } from '../common/utils/query-optimization.util';
import { EstablishmentDocument } from '../establishments/schemas/establishment.schema';
import { OfferPresenter } from '../offers/presenters/offer.presenter';

/**
 * Lean result types for Favorites documents
 * Use these for results from .lean() queries to maintain type safety
 *
 * Note: When using .lean(), Mongoose returns POJO with FlattenMaps type.
 * We use 'unknown' for _id to accept both ObjectId and FlattenMaps variants.
 */
export type FavoriteLean = FlattenMaps<Favorite> & { _id: unknown };
export type FavoriteListLean = FlattenMaps<FavoriteList> & { _id: unknown };
import { OfferDocument } from '../offers/schemas/offer.schema';

import {
  AddFavoriteDto,
  UpdateFavoriteDto,
  FavoritesFilterDto,
  CreateFavoriteListDto,
  UpdateFavoriteListDto,
  AddToListDto,
  ShareListDto,
  FavoriteStatsDto,
  RecommendationDto,
  RecommendationsResponseDto,
  TrendItemDto,
  TrendsResponseDto,
  RecommendationFiltersDto,
  TrendsFiltersDto,
} from './dto/favorite.dto';
import {
  FavoriteList,
  FavoriteListDocument,
  ListVisibility,
  ListItem,
} from './schemas/favorite-list.schema';
import { Favorite, FavoriteDocument, FavoriteType } from './schemas/favorite.schema';

@Injectable()
export class FavoritesService {
  private readonly logger = new Logger(FavoritesService.name);

  constructor(
    @InjectModel(Favorite.name) private readonly favoriteModel: Model<FavoriteDocument>,
    @InjectModel(FavoriteList.name) private readonly favoriteListModel: Model<FavoriteListDocument>,
    @InjectModel('Offer') private readonly offerModel: Model<OfferDocument>,
    @InjectModel('Establishment') private readonly establishmentModel: Model<EstablishmentDocument>,
    private readonly eventBus: EventBusService,
  ) {}

  async addFavorite(userId: string, addFavoriteDto: AddFavoriteDto): Promise<FavoriteDocument> {
    try {
      const existingFavorite = await this.favoriteModel.findOne({
        userId: new Types.ObjectId(userId),
        type: addFavoriteDto.type,
        itemId: new Types.ObjectId(addFavoriteDto.itemId),
      });

      if (existingFavorite) {
        if (existingFavorite.isActive) {
          throw new ConflictException('Item is already in favorites');
        }
        // Reactivate existing favorite
        existingFavorite.isActive = true;
        existingFavorite.addedAt = new Date();
        if (addFavoriteDto.preferences) {
          existingFavorite.preferences = {
            notifications: addFavoriteDto.preferences.notifications ?? true,
            emailAlerts: addFavoriteDto.preferences.emailAlerts ?? true,
            pushNotifications: addFavoriteDto.preferences.pushNotifications ?? true,
            preferredTimes: addFavoriteDto.preferences.preferredTimes ?? [],
            preferredDays: addFavoriteDto.preferences.preferredDays ?? [],
            maxDistance: addFavoriteDto.preferences.maxDistance ?? 5,
          };
        }
        return existingFavorite.save();
      }

      const favorite = new this.favoriteModel({
        userId: new Types.ObjectId(userId),
        type: addFavoriteDto.type,
        itemId: new Types.ObjectId(addFavoriteDto.itemId),
        itemName: addFavoriteDto.itemName,
        itemImage: addFavoriteDto.itemImage,
        preferences: addFavoriteDto.preferences
          ? {
              notifications: addFavoriteDto.preferences.notifications ?? true,
              emailAlerts: addFavoriteDto.preferences.emailAlerts ?? true,
              pushNotifications: addFavoriteDto.preferences.pushNotifications ?? true,
              preferredTimes: addFavoriteDto.preferences.preferredTimes ?? [],
              preferredDays: addFavoriteDto.preferences.preferredDays ?? [],
              maxDistance: addFavoriteDto.preferences.maxDistance ?? 5,
            }
          : {
              notifications: true,
              emailAlerts: true,
              pushNotifications: true,
              preferredTimes: [],
              preferredDays: [],
              maxDistance: 5,
            },
        tags: addFavoriteDto.tags || [],
        notes: addFavoriteDto.notes,
      });

      const saved = await favorite.save();
      await this.updateInteractionCount(saved._id.toString());

      // Emit event for offers module to update favorite count
      try {
        await this.eventBus.emit(
          'favorite.added',
          new FavoriteAddedEvent(saved._id.toString(), userId, addFavoriteDto.itemId, new Date()),
        );
      } catch (eventError) {
        this.logger.error(
          `Failed to emit favorite.added event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`,
        );
      }

      this.logger.log(
        `Favorite added: ${addFavoriteDto.type} ${addFavoriteDto.itemId} for user ${userId}`,
      );
      return saved;
    } catch (error) {
      this.logger.error(
        `Error adding favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async removeFavorite(userId: string, favoriteId: string): Promise<void> {
    try {
      const result = await this.favoriteModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(favoriteId),
          userId: new Types.ObjectId(userId),
        },
        { isActive: false },
      );

      if (!result) {
        throw new NotFoundException('Favorite not found');
      }

      // Emit event for offers module to update favorite count
      try {
        await this.eventBus.emit(
          'favorite.removed',
          new FavoriteRemovedEvent(favoriteId, userId, result.itemId.toString(), new Date()),
        );
      } catch (eventError) {
        this.logger.error(
          `Failed to emit favorite.removed event: ${eventError instanceof Error ? eventError.message : 'Unknown error'}`,
        );
      }

      this.logger.log(`Favorite removed: ${favoriteId} for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error removing favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async removeFavoriteByItem(userId: string, type: FavoriteType, itemId: string): Promise<void> {
    try {
      const result = await this.favoriteModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          type,
          itemId: new Types.ObjectId(itemId),
        },
        { isActive: false },
      );

      if (!result) {
        throw new NotFoundException('Favorite not found');
      }

      this.logger.log(`Favorite removed: ${type} ${itemId} for user ${userId}`);
    } catch (error) {
      this.logger.error(
        `Error removing favorite by item: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async updateFavorite(
    userId: string,
    favoriteId: string,
    updateDto: UpdateFavoriteDto,
  ): Promise<FavoriteDocument> {
    try {
      const favorite = await this.favoriteModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(favoriteId),
          userId: new Types.ObjectId(userId),
        },
        {
          $set: {
            ...updateDto,
            lastInteraction: new Date(),
          },
          $inc: { interactionCount: 1 },
        },
        { new: true },
      );

      if (!favorite) {
        throw new NotFoundException('Favorite not found');
      }

      this.logger.log(`Favorite updated: ${favoriteId} for user ${userId}`);
      return favorite;
    } catch (error) {
      this.logger.error(
        `Error updating favorite: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getUserFavorites(
    userId: string,
    filters: FavoritesFilterDto,
  ): Promise<{
    favorites: (Omit<FavoriteLean, 'itemId'> & { itemId: unknown })[];
    total: number;
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    try {
      this.logger.log(
        `🔍 [getUserFavorites] START | userId: ${userId} | filters: ${JSON.stringify(filters)}`,
      );

      const query: Record<string, unknown> = {
        userId: new Types.ObjectId(userId),
        isActive: filters.isActive ?? true,
      };

      if (filters.type) {
        query['type'] = filters.type;
      }

      if (filters.tag) {
        query['tags'] = { $in: [filters.tag] };
      }

      this.logger.log(`🔍 [getUserFavorites] Query: ${JSON.stringify(query)}`);

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const skip = (page - 1) * limit;

      const [favorites, total] = await Promise.all([
        this.favoriteModel
          .find(query)
          .select(
            'userId type itemId itemName itemImage addedAt interactionCount lastInteraction isActive tags',
          )
          .sort(filters.sortBy || '-addedAt')
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.favoriteModel.countDocuments(query),
      ]);

      this.logger.log(
        `✅ [getUserFavorites] RESULT | total: ${total} | favoritesCount: ${favorites.length} | page: ${page}`,
      );

      // Batch-fetch all referenced items via aggregate $lookup (replaces N+1 loop)
      // Before: 20 favorites × 3 queries each = 60 DB round-trips
      // After:  2 aggregates total (offers + establishments)
      const offerItemIds = favorites
        .filter((f) => f.type === FavoriteType.OFFER)
        .map((f) => new Types.ObjectId(String(f.itemId)));

      const establishmentItemIds = favorites
        .filter((f) => f.type === FavoriteType.ESTABLISHMENT)
        .map((f) => new Types.ObjectId(String(f.itemId)));

      const [batchedOffers, batchedEstablishments] = await Promise.all([
        offerItemIds.length > 0
          ? this.offerModel.aggregate([
              { $match: { _id: { $in: offerItemIds } } },
              {
                $lookup: {
                  from: 'establishments',
                  let: { estId: '$establishmentId' },
                  pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$estId'] } } },
                    { $project: { _id: 1, name: 1, type: 1, averageRating: 1, totalReviews: 1 } },
                  ],
                  as: 'establishmentId',
                },
              },
              { $unwind: { path: '$establishmentId', preserveNullAndEmptyArrays: true } },
              {
                $lookup: {
                  from: 'users',
                  let: { merId: '$merchantId' },
                  pipeline: [
                    { $match: { $expr: { $eq: ['$_id', '$$merId'] } } },
                    { $project: { _id: 1, profileImage: 1 } },
                  ],
                  as: 'merchantId',
                },
              },
              { $unwind: { path: '$merchantId', preserveNullAndEmptyArrays: true } },
            ])
          : [],
        establishmentItemIds.length > 0
          ? this.establishmentModel.aggregate([{ $match: { _id: { $in: establishmentItemIds } } }])
          : [],
      ]);

      // O(1) lookup maps
      const offerMap = new Map(
        batchedOffers.map((o: Record<string, unknown>) => [String(o['_id']), o]),
      );
      const estMap = new Map(
        batchedEstablishments.map((e: Record<string, unknown>) => [String(e['_id']), e]),
      );

      // Map favorites to populated data
      const populatedFavorites = favorites.map((favorite) => {
        let populatedItem:
          | ReturnType<typeof OfferPresenter.toCardDto>
          | Record<string, unknown>
          | null = null;

        try {
          if (favorite.type === FavoriteType.OFFER) {
            const offer = offerMap.get(String(favorite.itemId));
            if (offer) {
              populatedItem = OfferPresenter.toCardDto(
                offer as Parameters<typeof OfferPresenter.toCardDto>[0],
                undefined,
                true,
              );
            } else {
              this.logger.warn(
                `[getUserFavorites] Offer not found for favorite: ${String(favorite._id)}, offerId: ${String(favorite.itemId)}`,
              );
            }
          } else if (favorite.type === FavoriteType.ESTABLISHMENT) {
            populatedItem = estMap.get(String(favorite.itemId)) ?? null;
          }
        } catch (error) {
          this.logger.warn(
            `Failed to populate ${favorite.type} ${String(favorite.itemId)}: ${error instanceof Error ? error.message : 'Unknown'}`,
          );
        }

        return {
          ...favorite,
          itemId: populatedItem || favorite.itemId,
        };
      });

      // Post-lookup filter by establishment type (when provided)
      // Rationale: establishmentType lives on the joined establishment doc, so we filter after $lookup population
      // We use the original favorites array to get the raw itemId (MongoDB ObjectId) for lookup
      let filteredFavorites = populatedFavorites;
      let filteredTotal = total;

      if (filters.establishmentType) {
        const targetType = filters.establishmentType;
        filteredFavorites = populatedFavorites.filter((_fav, index) => {
          const originalFavorite = favorites[index]!;

          if (originalFavorite.type === FavoriteType.OFFER) {
            // Lookup the raw aggregated offer by the original itemId
            const offer = offerMap.get(String(originalFavorite.itemId));
            if (offer) {
              const estRef = offer['establishmentId'] as Record<string, unknown> | undefined;
              const estType = estRef?.['type'];
              return estType === targetType;
            }
            return false;
          }

          if (originalFavorite.type === FavoriteType.ESTABLISHMENT) {
            const est = estMap.get(String(originalFavorite.itemId));
            return est ? est['type'] === targetType : false;
          }

          return false;
        });
        filteredTotal = filteredFavorites.length;
      }

      const paginationMeta = QueryOptimizer.getPaginationMeta(filteredTotal, page, limit);
      return {
        favorites: filteredFavorites,
        total: paginationMeta.total,
        page: paginationMeta.page,
        totalPages: paginationMeta.totalPages,
        hasNext: paginationMeta.hasNext,
        hasPrev: paginationMeta.hasPrev,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching user favorites: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async checkIsFavorite(userId: string, type: FavoriteType, itemId: string): Promise<boolean> {
    try {
      const favorite = await this.favoriteModel.findOne({
        userId: new Types.ObjectId(userId),
        type,
        itemId: new Types.ObjectId(itemId),
        isActive: true,
      });

      return !!favorite;
    } catch (error) {
      this.logger.error(
        `Error checking favorite status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  async createFavoriteList(
    userId: string,
    createDto: CreateFavoriteListDto,
  ): Promise<FavoriteListDocument> {
    try {
      const existingList = await this.favoriteListModel.findOne({
        userId: new Types.ObjectId(userId),
        name: createDto.name,
        isActive: true,
      });

      if (existingList) {
        throw new ConflictException('A list with this name already exists');
      }

      const favoriteList = new this.favoriteListModel({
        userId: new Types.ObjectId(userId),
        ...createDto,
      });

      const saved = await favoriteList.save();
      this.logger.log(`Favorite list created: ${createDto.name} for user ${userId}`);
      return saved;
    } catch (error) {
      this.logger.error(
        `Error creating favorite list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get user's favorite lists with enterprise-grade pagination
   * ⚠️ CRITICAL FIX: Added pagination to prevent loading 1000s of lists
   *
   * @param userId - User ID
   * @param page - Page number (1-indexed)
   * @param limit - Items per page (max 100)
   * @returns Paginated favorite lists with total count
   */
  async getUserFavoriteLists(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{ lists: FavoriteListLean[]; total: number }> {
    try {
      // ✅ ENTERPRISE: DOS protection - limit max page size
      const safeLimit = Math.min(limit, 100);
      const skip = (page - 1) * safeLimit;

      const query = {
        userId: new Types.ObjectId(userId),
        isActive: true,
      };

      const [lists, total] = await Promise.all([
        this.favoriteListModel
          .find(query)
          .select(
            'name description visibility items.length shareCount viewCount createdAt updatedAt',
          ) // ✅ Only essential fields
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(safeLimit)
          .lean() // ✅ ENTERPRISE: 50% memory reduction
          .exec(),
        this.favoriteListModel.countDocuments(query),
      ]);

      return { lists, total };
    } catch (error) {
      this.logger.error(
        `Error fetching user favorite lists: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getFavoriteList(userId: string, listId: string): Promise<FavoriteListLean> {
    try {
      // Single aggregate pipeline resolves polymorphic items.itemId via dual $lookup
      const pipeline: PipelineStage[] = [
        {
          $match: {
            _id: new Types.ObjectId(listId),
            $or: [
              { userId: new Types.ObjectId(userId) },
              { sharedWith: { $in: [new Types.ObjectId(userId)] } },
              { visibility: ListVisibility.PUBLIC },
            ],
          },
        },
        { $limit: 1 },
        // Lookup all offers whose _id appears in items.itemId
        {
          $lookup: {
            from: 'offers',
            let: { itemIds: '$items.itemId' },
            pipeline: [{ $match: { $expr: { $in: ['$_id', '$$itemIds'] } } }],
            as: '_offerLookup',
          },
        },
        // Lookup all establishments whose _id appears in items.itemId
        {
          $lookup: {
            from: 'establishments',
            let: { itemIds: '$items.itemId' },
            pipeline: [{ $match: { $expr: { $in: ['$_id', '$$itemIds'] } } }],
            as: '_establishmentLookup',
          },
        },
        // Resolve each item's itemId to the matched document
        {
          $addFields: {
            items: {
              $map: {
                input: '$items',
                as: 'item',
                in: {
                  $mergeObjects: [
                    '$$item',
                    {
                      itemId: {
                        $let: {
                          vars: {
                            offerMatch: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$_offerLookup',
                                    as: 'o',
                                    cond: { $eq: ['$$o._id', '$$item.itemId'] },
                                  },
                                },
                                0,
                              ],
                            },
                            estMatch: {
                              $arrayElemAt: [
                                {
                                  $filter: {
                                    input: '$_establishmentLookup',
                                    as: 'e',
                                    cond: { $eq: ['$$e._id', '$$item.itemId'] },
                                  },
                                },
                                0,
                              ],
                            },
                          },
                          in: {
                            $ifNull: ['$$offerMatch', { $ifNull: ['$$estMatch', '$$item.itemId'] }],
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
        // Remove temporary lookup arrays
        { $project: { _offerLookup: 0, _establishmentLookup: 0 } },
      ];

      const [list] = await this.favoriteListModel.aggregate<FavoriteListLean>(pipeline);

      if (!list) {
        throw new NotFoundException('Favorite list not found or access denied');
      }

      // Update view count and last accessed (separate write)
      await this.favoriteListModel.findByIdAndUpdate(listId, {
        $inc: { viewCount: 1 },
        $set: {
          lastAccessedAt: new Date(),
          lastAccessedBy: new Types.ObjectId(userId),
        },
      });

      return list;
    } catch (error) {
      this.logger.error(
        `Error fetching favorite list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async updateFavoriteList(
    userId: string,
    listId: string,
    updateDto: UpdateFavoriteListDto,
  ): Promise<FavoriteListDocument> {
    try {
      const list = await this.favoriteListModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(listId),
          userId: new Types.ObjectId(userId),
        },
        { $set: updateDto },
        { new: true },
      );

      if (!list) {
        throw new NotFoundException('Favorite list not found');
      }

      this.logger.log(`Favorite list updated: ${listId} for user ${userId}`);
      return list;
    } catch (error) {
      this.logger.error(
        `Error updating favorite list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async addToFavoriteList(
    userId: string,
    listId: string,
    addToListDto: AddToListDto,
  ): Promise<FavoriteListDocument> {
    try {
      const list = await this.favoriteListModel.findOne({
        _id: new Types.ObjectId(listId),
        userId: new Types.ObjectId(userId),
      });

      if (!list) {
        throw new NotFoundException('Favorite list not found');
      }

      // Check if item is already in the list
      const existingItem = list.items.find(
        (item) => item.itemId.toString() === addToListDto.itemId && item.type === addToListDto.type,
      );

      if (existingItem) {
        throw new ConflictException('Item is already in this list');
      }

      const newItem: ListItem = {
        itemId: new Types.ObjectId(addToListDto.itemId),
        type: addToListDto.type,
        addedAt: new Date(),
        notes: addToListDto.notes,
        position: addToListDto.position || list.items.length,
      };

      list.items.push(newItem);
      const updated = await list.save();

      this.logger.log(`Item added to favorite list: ${addToListDto.itemId} to list ${listId}`);
      return updated;
    } catch (error) {
      this.logger.error(
        `Error adding to favorite list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async removeFromFavoriteList(
    userId: string,
    listId: string,
    itemId: string,
    type: string,
  ): Promise<FavoriteListDocument> {
    try {
      const list = await this.favoriteListModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(listId),
          userId: new Types.ObjectId(userId),
        },
        {
          $pull: {
            items: {
              itemId: new Types.ObjectId(itemId),
              type,
            },
          },
        },
        { new: true },
      );

      if (!list) {
        throw new NotFoundException('Favorite list not found');
      }

      this.logger.log(`Item removed from favorite list: ${itemId} from list ${listId}`);
      return list;
    } catch (error) {
      this.logger.error(
        `Error removing from favorite list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async shareList(
    userId: string,
    listId: string,
    shareDto: ShareListDto,
  ): Promise<FavoriteListDocument> {
    try {
      const userIds = shareDto.userIds.map((id) => new Types.ObjectId(id));

      const list = await this.favoriteListModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(listId),
          userId: new Types.ObjectId(userId),
        },
        {
          $addToSet: { sharedWith: { $each: userIds } },
          $inc: { shareCount: shareDto.userIds.length },
          $set: { visibility: ListVisibility.SHARED },
        },
        { new: true },
      );

      if (!list) {
        throw new NotFoundException('Favorite list not found');
      }

      this.logger.log(`List shared: ${listId} with ${shareDto.userIds.length} users`);
      return list;
    } catch (error) {
      this.logger.error(
        `Error sharing list: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async getFavoriteStats(userId: string): Promise<FavoriteStatsDto> {
    try {
      const [favoriteStats, listStats] = await Promise.all([
        this.favoriteModel.aggregate([
          { $match: { userId: new Types.ObjectId(userId), isActive: true } },
          {
            $group: {
              _id: '$type',
              count: { $sum: 1 },
              totalNotifications: { $sum: '$notificationCount' },
              totalInteractions: { $sum: '$interactionCount' },
            },
          },
        ]),
        this.favoriteListModel.aggregate([
          { $match: { userId: new Types.ObjectId(userId) } },
          {
            $group: {
              _id: null,
              totalLists: { $sum: 1 },
              activeLists: { $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] } },
              sharedLists: {
                $sum: { $cond: [{ $eq: ['$visibility', ListVisibility.SHARED] }, 1, 0] },
              },
            },
          },
        ]),
      ]);

      const stats: FavoriteStatsDto = {
        totalFavorites: 0,
        favoriteEstablishments: 0,
        favoriteOffers: 0,
        favoriteCategories: 0,
        totalLists: 0,
        activeLists: 0,
        sharedLists: 0,
        totalNotifications: 0,
        recentActivity: 0,
      };

      for (const stat of favoriteStats) {
        stats.totalFavorites += stat.count;
        stats.totalNotifications += stat.totalNotifications;

        switch (stat._id) {
          case FavoriteType.ESTABLISHMENT:
            stats.favoriteEstablishments = stat.count;
            break;
          case FavoriteType.OFFER:
            stats.favoriteOffers = stat.count;
            break;
          case FavoriteType.CATEGORY:
            stats.favoriteCategories = stat.count;
            break;
        }
      }

      if (listStats.length > 0) {
        const listStat = listStats[0];
        stats.totalLists = listStat.totalLists;
        stats.activeLists = listStat.activeLists;
        stats.sharedLists = listStat.sharedLists;
      }

      // Get recent activity (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      stats.recentActivity = await this.favoriteModel.countDocuments({
        userId: new Types.ObjectId(userId),
        lastInteraction: { $gte: weekAgo },
      });

      return stats;
    } catch (error) {
      this.logger.error(
        `Error generating favorite stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private async updateInteractionCount(favoriteId: string): Promise<void> {
    try {
      await this.favoriteModel.findByIdAndUpdate(favoriteId, {
        $inc: { interactionCount: 1 },
        $set: { lastInteraction: new Date() },
      });
    } catch (error) {
      this.logger.error(
        `Error updating interaction count: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Generate personalized recommendations based on user's favorite patterns
   * Uses collaborative filtering and content-based algorithms
   * ⚠️ ENTERPRISE FIX: Added limit to prevent fetching ALL favorites
   */
  async getRecommendationsBasedOnFavorites(
    userId: string,
    filters: RecommendationFiltersDto = {},
  ): Promise<RecommendationsResponseDto> {
    try {
      this.logger.log(`Generating recommendations for user: ${userId}`);

      // ✅ ENTERPRISE: Limit favorites analysis to most recent 100 (prevents loading 10K+ favorites)
      // Rationale: Recent favorites are more relevant for recommendations
      const MAX_FAVORITES_FOR_ANALYSIS = 100;

      // Populate removed: downstream consumers (analyzeUserPreferences, getCollaborativeRecommendations)
      // only read type, tags, preferences, interactionCount, itemId (as ObjectId) — none use populated item data.
      const userFavorites = await this.favoriteModel
        .find({ userId: new Types.ObjectId(userId), isActive: true })
        .select('itemId type tags preferences interactionCount lastInteraction')
        .sort({ lastInteraction: -1 })
        .limit(MAX_FAVORITES_FOR_ANALYSIS)
        .lean()
        .exec();

      if (userFavorites.length === 0) {
        return {
          recommendations: [],
          totalRecommendations: 0,
          algorithm: 'content-based-with-collaborative-filtering',
          basedOnFavoritesCount: 0,
          generatedAt: new Date(),
          confidence: 0,
        };
      }

      // Analyze user preferences
      const userPreferences = this.analyzeUserPreferences(userFavorites);
      // Get recommendations using hybrid approach
      const [contentRecommendations, collaborativeRecommendations] = await Promise.all([
        this.getContentBasedRecommendations(userId, userPreferences, filters),
        this.getCollaborativeRecommendations(userId, userFavorites, filters),
      ]);

      // Merge and rank recommendations
      const mergedRecommendations = this.mergeRecommendations(
        contentRecommendations,
        collaborativeRecommendations,
        userPreferences,
      );

      // Filter by confidence threshold and limit
      const filteredRecommendations = mergedRecommendations
        .filter((rec) => rec.similarityScore >= (filters.minConfidence ?? 0.5))
        .slice(0, filters.limit ?? 10);

      const confidence =
        filteredRecommendations.length > 0
          ? filteredRecommendations.reduce((sum, rec) => sum + rec.similarityScore, 0) /
            filteredRecommendations.length
          : 0;

      this.logger.log(
        `Generated ${filteredRecommendations.length} recommendations for user: ${userId}`,
      );

      return {
        recommendations: filteredRecommendations,
        totalRecommendations: filteredRecommendations.length,
        algorithm: 'content-based-with-collaborative-filtering',
        basedOnFavoritesCount: userFavorites.length,
        generatedAt: new Date(),
        confidence: Math.round(confidence * 100) / 100,
      };
    } catch (error) {
      this.logger.error(
        `Error generating recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Get popular trends across all users for a specific time period
   * Uses time-weighted popularity scoring with growth rate analysis
   */
  async getPopularTrends(filters: TrendsFiltersDto = {}): Promise<TrendsResponseDto> {
    try {
      this.logger.log(`Generating trends for period: ${filters.period || 'week'}`);

      const { startDate, endDate } = this.getPeriodDates(filters.period ?? 'week');
      const previousPeriod = this.getPreviousPeriodDates(filters.period ?? 'week', startDate);

      // Build aggregation pipeline for current period trends
      const currentPeriodPipeline = this.buildTrendsAggregationPipeline(
        startDate,
        endDate,
        filters,
      );

      // Build aggregation pipeline for previous period comparison
      const previousPeriodPipeline = this.buildTrendsAggregationPipeline(
        previousPeriod.startDate,
        previousPeriod.endDate,
        filters,
      );

      // Execute both aggregations
      const [currentTrends, previousTrends] = await Promise.all([
        this.favoriteModel.aggregate(currentPeriodPipeline),
        this.favoriteModel.aggregate(previousPeriodPipeline),
      ]);

      // Calculate growth rates and trend scores
      const trendsWithGrowth = this.calculateTrendScores(currentTrends, previousTrends);

      // Sort by trend score and apply limit
      trendsWithGrowth.sort((a, b) => b.trendScore - a.trendScore);
      const sortedTrends = trendsWithGrowth.slice(0, filters.limit ?? 20).map((trend, index) => ({
        ...trend,
        rank: index + 1,
      }));

      this.logger.log(
        `Generated ${sortedTrends.length} trends for period: ${filters.period || 'week'}`,
      );

      return {
        trends: sortedTrends,
        period: filters.period ?? 'week',
        totalTrends: sortedTrends.length,
        generatedAt: new Date(),
        periodStartDate: startDate,
        periodEndDate: endDate,
      };
    } catch (error) {
      this.logger.error(
        `Error generating trends: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  /**
   * Analyze user's favorite patterns to understand preferences
   * Accepts both full documents and lean results for flexibility
   */
  private analyzeUserPreferences(favorites: FavoriteLean[]): UserPreferences {
    const preferences: UserPreferences = {
      favoriteTypes: new Map(),
      commonTags: new Map(),
      categoryPreferences: new Map(),
      timePatterns: [],
      avgInteractionCount: 0,
    };

    let totalInteractions = 0;

    for (const favorite of favorites) {
      // Type preferences
      const typeCount = preferences.favoriteTypes.get(favorite.type) ?? 0;
      preferences.favoriteTypes.set(favorite.type, typeCount + 1);

      // Tag preferences
      for (const tag of favorite.tags ?? []) {
        const tagCount = preferences.commonTags.get(tag) ?? 0;
        preferences.commonTags.set(tag, tagCount + 1);
      }

      // Time patterns from preferred times
      if (favorite.preferences?.preferredTimes) {
        preferences.timePatterns.push(...favorite.preferences.preferredTimes);
      }

      totalInteractions += favorite.interactionCount || 0;
    }

    preferences.avgInteractionCount = totalInteractions / favorites.length;

    return preferences;
  }

  /**
   * Get content-based recommendations using user preferences
   */
  private async getContentBasedRecommendations(
    userId: string,
    userPreferences: UserPreferences,
    filters: RecommendationFiltersDto,
  ): Promise<RecommendationDto[]> {
    try {
      // Get user's favorite item IDs to exclude from recommendations
      const userFavoriteIds = await this.favoriteModel
        .find({ userId: new Types.ObjectId(userId), isActive: true })
        .distinct('itemId');

      // Build aggregation pipeline to find similar items
      const pipeline: PipelineStage[] = [
        {
          $match: {
            isActive: true,
            userId: { $ne: new Types.ObjectId(userId) },
            itemId: { $nin: userFavoriteIds },
            ...(filters.type && { type: filters.type }),
          },
        },
        {
          $group: {
            _id: {
              itemId: '$itemId',
              type: '$type',
              itemName: '$itemName',
              itemImage: '$itemImage',
            },
            favoriteCount: { $sum: 1 },
            avgInteraction: { $avg: '$interactionCount' },
            allTags: { $push: '$tags' },
          },
        },
        {
          $addFields: {
            flatTags: {
              $reduce: {
                input: '$allTags',
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] },
              },
            },
          },
        },
        { $limit: 100 }, // Limit for performance
      ];

      const similarItems = await this.favoriteModel.aggregate(pipeline);

      // Score items based on content similarity
      const recommendations: RecommendationDto[] = similarItems
        .map((item) => {
          const tagSimilarity = this.calculateTagSimilarity(
            Array.from(userPreferences.commonTags.keys()),
            item.flatTags,
          );
          const popularityScore = Math.min(item.favoriteCount / 10, 1); // Normalize popularity
          const interactionScore = Math.min(
            (item.avgInteraction || 0) / userPreferences.avgInteractionCount,
            1,
          );
          const contentScore = tagSimilarity * 0.6 + popularityScore * 0.3 + interactionScore * 0.1;

          return {
            itemId: item._id.itemId.toString(),
            type: item._id.type,
            itemName: item._id.itemName,
            itemImage: item._id.itemImage,
            score: Math.round(contentScore * 100) / 100,
            reason: `Based on your interest in ${Array.from(userPreferences.commonTags.keys()).slice(0, 3).join(', ')}`,
            category: 'content-based',
            tags: item.flatTags.filter((tag: unknown): tag is string => typeof tag === 'string'),
            similarityScore: Math.round(contentScore * 100) / 100,
          };
        })
        .filter((rec) => rec.score > 0.3); // Minimum content similarity threshold

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error in content-based recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Get collaborative filtering recommendations based on similar users
   */
  private async getCollaborativeRecommendations(
    userId: string,
    userFavorites: FavoriteLean[],
    filters: RecommendationFiltersDto,
  ): Promise<RecommendationDto[]> {
    try {
      const userItemIds = userFavorites.map((f) => f.itemId);

      // Find users with similar favorites (collaborative filtering)
      const similarUsers = await this.favoriteModel.aggregate([
        {
          $match: {
            itemId: { $in: userItemIds },
            userId: { $ne: new Types.ObjectId(userId) },
            isActive: true,
          },
        },
        {
          $group: {
            _id: '$userId',
            commonItems: { $sum: 1 },
            totalInteractions: { $sum: '$interactionCount' },
          },
        },
        {
          $match: {
            commonItems: { $gte: Math.min(2, userFavorites.length) }, // At least 2 common items
          },
        },
        {
          $sort: { commonItems: -1, totalInteractions: -1 },
        },
        { $limit: 50 }, // Top 50 similar users
      ]);

      if (similarUsers.length === 0) {
        return [];
      }

      const similarUserIds = similarUsers.map((u) => u._id);

      // Get items favorited by similar users that current user hasn't favorited
      const collaborativeItems = await this.favoriteModel.aggregate([
        {
          $match: {
            userId: { $in: similarUserIds },
            itemId: { $nin: userItemIds },
            isActive: true,
            ...(filters.type && { type: filters.type }),
          },
        },
        {
          $group: {
            _id: {
              itemId: '$itemId',
              type: '$type',
              itemName: '$itemName',
              itemImage: '$itemImage',
            },
            favoriteCount: { $sum: 1 },
            avgInteraction: { $avg: '$interactionCount' },
            userIds: { $addToSet: '$userId' },
            tags: { $push: '$tags' },
          },
        },
        {
          $addFields: {
            flatTags: {
              $reduce: {
                input: '$tags',
                initialValue: [],
                in: { $concatArrays: ['$$value', '$$this'] },
              },
            },
          },
        },
        { $sort: { favoriteCount: -1 } },
        { $limit: 50 },
      ]);

      // Score collaborative recommendations
      const recommendations: RecommendationDto[] = collaborativeItems.map((item) => {
        const userSimilarityScore = item.userIds.length / similarUsers.length;
        const popularityScore = Math.min(item.favoriteCount / 10, 1);

        const collaborativeScore = userSimilarityScore * 0.7 + popularityScore * 0.3;

        return {
          itemId: item._id.itemId.toString(),
          type: item._id.type,
          itemName: item._id.itemName,
          itemImage: item._id.itemImage,
          score: Math.round(collaborativeScore * 100) / 100,
          reason: `Popular among users with similar tastes`,
          category: 'collaborative-filtering',
          tags: [...new Set(item.flatTags.flat())].filter(
            (tag): tag is string => typeof tag === 'string',
          ), // Remove duplicates and ensure strings
          similarityScore: Math.round(collaborativeScore * 100) / 100,
        };
      });

      return recommendations;
    } catch (error) {
      this.logger.error(
        `Error in collaborative recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }

  /**
   * Merge and rank recommendations from different algorithms
   */
  private mergeRecommendations(
    contentRecommendations: RecommendationDto[],
    collaborativeRecommendations: RecommendationDto[],
    _userPreferences: UserPreferences,
  ): RecommendationDto[] {
    const mergedMap = new Map<string, RecommendationDto>();

    // Add content-based recommendations
    for (const rec of contentRecommendations) {
      mergedMap.set(rec.itemId, {
        ...rec,
        score: rec.score * 0.6, // Weight content-based slightly lower
      });
    }

    // Add or merge collaborative recommendations
    for (const rec of collaborativeRecommendations) {
      const existing = mergedMap.get(rec.itemId);
      if (existing) {
        // Boost score for items recommended by both algorithms
        existing.score = (existing.score + rec.score * 0.8) * 1.2;
        existing.reason = `${existing.reason} and ${rec.reason.toLowerCase()}`;
        existing.similarityScore = Math.min(
          ((existing.similarityScore + rec.similarityScore) / 2) * 1.2,
          1,
        );
      } else {
        mergedMap.set(rec.itemId, {
          ...rec,
          score: rec.score * 0.8, // Weight collaborative recommendations
        });
      }
    }

    // Convert to array and sort by final score
    return Array.from(mergedMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate similarity between two sets of tags using Jaccard similarity
   */
  private calculateTagSimilarity(userTags: string[], itemTags: string[]): number {
    if (userTags.length === 0 || itemTags.length === 0) {
      return 0;
    }

    const userTagSet = new Set(userTags);
    const itemTagSet = new Set(itemTags);

    const intersection = new Set([...userTagSet].filter((tag) => itemTagSet.has(tag)));
    const union = new Set([...userTagSet, ...itemTagSet]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Get date range for the specified period
   */
  private getPeriodDates(period: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    const endDate = new Date(now);
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        return this.getPeriodDates('week');
    }

    return { startDate, endDate };
  }

  /**
   * Get previous period dates for growth rate calculation
   */
  private getPreviousPeriodDates(
    period: string,
    currentStartDate: Date,
  ): { startDate: Date; endDate: Date } {
    const endDate = new Date(currentStartDate);
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(currentStartDate);
        startDate.setDate(currentStartDate.getDate() - 1);
        endDate.setDate(currentStartDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(currentStartDate);
        startDate.setDate(currentStartDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(currentStartDate);
        startDate.setMonth(currentStartDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(currentStartDate);
        startDate.setMonth(currentStartDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(currentStartDate);
        startDate.setFullYear(currentStartDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(currentStartDate);
        startDate.setDate(currentStartDate.getDate() - 7);
        break;
    }

    return { startDate, endDate };
  }

  /**
   * Build MongoDB aggregation pipeline for trends analysis
   */
  private buildTrendsAggregationPipeline(
    startDate: Date,
    endDate: Date,
    filters: TrendsFiltersDto,
  ): PipelineStage[] {
    const matchStage: Record<string, unknown> = {
      isActive: true,
      addedAt: { $gte: startDate, $lte: endDate },
    };

    if (filters.type) {
      matchStage['type'] = filters.type;
    }

    const pipeline: PipelineStage[] = [
      { $match: matchStage },
      {
        $group: {
          _id: {
            itemId: '$itemId',
            type: '$type',
            itemName: '$itemName',
            itemImage: '$itemImage',
          },
          favoriteCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' },
          avgInteraction: { $avg: '$interactionCount' },
          tags: { $push: '$tags' },
          totalInteractions: { $sum: '$interactionCount' },
        },
      },
      {
        $addFields: {
          uniqueUserCount: { $size: '$uniqueUsers' },
          flatTags: {
            $reduce: {
              input: '$tags',
              initialValue: [],
              in: { $concatArrays: ['$$value', '$$this'] },
            },
          },
        },
      },
      {
        $match: {
          favoriteCount: { $gte: filters.minFavoriteCount ?? 5 },
        },
      },
      {
        $sort: { favoriteCount: -1, uniqueUserCount: -1 },
      },
      { $limit: (filters.limit ?? 20) * 2 }, // Get more for better filtering
    ];

    return pipeline;
  }

  /**
   * Calculate trend scores with growth rate analysis
   */
  private calculateTrendScores(
    currentTrends: TrendData[],
    previousTrends: TrendData[],
  ): TrendItemDto[] {
    const previousTrendsMap = new Map(
      previousTrends.map((trend) => [trend._id.itemId.toString(), trend]),
    );

    return currentTrends.map((current) => {
      const previous = previousTrendsMap.get(current._id.itemId.toString());
      const previousCount = previous?.favoriteCount ?? 0;

      // Calculate growth rate
      const growthRate =
        previousCount > 0
          ? ((current.favoriteCount - previousCount) / previousCount) * 100
          : current.favoriteCount > 0
            ? 100
            : 0;

      // Calculate trend score (weighted combination of current popularity and growth)
      const popularityScore = Math.min(current.favoriteCount / 50, 1); // Normalize to 0-1
      const growthScore = Math.min(Math.max(growthRate / 100, -1), 2); // Cap growth impact
      const diversityScore = Math.min(current.uniqueUserCount / current.favoriteCount, 1);

      const trendScore = popularityScore * 0.4 + growthScore * 0.4 + diversityScore * 0.2;

      // Get popular tags (most common tags for this item)
      const tagCounts = new Map<string, number>();
      current.flatTags.flat().forEach((tag: string) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      });

      const popularTags = Array.from(tagCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);

      return {
        itemId: current._id.itemId.toString(),
        type: current._id.type,
        itemName: current._id.itemName,
        ...(current._id.itemImage !== undefined ? { itemImage: current._id.itemImage } : {}),
        favoriteCount: current.favoriteCount,
        growthRate: Math.round(growthRate * 100) / 100,
        rank: 0, // Will be set later after sorting
        popularTags,
        // averageRating omitted — could be populated from establishment/offer data
        trendScore: Math.round(Math.max(trendScore, 0) * 100) / 100,
      };
    });
  }

  // ============================================================================
  // NEW: Production-grade methods for isFavorite computation
  // ============================================================================

  /**
   * Get all offer IDs favorited by a user (optimized for isFavorite computation)
   * This is a LIGHTWEIGHT endpoint that returns only IDs, not full documents
   *
   * Performance: Uses index { userId: 1, type: 1, isActive: 1 }
   * Returns: Array of offer IDs (e.g., ["507f1f77bcf86cd799439011", ...])
   *
   * @param userId - User ID
   * @returns Array of offer IDs
   */
  async getUserFavoriteOfferIds(userId: string): Promise<string[]> {
    try {
      const favorites = await this.favoriteModel
        .find({
          userId: new Types.ObjectId(userId),
          type: FavoriteType.OFFER,
          isActive: true,
        })
        .select('itemId') // Only fetch itemId field (very lightweight)
        .lean()
        .exec();

      return favorites.map((fav) => fav.itemId.toString());
    } catch (error) {
      this.logger.error('Failed to get user favorite offer IDs', { userId, error });
      return []; // Graceful degradation: return empty array on error
    }
  }

  /**
   * Toggle favorite status (add or remove) with atomic updates
   * Uses MongoDB session and transaction to ensure consistency
   *
   * Features:
   * - Atomic update of both favorites collection and offer.favoriteCount
   * - Transaction rollback on error
   * - Upsert to handle race conditions
   * - Prevents duplicate favorites (unique index)
   *
   * @param userId - User ID
   * @param type - Favorite type
   * @param itemId - Item ID (e.g., offer ID)
   * @param itemName - Optional item name
   * @param itemImage - Optional item image URL
   * @returns New favorite status (true = added, false = removed)
   */
  async toggleFavorite(
    userId: string,
    type: FavoriteType,
    itemId: string,
    itemName?: string,
    itemImage?: string,
  ): Promise<boolean> {
    this.logger.log(
      `🔄 [toggleFavorite] START | userId: ${userId} | type: ${type} | itemId: ${itemId}`,
    );

    // Start MongoDB session for transaction
    const session = await this.favoriteModel.db.startSession();
    session.startTransaction();

    try {
      // Check if favorite exists
      const existing = await this.favoriteModel.findOne(
        {
          userId: new Types.ObjectId(userId),
          itemId: new Types.ObjectId(itemId),
          type,
        },
        null,
        { session },
      );

      this.logger.log(
        `🔍 [toggleFavorite] Existing favorite check | found: ${!!existing} | isActive: ${existing?.isActive}`,
      );

      if (existing && existing.isActive) {
        // REMOVE favorite (soft delete)
        existing.isActive = false;
        await existing.save({ session });

        // Atomically decrement favoriteCount on offer
        if (type === FavoriteType.OFFER) {
          await this.offerModel.findByIdAndUpdate(
            itemId,
            { $inc: { favoriteCount: -1 } },
            { session },
          );
        } else if (type === FavoriteType.ESTABLISHMENT) {
          await this.establishmentModel.findByIdAndUpdate(
            itemId,
            { $inc: { favoriteCount: -1 } },
            { session },
          );
        }

        // Emit event
        await this.eventBus.emit('favorite.removed', {
          favoriteId: existing._id.toString(),
          userId,
          itemId,
          type,
          removedAt: new Date(),
        });

        await session.commitTransaction();
        this.logger.log(
          `✅ [toggleFavorite] REMOVED | userId: ${userId} | itemId: ${itemId} | committed: true`,
        );
        return false;
      }
      // ADD favorite (upsert to handle race conditions)
      const favorite = await this.favoriteModel.findOneAndUpdate(
        { userId: new Types.ObjectId(userId), itemId: new Types.ObjectId(itemId), type },
        {
          $set: {
            userId: new Types.ObjectId(userId),
            itemId: new Types.ObjectId(itemId),
            type,
            itemName,
            itemImage,
            isActive: true,
            addedAt: new Date(),
          },
        },
        { upsert: true, new: true, session },
      );

      // Atomically increment favoriteCount on offer
      if (type === FavoriteType.OFFER) {
        await this.offerModel.findByIdAndUpdate(
          itemId,
          { $inc: { favoriteCount: 1 } },
          { session },
        );
      } else if (type === FavoriteType.ESTABLISHMENT) {
        await this.establishmentModel.findByIdAndUpdate(
          itemId,
          { $inc: { favoriteCount: 1 } },
          { session },
        );
      }

      // Emit event
      await this.eventBus.emit('favorite.added', {
        favoriteId: favorite._id.toString(),
        userId,
        itemId,
        type,
        addedAt: new Date(),
      });

      await session.commitTransaction();
      this.logger.log(
        `✅ [toggleFavorite] ADDED | userId: ${userId} | itemId: ${itemId} | favoriteId: ${favorite._id} | committed: true`,
      );

      // ✅ DIAGNOSTIC: Verify favorite was actually saved
      const verification = await this.favoriteModel.findById(favorite._id);
      this.logger.log(
        `🔍 [toggleFavorite] Post-commit verification | found: ${!!verification} | isActive: ${verification?.isActive}`,
      );

      return true;
    } catch (error) {
      // Rollback on error
      await session.abortTransaction();
      this.logger.error('Failed to toggle favorite (transaction rolled back)', {
        userId,
        type,
        itemId,
        error,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }
}

/**
 * Interface for user preferences analysis
 */
interface UserPreferences {
  favoriteTypes: Map<FavoriteType, number>;
  commonTags: Map<string, number>;
  categoryPreferences: Map<string, number>;
  timePatterns: string[];
  avgInteractionCount: number;
}

/**
 * Interface for trend data from aggregation
 */
interface TrendData {
  _id: {
    itemId: Types.ObjectId;
    type: FavoriteType;
    itemName: string;
    itemImage?: string;
  };
  favoriteCount: number;
  uniqueUsers: Types.ObjectId[];
  uniqueUserCount: number;
  avgInteraction: number;
  tags: string[][];
  flatTags: string[];
  totalInteractions: number;
}
