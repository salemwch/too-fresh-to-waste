# Offers API Implementation Guide - Mobile App

This document outlines all available offer endpoints from the backend and how to use them in the mobile app, particularly for the HomeScreen.

## ✅ Implementation Status

**Backend:** Fully implemented with recommended offers endpoint
**Mobile Service:** ✅ `getRecommendedOffers` added to `offersService.ts`
**Mobile Hooks:** ✅ `useRecommendedOffers` added to `useOffers.ts`
**HomeScreen:** ✅ Updated with 4 sections:
  1. **For You** (Recommended) - Personalized offers based on favorites
  2. **Urgent Deals** (Featured) - Auto-featured urgent offers
  3. **Hottest Deals** - Offers with 70%+ discount
  4. **Near You** (Nearby) - Location-based offers

---

## 📋 Table of Contents

1. [Available Endpoints](#available-endpoints)
2. [HomeScreen Sections](#homescreen-sections)
3. [API Implementation Examples](#api-implementation-examples)
4. [State Management Strategy](#state-management-strategy)
5. [Performance Considerations](#performance-considerations)

---

## 🎯 Available Endpoints

### 1. **GET /api/v1/offers/recommended** 🆕
**Purpose:** Personalized offer recommendations based on user favorites
**Authentication:** Required (JWT)
**Use Case:** "For You" section in HomeScreen

**Query Parameters:**
- `limit` (optional, default: 20, max: 100) - Number of offers to return

**Business Logic:**
- Priority 1: Offers from user's favorited establishments
- Priority 2: Offers in user's favorited categories
- Fallback: Featured offers (if no favorites exist)

**Ranking:**
- Favorited establishments first
- Highest discount percentage
- Expiring soon (urgent offers prioritized)
- Newest first (tie-breaker)

**Hard Filters Applied:**
- ✅ `status = ACTIVE`
- ✅ `isActive = true`
- ✅ `availableQuantity > 0` (not sold out)
- ✅ `availableUntil >= now` (not expired)
- ✅ `availableFrom <= now` (already started)

**Response:**
```json
{
  "message": "Recommended offers retrieved successfully",
  "data": [...offers],
  "count": 15
}
```

---

### 2. **GET /api/v1/offers/featured**
**Purpose:** Auto-featured and manually featured offers
**Authentication:** Public (no auth required)
**Use Case:** "Featured" or "Urgent Deals" section

**Query Parameters:**
- `limit` (optional, default: 10, max: 100)

**Business Logic:**
- Returns offers where `isFeaturedManual = true` OR `isFeaturedAuto = true`
- Auto-featured = urgent offers (existed ≥2h, ≤1.5h remaining)
- Manually featured = admin-promoted offers

**Filters:**
- `status = ACTIVE`
- `isFeatured = true` (virtual field combining manual + auto)
- `isActive = true`
- `availableFrom <= now`
- `availableUntil >= now`

**Sort:** `createdAt DESC`

**Response:**
```json
{
  "message": "Featured offers retrieved successfully",
  "data": [...offers]
}
```

---

### 3. **GET /api/v1/offers/nearby**
**Purpose:** Offers near user's location
**Authentication:** Public
**Use Case:** "Near You" section

**Query Parameters:**
- `longitude` (required) - User's longitude
- `latitude` (required) - User's latitude
- `maxDistance` (optional, default: 5000) - Max distance in meters
- `limit` (optional, default: 20, max: 100)

**Business Logic:**
- Uses geospatial queries with 2dsphere index
- Calculates distance to establishment
- Returns offers sorted by proximity

**Filters:**
- `status = ACTIVE`
- `isActive = true`
- `availableFrom <= now`
- `availableUntil >= now`
- Establishment within `maxDistance` radius

**Sort:** `distance ASC` (closest first)

**Response:**
```json
{
  "message": "Nearby offers retrieved successfully",
  "data": [
    {
      ...offer,
      "distance": 1234 // meters
    }
  ]
}
```

---

### 4. **GET /api/v1/offers** (Search/Browse All)
**Purpose:** Browse and search all offers with filters
**Authentication:** Public
**Use Case:** "Browse All" section, search results

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 12, max: 100)
- `search` (optional) - Full-text search (title, description)
- `type` (optional) - `surprise_bag`, `specific_items`, `meal_deal`
- `categories` (optional) - Array of category names
- `tags` (optional) - Array of tags
- `minPrice` (optional) - Minimum discounted price
- `maxPrice` (optional) - Maximum discounted price
- `minDiscount` (optional) - Minimum discount percentage
- `establishmentId` (optional) - Filter by establishment
- `merchantId` (optional) - Filter by merchant
- `sortBy` (optional) - `created_at`, `price`, `discount`, `expiry`
- `sortOrder` (optional) - `asc`, `desc`
- `longitude` + `latitude` + `maxDistance` (optional) - Geolocation filter

**Business Logic:**
- Most flexible endpoint for advanced filtering
- Supports full-text search
- Supports geolocation-based filtering
- Pagination support

**Auto-applied Filters (for public queries):**
- `status = ACTIVE`
- `isActive = true`
- `availableFrom <= now`
- `availableUntil >= now`

**Default Sort:** `createdAt DESC`

**Response:**
```json
{
  "message": "Offers retrieved successfully",
  "data": [...offers],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 47,
    "totalPages": 4
  }
}
```

---

### 5. **GET /api/v1/offers/establishment/:establishmentId**
**Purpose:** All offers from a specific establishment
**Authentication:** Public
**Use Case:** Establishment detail page

**Query Parameters:**
- `page` (optional, default: 1)
- `limit` (optional, default: 10, max: 100)

**Response:**
```json
{
  "message": "Establishment offers retrieved successfully",
  "data": [...offers],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 5,
    "totalPages": 1
  }
}
```

---

### 6. **GET /api/v1/offers/:id**
**Purpose:** Get single offer details
**Authentication:** Public
**Use Case:** Offer detail page

**Response:**
```json
{
  "message": "Offer retrieved successfully",
  "data": {
    ...offer,
    "establishment": {...},
    "merchant": {...}
  }
}
```

**Note:** Automatically increments `viewCount` on each request.

---

## 🏠 HomeScreen Sections

### Recommended Section Structure

```typescript
// HomeScreen sections (suggested layout)
const HOME_SECTIONS = {
  // 1. Personalized Section (Requires Auth)
  FOR_YOU: {
    title: 'For You',
    subtitle: 'Based on your favorites',
    endpoint: '/offers/recommended',
    limit: 10,
    requiresAuth: true,
    fallback: 'FEATURED', // Show featured if not logged in
  },

  // 2. Urgent Deals Section
  FEATURED: {
    title: 'Urgent Deals',
    subtitle: 'Ending soon - act fast!',
    endpoint: '/offers/featured',
    limit: 10,
    requiresAuth: false,
  },

  // 3. Nearby Section (Requires Location)
  NEARBY: {
    title: 'Near You',
    subtitle: 'Offers in your area',
    endpoint: '/offers/nearby',
    limit: 15,
    requiresAuth: false,
    requiresLocation: true,
  },

  // 4. Hottest Deals (Highest Discount)
  HOTTEST: {
    title: 'Hottest Deals',
    subtitle: 'Biggest discounts',
    endpoint: '/offers',
    params: {
      sortBy: 'discount',
      sortOrder: 'desc',
      minDiscount: 70,
      limit: 10,
    },
    requiresAuth: false,
  },

  // 5. New Arrivals
  NEW_ARRIVALS: {
    title: 'New Arrivals',
    subtitle: 'Just listed',
    endpoint: '/offers',
    params: {
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit: 10,
    },
    requiresAuth: false,
  },

  // 6. Surprise Bags (Popular category)
  SURPRISE_BAGS: {
    title: 'Surprise Bags',
    subtitle: 'Mystery food boxes',
    endpoint: '/offers',
    params: {
      type: 'surprise_bag',
      limit: 10,
    },
    requiresAuth: false,
  },
};
```

---

## 💻 API Implementation Examples

### Service Implementation (`offersService.ts`)

**✅ ALREADY IMPLEMENTED** - Located at `apps/mobile/src/features/offers/services/offersService.ts`

The service uses a custom response wrapper to handle the backend's `TransformInterceptor`:

```typescript
/**
 * Get personalized recommended offers (requires authentication)
 * Based on user's favorited establishments and categories
 *
 * @param limit - Maximum number of offers (default 20)
 * @param accessToken - JWT access token
 * @returns List of recommended offers
 */
async getRecommendedOffers(limit: number = 20, accessToken: string): Promise<OfferListItem[]> {
  const url = `${this.baseURL}/recommended?limit=${limit}`;
  return this.makeRequest<OfferListItem[]>('GET', url, undefined, {
    Authorization: `Bearer ${accessToken}`,
  });
}

// 2. Get Featured Offers (Urgent Deals)
export const getFeaturedOffers = async (limit: number = 10): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers/featured', {
    params: { limit },
  });
  return response.data;
};

// 3. Get Nearby Offers
export const getNearbyOffers = async (
  longitude: number,
  latitude: number,
  maxDistance: number = 5000,
  limit: number = 15
): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers/nearby', {
    params: { longitude, latitude, maxDistance, limit },
  });
  return response.data;
};

// 4. Get Hottest Deals (Highest Discount)
export const getHottestDeals = async (limit: number = 10): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers', {
    params: {
      sortBy: 'discount',
      sortOrder: 'desc',
      minDiscount: 70,
      limit,
    },
  });
  return response.data;
};

// 5. Get New Arrivals
export const getNewArrivals = async (limit: number = 10): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers', {
    params: {
      sortBy: 'created_at',
      sortOrder: 'desc',
      limit,
    },
  });
  return response.data;
};

// 6. Get Surprise Bags
export const getSurpriseBags = async (limit: number = 10): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers', {
    params: {
      type: 'surprise_bag',
      limit,
    },
  });
  return response.data;
};

// 7. Browse All Offers (with filters)
export const browseOffers = async (
  page: number = 1,
  limit: number = 12,
  filters?: {
    search?: string;
    type?: 'surprise_bag' | 'specific_items' | 'meal_deal';
    categories?: string[];
    tags?: string[];
    minPrice?: number;
    maxPrice?: number;
    minDiscount?: number;
    sortBy?: 'created_at' | 'price' | 'discount' | 'expiry';
    sortOrder?: 'asc' | 'desc';
  }
): Promise<OffersResponse> => {
  const response = await apiClient.get('/offers', {
    params: {
      page,
      limit,
      ...filters,
    },
  });
  return response.data;
};

// 8. Get Offer Details
export const getOfferById = async (id: string): Promise<{ data: Offer }> => {
  const response = await apiClient.get(`/offers/${id}`);
  return response.data;
};

// 9. Get Establishment Offers
export const getEstablishmentOffers = async (
  establishmentId: string,
  page: number = 1,
  limit: number = 10
): Promise<OffersResponse> => {
  const response = await apiClient.get(`/offers/establishment/${establishmentId}`, {
    params: { page, limit },
  });
  return response.data;
};
```

---

### TanStack Query Hooks (`useOffers.ts`)

**✅ ALREADY IMPLEMENTED** - Located at `apps/mobile/src/features/offers/hooks/useOffers.ts`

The hooks use Redux for auth state and TanStack Query for caching:

```typescript
/**
 * Fetch personalized recommended offers (requires authentication)
 */
export function useRecommendedOffers(
  limit: number = 20,
  options?: Omit<UseQueryOptions<OfferListItem[], Error>, 'queryKey' | 'queryFn'>,
) {
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);

  return useQuery<OfferListItem[], Error>({
    queryKey: offerKeys.recommended(limit),
    queryFn: async () => {
      if (!accessToken) {
        throw new Error('Authentication required for recommended offers');
      }
      Logger.info('Fetching recommended offers', { limit });
      const offers = await offersService.getRecommendedOffers(limit, accessToken);
      Logger.info('Recommended offers fetched', { count: offers.length });
      return offers;
    },
    enabled: isAuthenticated && !!accessToken, // Only fetch if authenticated
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes in cache
    ...options,
  });
}

// 2. Featured Offers (Urgent Deals)
export const useFeaturedOffers = (limit: number = 10) => {
  return useQuery({
    queryKey: ['offers', 'featured', limit],
    queryFn: () => offersService.getFeaturedOffers(limit),
    staleTime: 2 * 60 * 1000, // 2 minutes (refresh frequently - urgent!)
  });
};

// 3. Nearby Offers
export const useNearbyOffers = (
  maxDistance: number = 5000,
  limit: number = 15
) => {
  const { location } = useLocation(); // Your location hook

  return useQuery({
    queryKey: ['offers', 'nearby', location?.longitude, location?.latitude, maxDistance, limit],
    queryFn: () =>
      offersService.getNearbyOffers(
        location!.longitude,
        location!.latitude,
        maxDistance,
        limit
      ),
    enabled: !!location, // Only fetch if location is available
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// 4. Hottest Deals
export const useHottestDeals = (limit: number = 10) => {
  return useQuery({
    queryKey: ['offers', 'hottest', limit],
    queryFn: () => offersService.getHottestDeals(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// 5. New Arrivals
export const useNewArrivals = (limit: number = 10) => {
  return useQuery({
    queryKey: ['offers', 'new', limit],
    queryFn: () => offersService.getNewArrivals(limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// 6. Surprise Bags
export const useSurpriseBags = (limit: number = 10) => {
  return useQuery({
    queryKey: ['offers', 'surprise-bags', limit],
    queryFn: () => offersService.getSurpriseBags(limit),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};
```

---

### HomeScreen Implementation Example

```typescript
import React from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useRecommendedOffers,
  useFeaturedOffers,
  useNearbyOffers,
  useHottestDeals,
} from '@/features/offers/hooks/useOffers';
import { OfferSection } from '@/features/offers/components/OfferSection';

export const HomeScreen = () => {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Fetch different offer sections
  const recommended = useRecommendedOffers(10);
  const featured = useFeaturedOffers(10);
  const nearby = useNearbyOffers(5000, 15);
  const hottest = useHottestDeals(10);

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['offers'] });
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Section 1: For You (only if authenticated) */}
      {isAuthenticated && recommended.data && (
        <OfferSection
          title="For You"
          subtitle="Based on your favorites"
          offers={recommended.data.data}
          isLoading={recommended.isLoading}
          error={recommended.error}
        />
      )}

      {/* Section 2: Urgent Deals (Featured) */}
      <OfferSection
        title="Urgent Deals ⚡"
        subtitle="Ending soon - act fast!"
        offers={featured.data?.data}
        isLoading={featured.isLoading}
        error={featured.error}
        variant="urgent" // Red/orange styling
      />

      {/* Section 3: Near You */}
      {nearby.data && (
        <OfferSection
          title="Near You"
          subtitle="Offers in your area"
          offers={nearby.data.data}
          isLoading={nearby.isLoading}
          error={nearby.error}
        />
      )}

      {/* Section 4: Hottest Deals */}
      <OfferSection
        title="Hottest Deals 🔥"
        subtitle="Biggest discounts"
        offers={hottest.data?.data}
        isLoading={hottest.isLoading}
        error={hottest.error}
      />
    </ScrollView>
  );
};
```

---

## 🎨 State Management Strategy

### Query Key Naming Convention

```typescript
// Recommended structure for query keys
const QUERY_KEYS = {
  offers: {
    all: ['offers'] as const,
    lists: () => [...QUERY_KEYS.offers.all, 'list'] as const,
    list: (filters: object) => [...QUERY_KEYS.offers.lists(), filters] as const,
    details: () => [...QUERY_KEYS.offers.all, 'detail'] as const,
    detail: (id: string) => [...QUERY_KEYS.offers.details(), id] as const,
    recommended: (limit: number) => [...QUERY_KEYS.offers.all, 'recommended', limit] as const,
    featured: (limit: number) => [...QUERY_KEYS.offers.all, 'featured', limit] as const,
    nearby: (coords: { lng: number; lat: number }, distance: number, limit: number) =>
      [...QUERY_KEYS.offers.all, 'nearby', coords, distance, limit] as const,
    hottest: (limit: number) => [...QUERY_KEYS.offers.all, 'hottest', limit] as const,
  },
};
```

---

## ⚡ Performance Considerations

### 1. **Stale Time Configuration**
- **Featured Offers:** 2 minutes (urgent, update frequently)
- **Recommended Offers:** 5 minutes (personalized, moderate freshness)
- **Nearby Offers:** 5 minutes (location-based, moderate)
- **Hottest/New Arrivals:** 10 minutes (less time-sensitive)

### 2. **Pagination Strategy**
- Use `limit` parameter to control initial load size
- Implement infinite scroll for "Browse All" section
- Keep HomeScreen sections small (10-15 items max)

### 3. **Caching Strategy**
```typescript
// Example: Prefetch offer details on card press
const prefetchOfferDetails = (offerId: string) => {
  queryClient.prefetchQuery({
    queryKey: ['offers', 'detail', offerId],
    queryFn: () => offersService.getOfferById(offerId),
  });
};
```

### 4. **Error Handling**
```typescript
// Graceful fallbacks
const { data, isLoading, error } = useRecommendedOffers();

if (error) {
  // Fallback to featured offers
  return <FeaturedOffersSection />;
}
```

### 5. **Optimistic Updates**
```typescript
// Example: Favorite an offer (optimistic update)
const favoriteOffer = useMutation({
  mutationFn: (offerId: string) => api.post(`/favorites/${offerId}`),
  onMutate: async (offerId) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['offers'] });

    // Optimistically update cache
    queryClient.setQueryData(['offers', 'recommended'], (old: any) => ({
      ...old,
      data: old.data.map((offer: Offer) =>
        offer.id === offerId ? { ...offer, isFavorite: true } : offer
      ),
    }));
  },
});
```

---

## 📊 Analytics Events (Recommended)

Track these events for data-driven improvements:

```typescript
// Track which sections users engage with most
analytics.track('home_section_viewed', {
  section: 'recommended', // 'featured', 'nearby', 'hottest'
  offers_count: 10,
});

analytics.track('offer_card_clicked', {
  offer_id: '507f1f77bcf86cd799439011',
  section: 'recommended',
  position: 0, // Card position in section
});

analytics.track('offer_section_scrolled', {
  section: 'featured',
  scroll_depth: 'full', // 'partial' | 'full'
});
```

---

## 🔐 Authentication Handling

```typescript
// Handle unauthenticated users gracefully
const HomeScreen = () => {
  const { isAuthenticated } = useAuth();
  const recommended = useRecommendedOffers(10);

  // Show featured offers instead for unauthenticated users
  if (!isAuthenticated || recommended.error?.response?.status === 401) {
    return <FeaturedOffersSection />;
  }

  return <RecommendedOffersSection data={recommended.data} />;
};
```

---

## 🚀 Next Steps

1. ✅ **Backend API is ready** - All endpoints implemented
2. 📱 **Implement Service Layer** - Create `offersService.ts` with all methods
3. 🎣 **Create React Query Hooks** - Use TanStack Query for state management
4. 🎨 **Design HomeScreen Layout** - Implement sections with horizontal scrolling
5. 📊 **Add Analytics** - Track user engagement per section
6. 🧪 **Test Error States** - Handle network errors, empty states, location permission
7. 🔄 **Implement Pull-to-Refresh** - Allow users to refresh offers manually
8. ♿ **Accessibility** - Add screen reader support, proper labels

---

## 📝 Notes

- **Recommended Offers** require user authentication and favorites data
- **Featured Offers** use the auto-featuring system (urgent offers get auto-promoted)
- **Nearby Offers** require location permissions
- All endpoints return sanitized data via `OfferPresenter` (backend security)
- Soft-deleted offers are automatically excluded from all queries
- Sold-out and expired offers are filtered at the backend level

---

**Last Updated:** 2026-01-10
**Backend Version:** v1.0.0
**API Base URL:** `/api/v1/offers`
