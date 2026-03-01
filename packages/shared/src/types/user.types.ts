import { UserRole, UserStatus } from '../enums/user.enum';

/**
 * Safe user data returned to clients after registration/login.
 * Mirrors backend SafeUserResponse (auth/DTO/safe-user-response.dto.ts).
 *
 * Note: backend returns Date objects; JSON serialization converts them to ISO strings.
 * Consumers should accept both `string | Date` or parse accordingly.
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
  profileImage?: string | null;
  privacySettings?: {
    dataProcessingConsent: boolean;
    locationTrackingConsent: boolean;
    marketingOptIn: boolean;
    gdprConsentGiven: boolean;
  };
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
