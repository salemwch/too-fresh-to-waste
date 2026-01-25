# ID Field Convention

## Standard: Use `_id` for Direct MongoDB Responses

This project uses `_id` as the **default field name** for entity identifiers to maintain consistency with MongoDB's native field naming.

## The Rule

### ✅ Use `_id` (Default)
- All MongoDB documents returned directly from the database
- Any endpoint that doesn't use DTOs (Data Transfer Objects)
- **Reason**: Simpler, no transformation needed, consistent with database

### ✅ Use `id` (Exception - Only with DTOs)
- Endpoints that have explicit DTO classes with transformation
- Currently **only the Offers module** (`OfferCardDto`)
- **Reason**: Clean API abstraction when backend explicitly transforms the data

## Implementation

### Backend (`apps/food-waste-backend`)

**Internal Operations** - Always use `._id`:
```typescript
// ✅ CORRECT - Querying MongoDB
const favorite = await this.favoriteModel.findOne({ _id: new Types.ObjectId(id) });

// ✅ CORRECT - Accessing document ID
const saved = await favorite.save();
await this.updateInteractionCount((saved._id as Types.ObjectId).toString());
```

**API Responses** - Return `_id` by default:
```typescript
// ✅ CORRECT - Return document with _id
return this.favoritesService.getUserFavorites(userId, filters);
// Response: { favorites: [{ _id: "...", ... }] }
```

**Exception - When using DTOs**:
```typescript
// ✅ CORRECT - Offers module has OfferCardDto
export class OfferCardDto {
  @IsString()
  id: string;  // Transformed from _id → id
  // ...
}
```

### Frontend (`apps/mobile`)

**Types** - Match backend response:
```typescript
// ✅ CORRECT - Direct MongoDB responses use _id
export interface Favorite {
  _id: ID;
  userId: ID;
  // ...
}

export interface NearbyOffer {
  _id: string;
  title: string;
  // ...
}

// ✅ CORRECT - DTO responses use id (Offers module only)
export interface OfferListItem {
  id: string;  // Backend OfferCardDto uses 'id'
  title: string;
  // ...
}
```

**Usage**:
```typescript
// ✅ CORRECT - Accessing MongoDB documents
const favoriteId = favorite._id;
keyExtractor={(item) => item._id}
navigation.navigate('Details', { offerId: nearbyOffer._id });

// ✅ CORRECT - Accessing DTO responses (Offers only)
const offerId = offerListItem.id;
```

## Files Changed (Migration Summary)

### Backend Changes
- ✅ `auth/auth.service.ts` - Changed 26 occurrences of `user.id` → `user._id`

### Frontend Changes
**Reverted to use `_id`:**
- ✅ `features/favorites/types/index.ts` - `Favorite` interface
- ✅ `features/favorites/screens/FavoritesScreen.tsx` - keyExtractor
- ✅ `features/offers/services/nearbyOffersService.ts` - `NearbyOffer`, `NearbyEstablishment`
- ✅ `features/search/screens/SearchScreen.tsx` - All `._id` usages
- ✅ `features/map/screens/NearbyOffersScreen.tsx` - All `._id` usages
- ✅ `types/donations.ts` - `OrderWithDonation` interface

**Kept using `id` (has DTOs):**
- ✅ `features/offers/types/offer.types.ts` - `Offer`, `OfferListItem` (backend has `OfferCardDto`)
- ✅ `features/offers/screens/OfferDetailsScreen.tsx` - `offer.id`

## Benefits of This Approach

### ✅ Simplicity
- **No transformation overhead** - Backend returns what MongoDB stores
- **Easier debugging** - Database queries and API responses use same field names
- **Less code** - No mapper/DTO layer needed for most endpoints

### ✅ Performance
- **Zero transformation cost** - Direct passthrough from database
- **Reduced memory usage** - No intermediate objects created

### ✅ Maintainability
- **Single source of truth** - `_id` is consistently used everywhere
- **Predictable** - If there's no DTO, it's `_id`
- **Clear exception** - Only modules with DTOs use `id`

### ✅ Future-Proof
- **Easy to audit** - Search for `_id` to find all MongoDB document references
- **Consistent with tools** - MongoDB Compass, Studio 3T all show `_id`

## When to Add a DTO (Use `id` Instead)

Only create a DTO and transform `_id` → `id` when:
1. **Security** - Need to exclude sensitive fields
2. **Privacy** - GDPR/compliance requires field filtering
3. **Computed fields** - Backend adds calculated values
4. **Contract stability** - Want to abstract database implementation

**Example**: Offers module has `OfferCardDto` because it:
- Excludes internal metrics (`soldQuantity`, `reservedQuantity`)
- Computes `availableQuantity` and `ctaState`
- Protects merchant PII

## Verification

**Check if migration is correct:**
```bash
# Backend - should find _id usages in services
grep -r "\._id" apps/food-waste-backend/src/*/services/*.ts

# Frontend - should find _id in types (except offer.types.ts)
grep -r "  _id:" apps/mobile/src/*/types/*.ts

# Offers should use 'id' (has DTO)
grep "  id:" apps/mobile/src/features/offers/types/offer.types.ts
```

## Decision Record

**Date**: 2026-01-20
**Decision**: Use `_id` as the standard field name for entity identifiers
**Rationale**: Simpler architecture, better performance, easier maintenance
**Exception**: Offers module uses `id` (has explicit DTOs in backend)
**Status**: ✅ Implemented and Verified
