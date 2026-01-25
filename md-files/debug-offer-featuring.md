# Debug Offer Featuring Status

## Check Offer's Featuring Status in Database

```bash
# In MongoDB shell or Compass:
db.offers.findOne(
  { _id: ObjectId("YOUR_OFFER_ID_HERE") },
  {
    title: 1,
    availableFrom: 1,
    availableUntil: 1,
    isFeaturedManual: 1,
    isFeaturedAuto: 1,
    'pricing.discountPercentage': 1,
    createdAt: 1
  }
)
```

Expected for your offer (11 hours remaining):
```json
{
  "title": "Your Offer Title",
  "availableFrom": "2026-01-19T21:46:00.000Z",
  "availableUntil": "2026-01-20T22:46:00.000Z",
  "isFeaturedManual": false,  // ❌ Should be false (not manually featured)
  "isFeaturedAuto": false,    // ❌ Should be false (>3 hours remaining)
  "pricing": {
    "discountPercentage": 75  // ✅ If ≥70%, shows in "Hottest Deals 🔥"
  }
}
```

## Check Current Featuring Config

```bash
# Check backend logs when it starts - you should see:
✅ Auto-Featuring Configuration:
   - Minimum Existence: 0.5 hours
   - Urgency Threshold: 3 hours
   - Cron Schedule: */1 * * * *
```

## Manual Test - Trigger Auto-Featuring

```bash
# Call admin endpoint to manually run auto-featuring logic:
POST http://localhost:3000/api/v1/offers/admin/trigger-auto-featuring
Authorization: Bearer YOUR_ADMIN_TOKEN

# Response shows:
{
  "offersAutoFeatured": 2,     // How many got auto-featured
  "offersAutoUnfeatured": 5    // How many got auto-unfeatured
}
```

## Expected Behavior Timeline

For your offer (created 2026-01-19 21:46, expires 2026-01-20 22:46):

| Time | Hours Left | In "Urgent Deals"? | In "Hottest Deals"? | Reason |
|------|------------|-------------------|-------------------|--------|
| 2026-01-20 09:00 | 13.75h | ❌ NO | ✅ YES (if ≥70% off) | >3h remaining |
| 2026-01-20 19:00 | 3.75h | ❌ NO | ✅ YES (if ≥70% off) | >3h remaining |
| **2026-01-20 19:46** | **3.0h** | **✅ APPEARS HERE** | ✅ YES (if ≥70% off) | ≤3h threshold crossed |
| 2026-01-20 21:00 | 1.75h | ✅ YES | ✅ YES (if ≥70% off) | <3h remaining |
| 2026-01-20 22:46 | 0h | ❌ EXPIRED | ❌ EXPIRED | Offer ended |

## Fix if Incorrectly Showing

### Option 1: Unfeature the Offer (if manually featured by mistake)

```bash
PATCH http://localhost:3000/api/v1/offers/YOUR_OFFER_ID/unfeature
Authorization: Bearer YOUR_ADMIN_TOKEN
```

### Option 2: Change Urgency Threshold (affects ALL offers)

```bash
# In apps/food-waste-backend/.env
AUTO_FEATURE_URGENCY_HOURS=1.5  # Now only ≤1.5 hours = urgent

# Restart backend
cd apps/food-waste-backend
pnpm dev
```

### Option 3: Wait for Cron Job

The cron job runs **every 1 minute** and will auto-unfeature offers that no longer meet the ≤3h threshold.
