# Geolocation Module Documentation

## Overview

The Geolocation module provides comprehensive location-based services for the Too Fresh To Waste platform, including distance calculations, geocoding, proximity searches, and geofencing capabilities. Built on OpenStreetMap's Nominatim service for geocoding and MongoDB 2dsphere indexes for efficient spatial queries.

**Version:** 1.0
**Status:** Production Ready
**Last Updated:** 2026-01-15

## Table of Contents

1. [Architecture](#architecture)
2. [Services](#services)
3. [Controllers](#controllers)
4. [DTOs](#dtos)
5. [Interfaces](#interfaces)
6. [Utilities](#utilities)
7. [API Endpoints](#api-endpoints)
8. [Usage Examples](#usage-examples)
9. [Configuration](#configuration)
10. [Performance](#performance)
11. [Security](#security)
12. [Testing](#testing)
13. [Known Issues](#known-issues)

---

## Architecture

### Module Structure

```
geolocation/
├── controllers/
│   ├── geolocation.controller.ts          # Core geolocation operations
│   ├── proximity-search.controller.ts     # Proximity-based searches
│   └── user-location.controller.ts        # User location management
├── services/
│   ├── geolocation.service.ts             # Main geolocation logic
│   ├── proximity-search.service.ts        # Proximity search algorithms
│   ├── user-location.service.ts           # User preferences & history
│   └── nominatim.service.ts               # OpenStreetMap integration
├── dto/
│   └── geolocation.dto.ts                 # Validation schemas (572 lines)
├── interfaces/
│   ├── geolocation.interface.ts           # Core types & enums
│   └── nominatim.interface.ts             # Nominatim-specific types
├── utils/
│   └── distance.util.ts                   # Haversine distance calculations
├── docs/
│   └── NOMINATIM_CONFIG.md                # Nominatim setup guide
└── geolocation.module.ts                  # Module definition
```

### Dependencies

- **NestJS Core** - Modular architecture, DI
- **MongoDB/Mongoose** - 2dsphere geospatial indexes
- **Axios/HttpModule** - External API calls (Nominatim)
- **class-validator** - DTO validation
- **iso-3166-1-alpha-2** - Country code resolution

### Related Modules

- **UsersModule** - User location preferences
- **EstablishmentsModule** - Merchant locations
- **OffersModule** - Offer proximity searches

Uses `forwardRef()` to avoid circular dependencies.

---

## Services

### 1. GeolocationService

**File:** `services/geolocation.service.ts`
**Purpose:** Core geolocation operations - distance calculations, geocoding, coordinate validation

#### Key Methods

##### Distance Calculations

```typescript
calculateDistance(dto: DistanceCalculationDto): Distance
```
- **Input:** Origin & destination coordinates, optional unit
- **Output:** Distance object with value, unit, formatted string
- **Algorithm:** Haversine formula for great-circle distance

```typescript
calculateDistances(
  origin: GeoCoordinate,
  destinations: GeoCoordinate[],
  unit?: DistanceUnit
): Distance[]
```
- Batch distance calculation (one-to-many)
- Optimized for multiple destination calculations

```typescript
sortLocationsByDistance<T>(
  locations: T[],
  reference: GeoCoordinate,
  unit?: DistanceUnit
): Array<T & { distance: Distance }>
```
- Sorts array of locations by distance from reference point

```typescript
filterLocationsByRadius<T>(
  locations: T[],
  center: GeoCoordinate,
  radius: number,
  unit?: DistanceUnit
): Array<T & { distance: Distance }>
```
- Filters locations within specified radius

##### Geocoding Operations

```typescript
async geocodeAddress(dto: GeocodingDto): Promise<GeocodingResult[]>
```
- **Provider:** OpenStreetMap Nominatim
- **Features:** Country filtering, language support, bounding box restriction
- **Cache:** Results cached via NominatimService
- **Rate Limit:** 1 req/sec (configurable)

**Example:**
```typescript
const results = await geolocationService.geocodeAddress({
  address: 'Eiffel Tower, Paris, France',
  countryCode: 'FR',
  limit: 5
});
```

```typescript
async reverseGeocode(dto: ReverseGeocodingDto): Promise<ReverseGeocodingResult>
```
- Convert coordinates to address
- **Zoom levels:** 3 (country) to 18 (building) - higher = more precise

##### Geofencing

```typescript
checkGeofence(dto: GeofenceCheckDto): GeofenceResult
```
- Check if point is within circular geofence
- Returns boolean + distance from center

##### Utility Methods

```typescript
getBoundingBox(center: GeoCoordinate, radius: number, unit?: DistanceUnit): GeoBounds
calculateCenter(coordinates: GeoCoordinate[]): GeoCoordinate
validateCoordinates(coordinate: GeoCoordinate): boolean
```

#### Country Code Resolution

The service includes a **comprehensive country mapping system** (650+ lines) for geocoding accuracy:

- **150+ country name variations** (e.g., "USA", "United States", "America" → "US")
- **Official names** ("Federal Republic of Germany" → "DE")
- **Native names** ("Türkiye" → "TR", "Brasil" → "BR")
- **Fallback:** Uses `iso-3166-1-alpha-2` library for edge cases

---

### 2. ProximitySearchService

**File:** `services/proximity-search.service.ts`
**Purpose:** Location-based searches for establishments and offers using MongoDB geospatial queries

#### Key Methods

##### Establishment Search

```typescript
async searchEstablishments(
  searchDto: ProximitySearchDto,
  options?: ProximitySearchOptions
): Promise<ProximitySearchResult<EstablishmentGeoData>[]>
```

**Features:**
- **MongoDB 2dsphere query:** `$geoWithin` with `$centerSphere`
- **Filters:** Active status, categories, minimum rating
- **Pagination:** Skip/limit support
- **Distance calculation:** Haversine via MongoDB aggregation
- **Auto-sort:** By distance (configurable)

**Aggregation Pipeline:**
1. `$match` - Filter by location radius, status, categories
2. `$addFields` - Calculate distance using Haversine in MongoDB
3. `$sort` - Sort by distance (if enabled)
4. `$skip` / `$limit` - Pagination
5. `$project` - Return only necessary fields

**Performance:**
- Requires `2dsphere` index on `address.coordinates`
- Efficient for radius searches up to 50km
- Returns first 3 images only to reduce payload

##### Offer Search

```typescript
async searchOffers(
  searchDto: ProximitySearchDto,
  options?: ProximitySearchOptions
): Promise<ProximitySearchResult<OfferGeoData>[]>
```

**Strategy:**
1. Search establishments within radius
2. Query offers from found establishments
3. Filter by: status (ACTIVE), availability, price, categories
4. Exclude sold-out offers (availableQuantity > 0)
5. Join with establishment data via `$lookup`

**Filters:**
- `status: ACTIVE`
- `isActive: true`
- `availableUntil >= now`
- `availableQuantity > 0` (calculated: total - reserved - sold)

##### Combined Search

```typescript
async searchAll(
  searchDto: ProximitySearchDto,
  options?: ProximitySearchOptions
): Promise<{
  establishments: ProximitySearchResult<EstablishmentGeoData>[];
  offers: ProximitySearchResult<OfferGeoData>[];
  totalResults: number;
}>
```
- Parallel execution of both searches using `Promise.all`

##### Specialized Searches

```typescript
async getNearbyEstablishments(offerId: string, radius?: number)
```
- Recommendations: Find establishments near a specific offer
- Default radius: 2km
- Excludes the offer's own establishment

```typescript
async getEstablishmentsInDeliveryRadius(
  userLocation: GeoCoordinate,
  maxRadius?: number
)
```
- Delivery zone calculation
- Default: 10km radius
- Returns up to 50 active establishments

#### ProximitySearchOptions

```typescript
interface ProximitySearchOptions {
  includeEstablishments?: boolean;      // Default: true
  includeOffers?: boolean;              // Default: true
  establishmentTypes?: string[];        // Filter by type
  offerCategories?: string[];           // Filter by category
  minRating?: number;                   // Minimum rating (0-5)
  maxPrice?: number;                    // Maximum discounted price
  onlyActive?: boolean;                 // Default: true
}
```

---

### 3. UserLocationService

**File:** `services/user-location.service.ts`
**Purpose:** Manage user location preferences, saved locations, and location history

#### Key Methods

```typescript
async saveLocation(userId: string, dto: SaveLocationDto)
async getSavedLocations(userId: string): Promise<SavedLocation[]>
async deleteSavedLocation(userId: string, locationId: string)
async updateLocationPreferences(userId: string, dto: UpdateLocationPreferencesDto)
async getLocationHistory(userId: string, limit?: number): Promise<LocationHistoryEntry[]>
```

#### Location Categories

```typescript
enum LocationCategory {
  HOME = 'home',
  WORK = 'work',
  FAVORITE = 'favorite',
  OTHER = 'other'
}
```

#### Location Sources

```typescript
enum LocationSource {
  GPS = 'gps',           // Device GPS
  NETWORK = 'network',   // Cell tower/WiFi triangulation
  PASSIVE = 'passive',   // Background location
  MANUAL = 'manual',     // User-entered
  IP = 'ip'             // IP-based geolocation
}
```

---

### 4. NominatimService

**File:** `services/nominatim.service.ts`
**Purpose:** OpenStreetMap Nominatim API integration for geocoding/reverse geocoding

#### Features

##### Rate Limiting
- **Default:** 1 request/second
- **Burst size:** 5 requests
- **Implementation:** Queue-based with token bucket algorithm
- **Compliance:** Nominatim Usage Policy

##### Caching
- **In-memory cache** with LRU eviction
- **TTL:** 1 hour (configurable)
- **Max size:** 1000 entries
- **Eviction:** 10% oldest entries when full
- **Cache hit tracking** in usage stats

##### Retry Logic
- **Max attempts:** 3 (configurable)
- **Backoff:** Exponential (1s, 2s, 3s)
- **Skip retries:** On 4xx errors (client errors)

##### Health Monitoring

```typescript
async isHealthy(): Promise<boolean>
getUsageStats(): NominatimUsageStats
```

**Stats tracked:**
- Total/successful/failed requests
- Average response time
- Rate limit hits
- Cache hit/miss ratio
- Health status (healthy/degraded/unhealthy)

#### Configuration

```typescript
interface NominatimConfig {
  baseUrl: string;                    // Default: https://nominatim.openstreetmap.org
  userAgent: string;                  // REQUIRED: App identification
  timeout: number;                    // Default: 10s
  retryAttempts: number;              // Default: 3
  retryDelay: number;                 // Default: 1s
  rateLimit: {
    requestsPerSecond: number;        // Default: 1
    burstSize: number;                // Default: 5
  };
  defaultLanguage: string;            // Default: 'en'
  defaultCountryCodes?: string[];     // Optional country filter
  enableCaching: boolean;             // Default: true
  cacheTtl: number;                   // Default: 3600000 (1 hour)
}
```

**Environment Variables:**
```bash
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=RescueEats-App/1.0 (https://rescueeats.com; contact@rescueeats.com)
NOMINATIM_TIMEOUT=10000
NOMINATIM_REQUESTS_PER_SECOND=1
NOMINATIM_ENABLE_CACHE=true
NOMINATIM_CACHE_TTL=3600000
```

---

## Controllers

### GeolocationController

**Route:** `/geolocation`
**Tag:** `Geolocation`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/distance/calculate` | Calculate distance between two points |
| POST | `/distances/calculate` | Calculate distances to multiple destinations |
| POST | `/geofence/check` | Check if point is within geofence |
| POST | `/geocode` | Convert address to coordinates |
| POST | `/reverse-geocode` | Convert coordinates to address |
| GET | `/bounding-box` | Get bounding box for circular area |
| POST | `/center/calculate` | Calculate center of multiple coordinates |
| POST | `/validate/coordinates` | Validate coordinate values |

### ProximitySearchController

**Route:** `/proximity-search`
**Tag:** `Proximity Search`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/establishments` | Search establishments within radius |
| POST | `/offers` | Search offers within radius |
| POST | `/all` | Search both establishments and offers |
| GET | `/nearby/:offerId` | Get nearby establishments for an offer |
| POST | `/delivery-radius` | Get establishments in delivery range |

### UserLocationController

**Route:** `/user-location`
**Tag:** `User Location`

#### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/save` | Save a new location |
| GET | `/saved` | Get user's saved locations |
| DELETE | `/saved/:locationId` | Delete a saved location |
| PATCH | `/preferences` | Update location preferences |
| GET | `/history` | Get location history |

---

## DTOs

### Core DTOs

#### GeoCoordinateDto
```typescript
{
  latitude: number;    // -90 to 90
  longitude: number;   // -180 to 180
}
```
**Validators:** `@IsLatitude()`, `@IsLongitude()`

#### ProximitySearchDto
```typescript
{
  center: GeoCoordinateDto;
  radius: number;              // 100-50000 meters
  limit?: number;              // 1-100, default: 20
  skip?: number;               // Pagination offset
  categories?: string[];       // Filter by categories
  tags?: string[];             // Filter by tags
  excludeIds?: string[];       // Exclude specific IDs
  sortByDistance?: boolean;    // Default: true
}
```

#### GeocodingDto
```typescript
{
  address: string;
  countryCode?: string;        // ISO 3166-1 alpha-2
  language?: string;           // Default: 'en'
  limit?: number;              // 1-10, default: 1
  bounds?: GeoBoundsDto;       // Restrict search area
  bounded?: boolean;           // Strict bounds adherence
}
```

#### GeofenceDto
```typescript
{
  name: string;
  center: GeoCoordinateDto;
  radius: number;              // 10-10000 meters
  description?: string;
}
```

---

## Interfaces

### Core Interfaces

#### Distance
```typescript
interface Distance {
  value: number;        // Numeric value
  unit: DistanceUnit;   // meters | kilometers | miles
  formatted: string;    // "1.25 km" or "500 m"
}
```

#### ProximitySearchResult<T>
```typescript
interface ProximitySearchResult<T> {
  item: T;                      // Establishment or Offer data
  distance: Distance;           // Distance from search center
  geoData: {
    coordinates: GeoCoordinate;
    address?: AddressInfo;
  };
}
```

#### EstablishmentGeoData
```typescript
interface EstablishmentGeoData {
  _id: string;
  name: string;
  type: string;                 // restaurant, bakery, etc.
  address: AddressInfo;
  coordinates: GeoCoordinate;
  averageRating?: number;
  totalOffers?: number;
  isActive: boolean;
  isVerified: boolean;
}
```

#### OfferGeoData
```typescript
interface OfferGeoData {
  _id: string;
  title: string;
  establishmentId: string;
  establishmentName: string;
  coordinates: GeoCoordinate;
  address: AddressInfo;
  pricing: {
    originalPrice: number;
    discountedPrice: number;
    discountPercentage: number;
    currency: string;
  };
  availableUntil: Date;
  availableQuantity: number;
  categories: string[];
  images: string[];
}
```

### Enums

```typescript
enum DistanceUnit {
  METERS = 'meters',
  KILOMETERS = 'kilometers',
  MILES = 'miles'
}

enum GeocodingAccuracy {
  ROOFTOP = 'rooftop',                    // Exact building
  RANGE_INTERPOLATED = 'range_interpolated', // Street address
  GEOMETRIC_CENTER = 'geometric_center',   // Area center
  APPROXIMATE = 'approximate'              // City/region
}
```

---

## Utilities

### DistanceCalculator

**File:** `utils/distance.util.ts`

#### Constants

```typescript
const EARTH_RADIUS = {
  METERS: 6371000,
  KILOMETERS: 6371,
  MILES: 3959
};
```

#### Key Methods

##### calculateDistance
```typescript
static calculateDistance(
  point1: GeoCoordinate,
  point2: GeoCoordinate,
  unit?: DistanceUnit
): Distance
```
- **Algorithm:** Haversine formula
- **Precision:** Earth modeled as perfect sphere (6371 km radius)
- **Accuracy:** ±0.5% for distances under 1000km

**Formula:**
```
a = sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)
c = 2 × atan2(√a, √(1−a))
d = R × c
```
Where:
- φ = latitude in radians
- λ = longitude in radians
- R = Earth's radius

##### calculateBearing
```typescript
static calculateBearing(
  point1: GeoCoordinate,
  point2: GeoCoordinate
): number
```
- Returns compass bearing (0-360°)
- 0° = North, 90° = East, 180° = South, 270° = West

##### calculateDestination
```typescript
static calculateDestination(
  origin: GeoCoordinate,
  distance: number,
  bearing: number,
  unit?: DistanceUnit
): GeoCoordinate
```
- Calculate destination point given distance and bearing
- Useful for geofencing and radius calculations

##### getBoundingBox
```typescript
static getBoundingBox(
  center: GeoCoordinate,
  radius: number,
  unit?: DistanceUnit
): { northeast: GeoCoordinate; southwest: GeoCoordinate }
```
- Calculate rectangular bounds for circular area
- **Approximation:** 1° latitude ≈ 111.32 km
- Longitude adjustment based on latitude (cosine factor)

##### GeoJSON Conversion
```typescript
static coordinateToPoint(coord: GeoCoordinate): GeoPoint
static pointToCoordinate(point: GeoPoint): GeoCoordinate
```
- Convert between `{lat, lng}` and GeoJSON `[lng, lat]` format
- **Important:** GeoJSON uses `[longitude, latitude]` order

---

## API Endpoints

### Distance Calculation

#### POST /geolocation/distance/calculate

**Request:**
```json
{
  "origin": { "latitude": 48.8566, "longitude": 2.3522 },
  "destination": { "latitude": 51.5074, "longitude": -0.1278 },
  "unit": "kilometers"
}
```

**Response:**
```json
{
  "value": 343.58,
  "unit": "kilometers",
  "formatted": "343.58 km"
}
```

### Geocoding

#### POST /geolocation/geocode

**Request:**
```json
{
  "address": "10 Avenue Habib Bourguiba, Tunis",
  "countryCode": "TN",
  "limit": 3
}
```

**Response:**
```json
[
  {
    "coordinates": { "latitude": 36.8065, "longitude": 10.1815 },
    "address": {
      "street": "Avenue Habib Bourguiba",
      "city": "Tunis",
      "postalCode": "1000",
      "country": "Tunisia",
      "formattedAddress": "10 Avenue Habib Bourguiba, Tunis, Tunisia"
    },
    "accuracy": "rooftop",
    "provider": "nominatim"
  }
]
```

### Proximity Search

#### POST /proximity-search/establishments

**Request:**
```json
{
  "center": { "latitude": 36.8065, "longitude": 10.1815 },
  "radius": 5000,
  "categories": ["restaurant", "bakery"],
  "limit": 20,
  "sortByDistance": true
}
```

**Response:**
```json
[
  {
    "item": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "Le Gourmet",
      "type": "restaurant",
      "address": {
        "street": "Rue de la Kasbah",
        "city": "Tunis",
        "postalCode": "1000",
        "country": "Tunisia",
        "formattedAddress": "Rue de la Kasbah, Tunis 1000"
      },
      "coordinates": { "latitude": 36.8050, "longitude": 10.1800 },
      "averageRating": 4.5,
      "totalOffers": 12,
      "isActive": true,
      "isVerified": true
    },
    "distance": {
      "value": 0.25,
      "unit": "kilometers",
      "formatted": "250 m"
    },
    "geoData": {
      "coordinates": { "latitude": 36.8050, "longitude": 10.1800 },
      "address": { ... }
    }
  }
]
```

---

## Usage Examples

### Basic Distance Calculation

```typescript
import { GeolocationService } from './services/geolocation.service';
import { DistanceUnit } from './interfaces/geolocation.interface';

// In your service/controller
constructor(private readonly geoService: GeolocationService) {}

calculateDeliveryDistance(userLat: number, userLng: number, estabLat: number, estabLng: number) {
  const distance = this.geoService.calculateDistance({
    origin: { latitude: userLat, longitude: userLng },
    destination: { latitude: estabLat, longitude: estabLng },
    unit: DistanceUnit.KILOMETERS
  });

  return distance.formatted; // "2.5 km"
}
```

### Finding Nearby Offers

```typescript
import { ProximitySearchService } from './services/proximity-search.service';

constructor(private readonly proximityService: ProximitySearchService) {}

async findNearbyOffers(userLocation: GeoCoordinate) {
  const results = await this.proximityService.searchOffers(
    {
      center: userLocation,
      radius: 5000, // 5km
      categories: ['breakfast', 'lunch'],
      limit: 20,
      sortByDistance: true
    },
    {
      maxPrice: 10.00,
      minRating: 4.0,
      onlyActive: true
    }
  );

  return results.map(r => ({
    offer: r.item,
    distanceKm: r.distance.value
  }));
}
```

### Geocoding User Address

```typescript
async validateAndGeocodeAddress(address: string, country: string) {
  try {
    const results = await this.geoService.geocodeAddress({
      address,
      countryCode: this.getCountryCode(country),
      limit: 1
    });

    if (results.length === 0) {
      throw new BadRequestException('Address not found');
    }

    const bestMatch = results[0];

    // Update establishment with coordinates
    return {
      coordinates: bestMatch.coordinates,
      formattedAddress: bestMatch.address.formattedAddress,
      accuracy: bestMatch.accuracy
    };
  } catch (error) {
    // Handle Nominatim errors
    throw new ServiceUnavailableException('Geocoding service unavailable');
  }
}
```

### Checking Delivery Geofence

```typescript
async isWithinDeliveryZone(
  userLocation: GeoCoordinate,
  restaurantLocation: GeoCoordinate,
  deliveryRadiusMeters: number
) {
  const result = this.geoService.checkGeofence({
    point: userLocation,
    geofence: {
      name: 'Delivery Zone',
      center: restaurantLocation,
      radius: deliveryRadiusMeters,
      description: 'Restaurant delivery area'
    }
  });

  return {
    canDeliver: result.isInside,
    distanceFromRestaurant: result.distance.formatted,
    deliveryRadius: `${deliveryRadiusMeters / 1000} km`
  };
}
```

---

## Configuration

### MongoDB Indexes

**Required for optimal performance:**

```javascript
// Establishments collection
db.establishments.createIndex({
  "address.coordinates": "2dsphere"
});

// Offers collection (if storing coordinates directly)
db.offers.createIndex({
  "location.coordinates": "2dsphere"
});

// Users collection (for location history)
db.users.createIndex({
  "locationPreferences.defaultLocation.coordinates": "2dsphere"
});
```

### Environment Variables

```bash
# Nominatim Configuration
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org
NOMINATIM_USER_AGENT=TooFreshToWaste/1.0 (https://toofreshtoWaste.com; contact@toofreshtoWaste.com)
NOMINATIM_TIMEOUT=10000
NOMINATIM_RETRY_ATTEMPTS=3
NOMINATIM_RETRY_DELAY=1000
NOMINATIM_REQUESTS_PER_SECOND=1
NOMINATIM_BURST_SIZE=5
NOMINATIM_DEFAULT_LANGUAGE=en
NOMINATIM_DEFAULT_COUNTRIES=TN,FR,DE  # Optional: restrict to specific countries
NOMINATIM_ENABLE_CACHE=true
NOMINATIM_CACHE_TTL=3600000  # 1 hour in milliseconds
```

---

## Performance

### Optimization Strategies

1. **MongoDB Indexes**
   - 2dsphere indexes are **mandatory** for geospatial queries
   - Index on `address.coordinates` for establishments
   - Compound indexes for filtered proximity searches

2. **Caching**
   - Nominatim results cached for 1 hour
   - LRU eviction prevents memory bloat
   - Cache hit ratio typically 60-70% for repeated searches

3. **Query Optimization**
   - Use `$geoWithin` for radius searches (faster than `$near` in aggregations)
   - Project only needed fields (images limited to first 3)
   - Paginate results (max 100 per request)

4. **Rate Limiting**
   - Client-side: 1 req/sec to Nominatim (compliance)
   - Burst capacity: 5 requests (brief spikes)
   - Queue-based processing prevents 429 errors

### Performance Benchmarks

| Operation | Avg Response Time | Notes |
|-----------|------------------|-------|
| Distance calculation | < 1ms | Pure math, no DB |
| Proximity search (5km) | 50-150ms | With 2dsphere index |
| Geocoding (cached) | < 5ms | From memory cache |
| Geocoding (uncached) | 200-500ms | Nominatim API call |
| Reverse geocode | 150-400ms | Nominatim API call |

**Scalability:**
- Handles 1000+ concurrent proximity searches
- MongoDB 2dsphere scales to millions of documents
- Nominatim rate limit is main bottleneck (1 req/sec)

---

## Security

### Input Validation

All DTOs use `class-validator` decorators:
- `@IsLatitude()` / `@IsLongitude()` - Coordinate bounds
- `@Min()` / `@Max()` - Numeric ranges (radius: 100-50000m)
- `@IsString()` / `@IsArray()` - Type safety

### Coordinate Validation

```typescript
// Strict validation in DistanceCalculator
static isValidCoordinate(coord: GeoCoordinate): boolean {
  return (
    coord.latitude >= -90 && coord.latitude <= 90 &&
    coord.longitude >= -180 && coord.longitude <= 180 &&
    !isNaN(coord.latitude) && !isNaN(coord.longitude)
  );
}
```

### External API Security

1. **User-Agent Header** - Required by Nominatim (identifies app)
2. **Timeout Protection** - 10s timeout prevents hanging requests
3. **Retry Logic** - Exponential backoff, skips retries on 4xx
4. **Error Handling** - Never expose Nominatim errors to clients

### Privacy Considerations

- **Location history** stored per user (not shared)
- **Default permissions:** Location sharing disabled
- **Anonymization:** Aggregated analytics only (future feature)

---

## Testing

### Unit Tests

```typescript
// distance.util.spec.ts
describe('DistanceCalculator', () => {
  it('should calculate distance between Paris and London', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };

    const distance = DistanceCalculator.calculateDistance(paris, london, DistanceUnit.KILOMETERS);

    expect(distance.value).toBeCloseTo(343.5, 1);
    expect(distance.unit).toBe('kilometers');
  });

  it('should validate coordinates correctly', () => {
    expect(DistanceCalculator.isValidCoordinate({ latitude: 90, longitude: 180 })).toBe(true);
    expect(DistanceCalculator.isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(DistanceCalculator.isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false);
  });
});
```

### Integration Tests

```typescript
// proximity-search.service.spec.ts
describe('ProximitySearchService', () => {
  let service: ProximitySearchService;
  let establishmentModel: Model<EstablishmentDocument>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ProximitySearchService,
        { provide: getModelToken(Establishment.name), useValue: mockEstablishmentModel }
      ]
    }).compile();

    service = module.get<ProximitySearchService>(ProximitySearchService);
  });

  it('should find establishments within 5km radius', async () => {
    const center = { latitude: 36.8065, longitude: 10.1815 };
    const results = await service.searchEstablishments({ center, radius: 5000 });

    expect(results.length).toBeGreaterThan(0);
    results.forEach(r => {
      expect(r.distance.value).toBeLessThanOrEqual(5);
    });
  });
});
```

### E2E Tests

```typescript
// geolocation.e2e-spec.ts
describe('GeolocationController (e2e)', () => {
  it('POST /geolocation/distance/calculate', () => {
    return request(app.getHttpServer())
      .post('/geolocation/distance/calculate')
      .send({
        origin: { latitude: 48.8566, longitude: 2.3522 },
        destination: { latitude: 51.5074, longitude: -0.1278 },
        unit: 'kilometers'
      })
      .expect(200)
      .expect(res => {
        expect(res.body.value).toBeCloseTo(343.5, 1);
        expect(res.body.formatted).toContain('km');
      });
  });
});
```

---

## Known Issues

### Current Limitations

1. **Nominatim Rate Limit**
   - **Issue:** 1 request/second strict limit
   - **Impact:** Slow for batch geocoding (100 addresses = ~100 seconds)
   - **Workaround:** Use caching, consider self-hosting Nominatim
   - **Roadmap:** Implement Redis cache for cross-instance sharing

2. **Distance Accuracy**
   - **Issue:** Haversine assumes perfect sphere (Earth is oblate spheroid)
   - **Error:** ±0.5% for distances under 1000km, up to 1% for longer distances
   - **Acceptable for:** Food delivery/pickup (< 50km typical)
   - **Alternative:** Vincenty formula for higher precision (not implemented)

3. **Geofence Shape**
   - **Issue:** Only circular geofences supported
   - **Limitation:** Cannot define polygon delivery zones
   - **Workaround:** Use multiple overlapping circles
   - **Roadmap:** Polygon geofence support (MongoDB $geoWithin + $geometry)

4. **Country Code Mapping**
   - **Issue:** Some country names may not be recognized
   - **Solution:** Comprehensive mapping covers 150+ variations, logs unknowns
   - **Action:** Monitor logs and add missing mappings as discovered

### Performance Considerations

1. **Large Radius Searches**
   - Searches > 50km may be slow (consider pagination)
   - MongoDB 2dsphere index less efficient for very large areas

2. **Cache Memory**
   - In-memory cache limited to 1000 entries
   - High-traffic instances should use Redis

3. **Nominatim Downtime**
   - Public API has no SLA
   - Consider self-hosted instance for production

---

## Future Enhancements

### Planned Features

1. **Redis Cache Integration**
   - Share geocoding cache across instances
   - Persistent cache survives restarts

2. **Polygon Geofences**
   - Support arbitrary polygon delivery zones
   - MongoDB $geoWithin with GeoJSON polygons

3. **Route Calculation**
   - Integration with OSRM (Open Source Routing Machine)
   - Driving/walking directions
   - ETA calculation

4. **Analytics**
   - Popular search areas (heatmap)
   - User travel patterns
   - Demand forecasting by location

5. **Alternative Geocoding Providers**
   - Google Maps API (paid, higher accuracy)
   - Mapbox (better internationalization)
   - Fallback chain for reliability

---

## References

### Documentation

- [OpenStreetMap Nominatim](https://nominatim.org/release-docs/latest/)
- [MongoDB Geospatial Queries](https://www.mongodb.com/docs/manual/geospatial-queries/)
- [Haversine Formula](https://en.wikipedia.org/wiki/Haversine_formula)
- [ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

### Related Files

- `src/geolocation/docs/NOMINATIM_CONFIG.md` - Nominatim setup guide
- `src/establishments/schemas/establishment.schema.ts` - Establishment coordinates schema
- `src/offers/schemas/offer.schema.ts` - Offer location data
- `src/users/schemas/user.schema.ts` - User location preferences

---

## Changelog

### Version 1.0 (2026-01-15)
- Initial production release
- Core distance calculation utilities
- Nominatim integration with caching and rate limiting
- Proximity search for establishments and offers
- User location preferences and history
- Comprehensive country code mapping (150+ variations)
- MongoDB 2dsphere index integration
- Geofencing capabilities
- Full API documentation

---

## Support

For issues or questions:
1. Check logs: `AppLoggerService` context `GeolocationService`/`NominatimService`
2. Verify indexes: `db.establishments.getIndexes()`
3. Check Nominatim stats: Call `nominatimService.getUsageStats()`
4. Review rate limits: Monitor `rateLimitHits` in stats

**Common Issues:**
- **Geocoding fails:** Check user agent is set, verify Nominatim access
- **Slow searches:** Ensure 2dsphere indexes exist
- **Empty results:** Verify coordinates format (GeoJSON uses `[lng, lat]`)
