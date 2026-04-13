import { Controller, Get, HttpCode, HttpStatus, Post, Query, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { GetUser } from '../common/decorators/get-user.decorator';
import type { AuthUser } from '../common/decorators/get-user.decorator';

import { SuggestionDto } from './dto/search.dto';
import { SearchSuggestionService } from './services/search-suggestion.service';

/**
 * Search endpoints are intentionally public — suggestions should work
 * before a user logs in (e.g., landing page search bar).
 * GetUser() returns null for unauthenticated requests; the suggestion
 * service accepts an optional userId for personalisation.
 */
@ApiTags('🔍 Search')
@Controller('search')
export class SearchController {
  constructor(private readonly suggestionService: SearchSuggestionService) {}

  @Get('suggestions')
  @ApiOperation({
    summary: 'Autocomplete suggestions for a partial query',
    description:
      'Returns text, popular, and (when authenticated) personalised suggestions. Cached in Redis for 5 minutes.',
  })
  @ApiResponse({ status: 200, description: 'Suggestions retrieved successfully' })
  async getSuggestions(
    @Query(new ValidationPipe({ transform: true, forbidNonWhitelisted: false }))
    dto: SuggestionDto,
    @GetUser() user: AuthUser | null,
  ) {
    const result = await this.suggestionService.getSuggestions(dto, user?.userId ?? undefined);
    return {
      message: 'Suggestions retrieved successfully',
      data: result,
    };
  }

  /**
   * Full-text search is not yet implemented server-side.
   * Use GET /offers?search=<query> for offer search in the interim.
   */
  @Post()
  @HttpCode(HttpStatus.NOT_IMPLEMENTED)
  @ApiOperation({
    summary: 'Full-text search — not yet implemented',
    description: 'Use GET /offers?search=<query> for offer search in the interim.',
  })
  @ApiResponse({
    status: 501,
    description: 'Full-text search endpoint is not yet implemented.',
  })
  search() {
    return {
      message:
        'Full-text search is not yet implemented. Use GET /offers?search=<query> for offer search.',
      data: null,
    };
  }
}
