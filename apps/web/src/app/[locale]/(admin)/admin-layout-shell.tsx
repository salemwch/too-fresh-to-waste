'use client';

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
import { adminNavGroups } from '@/config/navigation.config';
import { UserRole } from '@foodwaste/shared';

interface AdminLayoutShellProps {
  children: React.ReactNode;
  collapsedGroups: string[];
}

function AdminHeader() {
  const t = useTranslations('dashboard');

  return (
    <header className='shrink-0 z-40 bg-white border-b border-slate-100 px-3 lg:px-5 py-1 lg:py-2 flex items-center justify-between gap-2'>
      <div className='flex items-center gap-1.5'>
        <AdminMobileNav groups={adminNavGroups} />
        <div className='hidden sm:block'>
          <Breadcrumbs />
        </div>
      </div>

      <div className='flex-1 max-w-sm mx-2 hidden md:block'>
        <div className='relative group'>
          <Search className='absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-primary-500' />
          <input
            type='text'
            placeholder={t('search')}
            className='w-full bg-slate-50 border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent transition-all'
          />
        </div>
      </div>

      <div className='flex items-center gap-1.5'>
        <LanguageSwitcherCompact className='w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600' />
        <NotificationBell />
        <div className='hidden sm:flex items-center pl-2 border-l border-slate-200'>
          <UserNav />
        </div>
      </div>
    </header>
  );
}

export function AdminLayoutShell({ children, collapsedGroups }: AdminLayoutShellProps) {
  return (
    <AuthGuard>
      <RoleGuard allowedRoles={[UserRole.ADMIN, UserRole.MODERATOR]}>
        <div className='fixed inset-0 flex bg-background'>
          <AdminSidebar groups={adminNavGroups} collapsedGroups={collapsedGroups} />

          <div className='flex flex-1 flex-col min-w-0'>
            <AdminHeader />
            <main className='flex-1 overflow-y-auto overscroll-contain min-h-0 p-4 lg:p-6'>
              {children}
            </main>
          </div>
        </div>
      </RoleGuard>
    </AuthGuard>
  );
}
