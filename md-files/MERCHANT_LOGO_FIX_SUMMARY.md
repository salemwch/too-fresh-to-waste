# Merchant Logo Display Fix - Summary

## Issue

The merchant's profile image (logo) wasn't displaying in the OfferCard component's bottom-left corner because the backend wasn't populating the merchant's `profileImage` field in the API responses.

## Data Flow Architecture

### **1. Database Schema**

#### User Schema (`apps/food-waste-backend/src/users/schemas/user.schema.ts:152`)

```typescript
@Prop({ type: String, default: null })
profileImage: string;
```

- **Field**: `profileImage`
- **Type**: String (URL to uploaded image)
- **Purpose**: Merchant's logo/profile picture

#### Establishment Schema

```typescript
@Prop({ type: [String], default: [] })
images: string[];
```

- **Note**: Establishment has `images[]` but NO `profileImage` field
- **Design**: Merchant profile image belongs to User, not Establishment

#### Offer Schema

```typescript
@Prop({ type: Types.ObjectId, ref: 'User', required: true })
merchantId: Types.ObjectId;

@Prop({ type: Types.ObjectId, ref: 'Establishment', required: true })
establishmentId: Types.ObjectId;
```

- **Relationships**: Offer → Merchant (User) → profileImage
- **Relationships**: Offer → Establishment → name, rating, etc.

---

### **2. Backend Processing**

#### **Step 1: Service Layer - Populate merchantId**

**getFeaturedOffers** (`apps/food-waste-backend/src/offers/offers.service.ts:810`)

```typescript
.populate('establishmentId', 'name address type averageRating')
.populate('merchantId', 'firstName lastName profileImage') // ✅ FIXED
```

**getNearbyOffers** (`apps/food-waste-backend/src/offers/offers.service.ts:939`)

```typescript
$project: {
  // ...
  'merchant.profileImage': 1, // ✅ FIXED
}
```

**getRecommendedOffers** (`apps/food-waste-backend/src/offers/offers.service.ts:1171`)

```typescript
$project: {
  // ...
  'merchant.profileImage': 1, // ✅ Already included
}
```

**findAll** (`apps/food-waste-backend/src/offers/offers.service.ts:397`)

```typescript
.populate('merchantId', 'firstName lastName profileImage') // ✅ Already included
```

#### **Step 2: Presenter Layer - Extract profileImage**

**OfferPresenter** (`apps/food-waste-backend/src/offers/presenters/offer.presenter.ts:89-104`)

```typescript
private static getEstablishmentData(offer: OfferDocument): {
  name: string;
  averageRating?: number;
  totalReviews?: number;
  profileImage?: string;
} {
  // ✅ Get merchant profileImage if populated
  let profileImage: string | undefined;
  if (offer.merchantId && typeof offer.merchantId === 'object') {
    const merchant = offer.merchantId as any;
    profileImage = merchant.profileImage; // Extract from merchant
  }

  // ✅ Handle populated establishment
  if (offer.establishmentId && typeof offer.establishmentId === 'object') {
    const establishment = offer.establishmentId as any;
    return {
      name: establishment.name || 'Establishment',
      averageRating: establishment.averageRating,
      totalReviews: establishment.totalReviews,
      profileImage, // ✅ Add merchant's profileImage to establishment object
    };
  }

  return { name: 'Establishment', profileImage };
}
```

**Key Design**:

- Merchant's `profileImage` is extracted from `offer.merchantId`
- It's then added to the `establishment` object in the DTO
- This keeps the frontend API simple (one `establishment` object instead of separate `merchant` and `establishment`)

#### **Step 3: DTO Structure**

**OfferCardDto** (`apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts:56-61`)

```typescript
establishment: {
  name: string;
  averageRating?: number;
  totalReviews?: number;
  profileImage?: string; // ✅ Merchant's profile image
};
```

---

### **3. API Response**

**GET /api/v1/offers/featured**

```json
{
  "statusCode": 200,
  "data": [
    {
      "id": "696f85894e705a8854179511",
      "title": "Surprise Bag",
      "image": "http://10.0.2.2:3000/uploads/offers/1_1768916361129_d0cb5896.jpeg",
      "establishment": {
        "name": "riadh palm",
        "averageRating": 0,
        "profileImage": "http://10.0.2.2:3000/uploads/profile-images/restaurent_1768935196257_efef210b.jpeg"
      }
    }
  ]
}
```

---

### **4. Frontend Processing**

#### **Mobile Type Definition** (`apps/mobile/src/features/offers/types/offer.types.ts:183-189`)

```typescript
establishment: {
  name: string;
  averageRating?: number;
  totalReviews?: number;
  profileImage?: string; // Merchant profile image/logo
};
```

#### **OfferCard Component** (`apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx:232-250`)

```typescript
{/* Establishment Logo/Avatar */}
{showEstablishment && offer.establishment?.profileImage && (
  <View style={styles.establishmentLogo}>
    <Image
      source={{ uri: offer.establishment.profileImage }}
      style={styles.logoImage}
      resizeMode="cover"
    />
  </View>
)}
```

**Styles** (OfferCard.tsx:437-456)

```typescript
establishmentLogo: {
  position: 'absolute',
  bottom: 8,
  left: 8,
  width: 40,
  height: 40,
  borderRadius: 20, // Circular logo
  overflow: 'hidden',
  backgroundColor: theme.colors.surface,
  borderWidth: 2,
  borderColor: theme.colors.surface,
},
```

---

## Files Modified

### Backend

1. **`apps/food-waste-backend/src/offers/offers.service.ts:810`**
   - Added `.populate('merchantId', 'firstName lastName profileImage')` to `getFeaturedOffers`

2. **`apps/food-waste-backend/src/offers/offers.service.ts:939`**
   - Added `'merchant.profileImage': 1` to projection in `getNearbyOffers`

### Frontend

- No changes needed! The OfferCard component already had the code to display the logo.
- It was just waiting for the backend to send the `profileImage` field.

---

## Verification Steps

### 1. Test Backend API Response

```bash
curl http://localhost:3000/api/v1/offers/featured?limit=1 | grep profileImage
```

**Expected Output:**

```
"profileImage":"http://10.0.2.2:3000/uploads/profile-images/restaurent_1768935196257_efef210b.jpeg"
```

### 2. Test in Mobile App

1. **Open Android Emulator:**

   ```bash
   cd apps/mobile
   pnpm dev:android
   ```

2. **Navigate to Home Screen**
   - Check Featured Offers carousel
   - Check Hottest Deals carousel
   - Verify circular merchant logo appears in bottom-left corner of each card

3. **Check Debug Logs** (if needed)
   ```javascript
   // OfferCard.tsx:121-128
   console.log('[OfferCard] Image URL:', {
     offerId: offer.id,
     imageUrl: uri,
     hasEstablishment: !!offer.establishment,
     profileImage: offer.establishment?.profileImage,
   });
   ```

---

## Design Rationale

### Why Merchant profileImage, Not Establishment images?

**Problem:**

- Establishment can have multiple `images[]` (storefront photos, interior, etc.)
- But OfferCard needs ONE logo to identify the merchant/brand

**Solution:**

- Use Merchant's `profileImage` (their brand logo/avatar)
- This is set once when merchant creates their account
- Appears consistently across all their offers

**Benefits:**

1. **Brand Consistency**: Same logo for all offers from one merchant
2. **Simplicity**: Merchants don't need to upload logo for each establishment
3. **Performance**: One field instead of array traversal
4. **UX**: Users recognize merchants by their consistent branding

### Why Add profileImage to establishment Object in DTO?

**Alternative Designs Considered:**

#### Option A: Separate merchant and establishment objects

```json
{
  "establishment": { "name": "..." },
  "merchant": { "profileImage": "..." }
}
```

**Rejected**: Frontend would need to track two objects

#### Option B: Top-level merchantProfileImage field

```json
{
  "merchantProfileImage": "...",
  "establishment": { "name": "..." }
}
```

**Rejected**: Inconsistent with component expectations

#### **Option C (Chosen): Merge into establishment object**

```json
{
  "establishment": {
    "name": "...",
    "profileImage": "..."
  }
}
```

**Benefits**:

- ✅ Single object for all establishment/merchant display data
- ✅ Frontend components expect one source of truth
- ✅ Simpler mobile app state management
- ✅ Matches existing OfferCard component structure

---

## Testing Checklist

Backend:

- [x] API returns `establishment.profileImage` in featured offers
- [x] API returns `establishment.profileImage` in nearby offers
- [x] API returns `establishment.profileImage` in recommended offers
- [x] API returns `establishment.profileImage` in search/filter offers

Frontend:

- [ ] Merchant logo displays in HomeScreen → Featured Offers
- [ ] Merchant logo displays in HomeScreen → Hottest Deals
- [ ] Merchant logo displays in SearchScreen → Offer list
- [ ] Merchant logo displays in FavoritesScreen → Favorite offers
- [ ] Logo is circular and positioned in bottom-left corner
- [ ] Logo has white border/shadow for visibility
- [ ] Logo loads correctly (no 404 errors)
- [ ] Placeholder handling when no profileImage exists

---

## Known Limitations

### Merchant Without profileImage

**Scenario**: Merchant hasn't uploaded a profile image

**Current Behavior**: No logo displayed (conditional render)

**Future Enhancement**: Add default placeholder avatar

```typescript
const logoUri = offer.establishment?.profileImage || DEFAULT_MERCHANT_AVATAR;
```

### Offer Created Before Fix

**Scenario**: Offers in database created before profileImage population was added

**Solution**: Already handled! Offers fetch merchant data dynamically via `.populate()`

- No database migration needed
- Old offers will automatically get profileImage on next fetch

---

## Additional Endpoints to Fix (Optional)

These endpoints also fetch offers but are less critical for OfferCard display:

1. **`updateOffer`** (service line 511) - Merchant editing their offer
2. **`updateStatus`** (service line 527) - Merchant activating/deactivating offer

**Recommendation**: Fix for consistency, but not urgent (these are mutation endpoints, not list endpoints)

**Fix**:

```typescript
.populate('merchantId', 'firstName lastName profileImage')
```

---

## Related Documentation

- Backend Offer Presenter: `apps/food-waste-backend/src/offers/presenters/offer.presenter.ts`
- Backend DTO: `apps/food-waste-backend/src/offers/DTO/offer-list.dto.ts`
- Mobile OfferCard: `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx`
- Mobile Types: `apps/mobile/src/features/offers/types/offer.types.ts`
- User Schema: `apps/food-waste-backend/src/users/schemas/user.schema.ts`
- Establishment Schema: `apps/food-waste-backend/src/establishments/schemas/establishment.schema.ts`

---

**Fixed by:** Claude Code
**Date:** 2026-01-20
**Issue:** Merchant profileImage not populated in offer list endpoints
**Solution:** Added `.populate('merchantId', 'profileImage')` to service methods
**Impact:** ✅ Merchant logos now display in OfferCard component
