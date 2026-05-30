'use client';

import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Building2, Users } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { cn } from '@foodwaste/ui';

const tabs = [
  { label: 'Locations', href: '/merchant/organization', icon: Building2 },
  { label: 'Team Members', href: '/merchant/organization/members', icon: Users },
];

export default function OrganizationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();

  return (
    <div className='space-y-6'>
      <div className='flex gap-1 border-b border-border'>
        {tabs.map(tab => {
          const fullHref = `/${locale}${tab.href}`;
          const isActive =
            tab.href === '/merchant/organization'
              ? pathname === fullHref
              : pathname.startsWith(fullHref);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className='size-4' />
              {tab.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
