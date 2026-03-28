import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { SearchService } from './search.service';

@ApiTags('🔍 Advanced Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {
    void this.searchService;
  }

  @Get('suggestions')
  getSuggestions(@Query('query') _query: string) {
    return {
      statusCode: 200,
      message: 'Suggestions retrieved successfully',
      data: {
        suggestions: [],
        trending: [],
        personalized: [],
      },
    };
  }

  @Post()
  search(@Query() _searchParams: Record<string, string>) {
    return {
      statusCode: 200,
      message: 'Search completed successfully',
      data: {
        results: [],
        total: 0,
      },
    };
  }
}
