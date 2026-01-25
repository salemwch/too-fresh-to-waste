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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../common/decorators/get-user.decorator';
import { FavoriteType } from './schemas/favorite.schema';
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
  addFavorite(
    @GetUser('id') userId: string,
    @Body() addFavoriteDto: AddFavoriteDto,
  ) {
    return this.favoritesService.addFavorite(userId, addFavoriteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user favorites' })
  @ApiResponse({ status: 200, description: 'Favorites retrieved successfully' })
   getUserFavorites(
    @GetUser('id') userId: string,
    @Query() filters: FavoritesFilterDto,
  ) {
    return this.favoritesService.getUserFavorites(userId, filters);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove favorite by ID' })
  @ApiResponse({ status: 204, description: 'Favorite removed successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
   removeFavorite(
    @GetUser('id') userId: string,
    @Param('id') favoriteId: string,
  ) {
    return this.favoritesService.removeFavorite(userId, favoriteId);
  }

  @Delete('item/:type/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove favorite by item type and ID' })
  @ApiResponse({ status: 204, description: 'Favorite removed successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
  @ApiParam({ name: 'type', enum: FavoriteType })
   removeFavoriteByItem(
    @GetUser('id') userId: string,
    @Param('type') type: FavoriteType,
    @Param('itemId') itemId: string,
  ) {
    return this.favoritesService.removeFavoriteByItem(userId, type, itemId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update favorite settings' })
  @ApiResponse({ status: 200, description: 'Favorite updated successfully' })
  @ApiResponse({ status: 404, description: 'Favorite not found' })
   updateFavorite(
    @GetUser('id') userId: string,
    @Param('id') favoriteId: string,
    @Body() updateDto: UpdateFavoriteDto,
  ) {
    return this.favoritesService.updateFavorite(userId, favoriteId, updateDto);
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

  @Get('stats')
  @ApiOperation({ summary: 'Get user favorites statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
   getFavoriteStats(@GetUser('id') userId: string) {
    return this.favoritesService.getFavoriteStats(userId);
  }

  // Favorite Lists endpoints
  @Post('lists')
  @ApiOperation({ summary: 'Create favorite list' })
  @ApiResponse({ status: 201, description: 'Favorite list created successfully' })
  @ApiResponse({ status: 409, description: 'List with this name already exists' })
   createFavoriteList(
    @GetUser('id') userId: string,
    @Body() createDto: CreateFavoriteListDto,
  ) {
    return this.favoritesService.createFavoriteList(userId, createDto);
  }

  @Get('lists')
  @ApiOperation({ summary: 'Get user favorite lists' })
  @ApiResponse({ status: 200, description: 'Favorite lists retrieved successfully' })
   getUserFavoriteLists(@GetUser('id') userId: string) {
    return this.favoritesService.getUserFavoriteLists(userId);
  }

  @Get('lists/:id')
  @ApiOperation({ summary: 'Get favorite list by ID' })
  @ApiResponse({ status: 200, description: 'Favorite list retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found or access denied' })
   getFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
  ) {
    return this.favoritesService.getFavoriteList(userId, listId);
  }

  @Put('lists/:id')
  @ApiOperation({ summary: 'Update favorite list' })
  @ApiResponse({ status: 200, description: 'Favorite list updated successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
   updateFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() updateDto: UpdateFavoriteListDto,
  ) {
    return this.favoritesService.updateFavoriteList(userId, listId, updateDto);
  }

  @Post('lists/:id/items')
  @ApiOperation({ summary: 'Add item to favorite list' })
  @ApiResponse({ status: 201, description: 'Item added to list successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
  @ApiResponse({ status: 409, description: 'Item is already in this list' })
   addToFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() addToListDto: AddToListDto,
  ) {
    return this.favoritesService.addToFavoriteList(userId, listId, addToListDto);
  }

  @Delete('lists/:id/items/:itemId/:type')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove item from favorite list' })
  @ApiResponse({ status: 204, description: 'Item removed from list successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
   removeFromFavoriteList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Param('itemId') itemId: string,
    @Param('type') type: string,
  ) {
    return this.favoritesService.removeFromFavoriteList(userId, listId, itemId, type);
  }

  @Post('lists/:id/share')
  @ApiOperation({ summary: 'Share favorite list with other users' })
  @ApiResponse({ status: 200, description: 'List shared successfully' })
  @ApiResponse({ status: 404, description: 'Favorite list not found' })
   shareList(
    @GetUser('id') userId: string,
    @Param('id') listId: string,
    @Body() shareDto: ShareListDto,
  ) {
    return this.favoritesService.shareList(userId, listId, shareDto);
  }

  @Get('recommendations/based-on-favorites')
  @ApiOperation({ summary: 'Get personalized recommendations based on user favorites' })
  @ApiResponse({
    status: 200,
    description: 'Recommendations retrieved successfully',
    type: RecommendationsResponseDto
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of recommendations (1-50)', type: Number })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by favorite type', enum: FavoriteType })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category', type: String })
  @ApiQuery({ name: 'maxDistance', required: false, description: 'Maximum distance in km', type: Number })
  @ApiQuery({ name: 'minConfidence', required: false, description: 'Minimum confidence score (0-1)', type: Number })
  getRecommendationsBasedOnFavorites(
    @GetUser('id') userId: string,
    @Query() filters: RecommendationFiltersDto,
  ): Promise<RecommendationsResponseDto> {
    return this.favoritesService.getRecommendationsBasedOnFavorites(userId, filters);
  }

  @Get('trends/popular')
  @ApiOperation({ summary: 'Get popular favorites trends with growth analysis' })
  @ApiResponse({
    status: 200,
    description: 'Trends retrieved successfully',
    type: TrendsResponseDto
  })
  @ApiQuery({
    name: 'period',
    required: false,
    description: 'Time period for trends analysis',
    enum: ['day', 'week', 'month', 'quarter', 'year']
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of trends to return (1-100)', type: Number })
  @ApiQuery({ name: 'type', required: false, description: 'Filter by favorite type', enum: FavoriteType })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by category', type: String })
  @ApiQuery({ name: 'minFavoriteCount', required: false, description: 'Minimum favorite count threshold', type: Number })
  getPopularTrends(@Query() filters: TrendsFiltersDto): Promise<TrendsResponseDto> {
    return this.favoritesService.getPopularTrends(filters);
  }

  @Post('bulk/add')
  @ApiOperation({ summary: 'Bulk add multiple items to favorites' })
  @ApiResponse({ status: 201, description: 'Items added to favorites successfully' })
  async bulkAddFavorites(
    @GetUser('id') userId: string,
    @Body() items: AddFavoriteDto[],
  ) {
    const results = [];

    for (const item of items) {
      try {
        const favorite = await this.favoritesService.addFavorite(userId, item);
        results.push({ success: true, favorite });
      } catch (error) {
        results.push({ success: false, error: error instanceof Error ? error.message : 'Unknown error', item });
      }
    }

    return {
      totalProcessed: items.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
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