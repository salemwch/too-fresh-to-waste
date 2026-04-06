# Quick Reference: Pickup Date Filtering

## 🎯 Summary

### ✅ What You Asked For

1. **Fetch offers by pickup date (today/tomorrow)** ✅ DONE
2. **Add image upload to create offer** ✅ ALREADY WORKS

---

## 📋 New Backend Endpoints

### 1. Pickup Today

```bash
GET http://localhost:3000/api/v1/offers/pickup-today
```

**Query Parameters**:

- `page` (optional, default: 1)
- `limit` (optional, default: 20)
- `latitude` (optional) - for distance
- `longitude` (optional) - for distance

**Example**:

```bash
curl "http://localhost:3000/api/v1/offers/pickup-today?limit=10&latitude=36.8065&longitude=10.1815"
```

---

### 2. Pickup Tomorrow

```bash
GET http://localhost:3000/api/v1/offers/pickup-tomorrow
```

**Query Parameters**: Same as pickup-today

**Example**:

```bash
curl "http://localhost:3000/api/v1/offers/pickup-tomorrow?limit=10"
```

---

## 📸 Image Upload (Already Works!)

### Create Offer with Images

```bash
POST http://localhost:3000/api/v1/offers
Content-Type: multipart/form-data
Authorization: Bearer YOUR_MERCHANT_TOKEN

Form Fields:
- title: "Fresh Bakery Bag"
- description: "Delicious pastries"
- type: "SURPRISE_BAG"
- availableFrom: "2026-01-20T06:00:00.000Z"
- availableUntil: "2026-01-20T20:00:00.000Z"
- totalQuantity: 10
- pricing[originalPrice]: 15.00
- pricing[discountedPrice]: 5.99
- pricing[currency]: "TND"
- images: [file1.jpg, file2.jpg] ← Upload here (max 5)
```

**Image Storage**: `apps/food-waste-backend/uploads/offers/`

---

## 🏗️ Files Changed

### Backend

✅ `apps/food-waste-backend/src/offers/offers.service.ts`

- Added `getPickupTodayOffers()` method (line 691)
- Added `getPickupTomorrowOffers()` method (line 736)

✅ `apps/food-waste-backend/src/offers/offers.controller.ts`

- Added `GET /offers/pickup-today` endpoint (line 173)
- Added `GET /offers/pickup-tomorrow` endpoint (line 251)

✅ `apps/food-waste-backend/src/common/utils/timezone.util.ts`

- Added `getStartOfDay()` method (line 98)
- Added `getEndOfDay()` method (line 116)

### Mobile (To Be Implemented)

⏳ Create `apps/mobile/src/features/offers/hooks/usePickupDateOffers.ts`
⏳ Update `apps/mobile/src/features/offers/services/offersService.ts`
⏳ Update `apps/mobile/src/features/home/screens/HomeScreen.tsx`

---

## 🧪 Test It Now

### 1. Restart Backend

```bash
cd apps/food-waste-backend
pnpm dev
```

You should see:

```
✅ Auto-Featuring Configuration:
   - Minimum Existence: 0.5 hours
   - Urgency Threshold: 3 hours
   - Cron Schedule: */1 * * * *
```

### 2. Test Endpoints

**Test Pickup Today**:

```bash
curl http://localhost:3000/api/v1/offers/pickup-today
```

**Test Pickup Tomorrow**:

```bash
curl http://localhost:3000/api/v1/offers/pickup-tomorrow
```

**Expected Response**:

```json
{
  "message": "Pickup today offers retrieved successfully",
  "data": [
    {
      "id": "...",
      "title": "...",
      "availableFrom": "2026-01-20T06:00:00.000Z",
      "availableUntil": "2026-01-20T20:00:00.000Z",
      "pricing": { ... }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

### 3. Test with Swagger UI

Open: `http://localhost:3000/api/v1/api-docs`

Look for:

- **📅 GET /offers/pickup-today**
- **📅 GET /offers/pickup-tomorrow**

---

## 🎨 How It Works

### Date Logic

**Pickup Today**: Offers where pickup window **overlaps** with today (00:00 - 23:59 Tunisia time)

Example:

```
Today: 2026-01-20
Offer: availableFrom=2026-01-20 08:00, availableUntil=2026-01-20 18:00
Result: ✅ Included (fully within today)

Today: 2026-01-20
Offer: availableFrom=2026-01-19 20:00, availableUntil=2026-01-20 14:00
Result: ✅ Included (overlaps with today)

Today: 2026-01-20
Offer: availableFrom=2026-01-21 08:00, availableUntil=2026-01-21 18:00
Result: ❌ Excluded (tomorrow only)
```

**Pickup Tomorrow**: Same logic but for tomorrow's date range.

---

## 🔥 Next Steps

### For Mobile App

1. **Create the hook file**:
   - File: `apps/mobile/src/features/offers/hooks/usePickupDateOffers.ts`
   - Content: See `PICKUP-DATE-FILTERING-GUIDE.md`

2. **Add service methods**:
   - File: `apps/mobile/src/features/offers/services/offersService.ts`
   - Add `getPickupTodayOffers()` and `getPickupTomorrowOffers()`

3. **Update HomeScreen**:
   - File: `apps/mobile/src/features/home/screens/HomeScreen.tsx`
   - Add two new sections after "Urgent Deals"

4. **Export hooks**:
   - File: `apps/mobile/src/features/offers/hooks/index.ts`
   - Add: `export * from './usePickupDateOffers';`

---

## 📚 Documentation

Full details in: `PICKUP-DATE-FILTERING-GUIDE.md`

---

## ✅ Checklist

Backend:

- [x] Service methods created
- [x] Controller endpoints created
- [x] Timezone utilities added
- [x] TypeScript compilation passes
- [x] Image upload working (already existed)

Frontend (To Do):

- [ ] Create usePickupDateOffers hook
- [ ] Add service methods
- [ ] Update HomeScreen with new sections
- [ ] Test on mobile app

---

**Ready to test!** Restart the backend and try the new endpoints. 🚀
