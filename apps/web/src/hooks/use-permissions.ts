'use client';

import { useAuthStore } from '@/lib/auth';
import { UserRole } from '@foodwaste/shared';

export function usePermissions() {
  const user = useAuthStore((state) => state.user);

  const hasRole = (role: UserRole) => user?.role === role;

  const hasAnyRole = (roles: UserRole[]) => !!user && roles.includes(user.role);

  const canAccessMerchant = () => hasRole(UserRole.MERCHANT);

  const canAccessAdmin = () =>
    hasAnyRole([UserRole.ADMIN, UserRole.MODERATOR]);

  return {
    user,
    hasRole,
    hasAnyRole,
    canAccessMerchant,
    canAccessAdmin,
  };
}
