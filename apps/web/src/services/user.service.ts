import { apiClient } from '@/lib/api-client';
import type {
  ApiResponse,
  UserResponse,
  UserPreferences,
  UpdateProfileRequest,
} from '@foodwaste/shared';

const USERS_BASE = '/users';

export const userService = {
  getProfile() {
    return apiClient.get<ApiResponse<UserResponse>>(`${USERS_BASE}/profile`);
  },

  updateProfile(data: UpdateProfileRequest) {
    return apiClient.patch<ApiResponse<UserResponse>>(`${USERS_BASE}/profile`, data);
  },

  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('profileImage', file);
    return apiClient.patch<ApiResponse<{ profileImage: string }>>(
      `${USERS_BASE}/profile/image`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
  },

  getPreferences() {
    return apiClient.get<ApiResponse<UserPreferences>>(`${USERS_BASE}/preferences`);
  },

  updatePreferences(data: Partial<UserPreferences>) {
    return apiClient.patch<ApiResponse<UserPreferences>>(`${USERS_BASE}/preferences`, data);
  },

  changePassword(currentPassword: string, newPassword: string) {
    return apiClient.patch<ApiResponse<void>>(`${USERS_BASE}/me/password`, {
      currentPassword,
      newPassword,
    });
  },
};
