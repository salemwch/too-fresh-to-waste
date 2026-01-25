# Pickup Date Filtering & Image Upload Guide

## ✅ What's Been Added

### 1. New Backend Endpoints

#### **GET `/api/v1/offers/pickup-today`**
- **Description**: Fetch all offers available for pickup today (00:00 - 23:59 Africa/Tunis)
- **Auth**: Public (no login required)
- **Query Parameters**:
  - `page` (optional, default: 1)
  - `limit` (optional, default: 20, max: 100)
  - `latitude` (optional) - for distance calculation
  - `longitude` (optional) - for distance calculation

**Example Request**:
```bash
GET http://localhost:3000/api/v1/offers/pickup-today?page=1&limit=10&latitude=36.8065&longitude=10.1815
```

**Example Response**:
```json
{
  "message": "Pickup today offers retrieved successfully",
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "title": "Fresh Bakery Surprise Bag",
      "availableFrom": "2026-01-20T06:00:00.000Z",
      "availableUntil": "2026-01-20T20:00:00.000Z",
      "pricing": {
        "originalPrice": 15.00,
        "discountedPrice": 5.99,
        "discountPercentage": 60
      },
      "distance": 2.5
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 15,
    "totalPages": 2
  }
}
```

---

#### **GET `/api/v1/offers/pickup-tomorrow`**
- **Description**: Fetch all offers available for pickup tomorrow (00:00 - 23:59 Africa/Tunis)
- **Auth**: Public (no login required)
- **Query Parameters**: Same as pickup-today

**Example Request**:
```bash
GET http://localhost:3000/api/v1/offers/pickup-tomorrow?page=1&limit=10
```

---

## ✅ Image Upload (Already Works!)

### **POST `/api/v1/offers`** - Create Offer with Images

The create offer endpoint **already supports image uploads**. No changes needed!

**How It Works**:
1. Accepts up to **5 images** via `multipart/form-data`
2. Stores images locally in `uploads/offers/` folder
3. Auto-processes images: 800x600px, 80% quality, JPEG format
4. Returns image URLs in response

**Example Request (Postman/Insomnia)**:
```http
POST http://localhost:3000/api/v1/offers
Content-Type: multipart/form-data
Authorization: Bearer YOUR_MERCHANT_TOKEN

Form Data:
- title: "Fresh Bakery Surprise Bag"
- description: "Delicious pastries from today"
- type: "SURPRISE_BAG"
- availableFrom: "2026-01-20T06:00:00.000Z"
- availableUntil: "2026-01-20T20:00:00.000Z"
- totalQuantity: 10
- pricing[originalPrice]: 15.00
- pricing[discountedPrice]: 5.99
- pricing[currency]: "TND"
- images: [file1.jpg, file2.jpg, file3.jpg]  ← Upload files here
```

**Example Response**:
```json
{
  "message": "Offer created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Fresh Bakery Surprise Bag",
    "images": [
      "http://localhost:3000/uploads/offers/1705747200000_abc123.jpg",
      "http://localhost:3000/uploads/offers/1705747200001_def456.jpg"
    ],
    "pricing": {
      "originalPrice": 15.00,
      "discountedPrice": 5.99,
      "discountPercentage": 60,
      "currency": "TND"
    },
    "status": "draft"
  }
}
```

---

## 📱 Mobile Integration (React Native)

### 1. Create Hooks for Pickup Date Filtering

Create `apps/mobile/src/features/offers/hooks/usePickupDateOffers.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { offersService } from '../services/offersService';
import type { LocationCoordinates } from '@/types';

/**
 * Hook to fetch offers available for pickup today
 */
export function usePickupTodayOffers(
  limit: number = 10,
  location?: LocationCoordinates
) {
  return useQuery({
    queryKey: ['offers', 'pickup-today', limit, location?.latitude, location?.longitude],
    queryFn: () => offersService.getPickupTodayOffers(1, limit, location),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}

/**
 * Hook to fetch offers available for pickup tomorrow
 */
export function usePickupTomorrowOffers(
  limit: number = 10,
  location?: LocationCoordinates
) {
  return useQuery({
    queryKey: ['offers', 'pickup-tomorrow', limit, location?.latitude, location?.longitude],
    queryFn: () => offersService.getPickupTomorrowOffers(1, limit, location),
    staleTime: 60000, // 1 minute
    gcTime: 300000, // 5 minutes
  });
}
```

### 2. Add Service Methods

Update `apps/mobile/src/features/offers/services/offersService.ts`:

```typescript
/**
 * Get offers available for pickup today
 */
async getPickupTodayOffers(
  page: number = 1,
  limit: number = 20,
  location?: LocationCoordinates
): Promise<OfferCardDto[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (location) {
    params.append('latitude', location.latitude.toString());
    params.append('longitude', location.longitude.toString());
  }

  const response = await axios.get<ApiResponseWrapper<OfferCardDto[]>>(
    `${this.baseURL}/pickup-today?${params.toString()}`
  );

  return response.data.data;
}

/**
 * Get offers available for pickup tomorrow
 */
async getPickupTomorrowOffers(
  page: number = 1,
  limit: number = 20,
  location?: LocationCoordinates
): Promise<OfferCardDto[]> {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (location) {
    params.append('latitude', location.latitude.toString());
    params.append('longitude', location.longitude.toString());
  }

  const response = await axios.get<ApiResponseWrapper<OfferCardDto[]>>(
    `${this.baseURL}/pickup-tomorrow?${params.toString()}`
  );

  return response.data.data;
}
```

### 3. Update HomeScreen with New Sections

Update `apps/mobile/src/features/home/screens/HomeScreen.tsx`:

```typescript
import { usePickupTodayOffers, usePickupTomorrowOffers } from '@/features/offers/hooks/usePickupDateOffers';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { coordinates } = useLocation();

  // Fetch pickup today offers
  const {
    data: pickupTodayOffers,
    isLoading: isPickupTodayLoading,
    error: pickupTodayError,
    refetch: refetchPickupToday,
  } = usePickupTodayOffers(
    10,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined
  );

  // Fetch pickup tomorrow offers
  const {
    data: pickupTomorrowOffers,
    isLoading: isPickupTomorrowLoading,
    error: pickupTomorrowError,
    refetch: refetchPickupTomorrow,
  } = usePickupTomorrowOffers(
    10,
    coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined
  );

  return (
    <ScrollView>
      {/* Pickup Today Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant='title' size='lg' weight='semibold'>
            Pickup Today 📅
          </Text>
          <Button
            variant='ghost'
            size='sm'
            onPress={() => navigation.navigate('Search', { filter: 'pickup-today' })}
          >
            See All
          </Button>
        </View>

        {isPickupTodayLoading && <ActivityIndicator />}

        {!isPickupTodayLoading && pickupTodayOffers && pickupTodayOffers.length > 0 && (
          <FlatList
            data={pickupTodayOffers}
            renderItem={({ item }) => (
              <FavoriteOfferCard
                offer={item}
                variant='default'
                onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
              />
            )}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>

      {/* Pickup Tomorrow Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant='title' size='lg' weight='semibold'>
            Pickup Tomorrow 📅
          </Text>
          <Button
            variant='ghost'
            size='sm'
            onPress={() => navigation.navigate('Search', { filter: 'pickup-tomorrow' })}
          >
            See All
          </Button>
        </View>

        {isPickupTomorrowLoading && <ActivityIndicator />}

        {!isPickupTomorrowLoading && pickupTomorrowOffers && pickupTomorrowOffers.length > 0 && (
          <FlatList
            data={pickupTomorrowOffers}
            renderItem={({ item }) => (
              <FavoriteOfferCard
                offer={item}
                variant='default'
                onPress={offer => navigation.navigate('OfferDetails', { offerId: offer.id })}
              />
            )}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
          />
        )}
      </View>
    </ScrollView>
  );
};
```

---

## 🧪 Testing

### Test Backend Endpoints

```bash
# 1. Start backend
cd apps/food-waste-backend
pnpm dev

# 2. Test pickup-today endpoint
curl http://localhost:3000/api/v1/offers/pickup-today

# 3. Test pickup-tomorrow endpoint
curl http://localhost:3000/api/v1/offers/pickup-tomorrow

# 4. Test with location filtering
curl "http://localhost:3000/api/v1/offers/pickup-today?latitude=36.8065&longitude=10.1815"
```

### Test Image Upload

```bash
# Using curl
curl -X POST http://localhost:3000/api/v1/offers \
  -H "Authorization: Bearer YOUR_MERCHANT_TOKEN" \
  -F "title=Test Offer" \
  -F "description=Test description" \
  -F "type=SURPRISE_BAG" \
  -F "availableFrom=2026-01-20T06:00:00.000Z" \
  -F "availableUntil=2026-01-20T20:00:00.000Z" \
  -F "totalQuantity=10" \
  -F "pricing[originalPrice]=15.00" \
  -F "pricing[discountedPrice]=5.99" \
  -F "pricing[currency]=TND" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

---

## 📂 Local Image Storage

Images are stored in: `apps/food-waste-backend/uploads/offers/`

**File naming**: `{timestamp}_{randomHash}.jpg`

**Example**: `1705747200000_abc123def456.jpg`

**Access URL**: `http://localhost:3000/uploads/offers/1705747200000_abc123def456.jpg`

---

## 🔥 Key Features

### Pickup Date Filtering
- ✅ Timezone-aware (Africa/Tunis)
- ✅ Handles offers spanning multiple days
- ✅ Only shows ACTIVE offers
- ✅ Sorted by expiry (soonest first)
- ✅ Pagination support
- ✅ Optional distance calculation

### Image Upload
- ✅ Up to 5 images per offer
- ✅ Auto image processing (resize, compress, format)
- ✅ Local storage (no Firebase/S3 needed)
- ✅ Secure file validation
- ✅ Returns accessible URLs

---

## 🎯 Summary

**Backend Changes**:
- ✅ Added `getPickupTodayOffers()` method in `OffersService`
- ✅ Added `getPickupTomorrowOffers()` method in `OffersService`
- ✅ Added `GET /offers/pickup-today` endpoint
- ✅ Added `GET /offers/pickup-tomorrow` endpoint
- ✅ Image upload already works (no changes needed!)

**Mobile Integration Needed**:
1. Create `usePickupDateOffers.ts` hook file
2. Add service methods to `offersService.ts`
3. Update `HomeScreen.tsx` to add 2 new sections
4. Export hooks from `index.ts`

**Next Steps**:
1. Restart backend: `pnpm dev`
2. Test endpoints with Postman/curl
3. Implement mobile hooks and UI
4. Test on Android emulator
