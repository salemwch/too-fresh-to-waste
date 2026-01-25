# Pickup Categorization Update

## Summary
Updated the pickup categorization system from automatic time-based logic to merchant-controlled categorization. This gives merchants full control over which sections their offers appear in on the mobile app.

## Changes Made

### 1. Schema Updates (offer.schema.ts)
**Added Fields:**
- `isPickupToday: boolean` - Merchant sets this to show offer in "Pickup Today" section
- `isPickupTomorrow: boolean` - Merchant sets this to show offer in "Pickup Tomorrow" section

**Added Indexes:**
```typescript
OfferSchema.index({ isPickupToday: 1, status: 1 });
OfferSchema.index({ isPickupTomorrow: 1, status: 1 });
```

### 2. Service Logic Updates (offers.service.ts)

**Before (Time-Based):**
```typescript
const query = {
    status: OfferStatus.ACTIVE,
    isActive: true,
    // Pickup window overlaps with today
    availableFrom: { $lte: endOfToday },
    availableUntil: { $gte: startOfToday },
};
```

**After (Merchant-Controlled):**
```typescript
const query = {
    status: OfferStatus.ACTIVE,
    isActive: true,
    isPickupToday: true,  // Set by merchant
};
```

**Added Merchant Population:**
Both `getPickupTodayOffers()` and `getPickupTomorrowOffers()` now populate merchant data:
```typescript
.populate('merchantId', 'firstName lastName profileImage')
```

### 3. Controller Updates (offers.controller.ts)
Updated both pickup endpoints to use aggregation-aware distance logic (checks for pre-calculated distance from aggregation pipeline before manual calculation).

### 4. Field Consistency
All four home screen sections now return the same complete offer data:
- ✅ Urgent Deals (Featured Offers)
- ✅ Hottest Deals (minDiscount=70%)
- ✅ Pickup Today (isPickupToday=true)
- ✅ Pickup Tomorrow (isPickupTomorrow=true)

**Complete Fields:**
- `establishment.name` - Actual establishment name
- `establishment.averageRating` - Rating (0-5)
- `establishment.profileImage` - Merchant logo
- `distance` - Distance in meters (when lat/lng provided)
- `pickupTimeSlots` - Array of time slots with start/end times

### 5. DTO Updates
**OfferCardDto (offer-list.dto.ts):**
```typescript
@IsOptional()
@IsBoolean()
isPickupToday?: boolean;

@IsOptional()
@IsBoolean()
isPickupTomorrow?: boolean;
```

**CreateOfferDto (create-offer.dto.ts):**
```typescript
@IsOptional()
@IsBoolean()
@Transform(({ value }) => {
    if (typeof value === 'string') return value === 'true';
    return value;
})
isPickupToday?: boolean = false;

@IsOptional()
@IsBoolean()
@Transform(({ value }) => {
    if (typeof value === 'string') return value === 'true';
    return value;
})
isPickupTomorrow?: boolean = false;
```

### 6. Presenter Updates (offer.presenter.ts)
Updated `toCardDto()` to include pickup categorization fields in the response.

## How Merchants Use This

### Creating Offers
When creating an offer via POST `/api/v1/offers`, merchants can now include:

```json
{
  "title": "Surprise Bag",
  "description": "...",
  "isPickupToday": true,
  "isPickupTomorrow": false,
  // ... other fields
}
```

### Updating Offers
Merchants can update these flags via PATCH `/api/v1/offers/:id`:

```json
{
  "isPickupToday": false,
  "isPickupTomorrow": true
}
```

## Migration Notes

**Existing Offers:**
All existing offers will have `isPickupToday: false` and `isPickupTomorrow: false` by default. Merchants will need to manually update their offers to appear in these sections.

**No Breaking Changes:**
The fields are optional with default values, so existing API clients continue to work without modification.

## Testing

### Backend Endpoints
```bash
# Test Pickup Today (should return empty until merchants set flags)
curl http://localhost:3000/api/v1/offers/pickup-today?latitude=36.8065&longitude=10.1815

# Test Pickup Tomorrow (should return empty until merchants set flags)
curl http://localhost:3000/api/v1/offers/pickup-tomorrow?latitude=36.8065&longitude=10.1815
```

### Setting Test Data
```javascript
// Update an existing offer to appear in Pickup Today
db.offers.updateOne(
  { _id: ObjectId("OFFER_ID_HERE") },
  { $set: { isPickupToday: true } }
)
```

## Benefits

1. **Merchant Control**: Merchants decide which sections their offers appear in
2. **No Time Logic Bugs**: Eliminates timezone and date calculation issues
3. **Flexibility**: Offers can appear in both sections if needed
4. **Performance**: Simple boolean queries are faster than date range queries
5. **Consistency**: All home screen sections now return identical offer data structures

## Files Changed

### Backend
- `apps/food-waste-backend/src/offers/schemas/offer.schema.ts`
- `apps/food-waste-backend/src/offers/offers.service.ts`
- `apps/food-waste-backend/src/offers/offers.controller.ts`
- `apps/food-waste-backend/src/offers/presenters/offer.presenter.ts`
- `apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts`
- `apps/food-waste-backend/src/offers/DTO/create-offer.dto.ts`
- `apps/food-waste-backend/src/common/utils/query-optimization.util.ts`

### Documentation
- `docs/pickup-categorization-update.md` (this file)
