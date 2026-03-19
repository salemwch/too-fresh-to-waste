'use client';

import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';
import { useNotificationStore } from '@/lib/notification-store';
import { useOfferStatusCount } from '@/hooks/use-merchant-dashboard';
import type { NavItem } from '@/config/navigation.config';

interface SidebarNavProps {
  items: NavItem[];
  collapsed?: boolean;
}

export function SidebarNav({ items, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('dashboard.nav');
  const unreadOrderCount = useNotificationStore((s) => s.unreadCount);
  const { data: draftOfferCount = 0 } = useOfferStatusCount('draft');

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {items.map((item) => {
        const isActive = pathname.startsWith(`/${locale}${item.href}`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors group',
              isActive
                ? 'bg-primary-500 text-white shadow-md shadow-primary-900/10'
                : 'text-slate-500 hover:bg-slate-50',
            )}
            title={collapsed ? t(item.titleKey) : undefined}
          >
            <div className="flex items-center gap-2.5">
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive
                    ? 'text-white'
                    : 'text-slate-400 group-hover:text-slate-600',
                )}
              />
              {!collapsed && <span>{t(item.titleKey)}</span>}
            </div>
            {!collapsed && (() => {
              // Orders: live unread count (red — urgent).
              if (item.titleKey === 'orders' && unreadOrderCount > 0) {
                return (
                  <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-medium">
                    {unreadOrderCount > 99 ? '99+' : unreadOrderCount}
                  </span>
                );
              }
              // Offers: draft count (amber — needs attention).
              if (item.titleKey === 'offers' && draftOfferCount > 0) {
                return (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-medium">
                    {draftOfferCount > 99 ? '99+' : draftOfferCount}
                  </span>
                );
              }
              // Static badge from nav config.
              if (item.badge) {
                return (
                  <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-medium">
                    {item.badge}
                  </span>
                );
              }
              return null;
            })()}
          </Link>
        );
      })}
    </nav>
  );
}
