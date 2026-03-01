'use client';

import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/lib/auth';

export function useCurrentUser() {
  const { accessToken, setUser, setLoading } = useAuthStore();

  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await authService.getProfile();
      const user = response.data.data;
      setUser(user);
      return user;
    },
    enabled: !!accessToken,
    retry: false,
    staleTime: 5 * 60 * 1000,
    meta: {
      onSettled: () => setLoading(false),
    },
  });
}
