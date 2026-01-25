# Urgent Deals API Reference

## 🔥 Quick Start

### **Frontend Usage (React Native)**
```typescript
import { useUrgentOffers } from '@/features/offers/hooks/useOffers';

// In your component:
const {
  data: urgentOffers,
  isLoading,
  error,
  refetch,
} = useUrgentOffers(
  1,  // Hours until expiry
  10, // Limit
  coordinates ? { latitude: coordinates.latitude, longitude: coordinates.longitude } : undefined
);
```

---

## 📡 API Endpoint

### **GET** `/api/v1/offers/urgent`

Returns offers expiring within a specified time window, sorted by soonest expiring first.

#### **Access**
- **Authentication**: ❌ Not required (public endpoint)
- **Rate Limit**: Standard API rate limits apply

#### **Query Parameters**

| Parameter | Type | Required | Default | Max | Description |
|-----------|------|----------|---------|-----|-------------|
| `hoursUntilExpiry` | integer | No | 1 | 24 | Maximum hours until offer expiry |
| `limit` | integer | No | 10 | 100 | Maximum number of offers to return |
| `latitude` | float | No | - | - | User latitude for distance calculation |
| `longitude` | float | No | - | - | User longitude for distance calculation |

#### **Request Example**
```bash
GET /api/v1/offers/urgent?hoursUntilExpiry=1&limit=10&latitude=40.7128&longitude=-74.0060
```

#### **Response Format**
```json
{
  "statusCode": 200,
  "data": {
    "message": "Urgent offers retrieved successfully",
    "data": [
      {
        "id": "507f1f77bcf86cd799439011",
        "title": "Surprise Bag - Bakery Items",
        "description": "Mix of fresh bakery items from today",
        "originalPrice": 15.00,
        "discountedPrice": 4.99,
        "discountPercent": 67,
        "availableFrom": "2026-01-25T08:00:00.000Z",
        "availableUntil": "2026-01-25T09:30:00.000Z",
        "availableQuantity": 3,
        "totalQuantity": 5,
        "status": "active",
        "type": "surprise_bag",
        "establishment": {
          "id": "507f1f77bcf86cd799439012",
          "name": "Fresh Bakery",
          "type": "BAKERY",
          "address": {
            "street": "123 Main St",
            "city": "New York",
            "coordinates": [-74.0060, 40.7128]
          },
          "averageRating": 4.5
        },
        "merchant": {
          "firstName": "John",
          "lastName": "Doe",
          "profileImage": "https://example.com/profile.jpg"
        },
        "images": ["https://example.com/image1.jpg"],
        "pickupWindow": {
          "start": "2026-01-25T09:00:00.000Z",
          "end": "2026-01-25T09:30:00.000Z"
        },
        "distance": 1.2,  // Only present if lat/lng provided
        "isFeatured": true,
        "isFeaturedManual": false,
        "isFeaturedAuto": true,
        "createdAt": "2026-01-25T06:00:00.000Z"
      }
    ],
    "meta": {
      "total": 3,
      "hoursUntilExpiry": 1
    }
  },
  "timestamp": "2026-01-25T08:45:00.000Z"
}
```

#### **Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `data.data[]` | array | List of urgent offers (see Offer object below) |
| `data.meta.total` | integer | Total number of urgent offers matching criteria |
| `data.meta.hoursUntilExpiry` | integer | Hours until expiry threshold used |

#### **Offer Object**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique offer identifier |
| `title` | string | Offer title |
| `description` | string | Offer description |
| `originalPrice` | number | Original price before discount |
| `discountedPrice` | number | Price after discount |
| `discountPercent` | integer | Discount percentage (calculated) |
| `availableFrom` | ISO 8601 | When offer becomes available |
| `availableUntil` | ISO 8601 | When offer expires |
| `availableQuantity` | integer | Remaining quantity |
| `totalQuantity` | integer | Total quantity created |
| `status` | enum | `active`, `expired`, `sold_out` |
| `type` | enum | `surprise_bag`, `specific_items` |
| `establishment` | object | Associated establishment details |
| `merchant` | object | Merchant info (name, profile image) |
| `images` | string[] | Offer image URLs |
| `pickupWindow` | object | Pickup time window |
| `distance` | number | Distance in km (only if lat/lng provided) |
| `isFeatured` | boolean | True if featured (manual or auto) |
| `isFeaturedManual` | boolean | True if manually featured by admin |
| `isFeaturedAuto` | boolean | True if auto-featured (urgency-based) |
| `createdAt` | ISO 8601 | When offer was created |

#### **Error Responses**

##### **400 Bad Request**
```json
{
  "statusCode": 400,
  "message": "Validation failed: hoursUntilExpiry must be a positive integer",
  "timestamp": "2026-01-25T08:45:00.000Z"
}
```

##### **500 Internal Server Error**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "timestamp": "2026-01-25T08:45:00.000Z"
}
```

---

## 🔄 Comparison with Other Endpoints

### **`/offers/urgent` vs `/offers/featured`**

| Aspect | `/urgent` | `/featured` |
|--------|-----------|-------------|
| **Filter** | Time-based (`availableUntil`) | Flag-based (`isFeatured`) |
| **Threshold** | 1 hour (default) | 3 hours (auto) / none (manual) |
| **Sorting** | By expiry time (soonest first) | By created date (newest first) |
| **Use Case** | Time-critical deals | Promoted/highlighted offers |
| **Admin Control** | ❌ Cannot manually add | ✅ Can manually feature |

### **`/offers/urgent` vs `/offers/expiring`**

| Aspect | `/urgent` | `/expiring` |
|--------|-----------|-------------|
| **Authentication** | ❌ Public | ✅ Admin only |
| **Default Threshold** | 1 hour | 24 hours |
| **Purpose** | Customer-facing urgent deals | Admin monitoring |
| **Access** | All users | Admins only |

---

## 🎯 Use Cases

### **1. Urgent Deals Section (Homepage)**
```typescript
// Show offers expiring within 1 hour
const { data } = useUrgentOffers(1, 10, userLocation);
```

### **2. Last-Minute Deals (Push Notification)**
```typescript
// Notify users about offers expiring in 30 minutes
const { data } = useUrgentOffers(0.5, 5, userLocation);
```

### **3. Ending Soon (Search Filter)**
```typescript
// Show all offers ending within 3 hours
const { data } = useUrgentOffers(3, 20, userLocation);
```

---

## 🧪 Testing

### **cURL Examples**

**Basic request (no location):**
```bash
curl -X GET "http://localhost:3000/api/v1/offers/urgent?hoursUntilExpiry=1&limit=10"
```

**With location for distance calculation:**
```bash
curl -X GET "http://localhost:3000/api/v1/offers/urgent?hoursUntilExpiry=1&limit=10&latitude=40.7128&longitude=-74.0060"
```

**Different urgency threshold (2 hours):**
```bash
curl -X GET "http://localhost:3000/api/v1/offers/urgent?hoursUntilExpiry=2&limit=20"
```

### **Postman Collection**
```json
{
  "name": "Get Urgent Offers",
  "request": {
    "method": "GET",
    "url": {
      "raw": "{{base_url}}/api/v1/offers/urgent?hoursUntilExpiry=1&limit=10&latitude=40.7128&longitude=-74.0060",
      "host": ["{{base_url}}"],
      "path": ["api", "v1", "offers", "urgent"],
      "query": [
        { "key": "hoursUntilExpiry", "value": "1" },
        { "key": "limit", "value": "10" },
        { "key": "latitude", "value": "40.7128" },
        { "key": "longitude", "value": "-74.0060" }
      ]
    }
  }
}
```

---

## 📱 Mobile Integration

### **React Query Hook**
```typescript
import { useUrgentOffers } from '@/features/offers/hooks/useOffers';

export function UrgentDealsSection() {
  const { coordinates } = useLocation();

  const {
    data: offers,
    isLoading,
    error,
    refetch,
  } = useUrgentOffers(
    1,  // 1 hour threshold
    10, // 10 offers max
    coordinates
  );

  if (isLoading) return <Skeleton />;
  if (error) return <Error onRetry={refetch} />;
  if (!offers?.length) return <EmptyState />;

  return (
    <FlatList
      data={offers}
      renderItem={({ item }) => <OfferCard offer={item} />}
      keyExtractor={item => item.id}
    />
  );
}
```

### **Cache Configuration**
```typescript
// The hook automatically configures:
{
  staleTime: 60000,     // 1 minute - data is fresh for 1 min
  gcTime: 600000,       // 10 minutes - cache lifetime
  refetchOnWindowFocus: true,  // Refresh when app focuses
  refetchOnReconnect: true,    // Refresh on network reconnect
}
```

---

## 🔧 Backend Implementation

### **Controller (NestJS)**
```typescript
@Get('urgent')
@Public()
@ApiOperation({
  summary: '🚨 Get urgent offers (expiring soon)',
  description: 'Returns offers expiring within a specified time window.'
})
async getUrgentOffers(
  @Query('hoursUntilExpiry', new DefaultValuePipe(1), ParseIntPipe) hoursUntilExpiry: number,
  @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  @Query('latitude') latitudeStr?: string,
  @Query('longitude') longitudeStr?: string,
) {
  // Implementation...
}
```

### **Service Method**
```typescript
async getUrgentOffers(
  hoursUntilExpiry: number = 1,
  page: number = 1,
  limit: number = 10
): Promise<FindAllResult> {
  return this.getExpiringOffers(hoursUntilExpiry, page, limit);
}
```

### **Database Query**
```typescript
const query = {
  status: OfferStatus.ACTIVE,
  availableUntil: {
    $lte: new Date(now.getTime() + hoursUntilExpiry * 60 * 60 * 1000),
    $gte: now
  }
};

const offers = await this.offerModel
  .find(query)
  .sort({ availableUntil: 1 })  // Soonest expiring first
  .limit(safeLimit)
  .lean()
  .exec();
```

---

## 🎓 Best Practices

### **1. Choose Appropriate Threshold**
- **< 30 minutes**: Extremely urgent, use for push notifications
- **1 hour** (default): Ideal for "Urgent Deals" sections
- **2-3 hours**: "Ending Soon" categories

### **2. Handle Empty States**
```typescript
if (!offers?.length) {
  return (
    <EmptyState
      icon="⏰"
      title="No urgent deals right now"
      message="Offers expiring within 1 hour will appear here"
    />
  );
}
```

### **3. Refresh Frequency**
- **Urgent deals**: Refresh every 1-2 minutes
- **Ending soon**: Refresh every 5 minutes
- **User action**: Always refetch on pull-to-refresh

### **4. Error Handling**
```typescript
if (error) {
  return (
    <ErrorState
      message="Failed to load urgent deals"
      onRetry={() => refetch()}
    />
  );
}
```

---

## 📊 Performance Metrics

### **Expected Response Times**
- **Without location**: 50-100ms
- **With location**: 70-120ms
- **High traffic**: 100-200ms

### **Database Performance**
- **Index**: `{ status: 1, availableUntil: 1 }`
- **Query complexity**: O(log n)
- **Memory usage**: Reduced 50% via `.lean()`

### **Caching Strategy**
- **Client cache**: 1 minute stale time
- **Server cache**: None (data is time-critical)
- **CDN**: Not applicable (dynamic data)

---

**Last Updated**: 2026-01-25
**Version**: 1.0.0
**Endpoint**: `/api/v1/offers/urgent`
