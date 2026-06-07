/**
 * User Profile Service
 *
 * API client for user profile operations.
 * Integrates with backend /api/v1/users endpoints.
 *
 * Endpoints:
 * - GET /users/profile - Get current user profile
 * - PATCH /users/profile - Update user profile
 * - PATCH /users/profile/image - Upload profile image
 */

import { apiClient, type BackendApiResponse, unwrapBackendResponse } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import type { User } from '@/features/auth/types';

// ============================================================================
// Types
// ============================================================================

/**
 * User profile update request
 * All fields are optional - only send fields you want to update
 */
interface UpdateUserProfileDto {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
}

/**
 * Profile image upload response
 */
interface ProfileImageUploadResponse {
  profileImage: string;
  user: User;
}

interface ReactNativeFilePart {
  uri: string;
  name: string;
  type: string;
}

/**
 * User location update request
 */
interface UpdateLocationDto {
  latitude: number;
  longitude: number;
  locationName?: string;
  source?: 'gps' | 'network' | 'passive' | 'manual' | 'ip';
}

/**
 * User location update response
 */
interface LocationUpdateResponse {
  latitude: number;
  longitude: number;
  locationName?: string;
  updatedAt: string;
}

// ============================================================================
// Service Implementation
// ============================================================================

class UserService {
  /**
   * Get current user profile
   *
   * ✅ PRODUCTION-GRADE IMPLEMENTATION
   * - Uses canonical BackendApiResponse type
   * - Centralized unwrapping (no manual .data.data access)
   * - Defensive validation with context-rich errors
   * - Type-safe extraction
   *
   * @returns User profile data
   * @throws Error if response is invalid or user data is incomplete
   */
  async getCurrentProfile(): Promise<User> {
    try {
      Logger.info('Fetching current user profile');

      // ────────────────────────────────────────────────────────────────────
      // 1. API CALL - Type matches actual backend response
      // ────────────────────────────────────────────────────────────────────
      const response = await apiClient.get<BackendApiResponse<User>>('/users/profile');

      // ────────────────────────────────────────────────────────────────────
      // 2. UNWRAP RESPONSE - Centralized, safe extraction
      // ────────────────────────────────────────────────────────────────────
      // Before: response.data.data.data (triple-nesting ❌)
      // After:  unwrapBackendResponse() (clean, safe ✅)
      const userData: unknown = unwrapBackendResponse(response, 'user profile fetch');

      // ────────────────────────────────────────────────────────────────────
      // 3. RUNTIME VALIDATION - Ensure critical fields exist
      // ────────────────────────────────────────────────────────────────────
      if (userData === null || typeof userData !== 'object') {
        throw new Error(`Invalid user data: expected object, got ${typeof userData}`);
      }

      const user = userData as Partial<User>;

      // Validate required fields (runtime type guard)
      if (typeof user.userId !== 'string' || user.userId === '') {
        throw new Error('Invalid user data: missing or invalid userId');
      }

      if (typeof user.email !== 'string' || user.email === '') {
        throw new Error('Invalid user data: missing or invalid email');
      }

      // ────────────────────────────────────────────────────────────────────
      // 4. SUCCESS LOGGING
      // ────────────────────────────────────────────────────────────────────
      Logger.info('User profile fetched successfully', {
        userId: user.userId,
        email: `${user.email.substring(0, 3)}***`, // Privacy: partial email
        role: user.role,
        hasLocation: !!user.locationPreferences?.defaultLocation,
      });

      return user as User;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.startsWith('Invalid user data')) {
        Logger.warn('Profile validation failed (stale auth state)', { error: msg });
      } else {
        Logger.error('Failed to fetch user profile', {}, error as Error);
      }
      throw error;
    }
  }

  /**
   * Update user profile
   *
   * ✅ Uses centralized unwrapping (no triple-nesting)
   *
   * @param updates - Partial user data to update
   * @returns Updated user profile
   * @throws Error if update fails or response is invalid
   */
  async updateProfile(updates: UpdateUserProfileDto): Promise<User> {
    try {
      Logger.info('Updating user profile', { fields: Object.keys(updates) });

      const response = await apiClient.patch<BackendApiResponse<User>>('/users/profile', updates);

      // ✅ Clean unwrapping - no manual .data.data access
      const user = unwrapBackendResponse(response, 'user profile update');

      Logger.info('User profile updated successfully', {
        userId: user.userId,
        updatedFields: Object.keys(updates),
      });

      return user;
    } catch (error) {
      Logger.error('Failed to update user profile', {}, error as Error);
      throw error;
    }
  }

  /**
   * Upload profile image
   *
   * ✅ Uses centralized unwrapping (no triple-nesting)
   *
   * @param imageUri - Local image URI (file://, content://, or data:)
   * @returns Updated user profile with new image URL
   * @throws Error if upload fails or response is invalid
   */
  async uploadProfileImage(imageUri: string): Promise<ProfileImageUploadResponse> {
    try {
      Logger.info('Uploading profile image');

      // Create FormData for multipart upload
      const formData = new FormData();

      // Extract filename from URI or generate one
      const filename = imageUri.split('/').pop() ?? 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      const profileImagePart: ReactNativeFilePart = {
        uri: imageUri,
        name: filename,
        type,
      };

      formData.append('profileImage', profileImagePart as unknown as Blob);

      const response = await apiClient.patch<BackendApiResponse<ProfileImageUploadResponse>>(
        '/users/profile/image',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      // ✅ Clean unwrapping - no manual .data.data access
      const result = unwrapBackendResponse(response, 'profile image upload');

      Logger.info('Profile image uploaded successfully', {
        hasProfileImage: !!result.profileImage,
      });

      return result;
    } catch (error) {
      Logger.error('Failed to upload profile image', {}, error as Error);
      throw error;
    }
  }

  /**
   * Update user's last known location
   * Syncs location to backend for cross-device persistence and location-based features
   *
   * ✅ Uses centralized unwrapping (no triple-nesting)
   *
   * @param location - Location coordinates and metadata
   * @returns Updated location data with timestamp
   * @throws Error if update fails or response is invalid
   */
  async updateLocation(location: UpdateLocationDto): Promise<LocationUpdateResponse> {
    try {
      Logger.info('Updating user location', {
        source: location.source ?? 'manual',
        hasLocationName: !!location.locationName,
      });

      const response = await apiClient.patch<BackendApiResponse<LocationUpdateResponse>>(
        '/users/location',
        location,
      );

      // ✅ Clean unwrapping - no manual .data.data access
      const result = unwrapBackendResponse(response, 'user location update');

      Logger.info('User location updated successfully', {
        hasLocationName: !!result.locationName,
      });

      return result;
    } catch (error) {
      Logger.error('Failed to update user location', {}, error as Error);
      throw error;
    }
  }

  /**
   * Update the authenticated user's password (no current password required)
   *
   * @param newPassword - The new password
   */
  async updatePassword(newPassword: string): Promise<void> {
    try {
      Logger.info('Updating password');
      await apiClient.patch('/users/me/password', { newPassword });
      Logger.info('Password updated successfully');
    } catch (error) {
      Logger.error('Failed to update password', {}, error as Error);
      throw error;
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const userService = new UserService();
