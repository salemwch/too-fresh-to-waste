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
      <div className='flex h-screen overflow-hidden bg-background'>
        {/* Sidebar skeleton */}
        <div className='hidden lg:flex w-56 shrink-0 flex-col gap-sm border-r bg-card p-lg'>
          <Skeleton className='mb-lg h-8 w-36' />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className='h-9 w-full rounded-md' />
          ))}
        </div>
        {/* Main area */}
        <div className='flex flex-1 flex-col overflow-hidden'>
          {/* Header */}
          <div className='flex h-14 shrink-0 items-center gap-md border-b bg-card px-lg'>
            <Skeleton className='h-7 w-7 rounded-md lg:hidden' />
            <Skeleton className='h-5 w-40' />
            <div className='ms-auto flex items-center gap-md'>
              <Skeleton className='h-8 w-8 rounded-full' />
            </div>
          </div>
          {/* Content */}
          <div className='flex-1 space-y-lg p-lg lg:p-[70px]'>
            <Skeleton className='h-6 w-40' />
            <Skeleton className='h-4 w-64' />
            <Skeleton className='mt-sm h-36 w-full max-w-md rounded-lg' />
          </div>
        </div>
      </div>
    );
  }

  // During logout, keep rendering children until navigation completes.
  // Returning null here causes a blank page because store.logout() fires
  // before window.location.replace() unloads the page.
  if (!isAuthenticated && !isLoggingOut) {
    return null;
  }

  return <>{children}</>;
}
