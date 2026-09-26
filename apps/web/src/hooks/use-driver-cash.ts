import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { adminKeys } from '@/hooks/use-admin';
import { adminService } from '@/services/admin.service';

import type { DriverCashQuery, DriverCashReconciliation } from '@/types/admin';

/**
 * Driver cash reconciliation and the admin actions that move it. Model:
 * `.claude/work/commission-settlement-model.md` ("Driver cash"). Every
 * mutation invalidates the whole report: a handover moves several drivers'
 * totals and the fleet total at once.
 */
export function useDriverCashReconciliation(params: DriverCashQuery = {}) {
  return useQuery({
    queryKey: adminKeys.driverCash(params),
    queryFn: async (): Promise<DriverCashReconciliation> => {
      const response = await adminService.getDriverCashReconciliation(params);
      return response.data.data;
    },
    // Money an admin is about to count by hand: refetch on focus, keep short.
    staleTime: 30 * 1000,
  });
}

function useInvalidateDriverCash() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.driverCashAll() });
}

export function useMoveDriverFloat() {
  const invalidate = useInvalidateDriverCash();
  return useMutation({
    mutationFn: (input: {
      driverId: string;
      type: 'ISSUED' | 'RETURNED';
      amount: number;
      reason?: string;
    }) => {
      const { driverId, ...body } = input;
      return adminService.moveDriverFloat(driverId, body);
    },
    onSuccess: () => invalidate(),
  });
}

export function useRecordDriverHandover() {
  const invalidate = useInvalidateDriverCash();
  return useMutation({
    mutationFn: (input: { driverId: string; amount: number; notes?: string }) => {
      const { driverId, ...body } = input;
      return adminService.recordDriverHandover(driverId, body);
    },
    onSuccess: () => invalidate(),
  });
}

export function useResolveDeliveryRecovery() {
  const invalidate = useInvalidateDriverCash();
  return useMutation({
    mutationFn: (input: { orderId: string; recovery: 'RETURNED_TO_MERCHANT' | 'UNRECOVERABLE' }) =>
      adminService.resolveDeliveryRecovery(input.orderId, input.recovery),
    onSuccess: () => invalidate(),
  });
}
