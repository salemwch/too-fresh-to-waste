// Global type definitions for the Food Waste mobile app

// Redux types
import type { store } from '@/store';

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Navigation types
export interface RootStackParamList extends Record<string, object | undefined> {
  // Deprecated - Legacy support
  Home: undefined;

  // Auth Stack
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  VerifyEmail: { email: string };
  MFAVerification: { mfaToken: string };

  // Main Tab Navigator
  MainTabs: undefined;

  // Offer Stack (Consumer-only)
  OfferDetails: { offerId: string };

  // Order Stack
  OrderDetails: { orderId: string };
  OrderHistory: undefined;
  Checkout: { offerId: string };

  // Profile Stack
  Profile: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Privacy: undefined;
  Security: undefined;

  // Establishment Stack (Consumer-only: view details)
  EstablishmentDetails: { establishmentId: string };

  // Map Stack
  Map: undefined;
  NearbyOffers: { latitude: number; longitude: number };
}

export interface TabParamList {
  Home: undefined;
  Search: { category?: string } | undefined;
  Favorites: undefined;
  Orders: undefined;
  Profile: undefined;
}

// API Response types
export interface ApiResponse<T = unknown> {
  data: T;
  message: string;
  statusCode: number;
  timestamp: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
  method?: string;
}

// Location types
export interface Location {
  latitude: number;
  longitude: number;
}

export interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: Location;
}

// Image/Media types
export interface ImageAsset {
  id: string;
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  size?: number;
  mimeType?: string;
}

// Form types
export interface FormField<T = string> {
  value: T;
  error?: string;
  touched: boolean;
  isValid: boolean;
}

export interface FormState<T extends Record<string, unknown>> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isValid: boolean;
  isSubmitting: boolean;
  hasChanges: boolean;
}

// Filter and search types
export interface SearchFilters {
  query?: string;
  category?: string;
  priceRange?: {
    min: number;
    max: number;
  };
  distance?: number;
  location?: Location;
  sortBy?: 'distance' | 'price' | 'rating' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

// Permission types
export enum Permission {
  LOCATION = 'LOCATION',
  CAMERA = 'CAMERA',
  PHOTO_LIBRARY = 'PHOTO_LIBRARY',
  NOTIFICATIONS = 'NOTIFICATIONS',
  MICROPHONE = 'MICROPHONE',
  CONTACTS = 'CONTACTS',
}

export interface PermissionStatus {
  permission: Permission;
  status: 'granted' | 'denied' | 'restricted' | 'undetermined';
  canRequestAgain: boolean;
}

// Device types
export interface DeviceInfo {
  platform: 'ios' | 'android';
  version: string;
  deviceId: string;
  model: string;
  brand: string;
  systemVersion: string;
  appVersion: string;
  buildNumber: string;
  bundleId: string;
  isEmulator: boolean;
  hasNotch: boolean;
  screenDimensions: {
    width: number;
    height: number;
  };
}

// Theme types
export interface Theme {
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    success: string;
    info: string;
    text: string;
    textSecondary: string;
    textDisabled: string;
    border: string;
    disabled: string;
    placeholder: string;
  };
  fonts: {
    regular: string;
    medium: string;
    bold: string;
    light: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    sm: number;
    md: number;
    lg: number;
    full: number;
  };
  shadows: {
    sm: object;
    md: object;
    lg: object;
  };
}

// Notification types
export interface PushNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
  category?: string;
  userInfo?: Record<string, unknown>;
}

// Analytics types
export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, string | number | boolean>;
  timestamp?: Date;
}

// Feature flag types
export interface FeatureFlags {
  biometricAuth: boolean;
  pushNotifications: boolean;
  locationServices: boolean;
  offlineMode: boolean;
  darkMode: boolean;
  socialLogin: boolean;
  mapIntegration: boolean;
  chatSupport: boolean;
  loyaltyProgram: boolean;
  multiLanguage: boolean;
}

// Cache types
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxAge?: number; // Maximum age in milliseconds
  tags?: string[]; // Cache tags for invalidation
}

// Network types
export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: 'wifi' | 'cellular' | 'bluetooth' | 'ethernet' | 'wimax' | 'vpn' | 'other' | 'unknown';
  details: {
    isConnectionExpensive: boolean;
    cellularGeneration?: '2g' | '3g' | '4g' | '5g';
    strength?: number; // Signal strength 0-100
  };
}

// Biometric types
export interface BiometricResult {
  success: boolean;
  error?: string;
  biometryType?: 'TouchID' | 'FaceID' | 'Fingerprint' | 'None';
}

// Export utility types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Common generic types
export type ID = string;
export type Timestamp = string; // ISO 8601 format
export type Currency = 'TND' | 'EUR' | 'USD'; // Tunisian Dinar, Euro, US Dollar
export type Language = 'en' | 'fr' | 'ar'; // English, French, Arabic

// Re-export types from features
export type {
  User,
  UserRole,
  AuthTokens,
  LoginRequest,
  RegisterRequest,
} from '@/features/auth/types';
