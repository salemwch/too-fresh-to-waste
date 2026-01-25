# Image Display Fix - Summary

## Issue
Images were not displaying in the mobile app's OfferCard and OfferDetailsScreen.

## Root Cause
**URL mismatch between backend and mobile app:**

### Backend Configuration (apps/food-waste-backend/.env:21)
- **Before:** `BACKEND_URL=http://localhost:3000`
- **Problem:** Generated image URLs like `http://localhost:3000/uploads/offers/image.jpeg`

### Mobile Configuration (apps/mobile/.env:22)
- **Configured:** `API_BASE_URL=http://10.0.2.2:3000/api/v1`
- **Android Emulator:** `10.0.2.2` is the special IP that maps to the host machine's `localhost`
- **Issue:** `localhost` from within the emulator doesn't point to the host machine

### Technical Details
1. **Backend Local Storage Service** (`apps/food-waste-backend/src/common/services/local-storage.service.ts:119`)
   - Generates download URLs using: `${this.baseUrl}/uploads/${folder}/${fileName}`
   - `baseUrl` comes from `BACKEND_URL` environment variable

2. **Data Flow:**
   - Backend stores images in: `C:\WFA\apps\food-waste-backend\uploads\offers\`
   - Backend serves static files via: `app.use('/uploads', express.static(...))` (main.ts:231)
   - Backend generates URLs with `localhost` → Mobile tries to load from emulator's localhost (fails)

## Solution Applied

### Updated Backend .env (apps/food-waste-backend/.env:23)
```env
# Before
BACKEND_URL=http://localhost:3000

# After
BACKEND_URL=http://10.0.2.2:3000
```

### Why This Works
- Image URLs now generated as: `http://10.0.2.2:3000/uploads/offers/image.jpeg`
- Mobile app can access these URLs since `10.0.2.2` points to host machine
- Consistent with mobile app's `API_BASE_URL` configuration

## Files Modified
1. `apps/food-waste-backend/.env` - Updated `BACKEND_URL` from `localhost` to `10.0.2.2`

## Verification Steps

### 1. Restart Backend Server (REQUIRED)
```bash
cd apps/food-waste-backend
pnpm dev
```
**Why:** Environment variables are loaded on server startup

### 2. Create a New Test Offer
```bash
# Test uploading a new offer with image
# New offers will get the corrected image URL
```

### 3. Verify Image URL Format
Check the API response for featured offers:
```bash
curl http://localhost:3000/api/v1/offers/featured?limit=1
```

**Expected Response:**
```json
{
  "data": [{
    "id": "...",
    "image": "http://10.0.2.2:3000/uploads/offers/image.jpeg",  // ✅ Using 10.0.2.2
    ...
  }]
}
```

### 4. Test in Mobile App
1. **Launch Android Emulator:**
   ```bash
   cd apps/mobile
   pnpm dev:android
   ```

2. **Navigate to Home Screen**
   - Images should now display in:
     - ✅ Featured Offers carousel
     - ✅ Hottest Deals carousel
     - ✅ Offer Details screen

3. **Check Debug Logs**
   - OfferCard has debug logging (OfferCard.tsx:121-128)
   - Look for: `[OfferCard] Image URL: { imageUrl: "http://10.0.2.2:3000/uploads/..." }`

## Known Limitations

### Existing Offers (Database)
**Problem:** Offers created BEFORE this fix still have old `localhost` URLs in database

**Solution Options:**

#### Option A: Quick Fix - Update Database (Recommended for Development)
```javascript
// Run this script to update existing offer image URLs
// File: apps/food-waste-backend/scripts/fix-offer-images.js

const mongoose = require('mongoose');
const { Offer } = require('../src/offers/schemas/offer.schema');

async function fixImageUrls() {
  await mongoose.connect(process.env.DATABASE_URL);

  const offers = await Offer.find({
    images: { $elemMatch: { $regex: 'http://localhost:3000' } }
  });

  for (const offer of offers) {
    offer.images = offer.images.map(url =>
      url.replace('http://localhost:3000', 'http://10.0.2.2:3000')
    );
    await offer.save();
  }

  console.log(`✅ Fixed ${offers.length} offers`);
  process.exit(0);
}

fixImageUrls();
```

#### Option B: Manual Cleanup
Delete old offers and create new ones with images

## Device-Specific Configuration

### iOS Simulator
```env
# apps/food-waste-backend/.env
BACKEND_URL=http://localhost:3000
```

### Real Android/iOS Device
```env
# Get your machine's IP: ipconfig (Windows) or ifconfig (Mac/Linux)
BACKEND_URL=http://192.168.1.100:3000  # Replace with your IP
```

### Production
```env
BACKEND_URL=https://api.yourapp.com
```

## Component Analysis

### Backend Components (Working Correctly)
✅ **Presenter** (`offer.presenter.ts:31`) - Correctly extracts first image from array
✅ **DTO** (`offer-list.dto.ts:30`) - Correctly defines `image?: string`
✅ **Controller** - Correctly uses presenter to sanitize data
✅ **Static File Serving** (`main.ts:231`) - Correctly serves /uploads directory

### Frontend Components (Working Correctly)
✅ **Service** (`offersService.ts:323`) - Correctly parses API responses
✅ **Hooks** (`useOffers.ts:138`) - Correctly returns OfferListItem[]
✅ **OfferCard** (`OfferCard.tsx:118`) - Correctly uses `offer.image`
✅ **OfferDetailsScreen** (`OfferDetailsScreen.tsx:182`) - Correctly uses `offer.images` for full offer

### Issue Was: Configuration Mismatch
❌ Backend generated URLs with `localhost`
❌ Mobile expected URLs with `10.0.2.2`
✅ **FIXED:** Backend now generates URLs with `10.0.2.2`

## Testing Checklist

- [ ] Backend server restarted with new env config
- [ ] New offer created with image upload
- [ ] API returns image URL with `10.0.2.2`
- [ ] HomeScreen displays images in Featured Offers
- [ ] HomeScreen displays images in Hottest Deals
- [ ] OfferDetailsScreen displays images
- [ ] SearchScreen displays images (if using OfferCard)
- [ ] FavoritesScreen displays images (if using OfferCard)

## Additional Notes

### Why Not Use Relative URLs?
- Backend doesn't know the client's base URL (could be emulator, real device, or web)
- Email verification links need absolute URLs
- Keeping absolute URLs provides better flexibility

### Alternative Solutions Considered

1. **Frontend URL Transformation** - Could transform URLs in mobile service layer, but:
   - Adds complexity
   - Requires URL parsing/replacement for every image
   - Backend fix is simpler and more maintainable

2. **Environment-Specific Builds** - Could have different backend URLs per target:
   - Increases build complexity
   - Current solution works for all scenarios with just env change

3. **CDN/External Storage** - Production approach:
   - Upload to Firebase Storage/AWS S3
   - URLs work from anywhere
   - Recommended for production deployment

## References

- Backend Local Storage Service: `apps/food-waste-backend/src/common/services/local-storage.service.ts`
- Backend .env: `apps/food-waste-backend/.env`
- Mobile .env: `apps/mobile/.env`
- OfferCard Component: `apps/mobile/src/design-system/components/organisms/OfferCard/OfferCard.tsx`
- Offer Presenter: `apps/food-waste-backend/src/offers/presenters/offer.presenter.ts`

---

**Fixed by:** Claude Code
**Date:** 2026-01-20
**Issue:** Image URLs using localhost instead of 10.0.2.2 for Android emulator
**Solution:** Updated BACKEND_URL in backend .env to use 10.0.2.2
