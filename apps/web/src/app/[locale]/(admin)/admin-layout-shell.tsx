'use client';

import { useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { AuthGuard } from '@/components/guards/auth-guard';
import { RoleGuard } from '@/components/guards/role-guard';
import { AdminSidebar } from '@/components/dashboard/admin/admin-sidebar';
import { AdminMobileNav } from '@/components/dashboard/admin/admin-mobile-nav';
import { LanguageSwitcherCompact } from '@/components/LanguageSwitcher';
import { Breadcrumbs } from '@/components/dashboard/breadcrumbs';
import { UserNav } from '@/components/dashboard/user-nav';
import { NotificationBell } from '@/components/dashboard/notification-panel';
import {
  adminNavGroups,
  filterNavGroupsByRole,
  isNavPathAllowedForRole,
} from '@/config/navigation.config';
import { usePathname, useRouter } from '@/i18n/routing';
import { useAuthStore } from '@/lib/auth';
import { UserRole } from '@foodwaste/shared';
import type { NavGroup } from '@/config/navigation.config';

interface AdminLayoutShellProps {
  children: React.ReactNode;
  collapsedGroups: string[];
}

function AdminHeader({ navGroups }: { navGroups: NavGroup[] }) {
  const t = useTranslations('dashboard');

  return (
    <header className='shrink-0 z-40 bg-white border-b border-slate-100 px-md lg:px-xl py-xs lg:py-sm flex items-center justify-between gap-sm'>
      <div className='flex items-center gap-1.5'>
        <AdminMobileNav groups={navGroups} />
        <div className='hidden sm:block'>
          <Breadcrumbs />
        </div>
      </div>

      <div className='flex-1 max-w-sm mx-sm hidden md:block'>
        <div className='relative group'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary-500' />
          <input
            type='text'
            placeholder={t('search')}
            className='w-full bg-slate-50 border border-slate-200 rounded-md ps-4xl pe-md py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent transition-all'
          />
        </div>
      </div>

      <div className='flex items-center gap-1.5'>
        <LanguageSwitcherCompact className='w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600' />
        <NotificationBell />
        <div className='hidden sm:flex items-center ps-sm border-l border-slate-200'>
          <UserNav />
        </div>
      </div>
    </header>
  );
}

export function AdminLayoutShell({ children, collapsedGroups }: AdminLayoutShellProps) {
  const { user } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();

  // Memoised because it rebuilds every group and item array: a fresh identity on
  // each render would defeat any memoisation inside the sidebar and mobile nav.
  const navGroups = useMemo(() => filterNavGroupsByRole(adminNavGroups, user?.role), [user?.role]);

  // Hiding a link stops the accident; this stops the typed URL. Waits for the
  // user to resolve, otherwise the first render — before auth rehydrates —
  // would bounce an admin off their own page.
  const isAllowed = user ? isNavPathAllowedForRole(adminNavGroups, pathname, user.role) : true;

  useEffect(() => {
    if (!isAllowed) router.replace('/admin/dashboard');
  }, [isAllowed, router]);

  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
        <div className='fixed inset-0 flex bg-background'>
          <AdminSidebar groups={navGroups} collapsedGroups={collapsedGroups} />

          <div className='flex flex-1 flex-col min-w-0'>
            <AdminHeader navGroups={navGroups} />
            <main className='flex-1 overflow-y-auto overscroll-contain min-h-0 p-lg lg:p-2xl'>
              {/* Withheld while the redirect above runs, so a forbidden page never
                  paints — and never fires its data hooks into a wall of 403s. */}
              {isAllowed ? children : null}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
