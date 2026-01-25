# HomeScreen Sections - Fetch Rules Documentation

## 🎯 Purpose
This document explains the exact filtering rules for each section in the HomeScreen.
Used for debugging why the 80% discount offer appears in some sections but not others.

---

## 📱 HomeScreen Sections

### 1. **For You ✨** (Personalized Recommendations)

**Location:** `HomeScreen.tsx` lines 69-77

**Hook:** `useRecommendedOffers(limit, coordinates)`

**Backend:** `GET /api/v1/offers/recommended?limit=10`

**Rules:**
- ✅ Requires **authentication** (uses accessToken)
- ✅ Based on user's **favorited establishments and categories**
- ✅ Includes **geolocation** (distance calculation if coordinates provided)
- ✅ Returns **personalized offers** based on user preferences
- ⚠️ Returns **empty array** if not authenticated (graceful fallback)

**Backend Filter:**
```typescript
// Personalized based on user's favorites
// Implementation in: offers.service.ts (getRecommendedOffers method)
```

---

### 2. **Urgent Deals ⚡** (Featured/Expiring Soon)

**Location:** `HomeScreen.tsx` lines 80-88

**Hook:** `useFeaturedOffers(limit, coordinates)`

**Backend:** `GET /api/v1/offers/featured?limit=10`

**Rules (offers.service.ts:655-693):**
```typescript
{
  status: OfferStatus.ACTIVE,        // Must be 'active'
  isActive: true,                    // Must be active
  availableFrom: { $lte: now },      // Already started
  availableUntil: { $gte: now },     // Not expired yet
  $or: [
    { isFeaturedManual: true },      // Manually featured by admin
    { isFeaturedAuto: true }         // Auto-featured (≤1.5h remaining, existed ≥2h)
  ]
}
```

**Sort:** `createdAt: -1` (newest first)

**Your Offer Status:**
- ✅ status: 'active'
- ✅ isActive: true
- ✅ isFeaturedAuto: true ← **This is why it appears here**
- ✅ Within time window

**⚠️ QUESTION:** The user says the offer has >1.5h remaining but still shows in Urgent Deals.
This suggests `isFeaturedAuto` was set by a cron job earlier (when it HAD ≤1.5h remaining).
Once set, `isFeaturedAuto` stays TRUE until the offer expires (it's not continuously recalculated).

---

### 3. **Hottest Deals 🔥** (70%+ Discount)

**Location:** `HomeScreen.tsx` lines 91-104

**Hook:** `useOffers({ status, minDiscount: 70 }, coordinates)`

**Backend:** `GET /api/v1/offers?status=active&minDiscount=70&limit=10`

**Rules (offers.service.ts:149-388):**
```typescript
// Line 160-163: Default filters (when no merchantId/status specified)
{
  status: OfferStatus.ACTIVE,
  isActive: true
}

// Line 207-209: Discount filter
{
  'pricing.discountPercentage': { $gte: 70 }  // 70% or more
}

// Line 214-218: Time window filter (for public queries)
{
  availableFrom: { $lte: now },
  availableUntil: { $gte: now }
}

// Line 222-305: GEOLOCATION FILTER (if coordinates provided)
// Uses $geoNear aggregation on establishments collection
// Default maxDistance: 5000 meters (5km)
```

**Your Offer Status:**
- ✅ status: 'active'
- ✅ isActive: true
- ✅ pricing.discountPercentage: 80 >= 70
- ✅ Within time window
- ✅ Establishment has coordinates: [10.62796, 35.84159]
- ❓ **ISSUE:** Should appear but doesn't - need to test!

---

## 🔍 Debugging Strategy

### Current Status
- ✅ Appears in "For You ✨"
- ✅ Appears in "Urgent Deals ⚡"
- ❌ Does NOT appear in "Hottest Deals 🔥" ← **PROBLEM**

### Next Steps
1. ✅ Comment out "For You" section (reduce noise)
2. Test with only "Urgent Deals" and "Hottest Deals" visible
3. Check API response for `GET /api/v1/offers?status=active&minDiscount=70&limit=10`
4. Compare backend results with frontend rendering

---

## 📊 Offer Data

**Offer ID:** `696e5eb281e3e14a846b60fd`

**Offer Fields:**
```json
{
  "title": "Surprise Bag",
  "status": "active",
  "isActive": true,
  "pricing": {
    "originalPrice": 20,
    "discountedPrice": 4,
    "discountPercentage": 80,
    "currency": "TND"
  },
  "availableFrom": "2026-01-19T16:43:00.000Z",
  "availableUntil": "2026-01-19T22:46:00.000Z",
  "totalQuantity": 33,
  "reservedQuantity": 0,
  "soldQuantity": 0,
  "isFeaturedManual": false,
  "isFeaturedAuto": true,
  "establishmentId": "696277a0bc2ec114a9585c65"
}
```

**Establishment Fields:**
```json
{
  "name": "riadh palm",
  "address": {
    "city": "sousse",
    "street": "kantoui sousse zone touristique",
    "coordinates": {
      "type": "Point",
      "coordinates": [10.62796, 35.84159]  // [lng, lat]
    }
  },
  "isActive": true,
  "isDeleted": false
}
```

**User Location:** Near Sousse (estimated)
**Distance:** ~2km (as shown in app)

---

## 🚨 Open Questions

1. **Why does the offer appear in "Urgent Deals" with >1.5h remaining?**
   - Answer: `isFeaturedAuto` was set earlier and persists until expiration

2. **Why does the offer NOT appear in "Hottest Deals" despite 80% discount?**
   - Need to test: Check API response for minDiscount=70 filter
   - Possible causes:
     - Frontend filtering issue
     - Backend geolocation issue
     - Response transformation issue
     - React Query caching issue

---

## 🛠️ Next Action

**Step 1:** Comment out "For You" section in HomeScreen
**Step 2:** Test and observe which sections show the offer
**Step 3:** Check network API responses
**Step 4:** Compare backend query results with frontend rendering
