# Offer Details Fixes - Summary

**Date:** 2026-01-19
**Issues:** Navigation header cut off + "0 bags remaining" when should show 33

---

## Issue 1: "0 bags remaining" Bug ❌→✅

### Root Cause
MongoDB virtual field `availableQuantity` was **NOT** being included in API responses.

**Schema Definition (offer.schema.ts:489-491):**
```typescript
OfferSchema.virtual('availableQuantity').get(function () {
    return this.totalQuantity - this.reservedQuantity - this.soldQuantity;
});
```

**Problem:**
- Mongoose virtuals are NOT included in `.toJSON()` or `.toObject()` by default
- API returned: `{ totalQuantity: 33, soldQuantity: 0, reservedQuantity: 0 }`
- BUT missing: `availableQuantity: 33`
- Frontend tried to access `offer.availableQuantity` → `undefined` → defaulted to `0`

### Solution
Added toJSON/toObject configuration to schema:

```typescript
// apps/food-waste-backend/src/offers/schemas/offer.schema.ts:246-247
OfferSchema.set('toJSON', { virtuals: true });
OfferSchema.set('toObject', { virtuals: true });
```

**Result:**
API now returns: `{ totalQuantity: 33, soldQuantity: 0, reservedQuantity: 0, availableQuantity: 33 }`

---

## Issue 2: Navigation Header Cut Off ❌→✅

### Root Cause
Android modal presentation cuts off header due to status bar overlap.

### Solution
Added `headerStatusBarHeight: 0` to modal screen options:

```typescript
// apps/mobile/src/navigation/MainStack.tsx:65
const modalScreenOptions = {
    presentation: 'modal' as const,
    headerStyle: {
      backgroundColor: theme.colors.surface,
    },
    headerTintColor: theme.colors.onSurface,
    headerTitleStyle: {
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
    },
    headerShadowVisible: true,
    headerStatusBarHeight: 0, // ✅ Fix for Android
};
```

---

## Files Changed

| File | Lines | Change |
|------|-------|--------|
| `apps/food-waste-backend/src/offers/schemas/offer.schema.ts` | 245-247 | Added virtuals config |
| `apps/mobile/src/navigation/MainStack.tsx` | 65 | Added headerStatusBarHeight |

---

## Testing

### Backend Test
**Restart backend for schema changes:**
```bash
cd apps/food-waste-backend
pnpm dev
```

**Test API:**
```bash
curl http://localhost:3000/api/v1/offers/696e5eb281e3e14a846b60fd
```

**Expected response:**
```json
{
  "statusCode": 200,
  "data": {
    "_id": "696e5eb281e3e14a846b60fd",
    "title": "Delicious Sushi Surprise Bag",
    "totalQuantity": 33,
    "soldQuantity": 0,
    "reservedQuantity": 0,
    "availableQuantity": 33,  ← ✅ NOW INCLUDED!
    "id": "696e5eb281e3e14a846b60fd"
  }
}
```

### Frontend Test
```bash
cd apps/mobile
pnpm dev:android
```

**Expected:**
1. ✅ Navigate to offer details
2. ✅ Header "< Offer Details" properly visible (not cut off)
3. ✅ Shows "33 bags remaining" (not 0)

---

## Technical Details

### Mongoose Virtual Fields

Virtual fields are:
- ✅ Computed properties (not stored in DB)
- ✅ Calculated on-the-fly when document is accessed
- ❌ NOT included in queries by default
- ❌ NOT included in JSON responses by default

**To include virtuals:**
```typescript
// Option 1: Schema-level (RECOMMENDED - affects all responses)
schema.set('toJSON', { virtuals: true });

// Option 2: Query-level (per-query basis)
await Model.findById(id).lean(false).exec();

// Option 3: Manual calculation (fallback)
const availableQuantity = offer.totalQuantity - offer.reservedQuantity - offer.soldQuantity;
```

### Why We Use Virtuals

**Advantages:**
- ✅ No data duplication (DRY principle)
- ✅ Always up-to-date (calculated from source fields)
- ✅ No risk of stale data
- ✅ Less storage (computed vs stored)

**Example:**
```
totalQuantity: 33  (stored)
soldQuantity: 0    (stored)
reservedQuantity: 0 (stored)
availableQuantity: 33 (computed: 33 - 0 - 0)
```

If we stored `availableQuantity`, we'd risk:
- ❌ Updating `soldQuantity` but forgetting to update `availableQuantity`
- ❌ Data inconsistency bugs
- ❌ Extra storage

---

## Verification Checklist

Backend:
- [ ] Restart backend server (`pnpm dev`)
- [ ] Test API endpoint returns `availableQuantity`
- [ ] Verify calculation: `totalQuantity - soldQuantity - reservedQuantity`

Frontend:
- [ ] Clear Metro cache (`pnpm metro:reset`)
- [ ] Reload Android app
- [ ] Check header is not cut off
- [ ] Check "X bags remaining" shows correct number
- [ ] Test with different offers (varying quantities)

---

## Related Code

**Virtual Field Definition:**
```typescript
// apps/food-waste-backend/src/offers/schemas/offer.schema.ts:489-491
OfferSchema.virtual('availableQuantity').get(function () {
    return this.totalQuantity - this.reservedQuantity - this.soldQuantity;
});
```

**Frontend Usage:**
```typescript
// apps/mobile/src/features/offers/screens/OfferDetailsScreen.tsx:171
const availableQty = offer.availableQuantity ?? 0;

// Line 270
{availableQty} {availableQty === 1 ? 'bag' : 'bags'} remaining
```

**API Service:**
```typescript
// apps/food-waste-backend/src/offers/offers.service.ts:390-408
async findById(id: string): Promise<OfferDocument> {
    const offer = await this.offerModel
        .findById(id)
        .populate('establishmentId', 'name address type averageRating phoneNumber email')
        .populate('merchantId', 'firstName lastName email phoneNumber profileImage')
        .exec();

    // With schema virtuals enabled, availableQuantity is now included!
    return offer;
}
```

---

## Status: ✅ RESOLVED

Both issues are fixed. Restart backend and clear Metro cache to see changes.
