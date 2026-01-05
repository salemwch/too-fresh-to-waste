export interface GeoPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface GeoBounds {
  northeast: GeoCoordinate;
  southwest: GeoCoordinate;
}

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
}

export interface Distance {
  value: number; // in meters
  unit: DistanceUnit;
  formatted: string; // "1.5 km" or "500 m"
}

export enum DistanceUnit {
  METERS = 'meters',
  KILOMETERS = 'kilometers',
  MILES = 'miles'
}

export interface ProximitySearchResult<T = any> {
  item: T;
  distance: Distance;
  geoData: {
    coordinates: GeoCoordinate;
    address?: AddressInfo;
  };
}

export interface AddressInfo {
  street?: string;
  city: string;
  postalCode: string;
  country: string;
  formattedAddress?: string;
}

export interface GeocodingResult {
  coordinates: GeoCoordinate;
  address: AddressInfo;
  bounds?: GeoBounds;
  accuracy: GeocodingAccuracy;
  provider: string;
}

export enum GeocodingAccuracy {
  ROOFTOP = 'rooftop',
  RANGE_INTERPOLATED = 'range_interpolated',
  GEOMETRIC_CENTER = 'geometric_center',
  APPROXIMATE = 'approximate'
}

export interface ReverseGeocodingResult {
  coordinates: GeoCoordinate;
  addresses: AddressInfo[];
  primaryAddress: AddressInfo;
}

export interface GeofenceConfig {
  center: GeoCoordinate;
  radius: number; // in meters
  name: string;
  description?: string;
}

export interface GeofenceResult {
  isInside: boolean;
  distance: Distance;
  geofence: GeofenceConfig;
}

export interface RouteInfo {
  distance: Distance;
  duration: {
    value: number; // in seconds
    formatted: string; // "15 min"
  };
  steps?: RouteStep[];
  polyline?: string; // encoded polyline
}

export interface RouteStep {
  instruction: string;
  distance: Distance;
  duration: {
    value: number;
    formatted: string;
  };
  startLocation: GeoCoordinate;
  endLocation: GeoCoordinate;
}

export interface GeoSearchFilter {
  center: GeoCoordinate;
  radius: number; // in meters
  bounds?: GeoBounds;
  categories?: string[];
  tags?: string[];
  excludeIds?: string[];
}

export interface EstablishmentGeoData {
  _id: string;
  name: string;
  type: string;
  address: AddressInfo;
  coordinates: GeoCoordinate;
  averageRating?: number;
  totalOffers?: number;
  isActive: boolean;
  isVerified: boolean;
}

export interface OfferGeoData {
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

export interface UserLocationPreferences {
  defaultLocation?: GeoCoordinate;
  searchRadius: number; // in meters
  savedLocations: SavedLocation[];
  locationHistory: LocationHistoryEntry[];
  autoDetectLocation: boolean;
  shareLocation: boolean;
}

export interface SavedLocation {
  id: string;
  name: string;
  coordinates: GeoCoordinate;
  address: AddressInfo;
  category: LocationCategory;
  createdAt: Date;
}

export enum LocationCategory {
  HOME = 'home',
  WORK = 'work',
  FAVORITE = 'favorite',
  OTHER = 'other'
}

export interface LocationHistoryEntry {
  coordinates: GeoCoordinate;
  timestamp: Date;
  accuracy: number; // in meters
  source: LocationSource;
}

export enum LocationSource {
  GPS = 'gps',
  NETWORK = 'network',
  PASSIVE = 'passive',
  MANUAL = 'manual',
  IP = 'ip'
}

export interface GeoAnalytics {
  popularAreas: PopularArea[];
  demandHeatmap: HeatmapPoint[];
  travelPatterns: TravelPattern[];
  serviceRadius: ServiceRadiusAnalysis;
}

export interface PopularArea {
  center: GeoCoordinate;
  radius: number;
  ordersCount: number;
  uniqueUsers: number;
  averageOrderValue: number;
  topCategories: string[];
}

export interface HeatmapPoint {
  coordinates: GeoCoordinate;
  intensity: number; // 0-1
  orderCount: number;
  value?: number; // revenue, orders, etc.
}

export interface TravelPattern {
  from: GeoCoordinate;
  to: GeoCoordinate;
  frequency: number;
  averageDistance: Distance;
  averageDuration: number;
}

export interface ServiceRadiusAnalysis {
  establishmentId: string;
  optimalRadius: number;
  coverageArea: number; // in square km
  reachableUsers: number;
  competitorCount: number;
}