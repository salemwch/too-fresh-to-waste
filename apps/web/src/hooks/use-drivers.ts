'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import type { CreateDriverPayload } from '@/services/admin.service';

export const driverKeys = {
  all: ['drivers'] as const,
};

export function useDrivers() {
  return useQuery({
    queryKey: driverKeys.all,
    queryFn: async () => {
      const res = await adminService.getDrivers();
      return res.data.data;
    },
  });
}

export function useCreateDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateDriverPayload) => {
      const res = await adminService.createDriver(payload);
      return res.data.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: driverKeys.all });
    },
  });
}
