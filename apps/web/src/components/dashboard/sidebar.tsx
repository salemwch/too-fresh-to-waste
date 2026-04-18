'use client';

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth';
import { useNotificationStore } from '@/lib/notification-store';
import { useOfferStatusCount } from '@/hooks/use-merchant-dashboard';
import { resolveProfileImage } from '@/lib/media';
import { UserRole } from '@foodwaste/shared';
import type { NavItem } from '@/config/navigation.config';

interface SidebarProps {
  items: NavItem[];
}

function getBadge(item: NavItem, unreadOrders: number, draftOffers: number): number | null {
  if (item.titleKey === 'orders' && unreadOrders > 0) return unreadOrders;
  if (item.titleKey === 'offers' && draftOffers > 0) return draftOffers;
  if (item.badge) return item.badge;
  return null;
}

export function Sidebar({ items }: SidebarProps) {
  const { logout } = useAuth();
  const t = useTranslations('dashboard');
  const tNav = useTranslations('dashboard.nav');
  const pathname = usePathname();
  const locale = useLocale();
  const user = useAuthStore(s => s.user);
  const unreadOrderCount = useNotificationStore(s => s.unreadCount);
  const isMerchant = useAuthStore(s => s.user?.role === UserRole.MERCHANT);
  const { data: draftOfferCount = 0 } = useOfferStatusCount('draft', isMerchant);

  const avatar = user
    ? resolveProfileImage(user.profileImage ?? undefined, user.avatar ?? undefined)
    : null;

  // Settings item rendered separately at the bottom
  const mainItems = items.filter(i => i.titleKey !== 'settings');
  const settingsItem = items.find(i => i.titleKey === 'settings');

  return (
    <aside className='hidden xl:flex flex-col w-72 shrink-0 bg-primary-500 text-white p-[24px] sticky top-0 h-screen z-30'>
      {/* Brand logo */}
      <div className='flex items-center gap-3 mb-10'>
        <div className='h-10 w-10 rounded-xl bg-brand-coral grid place-items-center text-white font-display text-lg font-bold shrink-0'>
          T
        </div>
        <div>
          <div className='font-display text-lg leading-tight'>Too Fresh</div>
          <div className='text-xs opacity-70 -mt-0.5'>to Waste · Merchant</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className='flex-1 space-y-1 overflow-y-auto overscroll-contain'>
        {mainItems.map(item => {
          const isActive = pathname.startsWith(`/${locale}${item.href}`);
          const Icon = item.icon;
          const badge = getBadge(item, unreadOrderCount, draftOfferCount);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-3 px-[16px] py-3 rounded-xl text-sm transition-all',
                isActive
                  ? 'bg-white/[0.08] shadow-glow-coral text-white'
                  : 'text-white/70 hover:text-white hover:bg-white/5',
              )}
            >
              {isActive && (
                <span className='absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-brand-coral' />
              )}
              <Icon className='h-[18px] w-[18px] shrink-0' size={18} />
              <span className='flex-1 text-left'>{tNav(item.titleKey)}</span>
              {badge !== null && (
                <span className='min-w-[20px] h-5 rounded-full bg-brand-coral text-white text-[10px] flex items-center justify-center font-medium px-1 shrink-0'>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section: user info + settings + logout */}
      <div className='mt-[24px] pt-[24px] border-t border-white/10 space-y-1'>
        {/* User info */}
        {user && (
          <div className='flex items-center gap-3 px-[16px] py-3 mb-1'>
            {avatar ? (
              <img
                src={avatar}
                alt={user.firstName}
                className='h-8 w-8 rounded-full object-cover shrink-0'
              />
            ) : (
              <div className='h-8 w-8 rounded-full bg-white/20 grid place-items-center text-xs font-semibold shrink-0'>
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
            )}
            <div className='min-w-0 flex-1'>
              <div className='text-sm font-medium text-white truncate'>
                {user.firstName} {user.lastName}
              </div>
              <div className='text-[11px] text-white/60 truncate'>{user.email}</div>
            </div>
          </div>
        )}

        {/* Settings nav item */}
        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={cn(
              'flex items-center gap-3 px-[16px] py-2.5 rounded-xl text-sm transition-colors',
              pathname.startsWith(`/${locale}${settingsItem.href}`)
                ? 'bg-white/[0.08] text-white'
                : 'text-white/70 hover:text-white hover:bg-white/5',
            )}
          >
            <settingsItem.icon size={18} />
            {tNav('settings')}
          </Link>
        )}

        {/* Logout */}
        <button
          onClick={logout}
          className='w-full flex items-center gap-3 px-[16px] py-2.5 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors'
        >
          <LogOut size={18} />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
