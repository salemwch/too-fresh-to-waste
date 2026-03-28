import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';

import {
  AddFavoriteDto,
  UpdateFavoriteDto,
  FavoritesFilterDto,
  CreateFavoriteListDto,
  UpdateFavoriteListDto,
  AddToListDto,
  ShareListDto,
  RecommendationFiltersDto,
  TrendsFiltersDto,
  RecommendationsResponseDto,
  TrendsResponseDto,
} from './dto/favorite.dto';
import { FavoritesService } from './favorites.service';
import { FavoriteType } from './schemas/favorite.schema';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Post()
  @ApiOperation({ summary: 'Add item to favorites' })
  @ApiResponse({ status: 201, description: 'Item added to favorites successfully' })
  @ApiResponse({ status: 409, description: 'Item is already in favorites' })
  async addFavorite(@GetUser('id') userId: string, @Body() addFavoriteDto: AddFavoriteDto) {
    const result = await this.favoritesService.addFavorite(userId, addFavoriteDto);
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  @ApiResponse({ status: 200, description: 'Favorites retrieved successfully' })
  async getUserFavorites(@GetUser('id') userId: string, @Query() filters: FavoritesFilterDto) {
    const result = await this.favoritesService.getUserFavorites(userId, filters);
    return result;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove favorite by ID' })
  @ApiResponse({ status: 204, description: 'Favorite removed successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async removeFavorite(@GetUser('id') userId: string, @Param('id') favoriteId: string) {
    const result = await this.favoritesService.removeFavorite(userId, favoriteId);
    return result;
  }

  @Delete('item/:type/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove favorite by item type and ID' })
  @ApiResponse({ status: 204, description: 'Favorite removed successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  @ApiParam({ name: 'type', enum: FavoriteType })
  async removeFavoriteByItem(
    @GetUser('id') userId: string,
    @Param('type') type: FavoriteType,
    @Param('itemId') itemId: string,
  ) {
    const result = await this.favoritesService.removeFavoriteByItem(userId, type, itemId);
    return result;
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update favorite settings' })
  @ApiResponse({ status: 200, description: 'Favorite updated successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  async updateFavorite(
    @GetUser('id') userId: string,
    @Param('id') favoriteId: string,
    @Body() updateDto: UpdateFavoriteDto,
  ) {
    const result = await this.favoritesService.updateFavorite(userId, favoriteId, updateDto);
    return result;
  }

  @Get('check/:type/:itemId')
  @ApiOperation({ summary: 'Check if item is favorited' })
  @ApiResponse({ status: 200, description: 'Favorite status checked' })
  @ApiParam({ name: 'type', enum: FavoriteType })
  async checkIsFavorite(
    @GetUser('id') userId: string,
    @Param('type') type: FavoriteType,
    @Param('itemId') itemId: string,
  ) {
    const isFavorite = await this.favoritesService.checkIsFavorite(userId, type, itemId);
    return { isFavorite };
  }

  // ============================================================================
  // NEW: Production-grade endpoints for optimistic UI
  // ============================================================================

  @Get('ids')
  @ApiOperation({
    summary: 'Get user favorite offer IDs (lightweight)',
    description:
      'Returns only IDs of favorited offers (not full documents). ' +
      'Optimized for frontend Redux hydration and isFavorite computation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite offer IDs retrieved successfully',
    schema: {
      example: {
        ids: ['507f1f77bcf86cd799439011', '507f191e810c19729de860ea'],
      },
    },
  })
  async getUserFavoriteIds(@GetUser('id') userId: string) {
    const ids = await this.favoritesService.getUserFavoriteOfferIds(userId);
    return { message: 'Favorite offer IDs retrieved successfully', data: { ids } };
  }

  @Post('toggle')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // Max 10 toggles per minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle favorite status (add or remove)',
    description:
      'Atomic operation that adds or removes favorite with transaction support. ' +
      'Returns new status. Optimized for optimistic UI updates. Rate limited to 10 requests/minute.',
  })
  @ApiResponse({
    status: 200,
    description: 'Favorite toggled successfully',
    schema: {
      example: {
        isFavorite: true,
        message: 'Favorite added successfully',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 429, description: 'Too many requests (rate limit exceeded)' })
  async toggleFavorite(
    @GetUser('id') userId: string,
    @Body()
    dto: {
      type: FavoriteType;
      itemId: string;
      itemName?: string;
      itemImage?: string;
    },
  ) {
    const isFavorite = await this.favoritesService.toggleFavorite(
      userId,
      dto.type,
      dto.itemId,
      dto.itemName,
      dto.itemImage,
    );

    return {
      isFavorite,
      message: isFavorite ? 'Favorite added successfully' : 'Favorite removed successfully',
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get user favorites statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getFavoriteStats(@GetUser('id') userId: string) {
    const result = await this.favoritesService.getFavoriteStats(userId);
    return result;
  }

  @Get('debug/count')
  @ApiOperation({ summary: '[DEBUG] Get raw favorites count for current user' })
  @ApiResponse({ status: 200, description: 'Debug count retrieved' })
  async debugGetFavoritesCount(@GetUser('id') userId: string) {
    const { Types } = await import('mongoose');
    const userObjectId = new Types.ObjectId(userId);

    const [totalFavorites, activeFavorites, offerFavorites] = await Promise.all([
      this.favoritesService['favoriteModel'].countDocuments({ userId: userObjectId }),
      this.favoritesService['favoriteModel'].countDocuments({
        userId: userObjectId,
        isActive: true,
      }),
      this.favoritesService['favoriteModel'].countDocuments({
        userId: userObjectId,
        type: 'offer',
        isActive: true,
      }),
    ]);

    return {
      userId,
      totalFavorites,
      activeFavorites,
      offerFavorites,
      timestamp: new Date(),
    };
  }

  // Favorite Lists endpoints
  @Post('lists')
  @ApiOperation({ summary: 'Create favorite list' })
  @ApiResponse({ status: 201, description: 'Favorite list created successfully' })
  @ApiResponse({ status: 409, description: 'List with this name already exists' })
  async createFavoriteList(
    @GetUser('id') userId: string,
    @Body() createDto: CreateFavoriteListDto,
  ) {
    const result = await this.favoritesService.createFavoriteList(userId, createDto);
    return result;
  }

  @Get('lists')
  @ApiOperation({ summary: 'Get user favorite lists' })
  @ApiResponse({ status: 200, description: 'Favorite lists retrieved successfully' })
  async getUserFavoriteLists(@GetUser('id') userId: string) {
    const result = await this.favoritesService.getUserFavoriteLists(userId);
    return result;
  }

  @Get('lists/:id')
  @ApiOperation({ summary: 'Get favorite list by ID' })
  @ApiResponse({ status: 200, description: 'Favorite list retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found or access denied' })
  async getFavoriteList(@GetUser('id') userId: string, @Param('id') listId: string) {
    const result = await this.favoritesService.getFavoriteList(userId, listId);
    return result;
  }

  @Put('lists/:id')
  @ApiOperation({ summary: 'Update favorite list' })
  @ApiResponse({ status: 200, description: 'Favorite list updated successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
  async updateFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() updateDto: UpdateFavoriteListDto,
  ) {
    const result = await this.favoritesService.updateFavoriteList(userId, listId, updateDto);
    return result;
  }

  @Post('lists/:id/items')
  @ApiOperation({ summary: 'Add item to favorite list' })
  @ApiResponse({ status: 201, description: 'Item added to list successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
  @ApiResponse({ status: 409, description: 'Item is already in this list' })
  async addToFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() addToListDto: AddToListDto,
  ) {
    const result = await this.favoritesService.addToFavoriteList(userId, listId, addToListDto);
    return result;
  }

  @Delete('lists/:id/items/:itemId/:type')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from favorite list' })
  @ApiResponse({ status: 204, description: 'Item removed from list successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
  async removeFromFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @Param('type') type: string,
  ) {
    const result = await this.favoritesService.removeFromFavoriteList(userId, listId, itemId, type);
    return result;
  }

  @Post('lists/:id/share')
  @ApiOperation({ summary: 'Share favorite list with other users' })
  @ApiResponse({ status: 200, description: 'List shared successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
  async shareList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() shareDto: ShareListDto,
  ) {
    const result = await this.favoritesService.shareList(userId, listId, shareDto);
    return result;
  }

  @Get('recommendations/based-on-favorites')
  @ApiOperation({ summary: 'Get personalized recommendations based on user favorites' })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
    type: RecommendationsResponseDto,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of recommendations (1-50)',
    type: Number,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by favorite type',
    enum: FavoriteType,
  })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category', type: String })
  @ApiQuery({
    name: 'maxDistance',
    required: false,
    description: 'Maximum distance in km',
    type: Number,
  })
  @ApiQuery({
    name: 'minConfidence',
    required: false,
    description: 'Minimum confidence score (0-1)',
    type: Number,
  })
  async getRecommendationsBasedOnFavorites(
    @GetUser('id') userId: string,
    @Query() filters: RecommendationFiltersDto,
  ): Promise<RecommendationsResponseDto> {
    const result = await this.favoritesService.getRecommendationsBasedOnFavorites(userId, filters);
    return result;
  }

  @Get('trends/popular')
  @ApiOperation({ summary: 'Get popular favorites trends with growth analysis' })
  @ApiResponse({
    status: 200,
    description: 'Trends retrieved successfully',
    type: TrendsResponseDto,
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Time period for trends analysis',
    enum: ['day', 'week', 'month', 'quarter', 'year'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of trends to return (1-100)',
    type: Number,
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: 'Filter by favorite type',
    enum: FavoriteType,
  })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category', type: String })
  @ApiQuery({
    name: 'minFavoriteCount',
    required: false,
    description: 'Minimum favorite count threshold',
    type: Number,
  })
  async getPopularTrends(@Query() filters: TrendsFiltersDto): Promise<TrendsResponseDto> {
    const result = await this.favoritesService.getPopularTrends(filters);
    return result;
  }

  @Post('bulk/add')
  @ApiOperation({ summary: 'Bulk add multiple items to favorites' })
  @ApiResponse({ status: 201, description: 'Items added to favorites successfully' })
  async bulkAddFavorites(@GetUser('id') userId: string, @Body() items: AddFavoriteDto[]) {
    const results = [];

    for (const item of items) {
      try {
        const favorite = await this.favoritesService.addFavorite(userId, item);
        results.push({ success: true, favorite });
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          item,
        });
      }
    }

    return {
      totalProcessed: items.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  @Get('export')
  @ApiOperation({ summary: 'Export user favorites data' })
  @ApiResponse({ status: 200, description: 'Favorites data exported successfully' })
  async exportFavorites(@GetUser('id') userId: string) {
    const [favorites, listsResult] = await Promise.all([
      this.favoritesService.getUserFavorites(userId, { page: 1, limit: 1000 }),
      this.favoritesService.getUserFavoriteLists(userId),
    ]);

    return {
      exportDate: new Date(),
      userId,
      favorites: favorites.favorites,
      favoriteLists: listsResult.lists,
      totalFavorites: favorites.total,
      totalLists: listsResult.total,
    };
  }
}
