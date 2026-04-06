import type { UserRole, UserStatus } from '../enums/user.enum';

/**
 * User address with optional GeoJSON coordinates
 */
export interface UserAddress {
  street: string;
  city: string;
  postalCode: string;
  country: string;
  coordinates?: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
}

/**
 * User location preferences
 */
export interface UserLocationPreferences {
  defaultLocation?: {
    latitude: number;
    longitude: number;
  };
  searchRadius?: number;
  autoDetectLocation?: boolean;
  shareLocation?: boolean;
}

/**
 * Privacy settings returned with user profile
 */
export interface UserPrivacySettings {
  dataProcessingConsent: boolean;
  locationTrackingConsent: boolean;
  marketingOptIn: boolean;
  gdprConsentGiven: boolean;
}

/**
 * Safe user data returned to clients after registration/login.
 * Mirrors backend SafeUserResponse (auth/DTO/safe-user-response.dto.ts).
 *
 * Note: backend returns Date objects; JSON serialization converts them to ISO strings.
 */
export interface UserResponse {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  role: UserRole;
  status: UserStatus;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  avatar?: string;
  profileImage?: string | null;
  address?: UserAddress;
  locationPreferences?: UserLocationPreferences;
  privacySettings?: UserPrivacySettings;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

export interface UserPreferences {
  language: string;
  currency: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  theme: 'light' | 'dark' | 'system';
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
}
