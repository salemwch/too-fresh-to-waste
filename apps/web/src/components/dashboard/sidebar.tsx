'use client';

import { useState } from 'react';
import Image from 'next/image';
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
  const isMerchantOrLM = useAuthStore(
    s => s.user?.role === UserRole.MERCHANT || s.user?.role === UserRole.LOCATION_MANAGER,
  );
  const { data: draftOfferCount = 0 } = useOfferStatusCount('draft', isMerchantOrLM);

  const avatar = user
    ? resolveProfileImage(user.profileImage ?? undefined, user.avatar ?? undefined)
    : null;
  const [avatarError, setAvatarError] = useState(false);

  const mainItems = items.filter(i => i.titleKey !== 'settings');
  const settingsItem = items.find(i => i.titleKey === 'settings');

  return (
    <aside className='hidden xl:flex flex-col w-72 shrink-0 bg-primary-500 text-white px-[14px] py-[20px] sticky top-0 h-screen z-30'>
      {/* Brand — compact inline logo */}
      <div className='flex items-center gap-[10px] mb-[18px] px-[6px]'>
        <div className='h-[34px] w-[34px] shrink-0 grid place-items-center'>
          <Image
            src='/images/white-leaf-logo.png'
            alt='Too Fresh to Waste'
            width={34}
            height={34}
            className='object-contain'
          />
        </div>
        {/* One line, one size, one colour. It was split across two lines with
            "to Waste" at 11px in white/55, which read as a tagline under a
            product called "Too Fresh" rather than as the brand name. */}
        <div className='font-display text-[15px] font-semibold leading-tight'>
          Too Fresh to Waste
        </div>
      </div>

      {/* Navigation — no scroll */}
      <nav className='flex-1 flex flex-col gap-[2px] overflow-hidden'>
        {mainItems.map(item => {
          const isActive = pathname.startsWith(`/${locale}${item.href}`);
          const Icon = item.icon;
          const badge = getBadge(item, unreadOrderCount, draftOfferCount);
          const isPro =
            item.titleKey === 'esg' || item.titleKey === 'analytics' || item.titleKey === 'reviews';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'relative flex items-center gap-[10px] px-[12px] py-[9px] rounded-xl text-[13px] transition-all',
                isActive
                  ? 'bg-white/[0.1] text-white'
                  : 'text-white/75 hover:text-white hover:bg-white/[0.06]',
              )}
            >
              {isActive && (
                <span className='absolute left-0 top-[7px] bottom-[7px] w-[3px] rounded-r-full bg-brand-coral' />
              )}
              <Icon size={16} className='shrink-0' />
              <span className='flex-1 truncate'>{tNav(item.titleKey)}</span>
              {isPro && (
                <span className='text-xs font-bold px-[5px] py-[2px] rounded border border-gold/50 text-gold leading-none shrink-0 tracking-wide'>
                  PRO
                </span>
              )}
              {badge !== null && (
                <span className='min-w-[18px] h-[18px] rounded-full bg-brand-coral text-white text-xs flex items-center justify-center font-medium px-[3px] shrink-0'>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: user info + settings + logout */}
      <div className='pt-[14px] border-t border-white/10 flex flex-col gap-[2px]'>
        {user && (
          <Link
            href='/merchant/profile'
            className='flex items-center gap-[10px] px-[12px] py-[8px] mb-[4px] rounded-xl hover:bg-white/[0.06] transition-colors group'
          >
            {avatar && !avatarError ? (
              <img
                src={avatar}
                alt={user.firstName}
                className='h-[30px] w-[30px] rounded-full object-cover shrink-0'
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className='h-[30px] w-[30px] rounded-full bg-white/20 grid place-items-center text-[11px] font-semibold shrink-0'>
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
            )}
            <div className='min-w-0 flex-1'>
              <div className='text-[13px] font-medium text-white truncate group-hover:text-white/90'>
                {user.firstName} {user.lastName}
              </div>
              <div className='text-[11px] text-white/75 truncate'>{user.email}</div>
            </div>
          </Link>
        )}

        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={cn(
              'flex items-center gap-[10px] px-[12px] py-[9px] rounded-xl text-[13px] transition-colors',
              pathname.startsWith(`/${locale}${settingsItem.href}`)
                ? 'bg-white/[0.1] text-white'
                : 'text-white/75 hover:text-white hover:bg-white/[0.06]',
            )}
          >
            <settingsItem.icon size={16} />
            {tNav('settings')}
          </Link>
        )}

        <button
          onClick={logout}
          className='w-full flex items-center gap-[10px] px-[12px] py-[9px] rounded-xl text-[13px] text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors'
        >
          <LogOut size={16} />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
