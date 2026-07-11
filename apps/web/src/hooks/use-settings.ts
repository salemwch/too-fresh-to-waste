'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services/settings.service';
import type {
  UserProfile,
  UpdateProfilePayload,
  ChangePasswordPayload,
  ActiveSession,
  MfaStatus,
} from '@/types/settings';

export const settingsKeys = {
  all: ['settings'] as const,
  profile: () => [...settingsKeys.all, 'profile'] as const,
  sessions: () => [...settingsKeys.all, 'sessions'] as const,
  mfaStatus: () => [...settingsKeys.all, 'mfa-status'] as const,
};

export function useProfile() {
  return useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async (): Promise<UserProfile> => {
      const response = await settingsService.getProfile();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => settingsService.updateProfile(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.profile() });
    },
  });
}

export function useUploadProfileImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => settingsService.uploadProfileImage(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.profile() });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => settingsService.changePassword(payload),
  });
}

export function useSessions() {
  return useQuery({
    queryKey: settingsKeys.sessions(),
    queryFn: async (): Promise<ActiveSession[]> => {
      const response = await settingsService.getSessions();
      return response.data.data;
    },
    staleTime: 60 * 1000,
  });
}

export function useTerminateSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => settingsService.terminateSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.sessions() });
    },
  });
}

export function useLogoutAll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => settingsService.logoutAll(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: settingsKeys.sessions() });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => settingsService.deleteAccount(),
  });
}

export function useMfaStatus() {
  return useQuery({
    queryKey: settingsKeys.mfaStatus(),
    queryFn: async (): Promise<MfaStatus> => {
      const response = await settingsService.getMfaStatus();
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
