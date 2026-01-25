# Favorites Module Documentation

## Overview

The Favorites module provides a comprehensive system for users to save, organize, and receive personalized recommendations based on their favorite items (establishments, offers, and categories). It includes intelligent recommendation algorithms using both content-based and collaborative filtering approaches, along with trend analysis capabilities.

**Module Location:** `apps/food-waste-backend/src/favorites/`

**Stack:**
- NestJS Controllers & Services
- MongoDB with Mongoose ODM
- JWT Authentication (required)
- Class-validator DTOs
- Swagger API Documentation

---

## Features

### Core Functionality
- ✅ **Add/Remove Favorites** - Save establishments, offers, or categories
- ✅ **Favorite Lists** - Create custom collections with metadata (name, description, icon, cover image)
- ✅ **Personalized Preferences** - Configure notifications, preferred times, max distance per favorite
- ✅ **Statistics Dashboard** - Track favorites count, notifications, recent activity
- ✅ **Bulk Operations** - Add multiple favorites at once
- ✅ **Export Data** - Export all favorites and lists for portability

### Advanced Features
- 🤖 **Smart Recommendations** - Hybrid algorithm combining content-based + collaborative filtering
- 📈 **Trend Analysis** - Track popular items with growth rate calculation
- 🔔 **Notification Preferences** - Granular control (email, push, preferred times/days)
- 👥 **List Sharing** - Share favorite lists with other users (private/shared/public visibility)
- 🏷️ **Tagging System** - Organize favorites with custom tags
- 📊 **Interaction Tracking** - Monitor engagement with favorites

---

## Architecture

### Module Structure

```
favorites/
├── favorites.controller.ts        # REST API endpoints
├── favorites.service.ts            # Business logic & algorithms
├── favorites.module.ts             # Module definition
├── dto/
│   └── favorite.dto.ts             # DTOs with validation
└── schemas/
    ├── favorite.schema.ts          # Individual favorite schema
    └── favorite-list.schema.ts     # Favorite list schema
```

### Dependencies

```typescript
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Favorite.name, schema: FavoriteSchema },
      { name: FavoriteList.name, schema: FavoriteListSchema },
    ]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
  exports: [FavoritesService, MongooseModule],
})
```

---

## API Endpoints

### Base URL: `/api/v1/favorites`

All endpoints require JWT authentication (`@UseGuards(JwtAuthGuard)`).

#### Individual Favorites

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `POST` | `/` | Add item to favorites | 201, 409 |
| `GET` | `/` | Get user favorites (paginated) | 200 |
| `PUT` | `/:id` | Update favorite preferences | 200, 404 |
| `DELETE` | `/:id` | Remove favorite by ID | 204, 404 |
| `DELETE` | `/item/:type/:itemId` | Remove favorite by item | 204, 404 |
| `GET` | `/check/:type/:itemId` | Check if item is favorited | 200 |
| `GET` | `/stats` | Get favorites statistics | 200 |
| `POST` | `/bulk/add` | Bulk add favorites | 201 |
| `GET` | `/export` | Export all favorites data | 200 |

#### Favorite Lists

| Method | Endpoint | Description | Status Codes |
|--------|----------|-------------|--------------|
| `POST` | `/lists` | Create favorite list | 201, 409 |
| `GET` | `/lists` | Get user lists | 200 |
| `GET` | `/lists/:id` | Get list by ID | 200, 404 |
| `PUT` | `/lists/:id` | Update list | 200, 404 |
| `POST` | `/lists/:id/items` | Add item to list | 201, 404, 409 |
| `DELETE` | `/lists/:id/items/:itemId/:type` | Remove item from list | 204, 404 |
| `POST` | `/lists/:id/share` | Share list with users | 200, 404 |

#### Intelligence Features

| Method | Endpoint | Description | Query Params |
|--------|----------|-------------|--------------|
| `GET` | `/recommendations/based-on-favorites` | Get personalized recommendations | `limit`, `type`, `category`, `maxDistance`, `minConfidence` |
| `GET` | `/trends/popular` | Get trending favorites | `period`, `limit`, `type`, `category`, `minFavoriteCount` |

---

## Database Schemas

### Favorite Schema

```typescript
{
  userId: ObjectId,              // ref: User
  type: FavoriteType,            // 'establishment' | 'offer' | 'category'
  itemId: ObjectId,              // Dynamic ref via refPath
  itemName?: string,             // Cached for performance
  itemImage?: string,            // Cached for performance
  preferences: {
    notifications: boolean,      // Master toggle
    emailAlerts: boolean,
    pushNotifications: boolean,
    preferredTimes: string[],    // ['morning', 'afternoon', 'evening']
    preferredDays: number[],     // [1,2,3,4,5] (weekdays)
    maxDistance: number          // 0-50 km
  },
  addedAt: Date,
  lastNotified?: Date,
  notificationCount: number,
  interactionCount: number,       // Tracks user engagement
  lastInteraction?: Date,
  isActive: boolean,              // Soft delete
  tags?: string[],                // Custom user tags
  notes?: string,                 // Personal notes
  metadata?: Map<string, string>
}
```

**Indexes:**
- `{ userId: 1, type: 1, itemId: 1 }` - Unique compound index
- `{ userId: 1, isActive: 1 }`
- `{ userId: 1, type: 1 }`
- `{ addedAt: -1 }`
- `{ lastInteraction: -1 }`

### FavoriteList Schema

```typescript
{
  userId: ObjectId,               // ref: User (owner)
  name: string,                   // List name (unique per user)
  description?: string,
  visibility: ListVisibility,     // 'private' | 'public' | 'shared'
  items: ListItem[],              // Array of items in the list
  sharedWith?: ObjectId[],        // ref: User[]
  iconEmoji?: string,             // Display icon
  coverImage?: string,            // Header image
  tags: string[],
  isActive: boolean,
  viewCount: number,              // Analytics
  shareCount: number,             // Analytics
  lastAccessedAt?: Date,
  lastAccessedBy?: ObjectId       // ref: User
}

ListItem {
  itemId: ObjectId,               // Dynamic ref
  type: string,                   // 'establishment' | 'offer'
  addedAt: Date,
  notes?: string,                 // Item-specific notes
  position: number                // For manual ordering
}
```

**Indexes:**
- `{ userId: 1, name: 1 }` - Unique per user
- `{ userId: 1, isActive: 1 }`
- `{ visibility: 1 }`
- `{ tags: 1 }`
- `{ createdAt: -1 }`

---

## Data Transfer Objects (DTOs)

### Key DTOs

#### AddFavoriteDto
```typescript
{
  type: FavoriteType,           // Required
  itemId: string,               // Required (MongoId)
  itemName?: string,
  itemImage?: string,
  preferences?: FavoritePreferenceDto,
  tags?: string[],
  notes?: string
}
```

#### FavoritesFilterDto
```typescript
{
  type?: FavoriteType,
  tag?: string,
  isActive?: boolean,
  page?: number,                // Default: 1, Min: 1
  limit?: number,               // Default: 20, Range: 1-100
  sortBy?: string               // Default: '-addedAt'
}
```

#### CreateFavoriteListDto
```typescript
{
  name: string,                 // Required
  description?: string,
  visibility?: ListVisibility,  // Default: 'private'
  iconEmoji?: string,
  coverImage?: string,
  tags?: string[]
}
```

#### RecommendationFiltersDto
```typescript
{
  limit?: number,               // Default: 10, Range: 1-50
  type?: FavoriteType,
  category?: string,
  maxDistance?: number,         // Range: 1-100 km
  minConfidence?: number        // Range: 0-1, Default: 0.5
}
```

---

## Service Methods

### Core Methods

#### `addFavorite(userId, addFavoriteDto)`
- Checks for existing favorite (unique constraint)
- Reactivates soft-deleted favorites
- Creates new favorite with default preferences
- Increments interaction count
- **Returns:** `FavoriteDocument`

#### `getUserFavorites(userId, filters)`
- Paginated results with filtering
- Supports sorting and type filtering
- Populates itemId references
- **Returns:** `{ favorites, total, page, totalPages }`

#### `getFavoriteStats(userId)`
- Aggregates statistics using MongoDB pipelines
- Groups by favorite type
- Calculates recent activity (last 7 days)
- **Returns:** `FavoriteStatsDto`

#### `updateInteractionCount(favoriteId)`
- Private method, called automatically
- Tracks user engagement for recommendation algorithm
- Updates `lastInteraction` timestamp

### List Management Methods

#### `createFavoriteList(userId, createDto)`
- Enforces unique list names per user
- Supports custom icons and cover images
- **Returns:** `FavoriteListDocument`

#### `getUserFavoriteLists(userId, page, limit)`
- ✅ **ENTERPRISE FIX:** Pagination to prevent loading thousands of lists
- DoS protection: Max 100 items per page
- Uses `.lean()` for 50% memory reduction
- **Returns:** `{ lists, total }`

#### `shareList(userId, listId, shareDto)`
- Adds users to `sharedWith` array
- Increments share count
- Changes visibility to `SHARED`
- **Returns:** `FavoriteListDocument`

---

## Recommendation Algorithm

### Hybrid Approach

The system uses a **weighted hybrid** of two algorithms:

1. **Content-Based Filtering (60%)** - Analyzes user's favorite patterns
2. **Collaborative Filtering (40%)** - Finds similar users

### `getRecommendationsBasedOnFavorites(userId, filters)`

**Step 1: Analyze User Preferences**
```typescript
- Analyze most recent 100 favorites (prevents loading 10K+ favorites)
- Extract: favorite types, common tags, category preferences, time patterns
- Calculate average interaction count
```

**Step 2: Content-Based Recommendations**
```typescript
- Find items with similar tags to user's favorites
- Score = (tagSimilarity × 0.6) + (popularityScore × 0.3) + (interactionScore × 0.1)
- Exclude items already favorited by user
- Minimum score threshold: 0.3
```

**Step 3: Collaborative Filtering**
```typescript
- Find users with ≥2 common favorites
- Get items favorited by similar users
- Score = (userSimilarity × 0.7) + (popularity × 0.3)
- Limit to top 50 similar users for performance
```

**Step 4: Merge and Rank**
```typescript
- Items from both algorithms: boost score by 1.2× (high confidence)
- Final scores: content × 0.6, collaborative × 0.8
- Filter by minConfidence threshold (default: 0.5)
- Sort by final score descending
```

**Response:**
```typescript
{
  recommendations: RecommendationDto[],
  totalRecommendations: number,
  algorithm: 'content-based-with-collaborative-filtering',
  basedOnFavoritesCount: number,
  generatedAt: Date,
  confidence: number              // Average similarity score
}
```

---

## Trend Analysis

### `getPopularTrends(filters)`

**Algorithm:**
1. Aggregate favorites for current period (day/week/month/quarter/year)
2. Aggregate favorites for previous period
3. Calculate growth rate: `((current - previous) / previous) × 100`
4. Compute trend score:
   ```typescript
   trendScore = (popularityScore × 0.4) + (growthScore × 0.4) + (diversityScore × 0.2)
   ```
5. Sort by trend score descending

**Growth Indicators:**
- `growthRate > 0` - Gaining popularity
- `growthRate < 0` - Declining popularity
- `growthRate = 100` - New trending item

**Response:**
```typescript
{
  trends: TrendItemDto[],
  period: string,
  totalTrends: number,
  generatedAt: Date,
  periodStartDate: Date,
  periodEndDate: Date
}
```

---

## Performance Optimizations

### ✅ Enterprise Fixes Applied

1. **Pagination Everywhere**
   - `getUserFavoriteLists()`: Max 100 items per page (prevents loading 1000s)
   - `getRecommendationsBasedOnFavorites()`: Analyzes only 100 most recent favorites

2. **Lean Queries**
   - Uses `.lean()` for 50% memory reduction
   - Returns POJOs instead of Mongoose documents

3. **Selective Field Projection**
   - Only fetches required fields in aggregations
   - Example: `select('name description visibility items.length')`

4. **Aggregation Pipeline Limits**
   - `$limit` stages prevent full collection scans
   - Balances accuracy vs. performance

5. **Index Utilization**
   - Compound indexes for common query patterns
   - Sorted indexes for pagination

---

## Security

### Authentication & Authorization
- All endpoints protected by `JwtAuthGuard`
- User ID extracted from JWT token via `@GetUser('id')`
- Resource ownership validated (users can only access their own favorites)

### Input Validation
- All DTOs use `class-validator` decorators
- MongoDB ID validation prevents injection
- Enum validation for type fields
- Range validation for pagination and scores

### Access Control for Lists
- **Private**: Only owner can view
- **Shared**: Owner + users in `sharedWith` array
- **Public**: Anyone can view (controlled by visibility)

### Soft Deletes
- Uses `isActive` flag instead of hard deletes
- Preserves data for analytics
- Allows reactivation of favorites

---

## Usage Examples

### Add a Favorite

```typescript
POST /api/v1/favorites
Authorization: Bearer <token>

{
  "type": "establishment",
  "itemId": "507f1f77bcf86cd799439011",
  "itemName": "Green Cafe",
  "preferences": {
    "notifications": true,
    "preferredTimes": ["morning", "afternoon"],
    "maxDistance": 10
  },
  "tags": ["vegan", "organic"]
}
```

### Get Personalized Recommendations

```typescript
GET /api/v1/favorites/recommendations/based-on-favorites?limit=10&minConfidence=0.6
Authorization: Bearer <token>

Response:
{
  "recommendations": [
    {
      "itemId": "...",
      "type": "establishment",
      "itemName": "Eco Bistro",
      "score": 0.85,
      "reason": "Based on your interest in vegan, organic, eco-friendly",
      "category": "content-based",
      "tags": ["vegan", "eco-friendly"],
      "similarityScore": 0.85
    }
  ],
  "totalRecommendations": 10,
  "algorithm": "content-based-with-collaborative-filtering",
  "basedOnFavoritesCount": 25,
  "generatedAt": "2026-01-15T...",
  "confidence": 0.78
}
```

### Create and Share a List

```typescript
// Create list
POST /api/v1/favorites/lists
{
  "name": "Weekend Brunch Spots",
  "description": "My favorite places for weekend brunch",
  "visibility": "private",
  "iconEmoji": "🥞",
  "tags": ["brunch", "weekend"]
}

// Share with friends
POST /api/v1/favorites/lists/<listId>/share
{
  "userIds": ["507f...", "507f..."],
  "message": "Check out my favorite brunch spots!"
}
```

### Get Trending Items

```typescript
GET /api/v1/favorites/trends/popular?period=week&limit=20&minFavoriteCount=10

Response:
{
  "trends": [
    {
      "itemId": "...",
      "type": "offer",
      "itemName": "Fresh Bakery Surprise Box",
      "favoriteCount": 156,
      "growthRate": 45.3,
      "rank": 1,
      "popularTags": ["bakery", "breakfast", "desserts"],
      "trendScore": 0.92
    }
  ],
  "period": "week",
  "totalTrends": 20,
  "periodStartDate": "...",
  "periodEndDate": "..."
}
```

---

## Testing

### Unit Tests (favorites.service.spec.ts)

```bash
pnpm test favorites.service
```

**Test Coverage:**
- ✅ Add favorite with duplicate handling
- ✅ Remove favorite (soft delete)
- ✅ Update favorite preferences
- ✅ Get favorites with pagination
- ✅ Create/update/delete lists
- ✅ Share list functionality
- ✅ Statistics aggregation
- ✅ Recommendation algorithm
- ✅ Trend calculation

### Integration Tests (favorites.controller.spec.ts)

```bash
pnpm test favorites.controller
```

**Test Coverage:**
- ✅ JWT authentication enforcement
- ✅ DTO validation
- ✅ HTTP status codes
- ✅ Error handling (404, 409, etc.)
- ✅ Swagger documentation

### E2E Tests (favorites.e2e-spec.ts)

```bash
pnpm test:e2e favorites
```

**Test Scenarios:**
- Full user journey: register → login → add favorites → get recommendations
- List creation and sharing workflow
- Bulk operations
- Export functionality

---

## Known Issues & Future Enhancements

### Known Issues
- No rate limiting on recommendation endpoint (can be CPU-intensive)
- Trend analysis doesn't account for seasonal patterns
- Collaborative filtering requires minimum user base to be effective

### Future Enhancements
- [ ] Real-time notifications when favorited items have new offers
- [ ] Machine learning model for recommendation refinement
- [ ] Geographic clustering for location-based recommendations
- [ ] A/B testing framework for algorithm tuning
- [ ] Redis caching for frequently requested recommendations
- [ ] Export to external services (Google Calendar, Apple Wallet)

---

## Related Modules

- **Auth Module** (`src/auth/`) - JWT authentication
- **Users Module** (`src/users/`) - User profiles
- **Establishments Module** (`src/establishments/`) - Merchant data
- **Offers Module** (`src/offers/`) - Surplus food listings
- **Notifications Module** (`src/notifications/`) - Alert system

---

## API Documentation

Interactive Swagger documentation available at:
```
http://localhost:3000/api/v1/api-docs#/Favorites
```

---

## Monitoring & Logs

### Key Log Events
- `Favorite added: {type} {itemId} for user {userId}`
- `Favorite removed: {favoriteId} for user {userId}`
- `List shared: {listId} with {count} users`
- `Generated {count} recommendations for user: {userId}`
- `Generated {count} trends for period: {period}`

### Error Tracking
All errors logged with stack traces via `AppLoggerService` and Sentry integration.

---

## Contact & Support

For questions or issues related to the Favorites module:
- Review Swagger docs: `/api/v1/api-docs`
- Check MongoDB indexes: `pnpm verify:indexes`
- Run test suite: `pnpm test favorites`
- View logs: Check console output or Sentry dashboard

---

**Last Updated:** 2026-01-15
**Module Version:** 1.0.0
**Maintainer:** Backend Team
