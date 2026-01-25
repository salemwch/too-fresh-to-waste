# Offer Filtering Implementation

## Summary
Added support for filtering offers by **Establishment Type** and **Cuisine Types** to the backend search functionality.

## The 4 Filtering Dimensions

| Filter | Field | Type | Examples | Status |
|--------|-------|------|----------|--------|
| **1. Offer Categories** | `offer.categories` | `string[]` | "pizza", "bakery", "breakfast" | ✅ Already existed |
| **2. Offer Type** | `offer.type` | `OfferType` enum | "SURPRISE_BAG", "SPECIFIC_ITEMS" | ✅ Already existed |
| **3. Establishment Type** | `establishment.type` | `EstablishmentType` enum | "BAKERY", "RESTAURANT", "HOTEL" | ✅ **ADDED** |
| **4. Cuisine Types** | `establishment.cuisineTypes` | `string[]` | "italian", "asian", "french" | ✅ **ADDED** |

---

## Files Modified

### 1. SearchOffersDto (`apps/food-waste-backend/src/offers/DTO/search-offers.dto.ts`)

**Added imports:**
```typescript
import { EstablishmentType } from '../../common/enums/establishment.enum';
```

**Added filter fields:**
```typescript
@IsOptional()
@IsEnum(EstablishmentType)
establishmentType?: EstablishmentType;

@IsOptional()
@IsArray()
@IsString({ each: true })
cuisineTypes?: string[];
```

### 2. OffersService (`apps/food-waste-backend/src/offers/offers.service.ts`)

**Implementation Strategy:**
- Detects when establishment filters are present
- Uses MongoDB aggregation pipeline to join and filter by establishment fields
- Supports both standalone queries and geolocation queries

**Key Changes:**

1. **Detection Logic** (Line 210):
   ```typescript
   const hasEstablishmentFilters = filters.establishmentType ||
       (filters.cuisineTypes && filters.cuisineTypes.length > 0);
   ```

2. **Aggregation Pipeline for Non-Geolocation Queries** (Lines 231-337):
   - Matches offers first
   - Lookups establishment collection
   - Applies establishment type and cuisine type filters
   - Lookups merchant data
   - Projects required fields
   - Applies sorting and pagination

3. **Geolocation Query Enhancement** (Lines 347-359):
   - Applies establishment filters in `$geoNear` query parameter
   - Filters establishments before looking up offers
   - More efficient than post-filtering

---

## API Usage Examples

### Filter by Establishment Type
```bash
# Get offers from bakeries only
GET /api/offers?establishmentType=BAKERY

# Get offers from hotels
GET /api/offers?establishmentType=HOTEL
```

### Filter by Cuisine Types
```bash
# Get offers from Italian restaurants
GET /api/offers?cuisineTypes=italian

# Get offers from Asian or Mexican cuisine
GET /api/offers?cuisineTypes=asian,mexican
```

### Combined Filters
```bash
# Get surprise bags from Italian restaurants near me
GET /api/offers?type=SURPRISE_BAG&cuisineTypes=italian&longitude=10.1815&latitude=36.8065&maxDistance=5000

# Get bakery offers with pizza category
GET /api/offers?establishmentType=BAKERY&categories=pizza,pastries
```

### All 4 Filters Together
```bash
GET /api/offers?type=SURPRISE_BAG&categories=pizza&establishmentType=RESTAURANT&cuisineTypes=italian
```

---

## Performance Considerations

### Indexes Used

**Existing indexes:**
- `{ type: 1, status: 1 }` - Offer type filtering
- `{ categories: 1, status: 1 }` - Category filtering
- `{ 'address.coordinates': '2dsphere' }` - Geolocation on establishments

**Establishment indexes:**
- `{ type: 1, isActive: 1, averageRating: -1 }` - Type filtering
- Cuisine types use array index on `cuisineTypes` field

### Query Performance

- **No establishment filters**: Uses fast `.find()` query with populate
- **With establishment filters**: Uses aggregation pipeline with $lookup
- **With geolocation + establishment filters**: Filters establishments first in $geoNear, then lookups offers

---

## EstablishmentType Enum Values

```typescript
export enum EstablishmentType {
    RESTAURANT = 'restaurant',
    BAKERY = 'bakery',           // Covers bakeries & pastry shops
    GROCERY_STORE = 'grocery_store',
    CAFE = 'cafe',
    FAST_FOOD = 'fast_food',
    SUPERMARKET = 'supermarket',
    HOTEL = 'hotel',
    OTHER = 'other',
}
```

---

## Testing Checklist

- [ ] Filter by establishment type only
- [ ] Filter by cuisine types only
- [ ] Filter by both establishment type and cuisine types
- [ ] Combine with existing filters (categories, offer type)
- [ ] Test with geolocation queries
- [ ] Test pagination with establishment filters
- [ ] Verify sorting works correctly
- [ ] Test with invalid establishment type (should return 400)
- [ ] Test with empty cuisine types array

---

## Frontend Integration

### TypeScript Types
```typescript
import { EstablishmentType } from '@backend/common/enums/establishment.enum';

interface OfferSearchParams {
  // Existing filters
  categories?: string[];
  type?: 'SURPRISE_BAG' | 'SPECIFIC_ITEMS' | 'MEAL_DEAL';

  // NEW: Establishment filters
  establishmentType?: EstablishmentType;
  cuisineTypes?: string[];

  // Other filters...
  page?: number;
  limit?: number;
}
```

### Example Usage
```typescript
// Search for Italian restaurant surprise bags
const params = {
  type: 'SURPRISE_BAG',
  establishmentType: EstablishmentType.RESTAURANT,
  cuisineTypes: ['italian'],
  page: 1,
  limit: 20
};

const response = await offersService.search(params);
```

---

## Migration Notes

- **Breaking Changes**: None - all new fields are optional
- **Backward Compatibility**: ✅ Fully compatible
- **Database Migration**: Not required - uses existing fields
- **API Version**: No version bump needed

---

## Related Documentation

- Establishment Schema: `apps/food-waste-backend/src/establishments/schemas/establishment.schema.ts`
- Offer Schema: `apps/food-waste-backend/src/offers/schemas/offer.schema.ts`
- Establishment Enums: `apps/food-waste-backend/src/common/enums/establishment.enum.ts`

---

**Implementation Date**: 2026-01-24
**Status**: ✅ Complete
