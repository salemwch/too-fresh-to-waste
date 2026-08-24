'use client';

import { useSearchParams } from 'next/navigation';
import { usePathname } from '@/i18n/routing';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';

export interface AdminTab {
  key: string;
  label: string;
  badge?: number;
}

interface AdminTabNavProps {
  tabs: AdminTab[];
  paramName?: string;
}

export function AdminTabNav({ tabs, paramName = 'tab' }: AdminTabNavProps) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentTab = searchParams.get(paramName) ?? tabs[0]?.key;

  return (
    <div className='border-b border-border/60'>
      {/*
        Plain navigation, not an ARIA tablist. These entries are links that
        change the URL; the ARIA tab pattern additionally requires a tabpanel,
        aria-controls and roving tabindex, none of which exist here. Claiming
        role='tab'/'tablist' told screen readers to expect behaviour the
        component does not implement — aria-current='page' is what actually
        describes it.
      */}
      <nav className='flex gap-0'>
        {tabs.map(tab => {
          const isActive = currentTab === tab.key;
          const href = tab.key === tabs[0]?.key ? pathname : `${pathname}?${paramName}=${tab.key}`;

          return (
            <Link
              key={tab.key}
              href={href}
              {...(isActive ? { 'aria-current': 'page' as const } : {})}
              className={cn(
                'relative px-lg py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className='flex items-center gap-1.5'>
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span
                    className={cn(
                      'min-w-[18px] h-[18px] rounded-full text-[10px] flex items-center justify-center font-medium px-xs',
                      isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {tab.badge > 99 ? '99+' : tab.badge}
                  </span>
                )}
              </span>
              {isActive && (
                <span className='absolute bottom-0 inset-x-0 h-[2px] bg-primary rounded-t-full' />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
