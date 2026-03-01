'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { type UserRole } from '@foodwaste/shared';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGuard({ allowedRoles, children, fallback }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const router = useRouter();
  const locale = useLocale();

  const hasAccess = isAuthenticated && user && allowedRoles.includes(user.role);

  useEffect(() => {
    if (!isLoading && isAuthenticated && !hasAccess) {
      // Authenticated but wrong role — redirect to appropriate dashboard
      router.replace(`/${locale}`);
    }
  }, [isLoading, isAuthenticated, hasAccess, router, locale]);

  if (isLoading) {
    return null;
  }

  if (!hasAccess) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
