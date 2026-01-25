# Search Module Documentation

## Overview

Advanced search module for the Too Fresh To Waste platform, providing intelligent search capabilities for offers, establishments, and categories with analytics, caching, and personalized suggestions.

**Status:** Production-ready | **API Version:** v1 | **Swagger Tag:** 🔍 Advanced Search

---

## Architecture

### Module Structure

```
search/
├── dto/
│   └── search.dto.ts              # Request/response DTOs with validation
├── schemas/
│   ├── search-query.schema.ts     # Search query tracking schema
│   ├── search-suggestion.schema.ts # Auto-complete suggestions schema
│   └── popular-search.schema.ts   # Trending/popular searches schema
├── services/
│   ├── search-cache.service.ts    # Redis-based caching layer
│   ├── search-analytics.service.ts # Search metrics and trends
│   ├── search-index.service.ts    # Document indexing engine
│   └── search-suggestion.service.ts # Auto-complete and suggestions
├── processors/
│   └── search.processor.ts        # Bull queue jobs for async operations
├── search.controller.ts           # REST API endpoints
├── search.service.ts              # Core search logic orchestrator
└── search.module.ts               # Module configuration
```

---

## Key Features

### 1. **Multi-Entity Search**
- Offers (surplus food listings)
- Establishments (merchants/restaurants)
- Categories (food types)

### 2. **Advanced Filtering**
- **Location-based**: Geospatial search with configurable radius (100m - 50km)
- **Price range**: Min/max filtering
- **Discount range**: Filter by percentage (0-100%)
- **Categories**: Multiple category filtering
- **Dietary restrictions**: Vegan, vegetarian, gluten-free, etc.
- **Establishment types**: Restaurant, bakery, grocery store
- **Pickup time slots**: Availability-based filtering
- **Status filters**: Include/exclude expired and sold-out offers

### 3. **Smart Sorting**
Supported criteria: `relevance`, `price`, `discount`, `distance`, `rating`, `expiration`
- **Sort order**: `asc` or `desc`
- **Multi-factor relevance scoring**

### 4. **Auto-Complete & Suggestions**
- **Text-based**: Fuzzy matching with aliases
- **Popular searches**: Trending queries with click-through rates
- **Location-based**: Nearby establishments and locations
- **Personalized**: User search history (last 30 days)
- **Trending**: Real-time trending queries

### 5. **Search Analytics**
- Query tracking with session IDs
- Result click tracking
- Zero-result query monitoring
- Trend analysis (hourly, daily, weekly, monthly)
- User demographics
- Response time metrics

### 6. **Caching Strategy**
- Redis-based caching with TTL
- Search results: 5 minutes
- Suggestions: 5 minutes
- Index documents: 1 hour
- Pattern-based cache invalidation

### 7. **Background Processing**
Bull queues for async operations:
- `search-indexing` - Offer/establishment indexing
- `search-analytics` - Search query recording

---

## API Endpoints

### POST /api/v1/search
**Description**: Execute a search query with filters
**Auth**: Optional (personalization requires authentication)

**Request Body** (`SearchDto`):
```typescript
{
  "query": "bakery items",                    // Required, max 500 chars
  "categories": ["bakery", "pastries"],       // Optional
  "priceRange": {
    "min": 0,
    "max": 50
  },
  "discountRange": {
    "min": 20,
    "max": 80
  },
  "location": {
    "longitude": 2.3522,
    "latitude": 48.8566,
    "radius": 5000,                           // meters (100-50000)
    "accuracy": 50,                           // meters
    "source": "gps"                           // gps | ip | manual
  },
  "dietaryRestrictions": ["vegetarian"],
  "establishmentTypes": ["bakery"],
  "pickupTimeSlots": [
    {
      "startTime": "16:00",
      "endTime": "18:00"
    }
  ],
  "sortBy": "relevance",                      // relevance|price|discount|distance|rating|expiration
  "sortOrder": "desc",                        // asc|desc
  "page": 1,                                  // min: 1
  "limit": 20,                                // 1-100, default: 20
  "includeExpired": false,
  "includeSoldOut": false
}
```

**Response**:
```typescript
{
  "statusCode": 200,
  "message": "Search completed successfully",
  "data": {
    "results": [
      {
        "type": "offer" | "establishment" | "category",
        "id": "string",
        "title": "string",
        "subtitle": "string",
        "image": "string",
        "relevanceScore": 0.95,
        "distance": 1234,                     // meters
        "metadata": {}
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### GET /api/v1/search/suggestions
**Description**: Get auto-complete suggestions
**Auth**: Optional (personalization requires authentication)

**Query Parameters** (`SuggestionDto`):
```typescript
{
  "query": "bake",                            // Required, max 100 chars
  "limit": 10,                                // 1-50, default: 10
  "types": ["query", "category", "establishment"],
  "location": {
    "longitude": 2.3522,
    "latitude": 48.8566,
    "radius": 5000
  },
  "includeTrending": true,
  "includePersonalized": true                 // Requires auth
}
```

**Response**:
```typescript
{
  "statusCode": 200,
  "message": "Suggestions retrieved successfully",
  "data": {
    "suggestions": [
      {
        "text": "bakery",
        "type": "query" | "category" | "establishment" | "location",
        "source": "query_history" | "popular_searches" | "location_based" | "admin_defined",
        "score": 0.92,
        "metadata": {}
      }
    ],
    "trending": ["fresh bread", "croissants"],
    "personalized": ["baguette", "bakery near me"]
  }
}
```

---

## Database Schemas

### SearchQuery Schema
**Purpose**: Track all search queries for analytics

**Indexes**:
- `query` (text index)
- `userId + createdAt` (compound, desc)
- `sessionId + createdAt` (compound, desc)
- `location.coordinates` (2dsphere geospatial)

**Key Fields**:
```typescript
{
  query: string;                    // Max 500 chars
  userId?: ObjectId;                // User reference (optional)
  sessionId: string;                // Tracking session
  filters: SearchFilters;           // Applied filters
  results: SearchResult[];          // Returned results
  resultCount: number;              // Total results found
  responseTime: number;             // Query execution time (ms)
  userAgent?: string;
  ipAddress?: string;
  location?: {
    coordinates: [number, number];  // [lng, lat]
    accuracy?: number;
    source?: 'gps' | 'ip' | 'manual';
  };
  clickedResult: boolean;           // User clicked any result
  clickedResultId?: string;
  clickedResultPosition?: number;   // Position in list (1-indexed)
  clickedAt?: Date;
  correctedQuery: boolean;          // Typo correction applied
  originalQuery?: string;           // Before correction
  suggestions: string[];            // Suggested alternatives
}
```

### PopularSearch Schema
**Purpose**: Aggregate popular/trending searches

**Indexes**:
- `query + period + periodStart` (compound)
- `period + trendScore` (compound, desc)
- `isActive + period + searchCount` (compound, desc)

**Key Fields**:
```typescript
{
  query: string;
  period: 'hourly' | 'daily' | 'weekly' | 'monthly';
  periodStart: Date;
  periodEnd: Date;
  searchCount: number;              // Total searches
  uniqueUsers: number;              // Unique user count
  clickThroughs: number;            // Results clicked
  clickThroughRate: number;         // 0-1
  conversions: number;              // Purchases made
  conversionRate: number;           // 0-1
  averageResponseTime: number;      // ms
  demographics?: {
    ageGroups?: Record<string, number>;
    locations?: Record<string, number>;
    userTypes?: Record<string, number>;
  };
  relatedQueries: string[];
  commonFilters: string[];          // Most used filters
  trendScore: number;               // Trending algorithm score
  trendDirection?: 'rising' | 'stable' | 'declining';
  isActive: boolean;
}
```

### SearchSuggestion Schema
**Purpose**: Store auto-complete suggestions

**Key Fields**:
```typescript
{
  text: string;
  type: 'query' | 'category' | 'establishment' | 'location';
  source: 'query_history' | 'popular_searches' | 'location_based' | 'admin_defined';
  aliases: string[];                // Alternative spellings
  frequency: number;                // Usage count
  relevanceScore: number;           // 0-1
  clickThroughRate: number;         // 0-1
  conversionRate: number;           // 0-1
  lastUsed: Date;
  expiresAt?: Date;                 // Temporary suggestions
  metadata?: {
    location?: {
      type: 'Point';
      coordinates: [number, number];
    };
    category?: string;
    establishmentId?: string;
  };
  isActive: boolean;
}
```

---

## Services

### SearchService (Main Orchestrator)
**Location**: `search.service.ts`
**Status**: Stub implementation (returns empty results)

**Purpose**: Coordinates all search operations

**Planned Methods**:
```typescript
performSearch(query: string, filters: any): Promise<SearchResult>
```

### SearchCacheService
**Location**: `services/search-cache.service.ts`
**Redis Connection**: Shared instance with lazy connect

**Methods**:
- `get(key: string): Promise<any>` - Retrieve cached data
- `set(key: string, value: any, ttl?: number): Promise<void>` - Cache with TTL (default: 300s)
- `del(key: string): Promise<void>` - Delete cache entry
- `clearPattern(pattern: string): Promise<void>` - Bulk delete by pattern

**Key Patterns**:
- `search:{key}` - Search results
- `suggestions:{query}:{limit}:{types}:{userId}` - Auto-complete
- `search:offers:{offerId}` - Offer index documents
- `search:establishments:{establishmentId}` - Establishment index documents

### SearchAnalyticsService
**Location**: `services/search-analytics.service.ts`

**Methods**:
```typescript
// Record search query with metadata
recordSearchQuery(
  query: string,
  userId?: string,
  filters?: any,
  resultsCount?: number,
  location?: { latitude: number; longitude: number }
): Promise<void>

// Get aggregated analytics
getSearchAnalytics(period: 'day' | 'week' | 'month'): Promise<{
  totalSearches: number;
  uniqueQueryCount: number;
  averageResults: number;
  zeroResultQueries: number;
  zeroResultRate: number;
}>

// Top search queries by popularity
getTopSearchQueries(limit: number = 10): Promise<PopularSearch[]>

// Search trends over time
getSearchTrends(period: 'day' | 'week' | 'month'): Promise<Array<{
  query: string;
  trend: Array<{ date: string; count: number }>;
  totalCount: number;
}>>
```

### SearchIndexService
**Location**: `services/search-index.service.ts`

**Purpose**: Manage search index for offers and establishments

**Methods**:
```typescript
// Index single offer
indexOffer(offerId: string): Promise<void>

// Index single establishment
indexEstablishment(establishmentId: string): Promise<void>

// Remove from index
removeFromIndex(type: 'offers' | 'establishments', id: string): Promise<void>

// Full index rebuild
rebuildIndex(): Promise<void>

// Index statistics
getIndexStats(): Promise<{
  totalOffers: number;
  totalEstablishments: number;
  lastUpdated: Date;
}>
```

**Index Document Structure** (Offer):
```typescript
{
  id: string;
  type: 'offer';
  title: string;
  description: string;
  categories: string[];
  establishmentName: string;
  establishmentAddress: object;
  location: [number, number];       // [lng, lat]
  price: {
    original: number;
    discounted: number;
    discount: number;               // percentage
  };
  availability: {
    quantity: number;
    from: Date;
    until: Date;
  };
  searchText: string;               // Concatenated searchable text
  status: string;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### SearchSuggestionService
**Location**: `services/search-suggestion.service.ts`

**Methods**:
```typescript
// Get suggestions with multi-source ranking
getSuggestions(suggestionDto: SuggestionDto, userId?: string): Promise<{
  suggestions: Array<{ text, type, source, score, metadata }>;
  trending: string[];
  personalized: string[];
}>

// Add/update suggestion
addOrUpdateSuggestion(
  text: string,
  type: SuggestionType,
  source: SuggestionSource,
  metadata?: any
): Promise<SearchSuggestionDocument>

// Update metrics (CTR, conversion)
updateSuggestionMetrics(text: string, clicked: boolean, converted: boolean): Promise<void>

// Popular categories
getPopularCategories(limit: number = 10): Promise<string[]>

// Cleanup expired suggestions
cleanupExpiredSuggestions(): Promise<number>
```

**Scoring Algorithm**:
```
Text Suggestions:
  score = (textScore * 0.6) + (relevanceScore * 0.3) + (log(frequency + 1) * 0.1)

Popular Suggestions:
  score = (log(searchCount + 1) * 0.4) + (trendScore * 0.4) + (clickThroughRate * 0.2)

Location Suggestions:
  score = (relevanceScore * 0.4) + (log(frequency + 1) * 0.3) + 0.3 (location bonus)

Personalized:
  score = (log(count + 1) * 0.6) + (recencyScore * 0.4)
```

---

## Background Processors

### SearchProcessor
**Location**: `processors/search.processor.ts`
**Queue**: `search-indexing` (main), `search-analytics`

**Job Types**:

#### `index-offer`
```typescript
{ offerId: string }
```
Indexes a single offer for search. Triggered when offers are created/updated.

#### `index-establishment`
```typescript
{ establishmentId: string }
```
Indexes a single establishment for search.

#### `remove-from-index`
```typescript
{ type: 'offers' | 'establishments', id: string }
```
Removes document from search index (offer deleted/deactivated).

#### `rebuild-index`
```typescript
{}
```
Full index rebuild. Run during maintenance or after schema changes.

#### `record-search`
```typescript
{
  query: string;
  userId?: string;
  filters?: any;
  resultsCount?: number;
  location?: { latitude: number; longitude: number };
}
```
Records search query for analytics (async to avoid latency).

#### `cleanup-analytics`
```typescript
{ olderThanDays: number }
```
Cleans up old search query records. Run as scheduled job.

**Queue Configuration**:
- **Redis**: Shared connection (lazy connect, 3 retries, 10s timeout)
- **Job retention**: 10 completed, 5 failed
- **Retry policy**: 3 attempts (indexing), 2 attempts (analytics)

---

## Integration Points

### Offers Module
**Import**: `{ name: Offer.name, schema: OfferSchema }`

**Usage**:
- Index offers when created/updated
- Remove from index when deleted/expired
- Query offers by search criteria

### Establishments Module
**Import**: `{ name: Establishment.name, schema: EstablishmentSchema }`

**Usage**:
- Index establishments when created/updated
- Include establishment data in offer search results
- Search establishments directly

### Users Module
**Import**: `{ name: User.name, schema: UserSchema }`

**Usage**:
- Track user search history
- Personalized suggestions
- User demographics for analytics

### Redis Module
**Dependency**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_USERNAME`

**Usage**:
- Search result caching
- Suggestion caching
- Index document storage
- Bull queue backend

---

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_USERNAME=

# Search-specific (optional)
SEARCH_CACHE_TTL=300                # seconds (default: 5 min)
SEARCH_INDEX_TTL=3600               # seconds (default: 1 hour)
SEARCH_MAX_RESULTS=100              # max results per page
SEARCH_DEFAULT_LIMIT=20             # default page size
SEARCH_MAX_RADIUS=50000             # max geospatial radius (meters)
```

### Module Exports
The module exports these services for use in other modules:
- `SearchService`
- `SearchSuggestionService`
- `SearchAnalyticsService`
- `SearchIndexService`

**Import Example**:
```typescript
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  // ...
})
export class OffersModule {}
```

---

## Security & Validation

### Input Sanitization
All inputs sanitized via `GlobalSanitizationMiddleware` (XSS prevention).

### Validation Rules
- **Query string**: Max 500 chars, trimmed
- **Suggestion query**: Max 100 chars, trimmed
- **Coordinates**: Longitude [-180, 180], Latitude [-90, 90]
- **Radius**: 100-50,000 meters
- **Page**: Min 1
- **Limit**: 1-100
- **Discount/Price**: Non-negative numbers

### Rate Limiting
- **Public**: 50 req/1min (global limit)
- **Authenticated**: 200 req/1min
- **Admin**: No limit

### Privacy
- IP addresses and user agents stored for analytics (GDPR compliance required)
- User search history retained for 30 days (personalization)
- Option to disable personalized suggestions via `includePersonalized: false`

---

## Performance Considerations

### Caching Strategy
1. **Cache hits**: O(1) Redis lookup
2. **Cache misses**: Database query + index to cache
3. **TTL management**: Aggressive TTLs to balance freshness vs performance

### Database Indexes
- **Text indexes**: Full-text search on `query` fields
- **Geospatial indexes**: 2dsphere for location-based queries
- **Compound indexes**: Optimized for common query patterns

### Query Optimization
- Pagination limits prevent expensive full scans
- Aggregation pipelines use `$match` early in pipeline
- Location queries use `$nearSphere` with max distance constraint

### Async Processing
- Search query recording is async (Bull queue)
- Index updates are async (Bull queue)
- Analytics aggregation runs on-demand (not real-time)

---

## Monitoring & Observability

### Logging
Uses `@nestjs/common` Logger with context:
- `SearchService` - Core search operations
- `SearchAnalyticsService` - Analytics operations
- `SearchIndexService` - Indexing operations
- `SearchSuggestionService` - Suggestion generation
- `SearchProcessor` - Queue job processing

**Log Levels**:
- `log` - Normal operations
- `warn` - Non-critical issues (missing documents)
- `error` - Failures requiring attention

### Metrics to Track
1. **Search Performance**
   - Average response time
   - Cache hit rate
   - Zero-result rate

2. **User Engagement**
   - Click-through rate
   - Conversion rate
   - Suggestion usage

3. **System Health**
   - Queue job success/failure rate
   - Index rebuild duration
   - Redis connection status

### Prometheus Integration
Recommended custom metrics:
```typescript
search_queries_total{status="success|failure"}
search_query_duration_seconds
search_cache_hits_total
search_cache_misses_total
search_zero_results_total
search_suggestions_generated_total
search_index_size{type="offers|establishments"}
```

---

## Testing Strategy

### Unit Tests
**Target**: Individual services and methods
**Mocks**: Mongoose models, Redis client, Bull queues

**Test Cases**:
- ✅ Suggestion scoring algorithm
- ✅ Cache key generation
- ✅ Analytics aggregation
- ✅ Index document creation
- ✅ Duplicate removal and ranking

### Integration Tests
**Target**: Controller endpoints with database
**Setup**: In-memory MongoDB, Redis mock

**Test Cases**:
- ✅ Search with filters
- ✅ Geospatial queries
- ✅ Pagination
- ✅ Auto-complete suggestions
- ✅ Analytics recording

### E2E Tests
**Target**: Full search flow
**Setup**: Test database, real Redis

**Test Cases**:
- ✅ Search → click → conversion flow
- ✅ Personalized suggestions after search history
- ✅ Index rebuild after data changes
- ✅ Trending queries after volume spike

---

## Future Enhancements

### Planned Features
1. **Typo correction**: Levenshtein distance-based query correction
2. **Synonym expansion**: "bread" → "baguette", "loaf", "roll"
3. **Multi-language support**: i18n for queries and suggestions
4. **Image search**: Visual similarity search for offers
5. **Voice search**: Speech-to-text integration
6. **Faceted search**: Dynamic filter generation
7. **Search history**: User-facing search history page
8. **Export analytics**: CSV/JSON export for admin

### Optimization Opportunities
1. **Elasticsearch integration**: Replace MongoDB text search
2. **GraphQL API**: Flexible query structure
3. **Machine learning**: Personalized ranking models
4. **Distributed caching**: Redis Cluster for scale
5. **CDN caching**: Edge caching for popular queries

---

## Known Issues & Limitations

### Current Limitations
1. **Stub implementation**: `SearchService.performSearch()` returns empty results (implementation pending)
2. **No fuzzy matching**: Exact text matching only
3. **Basic relevance scoring**: Simple weighted score (ML-based ranking not implemented)
4. **No query correction**: Typos return zero results
5. **Limited location accuracy**: Relies on GPS/IP (no address geocoding fallback)

### Technical Debt
1. **Controller placeholders**: `/suggestions` and POST `/` return hardcoded responses
2. **Missing tests**: No test coverage yet
3. **Index storage**: Uses Redis cache (should migrate to dedicated search engine)
4. **Analytics retention**: No automatic cleanup (manual cleanup job required)

### Dependencies on External Modules
- **Offers module**: Must exist with `OfferSchema`
- **Establishments module**: Must exist with `EstablishmentSchema`
- **Users module**: Must exist with `UserSchema`
- **Redis**: Required for caching and queues (graceful degradation not implemented)

---

## Migration Notes

### From v0 (No search) → v1 (This implementation)
1. Run initial index rebuild: Trigger `rebuild-index` job
2. Populate suggestions: Seed common categories/queries via admin API
3. Enable analytics: Ensure Redis is configured
4. Monitor zero-result rate: Identify missing data or typos

### Breaking Changes
- None (new module)

---

## Troubleshooting

### Problem: Zero results for valid queries
**Cause**: Index not populated
**Solution**: Run `rebuildIndex()` via admin endpoint or script

### Problem: Suggestions not appearing
**Cause**: Cache miss + no suggestion documents
**Solution**: Seed `SearchSuggestion` collection with common queries

### Problem: Slow search performance
**Cause**: Cache disabled or Redis connection issue
**Solution**: Check Redis connectivity, verify cache TTLs

### Problem: Duplicate suggestions
**Cause**: Ranking algorithm not deduplicating
**Solution**: Review `deduplicateAndRank()` logic in `SearchSuggestionService`

### Problem: Analytics not recording
**Cause**: Bull queue not processing jobs
**Solution**: Check Redis connection, verify queue configuration

---

## API Examples

### Example 1: Basic search
```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "pizza",
    "page": 1,
    "limit": 10
  }'
```

### Example 2: Location-based search with filters
```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "bakery",
    "location": {
      "longitude": 10.1815,
      "latitude": 36.8065,
      "radius": 2000
    },
    "discountRange": {
      "min": 30,
      "max": 70
    },
    "sortBy": "distance",
    "sortOrder": "asc"
  }'
```

### Example 3: Get suggestions
```bash
curl -X GET "http://localhost:3000/api/v1/search/suggestions?query=bak&limit=10&includeTrending=true"
```

### Example 4: Personalized search (authenticated)
```bash
curl -X POST http://localhost:3000/api/v1/search \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "query": "vegan",
    "dietaryRestrictions": ["vegan"],
    "includePersonalized": true
  }'
```

---

## Related Documentation

- [Offers Module](../offers/offer.md)
- [Establishments Module](../establishments/establishment.md)
- [Analytics Module](../analytics/analytics.md)
- [Redis Configuration](../redis/README.md)
- [Bull Queues](../common/README.md#bull-queues)

---

## Version History

| Version | Date       | Changes                                      |
|---------|------------|----------------------------------------------|
| 1.0.0   | 2026-01-15 | Initial implementation with basic search     |

---

## Support

For questions or issues related to the search module:
1. Check existing issues in project repository
2. Review Swagger documentation at `/api/v1/api-docs`
3. Consult main backend CLAUDE.md for general guidance

---

**Last Updated**: 2026-01-15
**Maintained By**: Too Fresh To Waste Backend Team
**Module Status**: ✅ Partially Implemented (Core infrastructure ready, search logic pending)
