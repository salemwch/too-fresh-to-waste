'use client';

import { LogOut } from 'lucide-react';
import { SidebarNav } from './sidebar-nav';
import type { NavItem } from '@/config/navigation.config';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';

interface SidebarProps {
  items: NavItem[];
}

export function Sidebar({ items }: SidebarProps) {
  const { logout } = useAuth();
  const t = useTranslations('dashboard');

  return (
    <aside className="hidden xl:flex w-64 flex-col border-r border-slate-100 bg-white flex-shrink-0">
      {/* Navigation */}
      <div className="flex-1 overflow-y-auto overscroll-contain py-3">
        <SidebarNav items={items} />
      </div>

      {/* Log Out button */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
