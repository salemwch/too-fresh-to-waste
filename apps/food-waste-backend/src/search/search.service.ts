import { Injectable } from '@nestjs/common';

@Injectable()
export class SearchService {
  performSearch(
    _query: string,
    _filters: Record<string, unknown>,
  ): { results: never[]; total: number; suggestions: never[] } {
    // Implementation will be added later
    return {
      results: [],
      total: 0,
      suggestions: [],
    };
  }
}
