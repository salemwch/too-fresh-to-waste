# Offers Module Documentation

## Overview

The Offers module is the core business domain of the Too Fresh To Waste
platform. It manages surplus food listings from merchants, enabling them to
reduce food waste by offering discounted items to consumers before expiration.

**Purpose:** Enable merchants to create, manage, and promote time-sensitive food
offers with geolocation, pricing, and availability tracking.

**Key Features:**

- Food offer creation and management with image uploads
- Geolocation-based nearby offer discovery ($geoNear aggregation)
- Auto-featuring system for urgent offers (expiring soon)
- Personalized recommendations based on user favorites
- Quantity reservation and order fulfillment tracking
- Timezone-aware availability windows (Africa/Tunis default)
- Advanced search and filtering with pagination

---

## Architecture

### Module Structure

```
src/offers/
├── offers.controller.ts         # REST API endpoints (22 routes)
├── offers.service.ts            # Business logic and database operations
├── offers.module.ts             # NestJS module configuration
├── config/
│   └── featuring.config.ts      # Auto-featuring system configuration
├── DTO/
│   ├── create-offer.dto.ts      # Request validation for offer creation
│   ├── update-offer.dto.ts      # Partial update validation
│   ├── search-offers.dto.ts     # Advanced filtering and pagination
│   └── offer-list.dto.ts        # Response DTOs for API consumers
├── presenters/
│   └── offer.presenter.ts       # Data transformation layer (Presenter Pattern)
└── schemas/
    └── offer.schema.ts          # MongoDB schema with 25 indexes
```

### Design Patterns

1. **Controller-Service-Repository Pattern**
   - Controller: HTTP layer, validation, authorization
   - Service: Business logic, transaction management
   - Repository: Mongoose models for data access

2. **Presenter Pattern** (`OfferPresenter`)
   - Separates data transformation from business logic
   - Removes PII and internal metrics before API responses
   - Calculates CTA states (AVAILABLE, LOW_STOCK, SOLD_OUT)

3. **CQRS-lite** (Command Query Separation)
   - Write operations: `create`, `update`, `reserveQuantity`
   - Read operations: `findAll`, `getFeaturedOffers`, `getNearbyOffers`
   - Optimized with separate indexes for each query pattern

---

## Database Schema

### Core Fields

```typescript
{
  // Identification
  _id: ObjectId
  title: string (5-100 chars, required)
  description: string (max 1000 chars, required)

  // Relationships
  establishmentId: ObjectId (ref: Establishment, required)
  merchantId: ObjectId (ref: User, required)

  // Classification
  type: OfferType (surprise_bag | specific_items | meal_deal)
  status: OfferStatus (draft | active | sold_out | expired | cancelled | suspended)
  categories: string[] (bakery, restaurant, grocery, etc.)
  tags: string[] (vegan, gluten-free, etc.)

  // Pricing (TND currency enforced)
  pricing: {
    originalPrice: number (min: 0)
    discountedPrice: number (min: 0)
    discountPercentage: number (50-90%, backend-calculated)
    currency: Currency.TND (system-enforced)
  }

  // Inventory
  totalQuantity: number (1-1000, required)
  reservedQuantity: number (default: 0)
  soldQuantity: number (default: 0)

  // Media
  images: string[] (up to 5 images, local storage)

  // Availability (Timezone-aware)
  availableFrom: Date (UTC, required)
  availableUntil: Date (UTC, required)
  cancellationDeadline: Date (UTC, default: availableFrom - 2 hours)

  // Pickup Logistics
  pickupTimeSlots: [{
    startTime: string (HH:MM format)
    endTime: string (HH:MM format)
    maxOrders: number (min: 1)
    currentOrders: number (default: 0)
  }]

  // Featuring System (Hybrid Manual + Auto)
  isFeaturedManual: boolean (admin-controlled, default: false)
  isFeaturedAuto: boolean (cron-managed, default: false)
  featuredAt: Date (audit trail)
  featuredBy: ObjectId (ref: User, only for manual featuring)

  // Metrics
  viewCount: number (default: 0)
  favoriteCount: number (default: 0)

  // Optional Features
  nutritionalInfo: {
    calories: number
    protein: number
    carbs: number
    fat: number
    allergens: string[]
    dietaryInfo: string[] (vegetarian, vegan, gluten-free)
  }
  estimatedWeight: string (e.g., "500g")
  specialInstructions: string (max 500 chars)

  // Recurring Offers
  isRecurring: boolean (default: false)
  recurringDays: {
    monday: boolean
    tuesday: boolean
    // ... all days
  }

  // Lifecycle Management
  isActive: boolean (default: true)
  publishedAt: Date
  expiredAt: Date
  lastModifiedBy: ObjectId (ref: User)

  // Soft Delete
  isDeleted: boolean (default: false)
  deletedAt: Date
  deletedBy: string (userId)
  deletionReason: string

  // Timestamps
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### Virtual Fields

Computed on-the-fly (not stored in database):

```typescript
availableQuantity: number; // totalQuantity - reservedQuantity - soldQuantity
isExpired: boolean; // new Date() > availableUntil
isSoldOut: boolean; // availableQuantity <= 0
isFeatured: boolean; // isFeaturedManual || isFeaturedAuto
```

### Database Indexes (25 Total)

**Performance Indexes:**

- `{ establishmentId: 1, status: 1 }` - Establishment offer management
- `{ merchantId: 1, status: 1 }` - Merchant portfolio queries
- `{ status: 1, availableFrom: 1, availableUntil: 1 }` - Time-based filtering
- `{ categories: 1, status: 1 }` - Category browsing
- `{ isFeaturedManual: 1, status: 1 }` - Featured offers (manual)
- `{ isFeaturedAuto: 1, status: 1 }` - Featured offers (auto)
- `{ status: 1, createdAt: 1, availableUntil: 1, isFeaturedAuto: 1 }` -
  Auto-featuring cron optimization
- `{ title: 'text', description: 'text' }` - Full-text search
- `{ 'pricing.discountPercentage': -1, status: 1 }` - Discount range filtering
- `{ 'pricing.discountedPrice': 1, status: 1 }` - Price range filtering

**Enterprise Indexes (Production Readiness):**

- `{ status: 1, isFeaturedManual: 1, availableFrom: 1, createdAt: -1 }` -
  Homepage featured section
- `{ type: 1, status: 1, createdAt: -1 }` - Type-based discovery
- `{ viewCount: -1, favoriteCount: -1, status: 1 }` - Popularity sorting
- `{ 'nutritionalInfo.dietaryInfo': 1, status: 1 }` - Dietary filtering
- `{ 'nutritionalInfo.allergens': 1, status: 1 }` - Allergen filtering
- `{ isDeleted: 1, deletedAt: 1 }` - Soft delete recovery (sparse)

**See `offer.schema.ts:243-462` for complete index list with query patterns.**

---

## API Endpoints

Base path: `/api/v1/offers`

### Public Endpoints (No Auth Required)

#### `GET /offers`

List all active offers with advanced filtering and pagination.

**Query Parameters:**

```typescript
{
  // Pagination
  page?: number = 1           // Page number (1-indexed)
  limit?: number = 12          // Items per page (max: 100)

  // Search & Filters
  search?: string              // Full-text search (title + description)
  type?: OfferType            // surprise_bag | specific_items | meal_deal
  status?: OfferStatus        // active | expired | draft (admin/merchant only)
  categories?: string[]        // Filter by categories
  tags?: string[]              // Filter by tags
  isFeatured?: boolean         // Featured offers only

  // Geolocation
  longitude?: number           // User longitude (-180 to 180)
  latitude?: number            // User latitude (-90 to 90)
  maxDistance?: number = 5000  // Search radius in meters (100-50000)

  // Price Filtering
  minPrice?: number            // Minimum discounted price
  maxPrice?: number            // Maximum discounted price
  minDiscount?: number         // Minimum discount percentage (50-90)

  // Sorting
  sortBy?: OfferSortField      // createdAt | price | discount | expiry
  sortOrder?: 'asc' | 'desc'   // Sort direction

  // Admin/Merchant Filters
  establishmentId?: string     // Filter by establishment
  merchantId?: string          // Filter by merchant
}
```

**Response:**

```typescript
{
  message: string
  data: OfferCardDto[]         // Sanitized offer cards (see OfferPresenter)
  meta: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

**Business Logic:**

- Public queries: Only returns `ACTIVE` offers within availability window
  (`availableFrom <= now <= availableUntil`)
- Admin/merchant queries: Can see all statuses via `status` and `merchantId`
  filters
- Geolocation: Uses MongoDB `$geoNear` aggregation on establishments collection
- Distance calculation: Haversine formula for geodesic distance
- Security: Time-based filtering enforced by backend (users cannot manipulate
  "now")

**Performance:**

- Field projection: Only fetches required fields (60% payload reduction)
- `.lean()` queries: 50% memory reduction
- DoS protection: Max page size = 100

---

#### `GET /offers/featured`

Get featured offers (manually or auto-featured).

**Query Parameters:**

```typescript
{
  limit?: number = 10          // Max items (max: 100)
  longitude?: number           // User location (optional)
  latitude?: number            // User location (optional)
}
```

**Featuring Logic:**

- Returns offers where `isFeaturedManual = true` OR `isFeaturedAuto = true`
- Filters: `status: ACTIVE`, `availableFrom <= now`, `availableUntil >= now`
- Sorted by `createdAt DESC` (newest first)
- Calculates distance if user location provided

**Response:** Same structure as `GET /offers`

---

#### `GET /offers/nearby`

Get nearby offers within radius (geolocation-based).

**Query Parameters:**

```typescript
{
  longitude: number            // Required
  latitude: number             // Required
  maxDistance?: number = 5000  // Search radius in meters (default: 5km)
  limit?: number = 20          // Max items (max: 100)
}
```

**Technical Details:**

- Uses MongoDB `$geoNear` aggregation (MUST be first stage in pipeline)
- Queries `establishments` collection (has 2dsphere index on
  `address.coordinates`)
- Joins with `offers` collection via `$lookup`
- Returns distance field in meters
- Sorted by distance (nearest first)

**Response:** Offers with `distance` field included

---

#### `GET /offers/:id`

Get single offer by ID with full details.

**Response:**

```typescript
{
  message: string;
  data: OfferDocument; // Full offer with populated establishment + merchant
}
```

**Side Effects:**

- Increments `viewCount` by 1 (atomic operation)

**Populated Fields:**

- `establishmentId`: name, address, type, averageRating, phoneNumber, email
- `merchantId`: firstName, lastName, email, phoneNumber, profileImage

---

#### `GET /offers/establishment/:establishmentId`

Get all offers for a specific establishment.

**Query Parameters:** Same pagination as `GET /offers`

**Use Case:** Establishment detail page showing all available offers

---

### Protected Endpoints (Authentication Required)

#### `POST /offers` (Merchant Only)

Create new food offer with optional image uploads.

**Guards:** `JwtAuthGuard`, `RolesGuard` (MERCHANT role required)

**Content-Type:** `multipart/form-data` (supports file uploads)

**Body:** `CreateOfferDto` (see DTO section)

**Files:** `images` field (up to 5 images, processed via `LocalStorageService`)

**Image Processing:**

- Max width: 800px
- Max height: 600px
- Quality: 80%
- Format: JPEG

**Business Rules:**

1. `availableFrom` cannot be in the past
2. `availableUntil` must be after `availableFrom`
3. Discount must be 50-90% (backend-calculated)
4. Currency is always TND (system-enforced)
5. Pickup slot validation: `startTime < endTime`, `maxOrders >= 1`
6. Total slot capacity cannot exceed `totalQuantity`

**Timezone Handling:**

- User provides local time (e.g., 23:20 Tunisia)
- Backend converts to UTC using `TimezoneUtil.toUTC(date, 'Africa/Tunis')`
- Database stores UTC timestamps

**Response:**

```typescript
{
  message: 'Offer created successfully';
  data: OfferDocument;
}
```

---

#### `PATCH /offers/:id` (Merchant/Admin)

Update existing offer with optional new images.

**Guards:** `JwtAuthGuard`

**Authorization:**

- Merchants: Can only update own offers (checked via `merchantId`)
- Admins: Can update any offer

**Restrictions:**

- Cannot update offers with active reservations (merchants only)
- New images are ADDED to existing images (not replaced)

**Response:** Updated offer document

---

#### `PATCH /offers/:id/status` (Merchant/Admin)

Update offer status.

**Guards:** `JwtAuthGuard`, `RolesGuard` (MERCHANT or ADMIN)

**Merchant Restrictions:**

- Can only set: `ACTIVE`, `DRAFT`, `CANCELLED`
- Cannot set: `EXPIRED`, `SOLD_OUT`, `SUSPENDED` (system/admin-managed)

**Admin Permissions:** Can set any status

**Side Effects:**

- Status → ACTIVE: Sets `publishedAt = now`

---

#### `PATCH /offers/:id/reserve`

Reserve quantity for an order (atomic operation).

**Guards:** `JwtAuthGuard`

**Body:**

```typescript
{
  quantity: number; // Must be > 0
}
```

**Atomic Validation:**

- Offer must be ACTIVE
- `availableUntil` must be in the future (not expired)
- Available quantity must be >= requested quantity
- Formula: `availableQuantity = totalQuantity - reservedQuantity - soldQuantity`

**Response:**

```typescript
{
  message: string;
  data: {
    offer: OfferDocument;
    reservedQuantity: number;
    soldQuantity: number;
  }
}
```

**Error Cases:**

- `NotFoundException`: Offer not found
- `BadRequestException`: Not enough quantity, offer expired, or not active

---

#### `PATCH /offers/:id/confirm-sale` (Merchant/Admin)

Convert reserved quantity to sold quantity.

**Guards:** `JwtAuthGuard`, `RolesGuard` (MERCHANT or ADMIN)

**Body:**

```typescript
{
  quantity: number; // Must be > 0 and <= reservedQuantity
}
```

**Atomic Operation:**

```typescript
{
  $inc: {
    reservedQuantity: -quantity,
    soldQuantity: quantity
  }
}
```

**Use Case:** Merchant confirms customer pickup → converts reservation to sale

---

#### `PATCH /offers/:id/cancel-reservation`

Cancel quantity reservation (returns to available pool).

**Guards:** `JwtAuthGuard`

**Body:**

```typescript
{
  quantity: number;
}
```

**Use Case:** Customer cancels order before pickup → frees reserved quantity

---

#### `GET /offers/recommended` (Authenticated Users)

Get personalized offer recommendations.

**Guards:** `JwtAuthGuard`

**Query Parameters:**

```typescript
{
  limit?: number = 20          // Max items (max: 100)
}
```

**Recommendation Algorithm (MVP):**

1. **Fetch User Favorites:**
   - Query `favorites` collection for active favorites
   - Extract `favoritedEstablishments` (type: establishment)
   - Extract `favoritedCategories` (type: category)

2. **Fallback:**
   - If no favorites exist → return featured offers

3. **Hard Filters (CRITICAL):**
   - `status: ACTIVE`
   - `availableFrom <= now` (offer started)
   - `availableUntil >= now` (not expired)
   - `availableQuantity > 0` (not sold out)
   - Matches favorited establishments OR categories

4. **Ranking:**
   - Priority 1: Offers from favorited establishments
   - Priority 2: Offers in favorited categories
   - Discount percentage DESC (highest first)
   - Urgency ASC (expiring soon first)
   - Created at DESC (newest tie-breaker)

**Security:**

- Uses stable `categoryId`/slug matching (not `itemName`)
- De-duplicates offers matching both establishment + category

**Response:** Array of personalized offers

---

#### `GET /offers/my-offers` (Merchant Only)

Get merchant's own offers across all establishments.

**Guards:** `JwtAuthGuard`, `RolesGuard` (MERCHANT)

**Query Parameters:** Pagination (`page`, `limit`)

**Response:** Paginated list of merchant's offers

---

### Admin-Only Endpoints

#### `PATCH /offers/:id/feature` (Admin Only)

Manually feature an offer.

**Guards:** `JwtAuthGuard`, `RolesGuard` (ADMIN)

**Side Effects:**

- Sets `isFeaturedManual = true`
- Sets `featuredAt = now`
- Sets `featuredBy = admin user ID`

**Note:** Does not affect auto-featuring logic (`isFeaturedAuto` independent)

---

#### `PATCH /offers/:id/unfeature` (Admin Only)

Manually unfeature an offer.

**Guards:** `JwtAuthGuard`, `RolesGuard` (ADMIN)

**Side Effects:**

- Sets `isFeaturedManual = false`
- Clears `featuredAt` and `featuredBy`

**Note:** Auto-featured offers can still remain featured via `isFeaturedAuto`

---

#### `POST /offers/admin/trigger-auto-featuring` (Admin Only)

Manually trigger auto-featuring logic (bypasses cron schedule).

**Guards:** `JwtAuthGuard`, `RolesGuard` (ADMIN)

**Use Case:** Testing and debugging auto-featuring without waiting for cron

**Response:**

```typescript
{
  message: string;
  data: {
    offersAutoFeatured: number;
    offersAutoUnfeatured: number;
    timestamp: string;
  }
}
```

---

#### `GET /offers/expiring` (Admin Only)

Get offers expiring within time threshold.

**Guards:** `JwtAuthGuard`, `RolesGuard` (ADMIN)

**Query Parameters:**

```typescript
{
  hours?: number = 24          // Hours until expiry
}
```

**Use Case:** Admin dashboard for monitoring expiring offers

---

#### `PUT /offers/update-expired` (Admin Only)

Bulk update expired offers status.

**Guards:** `JwtAuthGuard`, `RolesGuard` (ADMIN)

**Operation:**

```typescript
{
  status: ACTIVE,
  availableUntil: { $lt: now }
} → {
  status: EXPIRED,
  expiredAt: now
}
```

**Response:** Number of updated offers

---

#### `DELETE /offers/:id` (Merchant/Admin)

Soft delete offer.

**Guards:** `JwtAuthGuard`

**Authorization:**

- Merchants: Can only delete own offers
- Admins: Can delete any offer

**Restrictions:**

- Cannot delete offers with active reservations (`reservedQuantity > 0`)

**Soft Delete Fields:**

```typescript
{
  isDeleted: true,
  deletedAt: new Date(),
  deletedBy: userId,
  deletionReason: string,
  status: CANCELLED,
  isActive: false
}
```

**Rationale:** Soft delete prevents referential integrity issues with active
orders

---

## Auto-Featuring System

### Overview

The auto-featuring system automatically promotes urgent offers to featured
status when they are expiring soon. This increases visibility and reduces food
waste.

**Configuration File:** `src/offers/config/featuring.config.ts`

### Hybrid Featuring Model

**Two Independent Flags:**

1. **`isFeaturedManual` (Admin-Controlled)**
   - Set by admins via `PATCH /offers/:id/feature`
   - Persists until admin explicitly removes it
   - Tracks `featuredBy` (admin user ID) and `featuredAt`

2. **`isFeaturedAuto` (Cron-Managed)**
   - Set automatically by cron job every 1 minute
   - Based on urgency criteria (see below)
   - Automatically unfeatured when criteria no longer met

**Virtual Field: `isFeatured = isFeaturedManual || isFeaturedAuto`**

### Auto-Featuring Criteria

**Eligible Offers:**

1. **Status:** `ACTIVE`
2. **Existence:** Offer created at least **30 minutes ago** (configurable via
   `MIN_EXISTENCE_HOURS`)
3. **Urgency:** Offer expires in **3 hours or less** (configurable via
   `URGENCY_THRESHOLD_HOURS`)
4. **Availability:** `availableQuantity > 0` (not sold out)

**Formula:**

```typescript
createdAt <= now - MIN_EXISTENCE_MS &&
  availableUntil <= now + URGENCY_THRESHOLD_MS &&
  availableUntil >= now &&
  status === ACTIVE &&
  availableQuantity > 0;
```

### Auto-Unfeaturing Criteria

**Ineligible Offers (Auto-Unfeatured):**

1. Status is not `ACTIVE`
2. Offer has expired (`availableUntil <= now`)
3. Offer is no longer urgent (`availableUntil > now + URGENCY_THRESHOLD_MS`)

**Important:** Auto-unfeaturing does NOT touch manually featured offers
(`isFeaturedManual = true`)

### Cron Jobs

**Auto-Featuring Job:**

```typescript
@Cron('*/1 * * * *')  // Every 1 minute
async handleAutoFeaturing() {
  const featured = await this.autoFeatureEligibleOffers();
  const unfeatured = await this.autoUnfeatureIneligibleOffers();
}
```

**Expiration Job:**

```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async handleUpdateExpired() {
  const updated = await this.updateExpiredOffers();
}
```

### Configuration

**Environment Variables:**

```bash
# Minimum existence time before auto-featuring (hours)
AUTO_FEATURE_MIN_EXISTENCE_HOURS=0.5  # Default: 30 minutes

# Urgency threshold for auto-featuring (hours)
AUTO_FEATURE_URGENCY_HOURS=3          # Default: 3 hours

# Cron schedule (cron syntax)
AUTO_FEATURE_CRON_SCHEDULE='*/1 * * * *'  # Default: every 1 minute

# Enable/disable auto-featuring
AUTO_FEATURE_ENABLED=true             # Default: true
```

**Validation:**

- `MIN_EXISTENCE_HOURS` must be 0-24
- `URGENCY_THRESHOLD_HOURS` must be 0-24

### Performance Optimization

**Dedicated Index for Cron Job:**

```typescript
OfferSchema.index({
  status: 1,
  createdAt: 1,
  availableUntil: 1,
  isFeaturedAuto: 1,
});
```

This compound index covers all fields in the auto-featuring query, enabling fast
cron execution.

---

## Security Features

### Input Validation & Sanitization

1. **GlobalSanitizationMiddleware**
   - Strips HTML tags from all string inputs (XSS prevention)
   - Applied globally via `app.module.ts`

2. **ValidationPipe**
   - `class-validator` decorators on all DTOs
   - `whitelist: true` (strips unknown properties)
   - `transform: true` (type coercion)

3. **Backend-Calculated Fields**
   - `discountPercentage`: Backend calculates from prices (users cannot
     manipulate)
   - `currency`: System-enforced as TND (users cannot set)

### Authorization & Access Control

**Role-Based Access Control (RBAC):**

| Endpoint                    | Roles Allowed   | Ownership Check            |
| --------------------------- | --------------- | -------------------------- |
| `POST /offers`              | MERCHANT        | N/A                        |
| `PATCH /offers/:id`         | MERCHANT, ADMIN | Merchant: Own offers only  |
| `PATCH /offers/:id/status`  | MERCHANT, ADMIN | Merchant: Limited statuses |
| `DELETE /offers/:id`        | MERCHANT, ADMIN | Merchant: Own offers only  |
| `PATCH /offers/:id/feature` | ADMIN           | N/A                        |
| `GET /offers/expiring`      | ADMIN           | N/A                        |

**Guards Chain:**

```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MERCHANT)
```

### Time-Based Security

**Backend-Enforced Time Filtering:**

- Public queries: Only shows offers within availability window
  (`availableFrom <= now <= availableUntil`)
- Users cannot manipulate "now" to see future or past offers
- Timezone conversion: User local time → UTC storage

### Data Privacy

**OfferPresenter Sanitization:**

- Removes merchant PII (email, phone)
- Removes internal metrics (`soldQuantity`, `reservedQuantity` exposed as
  `availableQuantity`)
- Only exposes establishment name (not full address for merchant privacy)

### Atomic Operations

**Race Condition Prevention:**

- `reserveQuantity`: Atomic `findOneAndUpdate` with availability check
- `confirmSale`: Atomic `$inc` operations for quantity adjustments

### Soft Delete

**Referential Integrity:**

- Offers are soft-deleted (not hard-deleted)
- Prevents breaking references in `orders` and `reservations` collections
- Query middleware auto-filters deleted offers (`isDeleted: { $ne: true }`)

---

## Business Rules

### Pricing Rules

1. **Discount Range:** 50-90% (enforced by backend)
2. **Currency:** Always TND (system-enforced)
3. **Calculation:**
   `discountPercentage = round(((originalPrice - discountedPrice) / originalPrice) * 100)`
4. **Validation:** `discountedPrice < originalPrice`

**Rationale:** 50-90% range ensures legitimacy of food waste reduction (prevents
abuse)

### Quantity Management

1. **Available Quantity Formula:**

   ```typescript
   availableQuantity = totalQuantity - reservedQuantity - soldQuantity;
   ```

2. **Status Auto-Update:**
   - `availableQuantity <= 0` → `status: SOLD_OUT`
   - `availableQuantity > 0` and `status: SOLD_OUT` → `status: ACTIVE`
   - `now > availableUntil` → `status: EXPIRED`

3. **Pickup Slot Validation:**
   - `sum(pickupTimeSlots[].maxOrders) <= totalQuantity`
   - Prevents overbooking scenarios

### Timezone Handling

**Storage:** All dates stored in UTC

**Conversion:**

```typescript
// User input: Local time (e.g., 23:20 Tunisia)
const availableFrom = TimezoneUtil.toUTC(dto.availableFrom, 'Africa/Tunis');

// API response: UTC timestamp (frontend converts to user's timezone)
```

**Default Timezone:** `Africa/Tunis` (Tunisia)

**Configurable:** Via `timezone` field in `CreateOfferDto`

---

## Performance Optimizations

### Query Optimization

1. **Field Projection** (`OFFER_LIST_FIELDS`)
   - Only fetches required fields for list views
   - Reduces payload size by 60%
   - Defined in `src/common/utils/query-optimization.util.ts`

2. **Lean Queries** (`.lean()`)
   - Returns plain JavaScript objects (not Mongoose documents)
   - 50% memory reduction
   - Used for read-only operations

3. **Pagination** (DoS Protection)
   - Max page size: 100
   - Default: 10-20 items
   - Enforced in service layer: `Math.min(limit, 100)`

### Geolocation Performance

**Challenge:** MongoDB `$geoNear` must be the first aggregation stage

**Solution:**

1. Query `establishments` collection (has 2dsphere index)
2. Use `$lookup` to join with `offers` collection
3. Filter offers within the `$lookup` pipeline

**Index:**

```typescript
establishments.index({ 'address.coordinates': '2dsphere' });
```

### Caching Strategy (Future Enhancement)

**Recommended:**

- Cache featured offers (Redis, 1-minute TTL)
- Cache popular searches (Redis, 5-minute TTL)
- Invalidate on offer status change

---

## Testing

### Unit Tests

**Test Files:** `offers.service.spec.ts`, `offers.controller.spec.ts`

**Key Test Cases:**

1. Offer creation with valid/invalid data
2. Discount calculation and validation
3. Quantity reservation (atomic operations)
4. Auto-featuring eligibility logic
5. Timezone conversion
6. OfferPresenter sanitization

**Run:**

```bash
pnpm test:unit
```

### Integration Tests

**Test File:** `offers.controller.integration.spec.ts`

**Scenarios:**

1. End-to-end offer creation flow with image uploads
2. Geolocation queries with mock establishments
3. Personalized recommendations with mock favorites
4. Role-based access control (RBAC)

**Run:**

```bash
pnpm test:integration
```

### E2E Tests

**Test File:** `test/offers.e2e-spec.ts`

**Scenarios:**

1. Public API: List offers, nearby offers, featured offers
2. Merchant API: Create, update, delete offers
3. Admin API: Manual featuring, trigger auto-featuring

**Run:**

```bash
pnpm test:e2e
```

---

## Migration & Maintenance

### Schema Migrations

**Index Verification:**

```bash
pnpm verify:indexes
```

Checks all indexes in `offer.schema.ts` against MongoDB.

**Adding New Indexes:**

1. Add index in `offer.schema.ts`
2. Run `pnpm verify:indexes` to create in database
3. Monitor index creation with `db.currentOp()` (long-running)

### Data Cleanup Scripts

**Expire Old Offers:**

```bash
node scripts/expire-old-offers.js
```

**Fix Offer Images (Bulk Update):**

```bash
node scripts/fix-offer-images.js
```

---

## Known Issues & Future Improvements

### Known Issues

1. No known issues affecting offers module functionality.

2. **Image Storage:**
   - Currently uses local storage (`LocalStorageService`)
   - TODO: Migrate to CDN (Cloudflare R2 or AWS S3) for scalability

### Future Enhancements

1. **Redis Caching:**
   - Cache featured offers (1-minute TTL)
   - Cache geolocation queries (5-minute TTL)

2. **Real-Time Updates:**
   - WebSocket notifications for offer status changes
   - Push notifications for nearby new offers

3. **Advanced Recommendations:**
   - Machine learning-based personalization
   - Collaborative filtering (users who liked X also liked Y)

4. **Analytics:**
   - Track conversion rate (views → reservations → sales)
   - Merchant dashboard with performance metrics

5. **Batch Operations:**
   - Bulk offer creation for recurring items
   - CSV import for large merchants

6. **Elastic Search Integration:**
   - Replace MongoDB full-text search
   - Better relevance scoring and fuzzy matching

---

## Related Modules

### Dependencies

- **EstablishmentsModule:** Geolocation data for nearby offers
- **FavoritesModule:** Personalized recommendations
- **UsersModule:** Merchant and admin roles
- **CommonModule:** `LocalStorageService`, `AppLoggerService`, `TimezoneUtil`

### Dependents

- **OrdersModule:** Creates orders from offers
- **PaymentsModule:** Processes payments for offer purchases
- **NotificationsModule:** Sends notifications for offer updates
- **AnalyticsModule:** Tracks offer performance metrics

---

## API Versioning

**Current Version:** `/api/v1/offers`

**Swagger Documentation:**
`http://localhost:3000/api/v1/api-docs#/🎯%20Offers%20Management`

---

## Contact & Support

**Module Owner:** Backend Team

**Slack Channel:** `#backend-offers`

**Related Documentation:**

- [Establishments Module](../establishments/establishment.md)
- [Favorites Module](../favorites/favorites.md)
- [Analytics Module](../analytics/analytics.md)

---

**Last Updated:** 2026-01-15

**Version:** 1.0.0
