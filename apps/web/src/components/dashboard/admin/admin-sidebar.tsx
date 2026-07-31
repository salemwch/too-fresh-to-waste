'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { LogOut, ChevronDown } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';
import { useAuth } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth';
import { resolveProfileImage } from '@/lib/media';
import type { NavGroup } from '@/config/navigation.config';

const COOKIE_NAME = 'admin_sidebar_collapsed';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function readCollapsedFromCookie(serverValue: string[]): Set<string> {
  return new Set(serverValue);
}

function writeCollapsedToCookie(collapsed: Set<string>) {
  const value = JSON.stringify(Array.from(collapsed));
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

interface AdminSidebarProps {
  groups: NavGroup[];
  collapsedGroups: string[];
}

export function AdminSidebar({ groups, collapsedGroups }: AdminSidebarProps) {
  const { logout } = useAuth();
  const t = useTranslations('dashboard');
  const tNav = useTranslations('dashboard.nav');
  const tGroups = useTranslations('dashboard.nav.groups');
  const pathname = usePathname();
  const locale = useLocale();
  const user = useAuthStore(s => s.user);

  const avatar = user
    ? resolveProfileImage(user.profileImage ?? undefined, user.avatar ?? undefined)
    : null;
  const [avatarError, setAvatarError] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    readCollapsedFromCookie(collapsedGroups),
  );

  const activeGroupKey = useMemo(() => {
    for (const group of groups) {
      for (const item of group.items) {
        if (pathname.startsWith(`/${locale}${item.href}`)) {
          return group.groupKey;
        }
      }
    }
    return null;
  }, [groups, pathname, locale]);

  const isGroupOpen = useCallback(
    (groupKey: string) => {
      if (groupKey === activeGroupKey) return true;
      return !collapsed.has(groupKey);
    },
    [collapsed, activeGroupKey],
  );

  function toggleGroup(groupKey: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      writeCollapsedToCookie(next);
      return next;
    });
  }

  const settingsItem = groups.flatMap(g => g.items).find(i => i.titleKey === 'settings');

  const displayGroups = groups.map(g => ({
    ...g,
    items: g.items.filter(i => i.titleKey !== 'settings'),
  }));

  return (
    <aside className='hidden xl:flex flex-col w-72 shrink-0 bg-primary-500 text-white px-[14px] py-[20px] h-full z-30'>
      {/* Brand */}
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
        {/* One line, one size, one colour — same as the merchant sidebar. */}
        <div className='font-display text-[15px] font-semibold leading-tight'>
          Too Fresh to Waste
        </div>
      </div>

      {/* Grouped navigation */}
      <nav className='flex-1 flex flex-col gap-[4px] overflow-y-auto admin-sidebar-scroll'>
        {displayGroups.map(group => {
          const open = isGroupOpen(group.groupKey);

          return (
            <div key={group.groupKey}>
              {/* Section header */}
              <button
                onClick={() => toggleGroup(group.groupKey)}
                className={cn(
                  'w-full flex items-center justify-between px-[12px] py-[6px] text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors rounded-lg',
                  'text-accent-500',
                )}
              >
                <span>{tGroups(group.groupKey)}</span>
                <ChevronDown
                  size={12}
                  className={cn('transition-transform duration-200', !open && '-rotate-90')}
                />
              </button>

              {/* Section items */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
                )}
              >
                <div className='flex flex-col gap-[1px] pb-[6px]'>
                  {group.items.map(item => {
                    const isActive = pathname.startsWith(`/${locale}${item.href}`);
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'relative flex items-center gap-[10px] px-[12px] py-[8px] rounded-xl text-[13px] transition-all',
                          isActive
                            ? 'bg-white/[0.12] text-white font-medium'
                            : 'text-white/90 hover:text-white hover:bg-white/[0.06]',
                        )}
                      >
                        {isActive && (
                          <span className='absolute left-0 top-[6px] bottom-[6px] w-[3px] rounded-r-full bg-brand-coral' />
                        )}
                        <Icon size={15} className='shrink-0' />
                        <span className='flex-1 truncate'>{tNav(item.titleKey)}</span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className='min-w-[18px] h-[18px] rounded-full bg-brand-coral text-white text-[9px] flex items-center justify-center font-medium px-[3px] shrink-0'>
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Bottom: user info + settings + logout */}
      <div className='pt-[14px] border-t border-white/10 flex flex-col gap-[2px]'>
        {user && (
          <Link
            href='/admin/settings'
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
              <div className='text-[11px] text-white/50 truncate'>{user.email}</div>
            </div>
          </Link>
        )}

        {settingsItem && (
          <Link
            href={settingsItem.href}
            className={cn(
              'flex items-center gap-[10px] px-[12px] py-[9px] rounded-xl text-[13px] transition-colors',
              pathname.startsWith(`/${locale}${settingsItem.href}`)
                ? 'bg-white/[0.12] text-white font-medium'
                : 'text-white/90 hover:text-white hover:bg-white/[0.06]',
            )}
          >
            <settingsItem.icon size={16} />
            {tNav('settings')}
          </Link>
        )}

        <button
          onClick={logout}
          className='w-full flex items-center gap-[10px] px-[12px] py-[9px] rounded-xl text-[13px] text-white/90 hover:text-white hover:bg-white/[0.06] transition-colors'
        >
          <LogOut size={16} />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
