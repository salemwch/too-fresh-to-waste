# Reviews Module Documentation

## Overview

The Reviews module provides a comprehensive review and rating system for the Too
Fresh To Waste food waste reduction marketplace. It enables customers to review
establishments, orders, and offers with AI-powered sentiment analysis, automated
moderation, analytics, and gamification integration.

**Module Path:** `src/reviews/`

**Stack:** NestJS 11 | MongoDB (Mongoose) | Bull Queues | Redis | Firebase
Storage

---

## Architecture

### Module Structure

```
reviews/
├── dto/
│   ├── create-review.dto.ts        # DTOs for review operations
│   └── update-review.dto.ts
├── schemas/
│   └─��� review.schema.ts            # Mongoose schema with indexes
├── reviews.controller.ts           # REST API endpoints
├── reviews.service.ts              # Core business logic
├── review-analytics.service.ts     # Analytics and insights generation
├── reviews.module.ts               # Module configuration
└── reviews.md                      # This documentation
```

### External Dependencies

The module integrates with:

- `EstablishmentsModule` - Merchant/restaurant management
- `OrdersModule` - Order verification for reviews
- `OffersModule` - Offer-specific reviews
- `UsersModule` - Reviewer profiles and permissions
- `EmailModule` - Review notifications
- `LoyaltyModule` - Gamification points for reviews
- `CommonModule` - Shared services (logging, validation, storage)

### Background Processing

Four Bull queues handle asynchronous tasks:

1. **review-processing** - New review validation and AI analysis
   - 3 attempts with exponential backoff (2s delay)
   - Retains last 100 completed, 50 failed jobs

2. **review-analytics** - Analytics computation
   - 2 attempts with exponential backoff (5s delay)
   - Retains last 50 completed, 25 failed jobs

3. **review-moderation** - Content moderation workflows
   - 5 attempts with exponential backoff (3s delay)
   - Retains last 200 completed, 100 failed jobs

4. **notification-processing** - Email/push notifications for reviews
   - 3 attempts with exponential backoff (1s delay)
   - Retains last 50 completed, 25 failed jobs

---

## Data Models

### Review Schema

**Collection:** `reviews`

#### Core Fields

| Field             | Type     | Required | Description                                                    |
| ----------------- | -------- | -------- | -------------------------------------------------------------- |
| `_id`             | ObjectId | Yes      | Unique review identifier                                       |
| `reviewerId`      | ObjectId | Yes      | Reference to User (reviewer)                                   |
| `establishmentId` | ObjectId | Yes      | Reference to Establishment                                     |
| `orderId`         | ObjectId | No       | Reference to Order (if order-based)                            |
| `offerId`         | ObjectId | No       | Reference to Offer                                             |
| `type`            | Enum     | Yes      | `ORDER`, `ESTABLISHMENT`, `OFFER`                              |
| `overallRating`   | Number   | Yes      | 1-5 star rating                                                |
| `comment`         | String   | Yes      | Review text (10-2000 chars)                                    |
| `title`           | String   | No       | Review title (3-100 chars)                                     |
| `images`          | Array    | No       | Up to 10 images (ReviewImages[])                               |
| `status`          | Enum     | Yes      | `PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`, `SPAM`, `HIDDEN` |

#### Detailed Ratings (Optional)

Each rated 1-5:

- `foodQuality` - Quality of food items
- `serviceQuality` - Service experience
- `valueForMoney` - Price vs. value perception
- `packaging` - Packaging quality and presentation
- `pickupExperience` - Pickup process smoothness
- `sustainability` - Environmental impact perception

#### Metrics

```typescript
metrics: {
  helpfulCount: number; // Users who found it helpful
  notHelpfulCount: number; // Users who found it not helpful
  reportCount: number; // Times reported
  viewCount: number; // View impressions
  shareCount: number; // Social shares
}
```

#### Sentiment Analysis (AI-Powered)

```typescript
sentimentAnalysis: {
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  confidence: number;           // 0-1 confidence score
  positiveScore: number;        // 0-1 positivity score
  negativeScore: number;        // 0-1 negativity score
  neutralScore: number;         // 0-1 neutrality score
  keywords: string[];           // Extracted keywords
  language: string;             // Detected language (e.g., 'en')
}
```

#### Moderation Info

```typescript
moderationInfo: {
  isModerated: boolean;
  moderatedBy?: ObjectId;             // Admin who moderated
  moderatedAt?: Date;
  moderationReason?: string;
  autoModerationFlags?: string[];     // Auto-detected issues
  manualModerationRequired?: boolean;
}
```

#### Responses (Merchant/Admin replies)

```typescript
responses: [{
  responseText: string;           // Max 1000 chars
  respondedBy: ObjectId;          // User who responded
  respondedAt: Date;
  isOwnerResponse: boolean;       // True if establishment owner
  lastEditedAt?: Date;
}]
```

#### Metadata

Extensive metadata tracking for analytics and fraud detection (see
`IReviewMetadata` interface in schema):

- Processing info (IP, user agent, device fingerprint)
- Analytics (read time, scroll depth, UTM parameters)
- AI processing results
- Review context (order value, account age)
- Quality scores
- Technical metadata

### Database Indexes

Optimized for common query patterns:

```typescript
// Primary indexes
{ establishmentId: 1, status: 1, createdAt: -1 }
{ reviewerId: 1, createdAt: -1 }
{ orderId: 1 } // sparse
{ offerId: 1 } // sparse
{ overallRating: 1, status: 1 }
{ status: 1, 'moderationInfo.manualModerationRequired': 1 }

// Text search index
{ comment: 'text', title: 'text', 'sentimentAnalysis.keywords': 'text' }

// Composite indexes
{ establishmentId: 1, type: 1, status: 1, overallRating: 1, createdAt: -1 }
```

---

## API Endpoints

Base path: `/api/v1/reviews`

### Public Endpoints

#### GET `/reviews`

Get all reviews with filtering and pagination.

**Query Parameters:**

- `page` (number, default: 1) - Page number
- `limit` (number, default: 10, max: 100) - Items per page
- `status` (ReviewStatus) - Filter by status
- `minRating`, `maxRating` (1-5) - Rating range
- `type` (ReviewType) - Filter by type
- `sentiment` (SentimentType) - Filter by sentiment
- `search` (string) - Full-text search
- `sortBy` (string) - `createdAt`, `overallRating`, `helpfulCount`,
  `engagementScore`
- `sortOrder` (`asc`|`desc`, default: `desc`)
- `establishmentId`, `reviewerId` (ObjectId) - Entity filters
- `verifiedPurchaseOnly`, `recommendedOnly` (boolean) - Feature filters
- `fromDate`, `toDate` (ISO string) - Date range
- `tags` (string, comma-separated) - Tag filters

**Response:**

```json
{
  "success": true,
  "message": "Reviews retrieved successfully",
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "analytics": {
    "averageRating": 4.2,
    "totalReviews": 100
  }
}
```

#### GET `/reviews/:id`

Get specific review by ID. Increments view count.

**Auth:** JWT required (access controlled based on review status)

#### GET `/reviews/establishment/:establishmentId`

Get all approved reviews for an establishment.

**Auth:** Public

#### GET `/reviews/establishment/:establishmentId/summary`

Get aggregated review statistics for an establishment.

**Response includes:**

- Total reviews and average rating
- Rating breakdown (1-5 stars)
- Average detailed ratings
- Sentiment breakdown
- Response rate
- Average helpfulness score

---

### Consumer Endpoints

**Auth:** JWT + `CONSUMER` role required

#### POST `/reviews`

Create a new review.

**Body:** `CreateReviewDto` (multipart/form-data for images)

- Maximum 10 images, 10MB each
- Allowed formats: JPEG, PNG, WebP
- Images uploaded to Firebase Storage under `reviews/` folder

**Validations:**

- Cannot review own establishment
- Cannot duplicate review for same order/establishment
- Order must be completed (`PICKED_UP` status)
- Offer must belong to establishment
- Comment length: 10-2000 characters

**Auto-moderation triggers:**

- Spam detection (URLs, repeated characters, phone numbers)
- Inappropriate content
- Fake review patterns
- Low-quality content (< 20 chars)

**Gamification:** Awards points if order-based review with comment.

#### GET `/reviews/my-reviews`

Get current user's reviews with pagination.

**Query:** `page`, `limit`, `status`

#### PATCH `/reviews/:id`

Update own review (within 30 days for consumers).

**Body:** `UpdateReviewDto` (multipart/form-data)

**Behavior:**

- Re-analyzes sentiment if comment changed
- May require re-moderation
- Sets `isEdited` flag and `lastEditedAt`

#### DELETE `/reviews/:id`

Soft-delete own review.

**Body:** `reason` (optional string)

---

### Merchant Endpoints

**Auth:** JWT + `MERCHANT` role required

#### GET `/reviews/merchant/reviews`

Get all reviews for merchant's establishments.

**Query:** Standard `ReviewQueryDto` parameters

#### POST `/reviews/:id/response`

Add response to a review of merchant's establishment.

**Body:** `ReviewResponseDto` (5-1000 chars)

**Restrictions:** One response per user per review

#### GET `/reviews/analytics`

Get comprehensive analytics for merchant's establishments.

**Query:** `ReviewAnalyticsDto`

- `startDate`, `endDate` (ISO strings)
- `groupBy` (`day`|`week`|`month`|`year`)
- `establishmentId` (optional, auto-selected if only one)

**Returns:**

- Total reviews and average rating
- Rating distribution
- Sentiment distribution
- Review trends over time
- Top keywords
- Engagement metrics

---

### Admin Endpoints

**Auth:** JWT + `ADMIN` role required

#### GET `/reviews/moderation/pending`

Get reviews awaiting moderation.

**Query:** `page`, `limit` (sorted oldest first)

#### GET `/reviews/moderation/flagged`

Get flagged reviews requiring attention.

**Query:** `page`, `limit`

#### PATCH `/reviews/:id/moderate`

Moderate a review (approve/reject/flag/spam/hide).

**Body:** `ReviewModerationDto`

- `status` (ReviewStatus)
- `moderationReason` (optional string)

**Side effects:**

- Updates establishment stats if status changes
- Emits `review.moderated` event

#### POST `/reviews/bulk/moderate`

Bulk moderate multiple reviews.

**Body:** `BulkReviewModerationDto`

- `reviewIds` (1-100 ObjectIds)
- `action` (`approve`|`reject`|`flag`|`spam`)
- `reason` (optional string)

**Returns:** Count of processed and failed reviews

#### GET `/reviews/user/:userId/stats`

Get user review statistics (admin monitoring).

**Returns:**

- Total reviews, average rating
- Verification rate
- Status breakdown
- Monthly activity

---

### Interaction Endpoints

**Auth:** JWT + `CONSUMER` or `MERCHANT` role

#### POST `/reviews/:id/interact`

Mark review as helpful or not helpful.

**Body:** `ReviewInteractionDto`

- `interactionType` (`helpful`|`not_helpful`)

**Behavior:** Removes previous interaction before adding new one

**Rate limit:** Applied via `RateLimitGuard`

#### POST `/reviews/:id/report`

Report a review for violations.

**Body:** `ReviewReportDto`

- `reason` (enum: `spam`, `inappropriate`, `fake`, `offensive`, `irrelevant`,
  `other`)
- `additionalDetails` (optional, max 500 chars)

**Auto-flagging:** Review auto-flagged after 3 reports

**Rate limit:** Applied via `RateLimitGuard`

#### POST `/reviews/:id/share`

Increment share count when review is shared.

**Body:** `platform` (string) - Social platform name

---

### Analytics Endpoints

**Auth:** JWT + `ADMIN` or `MERCHANT` role

#### GET `/reviews/trending/keywords`

Get trending keywords from reviews.

**Query:**

- `establishmentId` (optional)
- `days` (default: 30)

**Returns:** Keywords with count and trend direction (positive/negative/neutral)

---

## Services

### ReviewsService

**File:** `reviews.service.ts`

Core business logic for review CRUD operations.

#### Key Methods

##### `create(createReviewDto, reviewerId)`

Creates a new review with validation and AI analysis.

**Transaction steps:**

1. Validate reviewer, establishment, order, offer
2. Check for duplicates
3. Perform AI sentiment analysis
4. Run auto-moderation
5. Save review
6. Update establishment stats
7. Mark order as rated
8. Emit `review.created` event
9. Award gamification points (non-blocking)

**Returns:** Populated `ReviewDocument`

##### `findAll(queryDto)`

Retrieves reviews with advanced filtering, pagination, and analytics.

Uses MongoDB aggregation for efficient queries.

**Returns:** `{ reviews, total, analytics }`

##### `findOne(id, userId?, userRole?)`

Gets single review with access control.

**Access rules:**

- Approved reviews: Public
- Pending/flagged reviews: Reviewer + establishment owner + admin
- Increments view count

##### `update(id, updateReviewDto, userId, userRole)`

Updates review with re-analysis and moderation.

**Business rules:**

- Consumers: Can edit own reviews within 30 days
- Admins: Can edit any review anytime
- Re-analyzes sentiment if comment changed
- May require re-moderation

##### `addResponse(reviewId, responseDto, userId, userRole)`

Adds merchant/admin response to review.

**Rules:**

- Merchants: Can respond to own establishment reviews
- Admins: Can respond to any review
- One response per user per review

##### `handleInteraction(reviewId, interactionDto, userId)`

Records helpful/not helpful votes.

**Behavior:** Replaces previous vote from same user

##### `reportReview(reviewId, reportDto, userId)`

Records review report and auto-flags after threshold.

**Auto-flagging:** 3+ reports → status changes to `FLAGGED`

##### `moderateReview(reviewId, moderationDto, moderatorId)`

Moderates review (admin only).

**Side effects:**

- Updates establishment stats if status changes
- Emits `review.moderated` event

##### `remove(id, userId, userRole, reason?)`

Soft-deletes review.

**Fields updated:**

- `isDeleted: true`
- `deletedAt`, `deletedBy`, `deletionReason`

##### `getMerchantEstablishments(merchantId)`

Fetches establishments owned by merchant.

##### `getMerchantReviews(establishmentIds, queryDto)`

Retrieves reviews for multiple establishments (merchant dashboard).

##### `getEstablishmentReviewSummary(establishmentId)`

Generates aggregated statistics for establishment.

##### `getUserReviewStats(userId)`

Generates user review statistics (admin tool).

##### `getTrendingKeywords(establishmentId?, days?)`

Extracts trending keywords with sentiment.

##### `incrementShareCount(reviewId, platform)`

Tracks social shares.

#### Private Methods

##### `analyzeReviewContent(comment)`

AI-powered sentiment analysis (mock implementation).

**TODO:** Integrate with real AI services (AWS Comprehend, Google NL, Azure Text
Analytics, OpenAI)

##### `performAutoModeration(reviewData)`

Automated content moderation.

**Checks:**

- Spam patterns (URLs, discount keywords, phone numbers, repeated chars)
- Inappropriate content (configurable word list)
- Fake review indicators (velocity, patterns, geo inconsistencies)
- Low quality (< 20 chars)

**Returns:** `{ requiresManualReview, flags }`

##### `updateEstablishmentStats(establishmentId, session?)`

Recalculates establishment average rating and total reviews.

Only counts `APPROVED` reviews.

##### `incrementViewCount(reviewId)`

Non-blocking view counter increment.

##### `buildReviewAggregationPipeline(filters, skip, limit)`

Constructs MongoDB aggregation pipeline for complex queries.

#### Cron Jobs

##### `@Cron(EVERY_DAY_AT_2AM) cleanupDeletedReviews()`

Permanently deletes soft-deleted reviews older than 30 days.

##### `@Cron(EVERY_DAY_AT_3AM) recalculateEstablishmentRatings()`

Batch recalculates ratings for all active establishments.

##### `@Cron(EVERY_HOUR) processManualModerationQueue()`

Checks for reviews requiring manual moderation and emits alert event.

---

### ReviewAnalyticsService

**File:** `review-analytics.service.ts`

Advanced analytics and insights generation.

#### Key Methods

##### `generateEstablishmentInsights(establishmentId, timeframe?)`

Generates comprehensive insights for establishment.

**Parameters:**

- `establishmentId` - Target establishment
- `timeframe` (default: 90 days) - Analysis period

**Returns:** `ReviewInsights` object with:

- **Overall Metrics**: Total reviews, average rating, growth rate, engagement
  rate
- **Sentiment Analysis**: Distribution, trends over time, keyword analysis
- **Rating Analysis**: Distribution, trends, category breakdown
- **Competitive Analysis**: Industry average, percentile rank, top performers
- **Actionable Insights**: Prioritized recommendations

##### `getEstablishmentBenchmark(establishmentId)`

Compares establishment against industry benchmarks.

**Returns:** `EstablishmentBenchmark` with:

- Metrics (rating, reviews, response rate, sentiment score, engagement)
- Rankings (overall, category, local, percentile)
- Trends (rating, volume, sentiment)

##### `generateIndustryReport(industryType, timeframe?)`

Aggregates industry-wide statistics.

**Industry types:** `restaurant`, `bakery`, `grocery_store`, `cafe`,
`fast_food`, `supermarket`

##### Private Methods

##### `calculateOverallMetrics(establishmentId, startDate)`

Computes current vs. previous period metrics.

##### `analyzeSentimentTrends(establishmentId, startDate)`

Tracks sentiment distribution and keyword impacts over time.

##### `analyzeRatingTrends(establishmentId, startDate)`

Analyzes rating patterns and category performance.

##### `performCompetitiveAnalysis(establishmentId)`

Benchmarks against industry averages and top performers.

##### `generateActionableInsights(establishmentId, analytics)`

AI-driven insight generation with prioritization.

**Insight Types:**

- **Alerts** (high priority) - Critical issues (low rating, declining reviews)
- **Improvements** (medium/high priority) - Areas needing attention
- **Strengths** (medium priority) - Positive aspects to leverage

**Recommendations include:**

- Category-specific improvements (food quality, service, packaging, etc.)
- Response rate optimization
- Engagement strategies

##### `calculateEstablishmentMetrics(establishmentId)`

Computes metrics for benchmarking:

- Response rate and average response time
- Sentiment score (0-100 scale, 50 = neutral)
- Engagement score (weighted: helpful votes 25%, shares 30%, responses 35%,
  views 10%)

##### `analyzeEstablishmentTrends(establishmentId)`

Compares last 30 days vs. previous 30 days.

**Trend indicators:**

- Rating: `up` | `down` | `stable` (±10% threshold)
- Volume: `up` | `down` | `stable` (±5% threshold)
- Sentiment: `improving` | `declining` | `stable` (±5% threshold)

#### Cron Jobs

##### `@Cron(EVERY_DAY_AT_2AM) scheduleAnalyticsUpdates()`

Queues analytics updates for 1000 active establishments (staggered delays).

##### `@Cron(EVERY_WEEK) generateWeeklyReports()`

Queues industry reports for all categories.

##### `@Cron(EVERY_12_HOURS) updateEstablishmentBenchmarks()`

Updates benchmarks for establishments with 5+ reviews (max 500).

---

## Configuration

### Module Configuration (reviews.module.ts)

#### Review Config Provider

```typescript
{
  provide: 'REVIEW_CONFIG',
  useFactory: () => ({
    maxImagesPerReview: 10,
    maxImageSize: 10 * 1024 * 1024,  // 10MB
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
    autoModerationEnabled: true,
    sentimentAnalysisEnabled: true,
    maxReviewsPerDay: 10,
    maxResponsesPerReview: 3,
    reviewEditTimeLimit: 30 * 24 * 60 * 60 * 1000,  // 30 days
    minimumReviewLength: 10,
    maximumReviewLength: 2000,
  })
}
```

#### AI Sentiment Service Provider

Mock implementation - replace with actual AI service integration.

**Recommended services:**

- AWS Comprehend
- Google Cloud Natural Language
- Azure Text Analytics
- OpenAI GPT API

#### Content Moderation Service Provider

Mock implementation - replace with actual moderation APIs.

**Recommended services:**

- AWS Rekognition
- Google Cloud Vision
- Microsoft Azure Content Moderator
- OpenAI Moderation API

---

## Security

### Authentication & Authorization

All endpoints protected by JWT authentication except:

- `GET /reviews` (public)
- `GET /reviews/establishment/:id` (public)
- `GET /reviews/establishment/:id/summary` (public)

### Role-Based Access Control

| Endpoint          | Consumer | Merchant | Admin   |
| ----------------- | -------- | -------- | ------- |
| Create review     | ✓        | ✗        | ✗       |
| Update own review | ✓        | ✗        | ✗       |
| Delete own review | ✓        | ✗        | ✗       |
| Add response      | ✗        | ✓ (own)  | ✓ (all) |
| Moderate review   | ✗        | ✗        | ✓       |
| View analytics    | ✗        | ✓ (own)  | ✓ (all) |

### Input Sanitization

All inputs sanitized via:

- `GlobalSanitizationMiddleware` (XSS prevention)
- `class-validator` decorators in DTOs
- MongoDB query sanitization

### Rate Limiting

Applied to:

- `POST /reviews` - Create review
- `POST /reviews/:id/interact` - Helpful votes
- `POST /reviews/:id/report` - Report review

Via `RateLimitGuard` from `common` module.

### Content Security

- Images validated for type and size
- Firebase Storage with public read, authenticated write
- Review content analyzed for spam, profanity, PII
- Auto-moderation flags suspicious patterns

---

## Testing

### Unit Tests

Test file pattern: `*.spec.ts` alongside source files.

**Coverage areas:**

- Service methods (validation, business logic)
- DTO transformations and validation
- Schema pre/post hooks
- Virtual fields

**Example:**

```bash
pnpm test reviews.service.spec.ts
```

### Integration Tests

Test controller endpoints with mocked dependencies.

**Example:**

```bash
pnpm test reviews.controller.spec.ts
```

### E2E Tests

End-to-end testing of review workflows.

**Test scenarios:**

1. Consumer creates order-based review
2. AI sentiment analysis processes review
3. Auto-moderation flags inappropriate content
4. Admin moderates review
5. Merchant responds to review
6. User marks review as helpful
7. User reports review
8. Establishment stats update

**Run tests:**

```bash
pnpm test:e2e
```

### Manual Testing via Swagger

Swagger UI: `http://localhost:3000/api/v1/api-docs`

Navigate to "Reviews" tag to test endpoints interactively.

---

## Events

The module emits events for real-time features:

| Event                         | Payload                                                        | Listeners                |
| ----------------------------- | -------------------------------------------------------------- | ------------------------ |
| `review.created`              | `{ review, reviewerId, establishmentId }`                      | Notifications, Analytics |
| `review.updated`              | `{ review, userId, changes }`                                  | Notifications            |
| `review.response_added`       | `{ review, response, responderId }`                            | Notifications            |
| `review.interaction`          | `{ reviewId, userId, interactionType }`                        | Analytics                |
| `review.reported`             | `{ reviewId, reporterId, reason, reportCount }`                | Moderation queue         |
| `review.moderated`            | `{ reviewId, moderatorId, previousStatus, newStatus, reason }` | Notifications, Analytics |
| `review.deleted`              | `{ reviewId, deletedBy, reason }`                              | Analytics                |
| `reviews.moderation_required` | `{ count, reviews[] }`                                         | Admin alerts             |

**Usage:**

```typescript
this.eventEmitter.emit('review.created', payload);
```

---

## Monitoring

### Metrics

Track these KPIs:

- Review creation rate (per day/week)
- Average rating by establishment
- Moderation queue size
- Auto-moderation accuracy
- Response rate by merchants
- Engagement metrics (helpful votes, shares)

### Logging

All operations logged via `AppLoggerService` with:

- Correlation IDs for tracing
- Error stack traces
- Performance timing

### Health Checks

Reviews module health checked indirectly via:

- MongoDB connection health
- Redis connection health (queues)
- Queue job processing rates

---

## Known Issues

1. **Mock AI services**: Sentiment analysis and content moderation use
   placeholder logic

---

## Future Enhancements

### Planned Features

1. **Real AI Integration**
   - AWS Comprehend for sentiment analysis
   - Azure Content Moderator for image/text moderation
   - Toxicity scoring
   - Multi-language support

2. **Advanced Analytics**
   - ML-based fake review detection
   - Competitor analysis dashboard
   - Predictive review volume forecasting
   - Sentiment trend alerts

3. **Enhanced User Experience**
   - Review templates for common feedback
   - Photo guidelines and editing tools
   - Review draft auto-save
   - Reward badges for helpful reviewers

4. **Merchant Tools**
   - Review response templates
   - Automated response suggestions (AI)
   - Review sentiment alerts
   - Competitive benchmarking dashboard

5. **Integration Improvements**
   - Social media sharing with Open Graph
   - Review syndication to Google/Yelp
   - WhatsApp/SMS review requests
   - Email digest for new reviews

### Performance Optimizations

1. **Caching Strategy**
   - Redis cache for establishment review summaries (TTL: 1 hour)
   - Cache trending keywords (TTL: 6 hours)
   - Cache industry reports (TTL: 24 hours)

2. **Query Optimization**
   - Add covering indexes for common queries
   - Implement read replicas for analytics queries
   - Use MongoDB views for frequently accessed aggregations

3. **Scalability**
   - Implement sharding on `establishmentId` for large deployments
   - Move image processing to serverless (AWS Lambda / Cloud Functions)
   - Implement CDN caching for review images

---

## API Response Examples

### Create Review

**Request:**

```http
POST /api/v1/reviews
Content-Type: multipart/form-data
Authorization: Bearer <token>

{
  "establishmentId": "507f1f77bcf86cd799439011",
  "orderId": "507f1f77bcf86cd799439012",
  "overallRating": 5,
  "comment": "Amazing food quality! Fresh ingredients and great value. The pickup experience was smooth and staff were friendly.",
  "title": "Outstanding experience!",
  "detailedRatings": {
    "foodQuality": 5,
    "serviceQuality": 5,
    "valueForMoney": 4,
    "packaging": 4,
    "pickupExperience": 5,
    "sustainability": 5
  },
  "isRecommended": true,
  "tags": ["fresh", "healthy", "sustainable"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Review created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439099",
    "reviewerId": {
      "_id": "507f1f77bcf86cd799439001",
      "firstName": "John",
      "lastName": "Doe",
      "avatar": "https://..."
    },
    "establishmentId": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Green Grocer",
      "type": "grocery_store",
      "averageRating": 4.5,
      "totalReviews": 123
    },
    "overallRating": 5,
    "comment": "Amazing food quality! Fresh ingredients...",
    "title": "Outstanding experience!",
    "status": "approved",
    "isVerifiedPurchase": true,
    "sentimentAnalysis": {
      "sentiment": "positive",
      "confidence": 0.92,
      "keywords": ["amazing", "fresh", "great", "smooth", "friendly"]
    },
    "metrics": {
      "helpfulCount": 0,
      "notHelpfulCount": 0,
      "reportCount": 0,
      "viewCount": 0,
      "shareCount": 0
    },
    "createdAt": "2024-08-30T10:00:00.000Z",
    "updatedAt": "2024-08-30T10:00:00.000Z"
  }
}
```

### Get Analytics

**Request:**

```http
GET /api/v1/reviews/analytics?establishmentId=507f1f77bcf86cd799439011&groupBy=week
Authorization: Bearer <merchant_token>
```

**Response:**

```json
{
  "success": true,
  "message": "Analytics retrieved successfully",
  "data": {
    "totalReviews": 145,
    "averageRating": 4.3,
    "ratingDistribution": {
      "rating_1": 2,
      "rating_2": 5,
      "rating_3": 18,
      "rating_4": 45,
      "rating_5": 75
    },
    "sentimentDistribution": {
      "positive": 102,
      "neutral": 28,
      "negative": 15
    },
    "reviewTrends": [
      {
        "date": "2024-W34",
        "count": 12,
        "averageRating": 4.5
      },
      {
        "date": "2024-W35",
        "count": 15,
        "averageRating": 4.2
      }
    ],
    "topKeywords": [
      { "keyword": "fresh", "count": 67 },
      { "keyword": "quality", "count": 54 },
      { "keyword": "value", "count": 42 }
    ],
    "engagementMetrics": {
      "totalViews": 2450,
      "totalHelpfulVotes": 234,
      "totalShares": 45,
      "averageEngagementScore": 18.5
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### Issue: Reviews not appearing after creation

**Cause:** Auto-moderation flagged review as `PENDING` **Solution:** Check
`moderationInfo.autoModerationFlags`. Admin must manually approve.

#### Issue: Establishment stats not updating

**Cause:** MongoDB transaction failed or cron job not running **Solution:**

1. Check logs for transaction errors
2. Manually trigger: `pnpm backend seed:verify-reviews`
3. Verify cron job: `recalculateEstablishmentRatings()`

#### Issue: Images not uploading

**Cause:** Firebase Storage credentials missing or invalid **Solution:**

1. Verify `FIREBASE_STORAGE_BUCKET` in `.env`
2. Check Firebase service account key
3. Verify file size < 10MB and type in allowlist

#### Issue: High memory usage from analytics

**Cause:** Large aggregation pipelines without limits **Solution:**

1. Add pagination to analytics queries
2. Implement result caching with Redis
3. Consider pre-computing daily summaries

#### Issue: Queue jobs failing

**Cause:** Redis connection issues or job timeout **Solution:**

1. Check Redis connection: `redis-cli ping`
2. Increase job timeout in queue config
3. Review failed jobs in Bull dashboard
4. Check queue processors are registered correctly

---

## Support

For questions or issues:

1. Check this documentation
2. Review code comments in source files
3. Check related module docs (orders, establishments, users)
4. Consult main backend `CLAUDE.md`
5. Review NestJS official documentation
6. Check project issue tracker

---

## Changelog

### Current Version

- Full review CRUD with soft delete
- AI-powered sentiment analysis (mock)
- Auto-moderation with configurable rules
- Merchant response capability
- Comprehensive analytics dashboard
- Gamification integration
- Image upload to Firebase Storage
- Real-time event system
- Advanced filtering and pagination
- Competitive benchmarking
- Actionable insights generation

### TODO

- Migrate to real AI services
- Implement review response templates
- Add review photo moderation
- Build merchant analytics dashboard UI
- Implement review syndication
- Add review request automation
- Build review translation feature
- Implement review verification badges

---

**Last Updated:** 2026-01-15 **Maintained by:** Backend Team **Module Status:**
Production-ready (with known typos)
