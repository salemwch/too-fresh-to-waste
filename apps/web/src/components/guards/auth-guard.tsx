'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuthStore } from '@/lib/auth';
import { Skeleton } from '@foodwaste/ui';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, isLoggingOut } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    // Skip redirect during logout — the logout handler owns that navigation
    if (!isLoading && !isAuthenticated && !isLoggingOut) {
      const callbackUrl = encodeURIComponent(pathname);
      router.replace(`/${locale}/login?callbackUrl=${callbackUrl}`);
    }
  }, [isAuthenticated, isLoading, isLoggingOut, router, pathname, locale]);

  if (isLoading) {
    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar skeleton */}
        <div className="hidden lg:flex w-56 shrink-0 flex-col gap-2 border-r bg-card p-4">
          <Skeleton className="mb-4 h-8 w-36" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
            <Skeleton className="h-7 w-7 rounded-md lg:hidden" />
            <Skeleton className="h-5 w-40" />
            <div className="ml-auto flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
          {/* Content */}
          <div className="flex-1 space-y-4 p-4 lg:p-[70px]">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-2 h-36 w-full max-w-md rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
