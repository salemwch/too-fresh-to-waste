import { apiClient } from '@/lib/api-client';
import type { BackendEnvelope } from '@/types/dashboard';
import type {
  UserProfile,
  UpdateProfilePayload,
  ChangePasswordPayload,
  ActiveSessionsResponse,
  MfaStatus,
} from '@/types/settings';

export const settingsService = {
  getProfile() {
    return apiClient.get<BackendEnvelope<UserProfile>>('/users/profile');
  },

  updateProfile(payload: UpdateProfilePayload) {
    return apiClient.patch<BackendEnvelope<UserProfile>>('/users/profile', payload);
  },

  uploadProfileImage(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.patch<BackendEnvelope<UserProfile>>('/users/profile/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  changePassword(payload: ChangePasswordPayload) {
    return apiClient.patch<BackendEnvelope<{ message: string }>>('/users/me/password', payload);
  },

  getSessions() {
    return apiClient.get<BackendEnvelope<ActiveSessionsResponse>>('/auth/sessions');
  },

  terminateSession(sessionId: string) {
    return apiClient.post<BackendEnvelope<{ message: string }>>(
      `/auth/terminate-session/${sessionId}`,
    );
  },

  logoutAll() {
    return apiClient.post<BackendEnvelope<{ message: string }>>('/auth/logout-all');
  },

  deleteAccount() {
    return apiClient.delete<BackendEnvelope<{ message: string }>>('/auth/me');
  },

  getMfaStatus() {
    return apiClient.get<BackendEnvelope<MfaStatus>>('/auth/mfa/status');
  },
};
