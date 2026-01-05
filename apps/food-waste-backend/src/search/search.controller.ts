import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('🔍 Advanced Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('suggestions')
  async getSuggestions(@Query('query') query: string) {
    return {
      statusCode: 200,
      message: 'Suggestions retrieved successfully',
      data: {
        suggestions: [],
        trending: [],
        personalized: []
      }
    };
  }

  @Post()
  async search(@Query() searchParams: any) {
    return {
      statusCode: 200,
      message: 'Search completed successfully',
      data: {
        results: [],
        total: 0
      }
    };
  }
}