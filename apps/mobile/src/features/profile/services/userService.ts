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

import { apiClient, type ApiResponseWrapper } from '@/services/apiClient';
import { Logger } from '@/utils/logger';

import type { User } from '@/features/auth/types';

// ============================================================================
// Types
// ============================================================================

/**
 * User profile update request
 * All fields are optional - only send fields you want to update
 */
export interface UpdateUserProfileDto {
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
export interface ProfileImageUploadResponse {
  profileImage: string;
  user: User;
}

/**
 * User location update request
 */
export interface UpdateLocationDto {
  latitude: number;
  longitude: number;
  locationName?: string;
  source?: 'gps' | 'network' | 'passive' | 'manual' | 'ip';
}

/**
 * User location update response
 */
export interface LocationUpdateResponse {
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
   * @returns User profile data
   */
  async getCurrentProfile(): Promise<User> {
    try {
      Logger.info('Fetching current user profile');

      const response = await apiClient.get<
        ApiResponseWrapper<{ message: string; data: User }>
      >('/users/profile');

      // Backend wraps response: { statusCode, data: { message, data: User }, timestamp }
      // Defensive check for response structure
      if (!response?.data?.data?.data) {
        Logger.error('Invalid profile response structure', { response });
        throw new Error('Invalid response structure from server');
      }

      const user = response.data.data.data;

      Logger.info('User profile fetched successfully', {
        userId: user?.userId || 'unknown',
        hasLocation: !!user?.locationPreferences?.defaultLocation
      });
      return user;
    } catch (error) {
      Logger.error('Failed to fetch user profile', {}, error as Error);
      throw error;
    }
  }

  /**
   * Update user profile
   * @param updates - Partial user data to update
   * @returns Updated user profile
   */
  async updateProfile(updates: UpdateUserProfileDto): Promise<User> {
    try {
      Logger.info('Updating user profile', { fields: Object.keys(updates) });

      const response = await apiClient.patch<
        ApiResponseWrapper<{ message: string; data: User }>
      >('/users/profile', updates);

      // Backend wraps response: { statusCode, data: { message, data: User }, timestamp }
      const user = response.data.data.data;

      Logger.info('User profile updated successfully', { userId: user.userId });
      return user;
    } catch (error) {
      Logger.error('Failed to update user profile', {}, error as Error);
      throw error;
    }
  }

  /**
   * Upload profile image
   * @param imageUri - Local image URI (file://, content://, or data:)
   * @returns Updated user profile with new image URL
   */
  async uploadProfileImage(imageUri: string): Promise<ProfileImageUploadResponse> {
    try {
      Logger.info('Uploading profile image');

      // Create FormData for multipart upload
      const formData = new FormData();

      // Extract filename from URI or generate one
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('profileImage', {
        uri: imageUri,
        name: filename,
        type,
      } as any);

      const response = await apiClient.patch<
        ApiResponseWrapper<{ message: string; data: ProfileImageUploadResponse }>
      >('/users/profile/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Backend wraps response: { statusCode, data: { message, data: {...} }, timestamp }
      const result = response.data.data.data;

      Logger.info('Profile image uploaded successfully');
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
   * @param location - Location coordinates and metadata
   * @returns Updated location data with timestamp
   */
  async updateLocation(location: UpdateLocationDto): Promise<LocationUpdateResponse> {
    try {
      Logger.info('Updating user location', {
        source: location.source || 'manual',
        hasLocationName: !!location.locationName,
      });

      const response = await apiClient.patch<
        ApiResponseWrapper<{ message: string; data: LocationUpdateResponse }>
      >('/users/location', location);

      // Backend wraps response: { statusCode, data: { message, data: {...} }, timestamp }
      const result = response.data.data.data;

      Logger.info('User location updated successfully');
      return result;
    } catch (error) {
      Logger.error('Failed to update user location', {}, error as Error);
      throw error;
    }
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const userService = new UserService();
