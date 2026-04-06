# OfferCard Redesign - Implementation Summary

## Overview

Updated the OfferCard component to match the new design from `offer.md`. The new design removes promotional badges and adds establishment ratings.

## Changes Made

### 1. Backend Updates

#### `apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts`

- ✅ Added `averageRating` and `totalReviews` to establishment object in OfferCardDto

```typescript
establishment: {
    name: string;
    averageRating?: number; // 0-5 rating for display
    totalReviews?: number; // Number of reviews
};
```

#### `apps/food-waste-backend/src/offers/presenters/offer.presenter.ts`

- ✅ Renamed `getEstablishmentName()` to `getEstablishmentData()`
- ✅ Now extracts rating and review data from populated establishment

```typescript
private static getEstablishmentData(offer: OfferDocument): {
    name: string;
    averageRating?: number;
    totalReviews?: number;
}
```

### 2. Frontend Type Updates

#### `apps/mobile/src/features/offers/types/offer.types.ts`

- ✅ Updated `OfferListItem` interface to include establishment rating fields

```typescript
establishment: {
    name: string;
    averageRating?: number; // 0-5 rating from reviews
    totalReviews?: number; // Number of reviews
};
```

### 3. OfferCard Component Updates

#### `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx`

**Removed Elements:**

- ❌ "Featured" badge (top right)
- ❌ "40% OFF" discount percentage badge (top left)
- ❌ "Expiring Soon" badge (top right)
- ❌ "Low Stock" badge (was in top right badges array)
- ❌ Favorite heart button from image section (bottom right)
- ❌ Custom badges support

**Added Elements:**

- ✅ **Star Rating Badge** (top right) - Shows establishment rating with star icon
  - Only displays if establishment has rating > 0
  - Dark primary color background with white star and number
  - Format: ★ 3.9

**Moved Elements:**

- ✅ **Favorite Heart Button** - Moved from image to content section
  - Now appears next to establishment name
  - Uses unicode heart character (❤ / ♡)
  - Updated color to use theme secondary color

**Redesigned Content Layout:**

```
┌─────────────────────────────────┐
│ Hotel Carthage          ♡       │  ← Establishment name + favorite
│ Surprise Bag                    │  ← Offer type (not title)
│ Pick up today: 18:00            │  ← Pickup time
├─────────────────────────────────┤  ← Border separator
│ 5.2 km          £21.00  £9.49   │  ← Distance + prices
└─────────────────────────────────┘
```

**Image Section:**

```
┌─────────────────────────────────┐
│  [5 left]             [★ 3.9]  │  ← Items left + Rating
│                                 │
│         [Food Image]            │
│                                 │
│  [EL]                           │  ← Establishment logo
└─────────────────────────────────┘
```

**Component Props Removed:**

- `variant` - No longer needed (no variant-specific badges)
- `showDiscountBadge` - Removed discount badge
- `badges` - Removed custom badges support
- `titleLines` - Now using single line for type

**New Styles Added:**

```typescript
ratingBadge: { position: 'absolute', top, right }
ratingBadgeContent: { flexDirection: 'row', backgroundColor: primary }
starIcon: { color: '#FFFFFF', fontSize: 12 }
ratingText: { color: '#FFFFFF', fontWeight: '600' }
establishmentRow: { flexDirection: 'row', justifyContent: 'space-between' }
favoriteButtonContent: { padding: 4 }
pickupTime: { marginBottom }
bottomRow: { borderTopWidth: 1, borderTopColor: outline }
priceContainer: { flexDirection: 'row', gap }
originalPrice: { textDecorationLine: 'line-through' }
currentPrice: { fontSize: 16, fontWeight: 'bold' }
```

**Removed Styles:**

- `topRightBadges`
- `favoriteButton` (image section)
- `favoriteButtonBackground`
- `meta`

## Testing Required

1. **Backend:**

   ```bash
   # Restart backend server to apply changes
   cd apps/food-waste-backend
   pnpm dev
   ```

2. **Mobile:**

   ```bash
   # Clear Metro cache and rebuild
   cd apps/mobile
   pnpm metro:reset
   pnpm dev:android  # or dev:ios
   ```

3. **Verify:**
   - [ ] Rating badge shows when establishment has rating > 0
   - [ ] Items left badge displays correctly
   - [ ] Favorite button works in content section
   - [ ] Prices display with strikethrough for original price
   - [ ] Bottom border separator appears correctly
   - [ ] Distance displays when available
   - [ ] Pickup time formatted as "Pick up today: HH:MM"

## API Response Example

```json
{
  "id": "68b2bf63414aead6d068044d",
  "title": "Surplus Tunisian Dinner Special",
  "type": "surprise_bag",
  "image": "https://example.com/image1.jpg",
  "pricing": {
    "originalPrice": 25,
    "discountedPrice": 15,
    "discountPercentage": 40,
    "currency": "TND"
  },
  "availableQuantity": 96,
  "availableUntil": "2026-08-31T21:00:00.000Z",
  "establishment": {
    "name": "Hotel Sindibad",
    "averageRating": 4.5,
    "totalReviews": 127
  },
  "distance": 2300,
  "ctaState": "available",
  "status": "active"
}
```

## Files Modified

**Backend:**

- `apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts`
- `apps/food-waste-backend/src/offers/presenters/offer.presenter.ts`

**Frontend:**

- `apps/mobile/src/features/offers/types/offer.types.ts`
- `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx`

## Breaking Changes

⚠️ **Props Removed:**

- `variant` prop no longer used
- `showDiscountBadge` prop removed
- `badges` prop removed
- `titleLines` prop removed

Existing code using these props should remove them to avoid TypeScript errors.

## Migration Notes

If you have existing code using the OfferCard:

```typescript
// ❌ Old usage
<OfferCard
  offer={offer}
  variant="featured"        // Remove
  showDiscountBadge={true}  // Remove
  badges={customBadges}     // Remove
  titleLines={2}            // Remove
/>

// ✅ New usage
<OfferCard
  offer={offer}
  showEstablishment={true}
  showPickupTime={true}
  showDistance={true}
  showItemsLeft={true}
  showFavorite={true}
/>
```

## Next Steps

1. Update establishment ratings in database with actual review data
2. Test across different screen sizes
3. Add loading skeleton states for ratings
4. Consider adding review count display next to rating
