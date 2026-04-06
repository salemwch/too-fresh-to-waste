'use client';

import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { LanguageSwitcherCompact } from '@/components/LanguageSwitcher';
import { MobileNav } from './mobile-nav';
import { Breadcrumbs } from './breadcrumbs';
import { UserNav } from './user-nav';
import { NotificationBell } from './notification-panel';
import { DonationDropdown } from './donation-dropdown';
import type { NavItem } from '@/config/navigation.config';

interface DashboardHeaderProps {
  navItems: NavItem[];
}

export function DashboardHeader({ navItems }: DashboardHeaderProps) {
  const t = useTranslations('dashboard');

  return (
    <header className='shrink-0 z-40 bg-white border-b border-slate-100 px-3 lg:px-5 py-1 lg:py-2 flex items-center justify-between gap-2'>
      {/* Left: Mobile nav + title */}
      <div className='flex items-center gap-1.5'>
        <MobileNav items={navItems} />
        <div className='hidden sm:block'>
          <Breadcrumbs />
        </div>
      </div>

      {/* Center: Search bar */}
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

      {/* Right: Actions + Profile */}
      <div className='flex items-center gap-1.5'>
        <LanguageSwitcherCompact className='w-7 h-7 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors text-slate-600' />

        {/* Notification bell */}
        <NotificationBell />

        {/* Donation pool dropdown */}
        <DonationDropdown />

        {/* Profile dropdown */}
        <div className='hidden sm:flex items-center pl-2 border-l border-slate-200'>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
