'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { UserRole } from '@foodwaste/shared';
import { XCircle } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { useAuthStore } from '@/lib/auth';
import { authService } from '@/services/auth.service';

/**
 * /email-verified
 *
 * Reached via 302 redirect from the backend after it verifies the email
 * and sets HttpOnly auth cookies. The URL carries only ?status=success|error —
 * no PII, no tokens. We immediately render a dashboard-shaped skeleton,
 * silently fetch /auth/me, then push to the correct dashboard by role.
 */

function roleDashboardPath(role: UserRole | undefined, locale: string): string {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.MODERATOR:
      return `/${locale}/admin/dashboard`;
    case UserRole.MERCHANT:
      return `/${locale}/merchant/dashboard`;
    default:
      return `/${locale}`;
  }
}

function DashboardSkeleton() {
  return (
    <div className='fixed inset-0 z-50 flex bg-background'>
      {/* Sidebar */}
      <aside className='hidden w-64 shrink-0 border-r border-border bg-card p-4 lg:block'>
        <div className='mb-6 h-8 w-32 animate-pulse rounded-md bg-muted' />
        <div className='space-y-2'>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className='h-9 w-full animate-pulse rounded-md bg-muted' />
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className='flex-1 overflow-hidden p-4 sm:p-6 lg:p-8'>
        {/* Top bar */}
        <div className='mb-6 flex items-center justify-between'>
          <div className='space-y-2'>
            <div className='h-7 w-48 animate-pulse rounded-md bg-muted' />
            <div className='h-4 w-64 animate-pulse rounded-md bg-muted/60' />
          </div>
          <div className='h-10 w-10 animate-pulse rounded-full bg-muted' />
        </div>

        {/* Stat cards */}
        <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className='h-28 animate-pulse rounded-xl border border-border bg-card p-4'
            />
          ))}
        </div>

        {/* Content blocks */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
          <div className='h-80 animate-pulse rounded-xl border border-border bg-card lg:col-span-2' />
          <div className='h-80 animate-pulse rounded-xl border border-border bg-card' />
        </div>
      </main>
    </div>
  );
}

function EmailVerifiedInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  const setUser = useAuthStore(s => s.setUser);
  const setAuthenticated = useAuthStore(s => s.setAuthenticated);

  const [errored, setErrored] = useState(status === 'error');
  const ranRef = useRef(false);

  useEffect(() => {
    if (status === 'error' || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // Backend has just set HttpOnly cookies — /auth/me is the source of truth.
        const response = await authService.getProfile();
        const user = response.data.data;
        setUser(user);
        setAuthenticated(true);
        router.replace(roleDashboardPath(user?.role, locale));
      } catch {
        setErrored(true);
      }
    })();
  }, [status, router, locale, setUser, setAuthenticated]);

  if (errored) {
    return (
      <div className='fixed inset-0 z-50 flex items-center justify-center bg-background px-4'>
        <div className='w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg'>
          <div className='mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100'>
            <XCircle className='h-8 w-8 text-red-600' />
          </div>
          <h1 className='mb-2 text-2xl font-semibold text-foreground'>{t('verifyFailedTitle')}</h1>
          <p className='mb-6 text-sm text-muted-foreground'>{t('verifyError')}</p>
          <Link
            href='/login'
            className='inline-flex items-center justify-center text-sm font-medium text-primary hover:underline'
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    );
  }

  return <DashboardSkeleton />;
}

export default function EmailVerifiedPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <EmailVerifiedInner />
    </Suspense>
  );
}
